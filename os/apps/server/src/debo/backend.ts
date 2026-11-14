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
  claimTranscript,
  createEntry,
  deleteEntry,
  deleteMediaRecord,
  type Entry,
  exportMedia,
  failTranscript,
  findTranscriptByHash,
  finishUpload,
  type FoundPiece,
  getMedia,
  getMediaForSource,
  getSources,
  getTranscriptText,
  listActivity,
  listJournalItems,
  listMediaKeys,
  type MediaRecord,
  mediaToday,
  type NewMedia,
  pendingTranscripts,
  recordActivity,
  recordUsage,
  requeueTranscript,
  saveTranscript,
  searchPieces,
  setChunkEmbeddings,
  type SourceKind,
  staleUploads,
  startMedia,
  type Transcript,
  updateEntry,
} from "@debo/db";
import { createLlm } from "@debo/llm";
import { createMemory, type Memory } from "@debo/memory";

export type { ActivityAction, ActivityItem, AskEvent, Entry, FoundPiece, MediaRecord, Memory, NewMedia, SourceKind, Transcript };

/** An entry in the journal list: written (no kind), or a voice note or video with its recording. */
export type Item = Entry & { kind?: SourceKind; media?: MediaRecord | null };

/**
 * What is known about recordings. Every call is for one owner and one
 * recording. A backend without this has no recordings.
 */
export interface DeboMediaDb {
  start(owner: string, input: NewMedia): Promise<MediaRecord>;
  get(owner: string, id: string): Promise<MediaRecord | null>;
  forSource(owner: string, sourceId: string): Promise<MediaRecord | null>;
  /** The words of a voice or video entry. */
  text(owner: string, sourceId: string): Promise<string>;
  /** Creates the entry for a finished upload. Null when it is not this person's. */
  finish(
    owner: string,
    id: string,
    input: { sizeBytes: number; happenedAt: Date; title: string },
  ): Promise<{ record: MediaRecord; created: boolean } | null>;
  /** Take the transcript job. Null when it is not waiting, or someone else has it. */
  claim(owner: string, id: string): Promise<MediaRecord | null>;
  /** The jobs that are waiting or stuck, across people, for the recovery sweep. */
  pending(): Promise<{ id: string; userId: string }[]>;
  requeue(owner: string, id: string): Promise<boolean>;
  fail(owner: string, id: string, reason: string): Promise<void>;
  /** Save the words. False when the entry was deleted meanwhile. */
  save(owner: string, id: string, transcript: Transcript): Promise<boolean>;
  findByHash(
    owner: string,
    hash: string,
    exceptId: string,
  ): Promise<{ text: string; language: string | null; segments: Transcript["segments"] } | null>;
  keys(owner: string): Promise<{ id: string; objectKey: string; uploadId: string | null }[]>;
  remove(owner: string, id: string): Promise<boolean>;
  /** Uploads nobody finished, for cleanup. */
  stale(): Promise<{ id: string; userId: string; objectKey: string; uploadId: string | null }[]>;
  today(owner: string): Promise<{ count: number; ms: number }>;
  export(owner: string): Promise<MediaRecord[]>;
}

export interface DeboBackend {
  entries: {
    list(owner: string, options: { limit: number; contains?: string }): Promise<Item[]>;
    create(owner: string, text: string, happenedAt?: Date): Promise<Entry>;
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
  sources(owner: string, ids: string[]): Promise<{ id: string; kind?: SourceKind; title: string; happenedAt: Date }[]>;
  /** Null when hosted memory (Mem0) is not set up. */
  memories: {
    list(owner: string): Promise<Memory[]>;
    update(owner: string, id: string, text: string): Promise<Memory | null>;
    forget(owner: string, id: string): Promise<Memory | null>;
  } | null;
  /** Voice notes and videos. Missing when recordings are not available. */
  media?: DeboMediaDb;
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
      list: (owner, { limit, contains }) => listJournalItems(url, owner, limit, contains),
      create: (owner, text, happenedAt) => createEntry(url, owner, { text, happenedAt }),
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
    media: {
      start: (owner, input) => startMedia(url, owner, input),
      get: (owner, id) => getMedia(url, owner, id),
      forSource: (owner, sourceId) => getMediaForSource(url, owner, sourceId),
      text: (owner, sourceId) => getTranscriptText(url, owner, sourceId),
      finish: (owner, id, input) => finishUpload(url, owner, id, input),
      claim: (owner, id) => claimTranscript(url, owner, id),
      pending: () => pendingTranscripts(url),
      requeue: (owner, id) => requeueTranscript(url, owner, id),
      fail: (owner, id, reason) => failTranscript(url, owner, id, reason),
      save: (owner, id, transcript) => saveTranscript(url, owner, id, transcript),
      findByHash: (owner, hash, exceptId) => findTranscriptByHash(url, owner, hash, exceptId),
      keys: (owner) => listMediaKeys(url, owner),
      remove: (owner, id) => deleteMediaRecord(url, owner, id),
      stale: () => staleUploads(url),
      today: (owner) => mediaToday(url, owner),
      export: (owner) => exportMedia(url, owner),
    },
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
