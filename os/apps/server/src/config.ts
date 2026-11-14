import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/** .env keys whose file value loses to a different value already set in the environment. */
export function shadowedEnvKeys(
  file: Record<string, string | undefined>,
  env: Record<string, string | undefined> = process.env,
): string[] {
  return Object.keys(file).filter((key) => env[key] !== undefined && env[key] !== file[key]);
}

if (existsSync(".env")) {
  // loadEnvFile never overrides existing variables. A stale shell or system-wide value
  // (for example OPENAI_API_KEY) would otherwise silently replace the .env setting.
  const shadowed = shadowedEnvKeys(parseEnv(readFileSync(".env", "utf8")));
  process.loadEnvFile(".env");
  if (shadowed.length)
    console.warn(
      `[Debo] Using ${shadowed.join(", ")} from the environment instead of .env. ` +
        (shadowed.length === 1
          ? "Unset it to use the .env value."
          : "Unset them to use the .env values."),
    );
}
/** Telemetry is off unless the operator sets DEBO_TELEMETRY=on. See docs/TELEMETRY.md. */
export function telemetryOptedIn(env: Record<string, string | undefined> = process.env) {
  return ["on", "true", "1"].includes(env.DEBO_TELEMETRY?.trim().toLowerCase() ?? "");
}
// Config loads before the runtime is imported, so this decides what the SDK sees.
// Off by default: the CopilotKit SDK would otherwise report usage on its own.
if (telemetryOptedIn()) {
  process.env.COPILOTKIT_TELEMETRY_SAMPLE_RATE ??= "1";
  // The operator opted in explicitly, so a stale opt-out variable must not silently win.
  if (process.env.DO_NOT_TRACK === "1" || process.env.DO_NOT_TRACK === "true") {
    console.warn("[Debo] DO_NOT_TRACK is set, so telemetry stays off even though DEBO_TELEMETRY=on.");
    process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
  }
} else {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
  // Never leave an account identity around for the SDK to attach to anything.
  delete process.env.CPK_TELEMETRY_ID;
}
if (process.env.CPK_INTELLIGENCE_API_KEY?.trim())
  console.warn(
    "[Debo] CPK_INTELLIGENCE_API_KEY is ignored. Debo keeps conversations in its own database and sends them to no one.",
  );

export interface Config {
  mode: "sample" | "live";
  port: number;
  host: string;
  publicUrl: string;
  dataDir: string;
  databaseUrl?: string;
  accessKey?: string;
  /** How requests prove who they are. Missing means "access-key" (one shared key, one owner). */
  authMode?: AuthMode;
  /** Neon Auth origin and key set; set when authMode is "neon". */
  neonAuthBaseUrl?: string;
  neonAuthJwksUrl?: string;
  /** Postgres schema for the records table. Missing means the default schema. */
  dbSchema?: string;
  encryptionKey?: string;
  model?: string;
  jevMode?: "off" | "sample" | "live";
  typesafeApiKey?: string;
  jevModel?: string;
  agentBackend: "sample" | "model" | "agui";
  agentUrl?: string;
  agentToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri: string;
  workerUrl?: string;
  workerToken?: string;
  taskWorkerEnabled?: boolean;
  webSearchEnabled?: boolean;
  computerEnabled?: boolean;
  computerImage?: string;
  /** Set at startup for an install whose computers were named before the rename. */
  computerLegacyNames?: boolean;
  computerDeploymentId?: string;
  computerProvider?: ComputerProvider;
  computerE2bTemplate?: string;
  e2bApiKey?: string;
  allowedOrigins: string[];
  trustProxy?: boolean;
}

export type AuthMode = "neon" | "access-key";

export type ComputerProvider = "docker" | "e2b-desktop";

/** Pinned so live rankings do not shift when TypeSafe moves the `jev-latest` alias. */
export const defaultJevModel = "jev-1.13.0";

export function required(name: string, message: string, value = process.env[name]): string {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

/** Accept a full worker URL, or host:port from a platform that omits the scheme. */
export function browserWorkerUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.includes("://") ? trimmed : `http://${trimmed}`;
}

/** The data directory when DATA_DIR is unset, relative to `cwd`. */
export function defaultDataDir(cwd = process.cwd()): string {
  // Legacy name, kept so existing installs keep working.
  const legacy = ".openmuse";
  return !existsSync(resolve(cwd, ".openfuse")) && existsSync(resolve(cwd, legacy))
    ? legacy
    : ".openfuse";
}

/** The access key from OPENFUSE_ACCESS_KEY, else from its legacy name. */
export function accessKeyFromEnv(env: Record<string, string | undefined> = process.env) {
  // Legacy name, kept so existing installs keep working.
  return env.OPENFUSE_ACCESS_KEY || env.OPENMUSE_ACCESS_KEY;
}

// Provider SDKs retry transient failures before the response starts, with
// exponential backoff: OpenAI and Anthropic retry HTTP 408, 409, 429, 5xx and
// connection errors and honor retry-after; Gemini retries 408, 429, 500, 502,
// 503 and 504. Other 4xx responses such as 400, 401 and 403 fail on the first
// attempt, and a stream that fails after it starts is not retried. External
// writes never re-fire here: they are dispatched outside the model loop through
// reviewed, idempotency-keyed actions.
export const MODEL_MAX_RETRIES = 2;
/**
 * Which sign-in the API uses. Neon Auth gives every person their own account.
 * The shared access key is one owner for a local or demo install.
 */
