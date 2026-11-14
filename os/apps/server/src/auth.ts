import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { Config } from "./config.ts";
import type { Store } from "./db.ts";
import { AppError } from "./errors.ts";

const digest = (value: string) => createHash("sha256").update(value).digest();
const userId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks a Neon Auth JWT. Neon Auth signs with EdDSA, sets `iss` and `aud` to the
 * origin of the auth URL, and `sub` to the user's id. Tokens last 15 minutes.
 * See https://neon.com/docs/auth/guides/plugins/jwt
 */
export class NeonVerifier {
  private readonly origin: string;
  constructor(
    baseUrl: string,
    private readonly keys: JWTVerifyGetKey,
  ) {
    this.origin = new URL(baseUrl).origin;
  }
  async owner(token: string): Promise<string> {
    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
    try {
      ({ payload } = await jwtVerify(token, this.keys, {
        algorithms: ["EdDSA"],
        issuer: this.origin,
        requiredClaims: ["exp", "sub"],
        clockTolerance: 5,
      }));
    } catch (error) {
      // Never log the token or the reason text: it can echo the token's claims.
      const expired = (error as { code?: string }).code === "ERR_JWT_EXPIRED";
      throw new AppError(expired ? "Session expired. Sign in again." : "Sign in to Debo", 401);
    }
    const audience = [payload.aud ?? []].flat();
    if (audience.length && !audience.includes(this.origin))
      throw new AppError("Sign in to Debo", 401);
    // Reserved owners ("system", "local-user") are not uuids, so no account can ever claim them.
    if (typeof payload.sub !== "string" || !userId.test(payload.sub))
      throw new AppError("Sign in to Debo", 401);
    return payload.sub.toLowerCase();
  }
}

export class Auth {
  constructor(
    private readonly db: Store,
    private readonly config: Config,
    private readonly signingKey: string,
    private readonly neon?: NeonVerifier,
  ) {}
  /** True when each person signs in with their own Neon Auth account. */
  get perUser() {
    return Boolean(this.neon);
  }
  async session(accessKey?: string) {
    if (this.neon) throw new AppError("Sign in with your Debo account", 400);
    if (
      this.config.mode === "live" &&
      (!accessKey ||
        !this.config.accessKey ||
        !timingSafeEqual(digest(accessKey), digest(this.config.accessKey)))
    )
      throw new AppError("Access key is incorrect", 401);
    const token = randomBytes(32).toString("base64url");
    await this.db.put("system", "sessions", {
      id: digest(token).toString("hex"),
      owner: "local-user",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
    return { token, mode: this.config.mode };
  }
  async owner(authorization?: string) {
    if (!authorization?.startsWith("Bearer ")) throw new AppError("Sign in to Debo", 401);
    if (this.neon) return this.neon.owner(authorization.slice(7).trim());
    const id = digest(authorization.slice(7)).toString("hex");
    const session = await this.db.get<{ owner: string; expiresAt: number }>(
      "system",
      "sessions",
      id,
    );
    if (!session || session.expiresAt < Date.now()) {
      // Expired sessions can never be valid again, so drop the row instead of keeping it forever.
      // Best-effort: a failed cleanup must not turn the rejection into a 5xx.
      if (session) await this.db.remove("system", "sessions", id).catch(() => {});
      throw new AppError("Session expired. Sign in again.", 401);
    }
    return session.owner;
  }
  async revoke(authorization?: string) {
    // Neon Auth owns the session. The app signs out there, and a JWT expires on its own.
    if (this.neon) return;
    if (authorization?.startsWith("Bearer "))
      await this.db.remove("system", "sessions", digest(authorization.slice(7)).toString("hex"));
  }
  sign(owner: string, path: string) {
    const expires = String(Date.now() + 15 * 60 * 1000);
    const signature = createHmac("sha256", this.signingKey)
      .update(`${owner}\n${path}\n${expires}`)
      .digest("hex");
    return `${this.config.publicUrl}${path}?owner=${encodeURIComponent(owner)}&expires=${expires}&signature=${signature}`;
  }
  verify(url: URL) {
    const owner = url.searchParams.get("owner") ?? "";
    const expires = url.searchParams.get("expires") ?? "";
    const signature = url.searchParams.get("signature") ?? "";
    if (
      !owner ||
      !/^\d+$/.test(expires) ||
      Number(expires) < Date.now() ||
      !/^\w{64}$/.test(signature)
    )
      throw new AppError("Document link expired; refresh the workspace", 401);
    const expected = createHmac("sha256", this.signingKey)
      .update(`${owner}\n${url.pathname}\n${expires}`)
      .digest("hex");
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
      throw new AppError("Invalid access link", 403);
    return owner;
  }
}
export async function createAuth(
  db: Store,
  config: Config,
  options: { jwks?: JWTVerifyGetKey } = {},
) {
  await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  // Hosts without a persistent disk (Cloudflare Containers) set SESSION_SIGNING_KEY,
  // otherwise every restart would mint a new key and sign everyone out.
  const key =
    process.env.SESSION_SIGNING_KEY?.trim() ||
    (await readOrCreate(join(config.dataDir, "session-signing-key"), () =>
      randomBytes(32).toString("base64"),
    ));
  let neon: NeonVerifier | undefined;
  if (config.authMode === "neon") {
    if (!config.neonAuthBaseUrl) throw new Error("Neon sign-in needs NEON_AUTH_BASE_URL");
    const keys =
      options.jwks ??
      createRemoteJWKSet(
        new URL(config.neonAuthJwksUrl ?? `${config.neonAuthBaseUrl}/.well-known/jwks.json`),
      );
    neon = new NeonVerifier(config.neonAuthBaseUrl, keys);
  }
  return new Auth(db, config, key, neon);
}
/** Reads a private file, or creates it without replacing another process's value. */
export async function readOrCreate(path: string, create: () => string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  let value = create();
  const temporary = `${path}.${randomBytes(16).toString("hex")}.tmp`;
  await writeFile(temporary, value, { mode: 0o600, flag: "wx" });
  try {
    // Publish only complete bytes, without replacing another process's value.
    await link(temporary, path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    value = await readFile(path, "utf8");
  } finally {
    await unlink(temporary);
  }
  return value;
}
