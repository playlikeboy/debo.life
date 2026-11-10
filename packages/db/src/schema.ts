// Tables for phase 1. See docs/DATA-MODEL.md.
//
// Every table that holds a person's data has user_id, an index on it, and a
// foreign key to Neon Auth's user table with ON DELETE CASCADE, so deleting
// an account deletes every row the person owns.
import { sql } from "drizzle-orm";
import { customType, index, integer, pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  },
  (t) => [
    index("chunks_user_idx").on(t.userId),
    index("chunks_source_idx").on(t.sourceId),
    index("chunks_search_idx").using("gin", t.search),
  ],
);
