// Tables for phase 1. See docs/DATA-MODEL.md.
//
// Every table that holds a person's data has user_id, an index on it, and a
// foreign key to Neon Auth's user table with ON DELETE CASCADE, so deleting
// an account deletes every row the person owns.
import { sql } from "drizzle-orm";
import { customType, index, integer, pgSchema, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

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

/** One thing the person gave Debo. Today only journal entries. */
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"journal">().notNull(),
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
