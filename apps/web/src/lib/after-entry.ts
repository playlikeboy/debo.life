import "server-only";
import { indexSource } from "@debo/ingest";
import { databaseUrl, serverEnv } from "@/lib/server-env";

// Work that runs after an entry is saved or edited, once the person already
// has their answer (Next's `after`). It cannot lose or block an entry:
// keyword search works without embeddings, and the backfill script
// (pnpm --filter @debo/db db:backfill-embeddings) catches up on anything missed.

/** Make the entry searchable by meaning. */
export async function afterEntryChanged(userId: string, sourceId: string) {
  try {
    await indexSource(databaseUrl(), serverEnv(), userId, sourceId);
  } catch (error) {
    console.error("index entry failed", { userId, sourceId, reason: error instanceof Error ? error.name : "unknown" });
  }
}
