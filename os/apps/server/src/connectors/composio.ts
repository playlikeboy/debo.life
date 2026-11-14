// The real connector provider: Composio (https://composio.dev). It holds each person's
// sign-in to their apps and carries each request. Debo never sees an app password or token.
//
// Used the way the current docs describe (checked November 2026):
//   - catalogue:  GET /api/v3/toolkits (the SDK list call stops at 1000 rows and drops the cursor)
//   - connecting: session.authorize(toolkit, { callbackUrl }) returns a hosted connect link
//   - accounts:   composio.connectedAccounts.list({ userIds }) and .delete(id)
//   - tools:      session.search({ query, toolkits }) to find, session.execute(slug, args) to run,
//                 composio.tools.getRawComposioTools({ tools }) for each tool's hints
// A session is made for one person (their owner id) and lists only the apps they connected,
// so a call can never reach another person's account or an app they did not connect.
import type { Composio } from "@composio/core";
import { AppError } from "../errors.ts";
import type {
  BackendAccount,
  ConnectorBackend,
  ExecuteOutcome,
  ToolkitInfo,
  ToolMeta,
} from "./types.ts";

const API = "https://backend.composio.dev";

type Raw = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");
const rec = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};

/** Never lets a provider message carry anything but a short plain sentence upward. */
function plainProviderError(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (/no active connection|not connected/i.test(text))
    return "That app is not connected, or its sign-in has expired. Connect it again in Apps.";
  if (/429|rate limit/i.test(text)) return "That app asked Debo to slow down. Try again in a minute.";
  if (/401|403|unauthori[sz]ed|forbidden|permission/i.test(text))
    return "That app did not allow it. Its sign-in may have expired or lack permission.";
  if (/404|not found/i.test(text)) return "That app could not find what was asked for.";
  return "That app could not do it just now. Try again in a moment.";
}

export class ComposioBackend implements ConnectorBackend {
  private sdk?: Promise<Composio>;
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private client() {
    this.sdk ??= import("@composio/core").then(
      ({ Composio }) =>
        // allowTracking is off: no usage analytics leave this server through the SDK.
        new Composio({ apiKey: this.apiKey, allowTracking: false }),
    );
    return this.sdk;
  }

