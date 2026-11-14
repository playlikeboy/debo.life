// An in-memory stand-in for the connector provider. Tests use it, and so does the sample
// workspace when DEBO_SAMPLE_CONNECTORS=1 (see index.ts). It never makes a network call.
import { randomUUID } from "node:crypto";
import type {
  BackendAccount,
  ConnectorBackend,
  ExecuteOutcome,
  ToolkitInfo,
  ToolMeta,
} from "./types.ts";

export const FAKE_TOOLKITS: ToolkitInfo[] = [
  ["gmail", "Gmail"],
  ["googlecalendar", "Google Calendar"],
  ["googledrive", "Google Drive"],
  ["googledocs", "Google Docs"],
  ["googlesheets", "Google Sheets"],
  ["notion", "Notion"],
  ["slack", "Slack"],
  ["github", "GitHub"],
  ["linear", "Linear"],
  ["outlook", "Outlook"],
  ["whatsapp", "WhatsApp"],
  ["youtube", "YouTube"],
  ["todoist", "Todoist"],
  ["trello", "Trello"],
].map(([slug, name]) => ({
  slug: slug as string,
  name: name as string,
  description: `${name} (practice copy)`,
  connectable: true,
})).concat([
  { slug: "telegram", name: "Telegram", description: "Telegram bots", connectable: false },
  { slug: "spotify", name: "Spotify", description: "Music", connectable: false },
  { slug: "asana", name: "Asana", description: "Tasks for teams", connectable: true },
]);

/** A few tools per app, with the same hints the real provider puts on its tools. */
export const FAKE_TOOLS: ToolMeta[] = [
  tool("GMAIL_FETCH_EMAILS", "gmail", "Fetch emails", ["readOnlyHint"], { query: "string" }),
  tool("GMAIL_SEND_EMAIL", "gmail", "Send an email", ["createHint"], {
    to: "string",
    subject: "string",
    body: "string",
  }),
  tool("GMAIL_DELETE_MESSAGE", "gmail", "Delete an email", ["destructiveHint"], { id: "string" }),
  tool("SLACK_SEARCH_MESSAGES", "slack", "Search messages", ["readOnlyHint"], { query: "string" }),
  tool("SLACK_SEND_MESSAGE", "slack", "Send a message", ["createHint"], {
    channel: "string",
    text: "string",
  }),
  tool("NOTION_SEARCH_PAGES", "notion", "Search pages", ["readOnlyHint"], { query: "string" }),
  tool("NOTION_UPDATE_PAGE", "notion", "Update a page", ["updateHint"], {
    page: "string",
    text: "string",
  }),
  // No hints at all: the risk check must treat this one as a change.
  tool("TODOIST_MYSTERY_TOOL", "todoist", "Mystery tool", [], { thing: "string" }),
  tool("GITHUB_LIST_ISSUES", "github", "List issues", ["readOnlyHint"], { repo: "string" }),
];

function tool(
  slug: string,
  toolkit: string,
  name: string,
  tags: string[],
  props: Record<string, string>,
): ToolMeta {
  return {
    slug,
    toolkit,
    name,
    description: `${name} in ${toolkit}.`,
    tags,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(Object.entries(props).map(([k, type]) => [k, { type }])),
    },
  };
}

interface FakeAccount extends BackendAccount {
  userId: string;
}

export class FakeConnectorBackend implements ConnectorBackend {
  accounts: FakeAccount[] = [];
  /** Every account id deleted, in order, so tests can check the provider really lost it. */
  deleted: string[] = [];
  /** Every call run: who, which tool, which arguments. */
  executed: { userId: string; slug: string; args: Record<string, unknown> }[] = [];
  /** What a tool returns. Tests replace this to return, for example, an email with an injected line. */
  respond: (slug: string, args: Record<string, unknown>) => unknown = (slug) => ({
    messages: [`result of ${slug}`],
  });
  toolkits: ToolkitInfo[] = FAKE_TOOLKITS;
  tools: ToolMeta[] = FAKE_TOOLS;
  failListing = false;
  toolkitFetches = 0;

  async listToolkits() {
    this.toolkitFetches += 1;
    return this.toolkits;
  }
  async link(userId: string, toolkit: string, callbackUrl: string) {
    const id = `ca_${randomUUID().slice(0, 8)}`;
    this.accounts.push({
      id,
      userId,
      toolkit,
      status: "INITIATED",
      createdAt: new Date().toISOString(),
    });
    const url = new URL(callbackUrl);
    url.searchParams.set("connected_account_id", id);
    url.searchParams.set("status", "success");
    return { id, url: url.toString() };
  }
  async listAccounts(userId: string) {
    if (this.failListing) throw new Error("provider down");
    return this.accounts
      .filter((a) => a.userId === userId)
      .map(({ userId: _u, ...account }) => account);
  }
  async deleteAccount(id: string) {
    this.accounts = this.accounts.filter((a) => a.id !== id);
    this.deleted.push(id);
  }
  /** Sample and test use: finish a connection, as the person would on the hosted page. */
  complete(id: string) {
    const account = this.accounts.find((a) => a.id === id);
    if (account && account.status === "INITIATED") account.status = "ACTIVE";
  }
  async searchTools(_userId: string, toolkits: string[], query: string) {
    const words = query.toLowerCase().split(/\W+/).filter(Boolean);
    const inScope = this.tools.filter((t) => toolkits.includes(t.toolkit));
    const hits = inScope.filter((t) =>
      words.some((w) => `${t.slug} ${t.name}`.toLowerCase().includes(w)),
    );
    return (hits.length ? hits : inScope).slice(0, 12);
  }
  async toolMeta(slug: string) {
    return this.tools.find((t) => t.slug === slug) ?? null;
  }
  async execute(
    userId: string,
    accounts: { toolkit: string; accountId: string }[],
    slug: string,
    args: Record<string, unknown>,
  ): Promise<ExecuteOutcome> {
    const meta = this.tools.find((t) => t.slug === slug);
    const mine = this.accounts.filter((a) => a.userId === userId);
    // Same rule as the real provider: only the person's own accounts can run a tool.
    if (
      !meta ||
      !accounts.some(
        (a) => a.toolkit === meta.toolkit && mine.some((m) => m.id === a.accountId),
      )
    )
      return { ok: false, error: "That app is not connected." };
    this.executed.push({ userId, slug, args });
    return { ok: true, data: this.respond(slug, args), logId: `log_${this.executed.length}` };
  }
  /** Test helper: an account that is already connected. */
  connect(userId: string, toolkit: string, status = "ACTIVE") {
    const id = `ca_${randomUUID().slice(0, 8)}`;
    this.accounts.push({ id, userId, toolkit, status, createdAt: new Date().toISOString() });
    return id;
  }
}
