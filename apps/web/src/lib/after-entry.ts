import "server-only";
import { chunksForSource } from "@debo/db";
import { indexSource } from "@debo/ingest";
import { memoryStore } from "@/lib/memory";
import { databaseUrl, serverEnv } from "@/lib/server-env";

// Work that runs after an entry is saved, edited or deleted, once the person
// already has their answer (Next's `after`). It cannot lose or block an entry:
// keyword search works without embeddings, and the backfill script
// (pnpm --filter @debo/db db:backfill-embeddings) catches up on anything missed.
// Memory (Mem0) is off when MEM0_API_KEY is not set. Logs carry ids only.

const reason = (error: unknown) => (error instanceof Error ? error.name : "unknown");

/** Make the entry searchable by meaning, then let Debo remember what is in it. */
export async function afterEntryChanged(userId: string, sourceId: string) {
  try {
    await indexSource(databaseUrl(), serverEnv(), userId, sourceId);
  } catch (error) {
    console.error("index entry failed", { userId, sourceId, reason: reason(error) });
  }
  await rememberEntry(userId, sourceId);
}

/** After an entry is deleted: forget everything Debo learned from it. */
export async function afterEntryDeleted(userId: string, sourceId: string) {
  const memory = memoryStore();
  if (!memory) return;
  try {
    const forgotten = await memory.forgetSource(userId, sourceId);
    console.info("entry memories forgotten", { userId, sourceId, forgotten });
  } catch (error) {
    console.error("forget entry memories failed", { userId, sourceId, reason: reason(error) });
  }
}

/**
 * Re-read the entry for memories. On an edit, memories from the old text go
 * first, except the ones the person fixed themselves. The text is read fresh
 * from the database, so two quick edits both end with the latest words.
 */
async function rememberEntry(userId: string, sourceId: string) {
  const memory = memoryStore();
  if (!memory) return;
  try {
    const pieces = await chunksForSource(databaseUrl(), userId, sourceId);
    const forgotten = await memory.forgetSource(userId, sourceId, { keepEditedByUser: true });
    if (pieces.length === 0) return; // deleted in the meantime
    const eventId = await memory.rememberFromSource({
      userId,
      sourceId,
      text: pieces.map((p) => p.text).join("\n\n"),
    });
    console.info("entry sent to memory", { userId, sourceId, forgotten, eventId });
  } catch (error) {
    console.error("remember entry failed", { userId, sourceId, reason: reason(error) });
  }
}
