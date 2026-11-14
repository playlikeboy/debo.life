import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  API: DurableObjectNamespace<DeboApi>;
  /** Service binding to the private debo-os-browser Worker. */
  BROWSER: Fetcher;
  API_SLEEP_AFTER?: string;
  [name: string]: unknown;
}

/** Everything the API reads from its environment. Unset values are skipped. */
const PASSED = [
  "WORKSPACE_MODE",
  "AGENT_BACKEND",
  "MODEL",
  "TASK_WORKER_ENABLED",
  "TRUST_PROXY",
  "PUBLIC_API_URL",
  "ALLOWED_ORIGINS",
  "WEB_SEARCH_ENABLED",
  // Secrets
  "DATABASE_URL",
  "OPENFUSE_ACCESS_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "SESSION_SIGNING_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "WORKER_TOKEN",
];

/** Fixed made-up host the API uses to reach the browser; see outboundByHost below. */
const BROWSER_HOST = "browser.internal";

export class DeboApi extends Container<Env> {
  defaultPort = 8787;
  requiredPorts = [8787];
  pingEndpoint = "localhost/api/health";
  enableInternet = true;
  sleepAfter: string | number;

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.sleepAfter = env.API_SLEEP_AFTER ?? "10m";
    const vars: Record<string, string> = { HOST: "0.0.0.0", PORT: "8787" };
    for (const key of PASSED) {
      const value = env[key];
      if (typeof value === "string" && value !== "") vars[key] = value;
    }
    // The API calls http://browser.internal. The Containers runtime intercepts that
    // hostname (below) and hands the request to the private browser Worker.
    if (env.BROWSER) vars.BROWSER_WORKER_URL = `http://${BROWSER_HOST}`;
    this.envVars = vars;
  }

  // Plain-HTTP interception: the request never leaves Cloudflare and never touches the
  // public internet. Only this container's outbound traffic can reach the binding.
  static outboundByHost = {
    [BROWSER_HOST]: (request: Request, env: Env) => env.BROWSER.fetch(request),
  };

  override onError(error: unknown) {
    console.error("debo-os-api container error", String(error));
  }
}

const api = (env: Env) => getContainer(env.API, "main");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return api(env).fetch(request);
  },

  // Wakes the container so the in-process task worker keeps durable tasks moving.
  // Starting it runs the engine's first tick, and the health call renews the idle timer.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const res = await api(env).fetch(new Request("http://container/api/health"));
    if (!res.ok) console.error("debo-os-api keep-awake health check failed", res.status);
  },
} satisfies ExportedHandler<Env>;
