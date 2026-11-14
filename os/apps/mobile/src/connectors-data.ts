// Talking to /api/connectors, and reading what comes back. The server holds the sign-in to
// each app (through Composio); the app only ever sees names, states and dates.
import { z } from "zod";
import type { FuseApi } from "./api";

export const ConnectionSchema = z.object({
  id: z.string(),
  toolkit: z.string(),
  name: z.string(),
  state: z.enum(["connected", "waiting", "failed", "expired"]),
  statusText: z.string(),
  connectedAt: z.string(),
});
export const CatalogueItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  blurb: z.string(),
  logo: z.string().optional(),
  connectable: z.boolean(),
});
const OverviewSchema = z.object({
  configured: z.boolean(),
  message: z.string().optional(),
  connections: z.array(ConnectionSchema),
  curated: z.array(CatalogueItemSchema),
});
const LinkSchema = z.object({ id: z.string(), url: z.string(), name: z.string() });

export type AppConnection = z.infer<typeof ConnectionSchema>;
export type AppItem = z.infer<typeof CatalogueItemSchema>;
export type ConnectorsOverview = z.infer<typeof OverviewSchema>;

const UNREADABLE = "I couldn't read the list of apps. Try again in a moment.";

export async function loadConnectors(api: FuseApi): Promise<ConnectorsOverview> {
  const parsed = OverviewSchema.safeParse(await api.request<unknown>("/api/connectors"));
  if (!parsed.success) throw new Error(UNREADABLE);
  return parsed.data;
}

export async function searchApps(api: FuseApi, query: string): Promise<AppItem[]> {
  const parsed = z
    .object({ items: z.array(CatalogueItemSchema) })
    .safeParse(await api.request<unknown>(`/api/connectors/search?q=${encodeURIComponent(query)}`));
  if (!parsed.success) throw new Error(UNREADABLE);
  return parsed.data.items;
}

/** Asks the server for the app's own sign-in page. `to` says where the page sends people after. */
export async function startConnect(api: FuseApi, slug: string, to: "web" | "native") {
  const parsed = LinkSchema.safeParse(
    await api.request<unknown>(`/api/connectors/${encodeURIComponent(slug)}/connect`, { to }),
  );
  if (!parsed.success) throw new Error("I couldn't start connecting that app. Try again.");
  return parsed.data;
}

export async function disconnectApp(api: FuseApi, id: string) {
  await api.request(`/api/connectors/${encodeURIComponent(id)}`, undefined, "DELETE");
}

/** The most useful connection for each app: a finished one beats an unfinished one. */
export function connectionsBySlug(connections: AppConnection[]) {
  const rank = { connected: 3, waiting: 2, failed: 1, expired: 0 } as const;
  const map = new Map<string, AppConnection>();
  for (const connection of connections) {
    const current = map.get(connection.toolkit);
    if (!current || rank[connection.state] > rank[current.state]) map.set(connection.toolkit, connection);
  }
  return map;
}

/** "Slack" from a tool name such as SLACK_SEND_MESSAGE, for a card shown before the answer arrives. */
export function appFromToolName(tool: unknown) {
  if (typeof tool !== "string" || !tool) return undefined;
  const first = tool.split("_")[0] ?? "";
  return first ? first[0] + first.slice(1).toLowerCase() : undefined;
}

export type ConnectorToolView =
  | { kind: "error"; message: string }
  | { kind: "found"; apps: string[]; count: number }
  | { kind: "none"; message: string }
  | { kind: "read"; app: string }
  | { kind: "review"; app: string; title: string; actionId: string }
  | { kind: "unreadable" };

/** What a find_app_tools or use_app_tool result means, in the card's terms. */
export function readConnectorTool(name: "find_app_tools" | "use_app_tool", result: unknown): ConnectorToolView {
  let value = result;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { kind: "unreadable" };
    }
  }
  if (!value || typeof value !== "object") return { kind: "unreadable" };
  const v = value as Record<string, unknown>;
  if (typeof v.error === "string") return { kind: "error", message: v.error };
  if (name === "find_app_tools") {
    const tools = Array.isArray(v.tools) ? (v.tools as { app?: unknown }[]) : [];
    if (!tools.length)
      return {
        kind: "none",
        message: typeof v.message === "string" ? v.message : "I found no matching tools.",
      };
    const apps = [...new Set(tools.map((t) => (typeof t.app === "string" ? t.app : "")).filter(Boolean))];
    return { kind: "found", apps, count: tools.length };
  }
  if (typeof v.actionId === "string" && typeof v.status === "string")
    return {
      kind: "review",
      app: typeof v.app === "string" ? v.app : "your app",
      title: typeof v.title === "string" ? v.title : "A change",
      actionId: v.actionId,
    };
  if (typeof v.source === "string") return { kind: "read", app: v.source.split(",")[0] ?? "your app" };
  return { kind: "unreadable" };
}