  async listToolkits(): Promise<ToolkitInfo[]> {
    const items: ToolkitInfo[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const url = new URL(`${API}/api/v3/toolkits`);
      url.searchParams.set("limit", "1000");
      url.searchParams.set("sort_by", "usage");
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await this.fetcher(url, {
        headers: { "x-api-key": this.apiKey },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
      const body = rec(await response.json());
      for (const raw of Array.isArray(body.items) ? body.items : []) {
        const item = rec(raw);
        const meta = rec(item.meta);
        const slug = str(item.slug);
        if (!slug || item.no_auth === true || item.is_local_toolkit === true) continue;
        const managed = Array.isArray(item.composio_managed_auth_schemes)
          ? item.composio_managed_auth_schemes
          : [];
        items.push({
          slug,
          name: str(item.name) || slug,
          description: str(meta.description),
          logo: str(meta.logo) || undefined,
          connectable: managed.length > 0,
        });
      }
      cursor = str(body.next_cursor) || undefined;
      if (!cursor) break;
    }
    return items;
  }

  async link(userId: string, toolkit: string, callbackUrl: string) {
    const composio = await this.client();
    const session = await composio.create(userId, {
      toolkits: [toolkit],
      manageConnections: { enable: false },
    });
    const request = await session.authorize(toolkit, { callbackUrl });
    if (!request.redirectUrl) throw new AppError("That app could not start connecting.", 502);
    return { id: request.id, url: request.redirectUrl };
  }

  async listAccounts(userId: string): Promise<BackendAccount[]> {
    const composio = await this.client();
    const out: BackendAccount[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const result = await composio.connectedAccounts.list({
        userIds: [userId],
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      for (const item of result.items)
        // Only these four fields leave this function. The provider's own record can hold more.
        out.push({
          id: item.id,
          toolkit: item.toolkit.slug,
          status: String(item.status),
          createdAt: String(item.createdAt ?? ""),
        });
      cursor = result.nextCursor ?? undefined;
      if (!cursor) break;
    }
    return out;
  }

  async deleteAccount(id: string) {
    const composio = await this.client();
    await composio.connectedAccounts.delete(id);
  }

  private async hints(slugs: string[]): Promise<Map<string, ToolMeta>> {
    const found = new Map<string, ToolMeta>();
    if (!slugs.length) return found;
    const composio = await this.client();
    const tools = await composio.tools.getRawComposioTools({ tools: slugs });
    for (const tool of tools)
      found.set(tool.slug, {
        slug: tool.slug,
        toolkit: String(tool.toolkit?.slug ?? "").toLowerCase(),
        name: tool.name ?? tool.slug,
        description: tool.description ?? "",
        tags: Array.isArray(tool.tags) ? tool.tags.map(String) : [],
        inputSchema: rec(tool.inputParameters),
      });
    return found;
  }

  async searchTools(userId: string, toolkits: string[], query: string): Promise<ToolMeta[]> {
    if (!toolkits.length) return [];
    const composio = await this.client();
    const session = await composio.create(userId, {
      toolkits,
      manageConnections: { enable: false },
    });
    const found = rec(await session.search({ query, toolkits }));
    const schemas = rec(found.toolSchemas);
    const primary = (Array.isArray(found.results) ? found.results : []).flatMap((r) => [
      ...(Array.isArray(rec(r).primaryToolSlugs) ? (rec(r).primaryToolSlugs as string[]) : []),
      ...(Array.isArray(rec(r).relatedToolSlugs) ? (rec(r).relatedToolSlugs as string[]) : []),
    ]);
    const slugs = [...new Set([...primary, ...Object.keys(schemas)])].slice(0, 12);
    const hints = await this.hints(slugs);
    const out: ToolMeta[] = [];
    for (const slug of slugs) {
      const meta = hints.get(slug);
      const schema = rec(schemas[slug]);
      // A tool with no hints is still returned. The risk check treats it as a change.
      out.push({
        slug,
        toolkit: (meta?.toolkit || str(schema.toolkit)).toLowerCase(),
        name: meta?.name ?? slug,
        description: meta?.description || str(schema.description),
        tags: meta?.tags ?? [],
        inputSchema: meta?.inputSchema ?? rec(schema.inputSchema),
      });
    }
    return out;
  }

  async toolMeta(slug: string): Promise<ToolMeta | null> {
    return (await this.hints([slug])).get(slug) ?? null;
  }

  async execute(
    userId: string,
    accounts: { toolkit: string; accountId: string }[],
    slug: string,
    args: Record<string, unknown>,
  ): Promise<ExecuteOutcome> {
    try {
      const composio = await this.client();
      const session = await composio.create(userId, {
        toolkits: accounts.map((a) => a.toolkit),
        // Pin each app to the connected account the service checked belongs to this person.
        connectedAccounts: Object.fromEntries(accounts.map((a) => [a.toolkit, [a.accountId]])),
        manageConnections: { enable: false },
      });
      const result = rec(await session.execute(slug, args));
      const resultType = str(result.resultType);
      if (resultType === "blocked" || resultType === "input_required")
        return { ok: false, error: "That app would not run this. Nothing was changed." };
      if (result.error)
        return { ok: false, error: plainProviderError(new Error(str(result.error))) };
      if (result.successful === false)
        return { ok: false, error: "That app could not do it just now. Try again in a moment." };
      return { ok: true, data: result.data, logId: str(result.logId) || undefined };
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      return {
        ok: false,
        error: plainProviderError(error),
        unknown: /timeout|timed out|abort|fetch failed|ECONN|socket|network/i.test(text),
      };
    }
  }
}
