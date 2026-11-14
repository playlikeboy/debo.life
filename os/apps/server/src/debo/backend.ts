// Debo's personal brain, as the platform sees it: one small interface over the
// shared packages (@debo/db, @debo/llm, @debo/memory, @debo/brain).
//
// The routes and agent tools only ever talk to DeboBackend, so tests give them
// a fake and the real thing is wired in one place (realBackend below).
// Never log entry text, questions, answers or memories. Ids and counts only.
import { type AskEvent, createBrain, dbStore } from "@debo/brain";
import {
  type ActivityAction,
  type ActivityItem,
  chunksForSource,
  createEntry,
  deleteEntry,
  type Entry,
  type FoundPiece,
  getSources,
  listActivity,
  listEntries,
  recordActivity,
  recordUsage,
  searchPieces,
  setChunkEmbeddings,
  updateEntry,
} from "@debo/db";
import { createLlm } from "@debo/llm";
import { createMemory, type Memory } from "@debo/memory";

export type { ActivityAction, ActivityItem, AskEvent, Entry, FoundPiece, Memory };

export interface DeboBackend {
  entries: {
    list(owner: string, options: { limit: number; contains?: string }): Promise<Entry[]>;
    create(owner: string, text: string): Promise<Entry>;
    /** False when the entry is not this person's. */
    update(owner: string, id: string, text: string): Promise<boolean>;
    /** False when the entry is not this person's. */
    remove(owner: string, id: string): Promise<boolean>;
  };
  /** Pieces of this person's entries that match a search, best first. */
  search(owner: string, query: string, limit: number): Promise<FoundPiece[]>;
  /** The one brain: the same pipeline the web app uses. */
  ask(owner: string, question: string, signal?: AbortSignal): AsyncGenerator<AskEvent, void>;
  /** Entries by id, only among this person's own. */
  sources(owner: string, ids: string[]): Promise<{ id: string; title: string; happenedAt: Date }[]>;
  /** Null when hosted memory (Mem0) is not set up. */
  memories: {
    list(owner: string): Promise<Memory[]>;
    update(owner: string, id: string, text: string): Promise<Memory | null>;
    forget(owner: string, id: string): Promise<Memory | null>;
  } | null;
  activity: {
    list(owner: string, limit: number): Promise<ActivityItem[]>;
    record(owner: string, item: { actor: "you" | "debo"; action: ActivityAction; sourceIds?: string[] }): Promise<void>;
  };
  /**
   * Work after an entry is saved, edited or deleted: make it searchable by
   * meaning, then let Debo remember what is in it (or forget it). Must not
   * throw: the person's entry is already safe.
   */
  afterChange(owner: string, entryId: string, change: "saved" | "deleted"): Promise<void>;
  /** Whether the AI side (answers) has a provider key. Entries work without it. */
  askConfigured: boolean;
}

type Env = Record<string, string | undefined>;

/** Where the Debo tables live. DEBO_DATABASE_URL first, then DATABASE_URL. */
export function deboDatabaseUrl(env: Env = process.env): string | undefined {
  return env.DEBO_DATABASE_URL?.trim() || env.DATABASE_URL?.trim() || undefined;
}

/** True when the AI package could answer: an Anthropic key, or the Neon gateway pair. */
export function llmConfigured(env: Env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim() || (env.NEON_AI_GATEWAY_BASE_URL?.trim() && env.NEON_AI_GATEWAY_TOKEN?.trim()));
}

/** Meaning search needs the Neon gateway (Anthropic makes no embeddings). */
function gatewayConfigured(env: Env): boolean {
  return Boolean(env.NEON_AI_GATEWAY_BASE_URL?.trim() && env.NEON_AI_GATEWAY_TOKEN?.trim());
}

const reason = (error: unknown) => (error instanceof Error ? error.name : "unknown");

export function realBackend(url: string, env: Env): DeboBackend {
  const memory = createMemory(env);
  const llm = () => createLlm(env);
  const brain = () => createBrain({ store: dbStore(url), llm: llm() });

  return {
    entries: {
      list: (owner, { limit, contains }) => listEntries(url, owner, limit, contains),
      create: (owner, text) => createEntry(url, owner, { text }),
      update: (owner, id, text) => updateEntry(url, owner, id, { text }),
      remove: (owner, id) => deleteEntry(url, owner, id),
    },
    async search(owner, query, limit) {
      // Meaning search is a bonus; keywords alone still find things.
      let embedding: number[] | undefined;
      if (gatewayConfigured(env)) {
        try {
          const { vectors, tokens } = await llm().embed([query]);
          embedding = vectors[0];
          await recordUsage(url, owner, { provider: "neon", units: tokens });
        } catch (error) {
          console.error("journal search embedding failed", { owner, reason: reason(error) });
        }
      }
      return searchPieces(url, owner, query, { embedding, limit });
    },
    ask: (owner, question, signal) => brain().askStream(owner, question, { signal }),
    sources: (owner, ids) => getSources(url, owner, ids),
    memories: memory
      ? {
          list: (owner) => memory.list(owner),
          update: (owner, id, text) => memory.update(owner, id, text),
          forget: (owner, id) => memory.forget(owner, id),
        }
      : null,
    activity: {
      list: (owner, limit) => listActivity(url, owner, limit),
      record: (owner, item) => recordActivity(url, owner, item),
    },
    async afterChange(owner, entryId, change) {
      if (change === "deleted") {
        if (!memory) return;
        try {
          const forgotten = await memory.forgetSource(owner, entryId);
          console.info("entry memories forgotten", { owner, entryId, forgotten });
        } catch (error) {
          console.error("forget entry memories failed", { owner, entryId, reason: reason(error) });
        }
        return;
      }
      // Search by meaning. Keyword search works without it, so a failure here loses nothing.
      if (gatewayConfigured(env)) {
        try {
          const pieces = await chunksForSource(url, owner, entryId);
          if (pieces.length > 0) {
            const { vectors, tokens } = await llm().embed(pieces.map((p) => p.text));
            await setChunkEmbeddings(url, owner, entryId, vectors);
            await recordUsage(url, owner, { provider: "neon", units: tokens });
          }
        } catch (error) {
          console.error("index entry failed", { owner, entryId, reason: reason(error) });
        }
      }
      if (!memory) return;
      try {
        // Read fresh, so two quick edits both end with the latest words. Fixed memories stay.
        const pieces = await chunksForSource(url, owner, entryId);
        const forgotten = await memory.forgetSource(owner, entryId, { keepEditedByUser: true });
        if (pieces.length === 0) return; // deleted in the meantime
        const eventId = await memory.rememberFromSource({
          userId: owner,
          sourceId: entryId,
          text: pieces.map((p) => p.text).join("\n\n"),
        });
        console.info("entry sent to memory", { owner, entryId, forgotten, eventId });
      } catch (error) {
        console.error("remember entry failed", { owner, entryId, reason: reason(error) });
      }
    },
    askConfigured: llmConfigured(env),
  };
}
