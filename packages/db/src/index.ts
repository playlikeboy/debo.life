// @debo/db: the only package that talks to Postgres.
import { sql } from "drizzle-orm";
import { withDb } from "./client";

export { withDb, type Db } from "./client";
export {
  createEntry,
  deleteEntry,
  getSources,
  listEntries,
  NewEntry,
  chunksForSource,
  chunksMissingEmbeddings,
  DEFAULT_MAX_DISTANCE,
  searchPieces,
  setChunkEmbeddings,
  setEmbeddingById,
  splitIntoChunks,
  updateEntry,
  type Entry,
  type FoundPiece,
  type SearchOptions,
} from "./journal";
export { EMBEDDING_DIMENSIONS } from "./schema";
export {
  listActivity,
  recordActivity,
  recordUsage,
  tokensUsedToday,
  type ActivityAction,
  type ActivityItem,
  type UsageRow,
} from "./records";

/**
 * Delete a person's account for good.
 *
 * Neon Auth keeps users in the `neon_auth` schema of our own database. Its
 * foreign keys cascade from `user` to sessions, sign-in accounts and
 * memberships, and ours cascade to sources and chunks. Files are deleted
 * separately by @debo/ingest before this runs.
 *
 * Returns whether a row was deleted.
 */
export async function deleteAccount(connectionString: string, userId: string): Promise<boolean> {
  return withDb(connectionString, async (db) =>
    db.transaction(async (tx) => {
      const result = await tx.execute(sql`delete from neon_auth."user" where id = ${userId}`);
      return (result.rowCount ?? 0) > 0;
    }),
  );
}

/** A tiny read that proves the database answers. Returns no user data. */
export async function checkDatabase(connectionString: string): Promise<{ serverVersion: string }> {
  return withDb(connectionString, async (db) => {
    const result = await db.execute<{ server_version: string }>(sql`show server_version`);
    const row = result.rows[0];
    if (!row) throw new Error("The database did not return a version.");
    return { serverVersion: row.server_version };
  });
}
