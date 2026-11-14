// Connectors: let a person connect their apps (Gmail, Slack, Notion...) through Composio and
// use them from chat, tasks and voice. See os/docs/CONNECTORS.md for the design and the rules.
import type { Config } from "../config.ts";
import { ComposioBackend } from "./composio.ts";
import { FakeConnectorBackend } from "./fake.ts";
import { ConnectorService } from "./service.ts";
import type { ConnectorBackend } from "./types.ts";

export { ComposioBackend } from "./composio.ts";
export { FAKE_TOOLKITS, FAKE_TOOLS, FakeConnectorBackend } from "./fake.ts";
export { classifyRisk } from "./risk.ts";
export { connectorCallbackRoute, connectorRoutes } from "./routes.ts";
export {
  ConnectorService,
  type ConnectorOptions,
  describeCall,
  NOT_SET_UP,
  wrapAppData,
} from "./service.ts";
export {
  connectorInstructions,
  connectorTaskInstructions,
  connectorTools,
  findAppToolsInput,
  runFindAppTools,
  runUseAppTool,
  useAppToolInput,
} from "./tools.ts";
export type * from "./types.ts";

const on = (value?: string) => ["1", "true", "on"].includes(value?.trim().toLowerCase() ?? "");

/** DEBO_SAMPLE_CONNECTORS=1 asks for practice connectors that never leave the machine. */
export function sampleConnectorsRequested(env: Record<string, string | undefined> = process.env) {
  return on(env.DEBO_SAMPLE_CONNECTORS);
}

/**
 * The connectors for this server. With COMPOSIO_API_KEY they are real. Without it the
 * service reports "not set up" and nothing else changes. In a sample workspace only,
 * DEBO_SAMPLE_CONNECTORS=1 swaps in a practice copy so the screens can be tried safely.
 */
export function createConnectors(
  config: Pick<Config, "mode" | "publicUrl" | "googleClientId">,
  options: {
    env?: Record<string, string | undefined>;
    googleConnected?: (owner: string) => Promise<boolean>;
    backend?: ConnectorBackend;
  } = {},
): { service: ConnectorService; backend: ConnectorBackend | null } {
  const env = options.env ?? process.env;
  let backend: ConnectorBackend | null = options.backend ?? null;
  if (!backend && sampleConnectorsRequested(env)) {
    if (config.mode !== "sample")
      throw new Error(
        "DEBO_SAMPLE_CONNECTORS is for sample workspaces only. Remove it from a live workspace.",
      );
    console.warn("[Debo] Practice connectors are on: no real app is reached.");
    backend = new FakeConnectorBackend();
  }
  const key = env.COMPOSIO_API_KEY?.trim();
  if (!backend && key) backend = new ComposioBackend(key);
  const service = new ConnectorService({
    backend,
    publicUrl: config.publicUrl,
    googleBuiltIn: config.mode === "sample" || Boolean(config.googleClientId),
    googleConnected: options.googleConnected,
  });
  return { service, backend };
}
