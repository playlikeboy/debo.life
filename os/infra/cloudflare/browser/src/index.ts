import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  BROWSER: DurableObjectNamespace<DeboBrowser>;
  BROWSER_SLEEP_AFTER?: string;
  WORKER_TOKEN?: string;
}

export class DeboBrowser extends Container<Env> {
  // The upstream image listens on 8790 (WORKER_HOST=0.0.0.0 is baked into the image).
  defaultPort = 8790;
  requiredPorts = [8790];
  pingEndpoint = "localhost/health";
  // The worker enforces its own public-destination rules; the container needs egress to browse.
  enableInternet = true;
  sleepAfter: string | number;

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.sleepAfter = env.BROWSER_SLEEP_AFTER ?? "15m";
    this.envVars = {
      WORKER_HOST: "0.0.0.0",
      WORKER_DATA_DIR: "/data",
      ...(env.WORKER_TOKEN ? { WORKER_TOKEN: env.WORKER_TOKEN } : {}),
    };
  }
}

export default {
  // Reached only through the service binding held by debo-os-api (no route, no workers.dev).
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.BROWSER, "main").fetch(request);
  },
} satisfies ExportedHandler<Env>;
