// @debo/memory: what Debo knows about a person, always with its source.
// Mem0 (open-source, self-hosted) behind one small API. See docs/MEMORY.md
// and decision 5 in docs/DECISIONS.md.
//
// Rules this package keeps:
// - Every memory carries the id of the entry it came from (`source_id`).
//   A memory without one is never returned.
// - Each entry is its own Mem0 "run", so Mem0's merge step can only change
//   memories from that same entry, never rewrite one learned elsewhere.
// - Forgetting deletes rows for real (checked with SQL in scripts/).
// - Memories the person fixed are kept when an entry is re-read.
// - Never log memory text or entry text. Ids and counts only.
import { z } from "zod";

// Mem0 reads MEM0_TELEMETRY once, when its module loads, and otherwise sends
// usage events to PostHog. Debo sends no analytics, so switch it off before
// the dynamic import below.
process.env.MEM0_TELEMETRY = "false";

type Mem0Module = typeof import("mem0ai/oss");
type Mem0 = InstanceType<Mem0Module["Memory"]>;
let mem0Module: Promise<Mem0Module> | undefined;
const loadMem0 = () => (mem0Module ??= import("mem0ai/oss"));

const MemoryEnv = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  NEON_AI_GATEWAY_BASE_URL: z.string().url(),
  NEON_AI_GATEWAY_TOKEN: z.string().min(1),
});

/** Same model as answers; one place to change it is @debo/llm's DEFAULT_MODEL. */
const LLM_MODEL = "claude-haiku-5-5";
/** Neon AI Gateway embedding model and its vector size. */
const EMBED_MODEL = "qwen3-embedding-0-6b";
const EMBED_DIMS = 1024;
/** Mem0 makes `debo_memories` and `debo_memories_entities` in our Postgres. */
const COLLECTION = "debo_memories";

export type Memory = {
  id: string;
  text: string;
  sourceId: string;
  editedByUser: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type Mem0Item = {
  id: string;
  memory: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  runId?: string;
  [key: string]: unknown;
};

/**
 * @param connectionString Postgres to store memories in (Hyperdrive on Cloudflare, DATABASE_URL locally).
 * @param env Needs ANTHROPIC_API_KEY, NEON_AI_GATEWAY_BASE_URL and NEON_AI_GATEWAY_TOKEN.
 */
export function createMemory(connectionString: string, env: Record<string, string | undefined>) {
  const keys = MemoryEnv.parse(env);

  const config = {
    llm: { provider: "anthropic", config: { apiKey: keys.ANTHROPIC_API_KEY, model: LLM_MODEL } },
    embedder: {
      provider: "openai",
      config: {
        apiKey: keys.NEON_AI_GATEWAY_TOKEN,
        baseURL: `${keys.NEON_AI_GATEWAY_BASE_URL}/v1`,
        model: EMBED_MODEL,
      },
    },
    vectorStore: {
      provider: "pgvector",
      config: { connectionString, collectionName: COLLECTION, dimension: EMBED_DIMS, embeddingModelDims: EMBED_DIMS, hnsw: true },
    },
    // Mem0's default history store is a SQLite file on disk. We have no disk
    // on Workers and do not need a second copy of the text.
    disableHistory: true,
  };

  /** One Mem0 instance per call, and always close its database connections. */
  async function withMem0<T>(work: (m: Mem0) => Promise<T>): Promise<T> {
    const { Memory: Mem0Class } = await loadMem0();
    const m = new Mem0Class(config);
    // claude-haiku-5-5 rejects a `temperature` setting ("Extra inputs are not
    // permitted"). Mem0's Anthropic adapter always fills in 0.1 and only skips
    // the field when it is undefined, so clear it on the instance.
    const llm = (m as unknown as { llm?: { temperature?: number; topP?: number } }).llm;
    if (llm) {
      llm.temperature = undefined;
      llm.topP = undefined;
    }
    try {
      return await work(m);
    } finally {
      // Mem0 keeps a pg Client open on each store and has no close method.
      // On Workers a connection cannot outlive its request, so end them here.
      const stores = m as unknown as { vectorStore?: { client?: { end(): Promise<void> } }; _entityStore?: { client?: { end(): Promise<void> } } };
      await Promise.allSettled([stores.vectorStore?.client?.end(), stores._entityStore?.client?.end()]);
    }
  }

  function toMemory(item: Mem0Item): Memory | null {
    const sourceId = typeof item.metadata?.source_id === "string" ? item.metadata.source_id : null;
    if (!sourceId) return null; // never show a memory without its source
    return {
      id: item.id,
      text: item.memory,
      sourceId,
      editedByUser: item.metadata?.edited_by_user === true,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
    };
  }

  async function allFor(m: Mem0, userId: string, sourceId?: string): Promise<Mem0Item[]> {
    const filters: Record<string, string> = { user_id: userId };
    if (sourceId) filters.run_id = sourceId;
    const { results } = await m.getAll({ filters, topK: 10_000 });
    return results as Mem0Item[];
  }

  /** The item, only if it belongs to this person. */
  async function owned(m: Mem0, userId: string, memoryId: string): Promise<Mem0Item | null> {
    if (!z.string().uuid().safeParse(memoryId).success) return null;
    const item = (await m.get(memoryId)) as Mem0Item | null;
    if (!item) return null;
    const owner = item.userId ?? item.user_id ?? item.metadata?.user_id;
    return owner === userId ? item : null;
  }

  return {
    /** Read an entry and remember the lasting facts in it. Returns new or changed memory ids. */
    async rememberFromSource(input: { userId: string; sourceId: string; text: string }): Promise<string[]> {
      return withMem0(async (m) => {
        const { results } = await m.add(input.text, {
          userId: input.userId,
          runId: input.sourceId,
          metadata: { source_id: input.sourceId },
          infer: true,
        });
        return (results as Mem0Item[]).map((r) => r.id);
      });
    },

    /** Everything Debo knows about this person, each with its source. */
    async list(userId: string): Promise<Memory[]> {
      return withMem0(async (m) => (await allFor(m, userId)).map(toMemory).filter((x): x is Memory => x !== null));
    },

    /** The person fixes a memory. Kept even when its entry is re-read later. */
    async update(userId: string, memoryId: string, text: string): Promise<boolean> {
      const clean = z.string().trim().min(1).max(1000).parse(text);
      return withMem0(async (m) => {
        const item = await owned(m, userId, memoryId);
        if (!item) return false;
        await m.update(memoryId, { text: clean, metadata: { edited_by_user: true } });
        return true;
      });
    },

    /** Forget one memory for good. */
    async forget(userId: string, memoryId: string): Promise<boolean> {
      return withMem0(async (m) => {
        if (!(await owned(m, userId, memoryId))) return false;
        await m.delete(memoryId);
        return true;
      });
    },

    /**
     * Forget what came from one entry. Use when an entry is deleted
     * (everything goes) or edited (keepEditedByUser: true, then rememberFromSource).
     */
    async forgetSource(userId: string, sourceId: string, options: { keepEditedByUser?: boolean } = {}): Promise<number> {
      return withMem0(async (m) => {
        const items = await allFor(m, userId, sourceId);
        let count = 0;
        for (const item of items) {
          if (options.keepEditedByUser && item.metadata?.edited_by_user === true) continue;
          await m.delete(item.id);
          count += 1;
        }
        return count;
      });
    },

    /** Forget everything about this person. Use when they delete their account. */
    async forgetAll(userId: string): Promise<void> {
      await withMem0(async (m) => {
        await m.deleteAll({ userId });
      });
    },
  };
}

export type MemoryStore = ReturnType<typeof createMemory>;
