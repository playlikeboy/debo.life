// The shapes shared by the connectors code. Nothing here talks to the network.

/** One app in the catalogue. */
export interface ToolkitInfo {
  slug: string;
  name: string;
  description: string;
  logo?: string;
  /**
   * True when a person can connect it with one tap. That means Composio holds the
   * app registration (managed sign-in). Other apps need the owner to set up their own
   * sign-in first, so they are shown as not available yet.
   */
  connectable: boolean;
}

/** A connected account as the provider reports it. `status` is the provider's own word. */
export interface BackendAccount {
  id: string;
  toolkit: string;
  status: string;
  createdAt: string;
}

/** What the provider says about one tool. `tags` carry its hints such as readOnlyHint. */
export interface ToolMeta {
  slug: string;
  toolkit: string;
  name: string;
  description: string;
  tags: string[];
  /** A JSON schema of the arguments, when the provider gave one. */
  inputSchema?: Record<string, unknown>;
}

export interface ExecuteOutcome {
  ok: boolean;
  data?: unknown;
  /** Plain words, never a provider payload. */
  error?: string;
  /** True when the request may have reached the app but no answer came back (a timeout). */
  unknown?: boolean;
  /** The provider's log id. Safe to log. */
  logId?: string;
}

/**
 * The thin edge to the connector provider. `ComposioBackend` is the real one;
 * `FakeConnectorBackend` serves tests and the sample workspace. Every method that
 * acts for a person takes their id, and the service always passes the signed-in owner.
 */
export interface ConnectorBackend {
  /** The whole catalogue. The service caches it. */
  listToolkits(): Promise<ToolkitInfo[]>;
  /** Starts a connection and returns the hosted page where the person signs in. */
  link(userId: string, toolkit: string, callbackUrl: string): Promise<{ id: string; url: string }>;
  listAccounts(userId: string): Promise<BackendAccount[]>;
  /** Sample workspace and tests only: finishes a pending connection. The real provider has no such call. */
  complete?(id: string): void;
  /** Really deletes the connected account at the provider. */
  deleteAccount(id: string): Promise<void>;
  /** Finds tools for a request, limited to the given toolkits. Hints are filled in. */
  searchTools(userId: string, toolkits: string[], query: string): Promise<ToolMeta[]>;
  /** One tool by its slug, or null when the provider has no such tool. */
  toolMeta(slug: string): Promise<ToolMeta | null>;
  /** Runs one tool as this person, limited to the given connected accounts. */
  execute(
    userId: string,
    accounts: { toolkit: string; accountId: string }[],
    slug: string,
    args: Record<string, unknown>,
  ): Promise<ExecuteOutcome>;
}

export type ConnectionState = "connected" | "waiting" | "failed" | "expired";

/** One connection as the app shows it. No tokens, ever. */
export interface Connection {
  id: string;
  toolkit: string;
  name: string;
  state: ConnectionState;
  /** A plain sentence for the person. */
  statusText: string;
  connectedAt: string;
}

export interface CatalogueItem {
  slug: string;
  name: string;
  /** One honest line about what Debo can do with this app. */
  blurb: string;
  logo?: string;
  connectable: boolean;
}

export type Risk = "read" | "write" | "destructive";
