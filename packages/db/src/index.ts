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
export { EMBEDDING_DIMENSIONS, type SourceKind } from "./schema";
export {
  claimTranscript,
  deleteMediaRecord,
  exportMedia,
  failTranscript,
  findTranscriptByHash,
  finishUpload,
  getMedia,
  getMediaForSource,
  getTranscriptText,
  listJournalItems,
  listMediaKeys,
  pendingTranscripts,
  mediaToday,
  requeueTranscript,
  saveTranscript,
  staleUploads,
  startMedia,
  type JournalItem,
  type MediaRecord,
  type NewMedia,
  type Transcript,
  type TranscriptSegment,
  type TranscriptStatus,
} from "./media";
export { exportRecords, type ExportEntry, type ExportRecords } from "./export";
export {
  chatTitleFrom,
  deleteConversation,
  exportChats,
  getConversation,
  listConversations,
  saveExchange,
  type ChatKind,
  type ChatMessage,
  type ChatReply,
  type ChatRole,
  type ChatSummary,
  type ExportChat,
} from "./chats";
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
 * memberships, and ours cascade to sources, chunks, usage, activity,
 * conversations and messages.
 * Tables left by the old self-hosted Mem0 (decision 18; no foreign keys) are
 * cleared here by payload.user_id if they exist. Memories in the hosted Mem0
 * Platform are deleted by @debo/memory, and files by @debo/ingest, before
 * this runs.
 *
 * Returns whether a row was deleted.
 */
export async function deleteAccount(connectionString: string, userId: string): Promise<boolean> {
  return withDb(connectionString, async (db) =>
    db.transaction(async (tx) => {
      for (const table of ["debo_memories", "debo_memories_entities"]) {
        const exists = await tx.execute<{ t: string | null }>(sql`select to_regclass(${`public.${table}`})::text as t`);
        if (exists.rows[0]?.t) {
          await tx.execute(sql`delete from ${sql.identifier(table)} where payload->>'user_id' = ${userId}`);
        }
      }
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
export {
  Autonomy,
  DEFAULT_SETTINGS,
  getUserSettings,
  updateUserSettings,
  UserSettings,
} from "./settings";
