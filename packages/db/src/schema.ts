// Tables for phase 1. See docs/DATA-MODEL.md.
//
// Every table that holds a person's data has user_id, an index on it, and a
// foreign key to Neon Auth's user table with ON DELETE CASCADE, so deleting
// an account deletes every row the person owns.
import { sql } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Size of the vectors from the embedding model (see @debo/llm EMBEDDING_DIMENSIONS). */
export const EMBEDDING_DIMENSIONS = 1024;

// Neon Auth owns this table. We only point at it; drizzle-kit is limited to
// the public schema (drizzle.config.ts), so it never tries to change it.
const neonAuth = pgSchema("neon_auth");
export const authUsers = neonAuth.table("user", { id: uuid("id").primaryKey() });

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/** What a source is. A voice or video entry keeps its transcript as the text. */
export type SourceKind = "journal" | "voice" | "video";

/** One thing the person gave Debo: a journal entry, a voice note or a video. */
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    // Plain text column: adding a kind needs no migration.
    kind: text("kind").$type<SourceKind>().notNull(),
    title: text("title").notNull(),
    text: text("text").notNull(),
    happenedAt: timestamp("happened_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sources_user_happened_idx").on(t.userId, t.happenedAt)],
);

/**
 * One row per model call, for daily limits and costs.
 * Numbers only: never the question, the answer or any note text.
 */
export const usage = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"chat">().notNull(),
    provider: text("provider").$type<"anthropic" | "neon">().notNull(),
    keyOwner: text("key_owner").$type<"debo" | "user">().notNull(),
    units: integer("units").notNull(), // input + output tokens
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_user_created_idx").on(t.userId, t.createdAt)],
);

/** What the activity record can say happened. Memory actions carry the entry the memory came from. */
export type ActivityAction = "saved" | "edited" | "deleted" | "answered" | "did-not-know" | "exported" | "fixed-memory" | "forgot-memory";

/**
 * The record a person can read: what Debo saved, changed, deleted and answered.
 * Ids and times only, never content. Promise 7: nothing happens in secret.
 */
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    actor: text("actor").$type<"you" | "debo">().notNull(),
    // Plain text column: adding an action needs no migration.
    action: text("action").$type<ActivityAction>().notNull(),
    sourceIds: uuid("source_ids").array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_user_created_idx").on(t.userId, t.createdAt)],
);

/** Pieces of a source, for search. Embeddings come when an embedding model is available. */
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('english', text)`),
    // Meaning search. Null until the piece has been embedded.
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (t) => [
    index("chunks_user_idx").on(t.userId),
    index("chunks_source_idx").on(t.sourceId),
    index("chunks_search_idx").using("gin", t.search),
    index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/**
 * One chat with Debo. The id is the chat's thread id, made in the browser,
 * so the first answer can save it without an extra round trip. The title is
 * the first question, cut short, so the person can find the chat again.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_user_updated_idx").on(t.userId, t.updatedAt)],
);

/** Who said a chat message: the person, or Debo. */
export type ChatRole = "person" | "debo";

/**
 * What kind of message it is. The person always asks a `question`. Debo
 * replies with an `answer` (with sources), `unknown` (nothing found),
 * `limit` (daily limit reached), `error` (could not answer) or `stopped`
 * (the person stopped the answer; the text is what was shown by then).
 */
export type ChatKind = "question" | "answer" | "unknown" | "limit" | "error" | "stopped";

/** One message in a chat. Debo's answers keep the ids of the entries they used. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<ChatRole>().notNull(),
    // Plain text column: adding a kind needs no migration.
    kind: text("kind").$type<ChatKind>().notNull(),
    text: text("text").notNull(),
    sourceIds: uuid("source_ids").array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_user_idx").on(t.userId),
    index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
  ],
);

/** Where a recording is in the process of being written out. */
export type TranscriptStatus = "waiting" | "working" | "ready" | "failed";

/** One piece of a transcript, with times in seconds. */
export type TranscriptSegment = { start: number; end: number; text: string };

/**
 * The recording behind a voice or video entry. The file itself lives in a
 * private Cloudflare R2 bucket, never in this database: this row holds where
 * it is (object_key) and what we know about it. The words are in sources.text
 * (and in chunks, for search), so answers, memories, export and delete work
 * the same as for a written entry. Deleting the source deletes this row; the
 * server deletes the R2 object in the same request.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    // Empty while the upload is still going; set once the entry exists.
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"voice" | "video">().notNull(),
    // "<user id>/<random id>.<ext>" in the bucket.
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    durationMs: integer("duration_ms"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    // Only what is safe to keep: { source: "recorded" | "picked", fileName?, lastModified? }. Never location.
    device: jsonb("device").$type<Record<string, string | number>>(),
    uploadState: text("upload_state").$type<"uploading" | "stored">().notNull().default("uploading"),
    // Set only while a multipart upload is open.
    uploadId: text("upload_id"),
    transcriptStatus: text("transcript_status").$type<TranscriptStatus>().notNull().default("waiting"),
    // A short plain code ("too-long", "engine"), never text from the recording.
    transcriptError: text("transcript_error"),
    transcriptAttempts: integer("transcript_attempts").notNull().default(0),
    transcriptStartedAt: timestamp("transcript_started_at", { withTimezone: true }),
    language: text("language"),
    segments: jsonb("segments").$type<TranscriptSegment[]>(),
    // SHA-256 of the file, set while it is transcribed. Lets Debo reuse a transcript for the same file.
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("media_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("media_source_idx").on(t.sourceId),
    index("media_user_hash_idx").on(t.userId, t.contentHash),
    index("media_transcript_idx").on(t.uploadState, t.transcriptStatus),
  ],
);
