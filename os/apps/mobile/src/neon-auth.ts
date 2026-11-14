/**
 * A small client for Neon Auth (managed Better Auth) over plain HTTP, so the same
 * code runs on web, iOS and Android. No React and no react-native imports here, so
 * tests can run it with a fake `fetch`.
 *
 * How a session works:
 * 1. Sign-in answers with the session token in the `set-auth-token` header (the
 *    Better Auth bearer plugin). The app keeps that token in secure storage.
 * 2. `GET /get-session` with that token as a Bearer answers with a short-lived JWT in
 *    the `set-auth-jwt` header (the JWT plugin). `GET /token` returns the same JWT.
 * 3. The Debo API takes the JWT as its Bearer token and checks it against Neon Auth's
 *    public keys. It lasts 15 minutes, so the app asks for a fresh one before then.
 */

export interface NeonUser {
  id: string;
  email: string;
  name?: string;
}

/** What went wrong, in words a person can act on. `message` is safe to show. */
export class AuthProblem extends Error {
  constructor(
    message: string,
    readonly kind: "credentials" | "exists" | "code" | "rate" | "network" | "server" | "other",
  ) {
    super(message);
    this.name = "AuthProblem";
  }
}

export type SignInResult =
  | { status: "signed-in"; sessionToken: string; user: NeonUser }
  | { status: "needs-code"; email: string }
  | { status: "confirmed"; email: string };

export interface JwtSession {
  jwt: string;
  user: NeonUser;
  /** When the JWT stops working, in milliseconds since 1970. */
  expiresAt: number;
}

const OFFLINE = "I couldn't reach the sign-in service. Check your connection and try again.";
const TROUBLE = "Sign-in is having trouble right now. Try again in a moment.";

interface ErrorBody {
  code?: string;
  message?: string;
}

export class NeonAuthClient {
  private readonly base: string;
  constructor(
    baseUrl: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {
    this.base = baseUrl.replace(/\/$/, "");
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const response = await this.post("/sign-in/email", { email, password });
    if (response.status === 403) return { status: "needs-code", email };
    if (!response.ok) throw await explain(response, "sign-in");
    return this.signedIn(response, email);
  }

  async signUp(name: string, email: string, password: string): Promise<SignInResult> {
    const response = await this.post("/sign-up/email", { name, email, password });
    if (!response.ok) throw await explain(response, "sign-up");
    // New accounts must confirm their email first. If a token came back, they are already in.
    const token = response.headers.get("set-auth-token");
    return token ? this.signedIn(response, email) : { status: "needs-code", email };
  }

  async verifyEmail(email: string, code: string): Promise<SignInResult> {
    const response = await this.post("/email-otp/verify-email", { email, otp: code });
    if (!response.ok) throw await explain(response, "code");
    const token = response.headers.get("set-auth-token");
    return token ? this.signedIn(response, email) : { status: "confirmed", email };
  }

  async resendCode(email: string): Promise<void> {
    const response = await this.post("/email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    });
    if (!response.ok) throw await explain(response, "resend");
  }

  /** A fresh JWT for the stored session, or null when the session has ended. */
  async jwtFor(sessionToken: string): Promise<JwtSession | null> {
    const response = await this.request("/get-session", { sessionToken });
    if (response.status === 401) return null;
    if (!response.ok) throw await explain(response, "session");
    const body = (await readJson(response)) as { user?: NeonUser } | null;
    if (!body?.user) return null;
    let jwt = response.headers.get("set-auth-jwt");
    if (!jwt) {
      const second = await this.request("/token", { sessionToken });
      if (second.ok) jwt = ((await readJson(second)) as { token?: string } | null)?.token ?? null;
    }
    if (!jwt) throw new AuthProblem(TROUBLE, "server");
    return { jwt, user: toUser(body.user), expiresAt: jwtExpiry(jwt) };
  }

  /** Ends the session at Neon Auth. A failure here must never keep someone signed in locally. */
  async signOut(sessionToken: string): Promise<void> {
    try {
      await this.request("/sign-out", { method: "POST", body: {}, sessionToken });
    } catch {
      // The local copy is removed either way.
    }
  }

  private async signedIn(response: Response, email: string): Promise<SignInResult> {
    const sessionToken = response.headers.get("set-auth-token");
    if (!sessionToken) throw new AuthProblem(TROUBLE, "server");
    const body = (await readJson(response)) as { user?: NeonUser } | null;
    return {
      status: "signed-in",
      sessionToken,
      user: toUser(body?.user ?? { id: "", email }),
    };
  }

  private post(path: string, body: unknown) {
    return this.request(path, { method: "POST", body });
  }

  private async request(
    path: string,
    options: { method?: string; body?: unknown; sessionToken?: string } = {},
  ): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.base}${path}`, {
        method: options.method ?? "GET",
        headers: {
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(options.sessionToken ? { Authorization: `Bearer ${options.sessionToken}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      // Only a real network failure gets here. Wrong passwords and the like come back as replies.
      throw new AuthProblem(OFFLINE, "network");
    }
  }
}

function toUser(user: Partial<NeonUser>): NeonUser {
  return { id: String(user.id ?? ""), email: String(user.email ?? ""), name: user.name };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}

type Step = "sign-in" | "sign-up" | "code" | "resend" | "session";

/** Turns a Neon Auth error reply into plain words. Never includes raw server text. */
async function explain(response: Response, step: Step): Promise<AuthProblem> {
  const body = ((await readJson(response)) ?? {}) as ErrorBody;
  const code = body.code ?? "";
  if (response.status === 429)
    return new AuthProblem("Too many tries. Wait a minute, then try again.", "rate");
  if (code.includes("OTP") || code.includes("CODE") || step === "code")
    return new AuthProblem(
      response.status >= 500
        ? TROUBLE
        : "That code is wrong or has run out. Check it, or ask for a new one.",
      response.status >= 500 ? "server" : "code",
    );
  if (code === "USER_ALREADY_EXISTS" || code.startsWith("USER_ALREADY_EXISTS"))
    return new AuthProblem("There is already an account with that email. Sign in instead.", "exists");
  if (code === "PASSWORD_TOO_SHORT")
    return new AuthProblem("Use at least 8 characters for your password.", "other");
  if (code === "INVALID_EMAIL")
    return new AuthProblem("That email doesn't look right. Check it and try again.", "other");
  if (step === "sign-in" && (response.status === 401 || response.status === 400))
    return new AuthProblem("That email and password don't match. Try again.", "credentials");
  if (response.status >= 500) return new AuthProblem(TROUBLE, "server");
  if (step === "sign-up")
    return new AuthProblem("I couldn't create your account. Try again in a moment.", "other");
  if (step === "resend")
    return new AuthProblem("I couldn't send a new code. Try again in a moment.", "other");
  return new AuthProblem(TROUBLE, "other");
}

/** When a JWT stops working. Reads the `exp` claim; guesses 10 minutes if it cannot. */
export function jwtExpiry(jwt: string, now = Date.now()): number {
  try {
    const payload = jwt.split(".")[1] ?? "";
    const text = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    const exp = (JSON.parse(text) as { exp?: number }).exp;
    if (typeof exp === "number") return exp * 1000;
  } catch {
    // Fall through to the guess.
  }
  return now + 10 * 60 * 1000;
}

/** How long to wait before asking for a new JWT: 90 seconds before it runs out, at least 15 seconds. */
export function refreshDelay(expiresAt: number, now = Date.now()): number {
  return Math.max(15_000, expiresAt - now - 90_000);
}