export function resolveAuth(
  mode: "sample" | "live",
  env: Record<string, string | undefined> = process.env,
): Pick<Config, "authMode" | "neonAuthBaseUrl" | "neonAuthJwksUrl" | "dbSchema"> {
  const requested = env.AUTH_MODE?.trim();
  if (requested && requested !== "neon" && requested !== "access-key")
    throw new Error("AUTH_MODE must be neon or access-key");
  const base = env.NEON_AUTH_BASE_URL?.trim().replace(/\/$/, "") || undefined;
  const jwks = env.NEON_AUTH_JWKS_URL?.trim() || undefined;
  if (mode === "live" && jwks && requested === "access-key")
    throw new Error(
      "NEON_AUTH_JWKS_URL is set, so live mode must use Neon Auth. Remove AUTH_MODE=access-key.",
    );
  const authMode: AuthMode =
    (requested as AuthMode | undefined) ?? (mode === "live" && jwks ? "neon" : "access-key");
  const schema = env.OS_DB_SCHEMA?.trim() || (authMode === "neon" ? "os" : undefined);
  if (schema && !/^[a-z_][a-z0-9_]{0,62}$/.test(schema))
    throw new Error("OS_DB_SCHEMA must be a lowercase Postgres schema name");
  if (authMode === "access-key") return { authMode, dbSchema: schema };
  if (!base) throw new Error("AUTH_MODE=neon requires NEON_AUTH_BASE_URL");
  return {
    authMode,
    neonAuthBaseUrl: base,
    neonAuthJwksUrl: jwks ?? `${base}/.well-known/jwks.json`,
    dbSchema: schema,
  };
}

export function readConfig(): Config {
  const mode = process.env.WORKSPACE_MODE ?? "sample";
  if (mode !== "sample" && mode !== "live")
    throw new Error("WORKSPACE_MODE must be sample or live");
  const backend = process.env.AGENT_BACKEND ?? (mode === "sample" ? "sample" : "model");
  if (backend !== "sample" && backend !== "model" && backend !== "agui")
    throw new Error("AGENT_BACKEND must be sample, model or agui");
  if (mode === "live" && backend === "sample")
    throw new Error("Live workspaces cannot use the sample agent");
  const jevMode = process.env.JEV_MODE ?? "off";
  if (jevMode !== "off" && jevMode !== "sample" && jevMode !== "live")
    throw new Error("JEV_MODE must be off, sample or live");
  const typesafeApiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (jevMode === "live" && !typesafeApiKey)
    throw new Error("JEV_MODE=live requires a nonblank TYPESAFE_API_KEY");
  const computerProvider = process.env.COMPUTER_PROVIDER?.trim() || "docker";
  if (computerProvider !== "docker" && computerProvider !== "e2b-desktop")
    throw new Error("COMPUTER_PROVIDER must be docker or e2b-desktop");
  const e2bApiKey = process.env.E2B_API_KEY?.trim();
  if (process.env.COMPUTER_ENABLED === "true" && computerProvider === "e2b-desktop") {
    if (!e2bApiKey)
      throw new Error("COMPUTER_PROVIDER=e2b-desktop requires a nonblank E2B_API_KEY");
    // Sandboxes are matched by metadata across the whole E2B team, and every default
    // install would otherwise derive the same deployment label from localhost:8787.
    if (!process.env.COMPUTER_DEPLOYMENT_ID?.trim())
      throw new Error(
        "COMPUTER_PROVIDER=e2b-desktop requires a unique COMPUTER_DEPLOYMENT_ID, e.g. from `openssl rand -hex 12`",
      );
  }
  const port = Number(process.env.PORT ?? 8787);
  const publicUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${port}`;
  const config: Config = {
    mode,
    port,
    host: process.env.HOST ?? "127.0.0.1",
    publicUrl,
    dataDir: resolve(process.env.DATA_DIR ?? defaultDataDir()),
    databaseUrl: process.env.DATABASE_URL,
    accessKey: accessKeyFromEnv(),
    ...resolveAuth(mode),
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    model: process.env.MODEL,
    jevMode,
    typesafeApiKey,
    jevModel: process.env.JEV_MODEL?.trim() || defaultJevModel,
    agentBackend: backend,
    agentUrl: process.env.AGENT_URL,
    agentToken: process.env.AGENT_TOKEN,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: `${publicUrl}/api/google/callback`,
    workerUrl: browserWorkerUrl(process.env.BROWSER_WORKER_URL),
    workerToken: process.env.WORKER_TOKEN,
    taskWorkerEnabled: process.env.TASK_WORKER_ENABLED !== "false",
    webSearchEnabled: process.env.WEB_SEARCH_ENABLED !== "false",
    computerEnabled: process.env.COMPUTER_ENABLED === "true",
    computerImage: process.env.COMPUTER_IMAGE,
    // A blank line from .env is unset; otherwise every such install would share one name.
    computerDeploymentId: process.env.COMPUTER_DEPLOYMENT_ID?.trim() || undefined,
    computerProvider,
    computerE2bTemplate: process.env.COMPUTER_E2B_TEMPLATE?.trim() || "desktop",
    e2bApiKey,
    allowedOrigins: (
      process.env.ALLOWED_ORIGINS ?? "http://localhost:8081,http://127.0.0.1:8081"
    ).split(","),
    // Only trust X-Forwarded-For/X-Real-IP when the deployment is known to sit
    // behind a proxy that sets them; otherwise a direct caller can spoof them.
    trustProxy: process.env.TRUST_PROXY === "true",
  };
  if (
    mode === "live" &&
    (!config.encryptionKey ||
      (config.authMode !== "neon" && (!config.accessKey || config.accessKey.length < 24)))
  )
    throw new Error(
      "Live mode requires OPENFUSE_ACCESS_KEY (24+ characters) and TOKEN_ENCRYPTION_KEY (32-byte base64)",
    );
  if (mode === "sample" && !["127.0.0.1", "localhost", "::1"].includes(config.host))
    throw new Error("Sample workspace is local-only. HOST must be a loopback address.");
  return config;
}
