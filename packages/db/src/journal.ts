// Journal entries and keyword search over them.
// Every function takes userId and filters by it. Callers cannot skip that.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { withDb } from "./client";
import { chunks, sources } from "./schema";

export const NewEntry = z.object({
  text: z.string().trim().min(1, "Write something first.").max(20_000, "That entry is too long. Keep it under 20,000 characters."),
});

export type Entry = { id: string; title: string; text: string; happenedAt: Date };

/** Short name for source chips: the first line, cut to 60 characters. */
function titleFrom(text: string) {
  const firstLine = text.split("\n").find((line) => line.trim())?.trim() ?? "Journal entry";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

/** Split long entries at paragraph breaks into pieces of about 1,200 characters. */
export function splitIntoChunks(text: string, size = 1200): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n\s*\n/)) {
    if (current && current.length + paragraph.length > size) {
      pieces.push(current.trim());
      current = "";
    }
    current += `${paragraph}\n\n`;
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces.flatMap((p) => (p.length <= size * 2 ? [p] : p.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? []));
}

export async function createEntry(connectionString: string, userId: string, input: unknown): Promise<Entry> {
  const { text } = NewEntry.parse(input);
  return withDb(connectionString, (db) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .insert(sources)
        .values({ userId, kind: "journal", title: titleFrom(text), text })
        .returning({ id: sources.id, title: sources.title, text: sources.text, happenedAt: sources.happenedAt });
      if (!row) throw new Error("The entry was not saved.");
      const pieces = splitIntoChunks(text);
      await tx.insert(chunks).values(pieces.map((piece, position) => ({ userId, sourceId: row.id, position, text: piece })));
      return row;
    }),
  );
}

export async function listEntries(connectionString: string, userId: string, limit = 50): Promise<Entry[]> {
  return withDb(connectionString, (db) =>
    db
      .select({ id: sources.id, title: sources.title, text: sources.text, happenedAt: sources.happenedAt })
      .from(sources)
      .where(and(eq(sources.userId, userId), eq(sources.kind, "journal")))
      .orderBy(desc(sources.happenedAt))
      .limit(limit),
  );
}

/**
 * Replace an entry's text and rebuild its pieces in one transaction, so
 * search never sees the old text. Returns false if it is not this person's.
 */
export async function updateEntry(
  connectionString: string,
  userId: string,
  sourceId: string,
  input: unknown,
): Promise<boolean> {
  if (!z.string().uuid().safeParse(sourceId).success) return false;
  const { text } = NewEntry.parse(input);
  return withDb(connectionString, (db) =>
    db.transaction(async (tx) => {
      const updated = await tx
        .update(sources)
        .set({ text, title: titleFrom(text), updatedAt: new Date() })
        .where(and(eq(sources.id, sourceId), eq(sources.userId, userId)))
        .returning({ id: sources.id });
      if (updated.length === 0) return false;
      await tx.delete(chunks).where(and(eq(chunks.sourceId, sourceId), eq(chunks.userId, userId)));
      const pieces = splitIntoChunks(text);
      await tx.insert(chunks).values(pieces.map((piece, position) => ({ userId, sourceId, position, text: piece })));
      return true;
    }),
  );
}

/** Delete one entry and its pieces. Returns whether it existed for this person. */
export async function deleteEntry(connectionString: string, userId: string, sourceId: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(sourceId).success) return false;
  return withDb(connectionString, async (db) => {
    const deleted = await db
      .delete(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.userId, userId)))
      .returning({ id: sources.id });
    return deleted.length > 0;
  });
}

export type FoundPiece = { chunkId: string; sourceId: string; title: string; happenedAt: Date; text: string };

/**
 * Keyword search over the person's pieces. Any word may match (OR), ranked
 * by how well each piece matches. Meaning search joins this later.
 */
export async function searchPieces(
  connectionString: string,
  userId: string,
  question: string,
  limit = 6,
): Promise<FoundPiece[]> {
  return withDb(connectionString, async (db) => {
    const query = sql`nullif(replace(plainto_tsquery('english', ${question})::text, '&', '|'), '')::tsquery`;
    const rows = await db
      .select({
        chunkId: chunks.id,
        sourceId: chunks.sourceId,
        title: sources.title,
        happenedAt: sources.happenedAt,
        text: chunks.text,
      })
      .from(chunks)
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(and(eq(chunks.userId, userId), eq(sources.userId, userId), sql`${chunks.search} @@ ${query}`))
      .orderBy(sql`ts_rank(${chunks.search}, ${query}) desc`, desc(sources.happenedAt))
      .limit(limit);
    return rows;
  });
}

/** Look up sources by id, only among this person's own. */
export async function getSources(connectionString: string, userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return withDb(connectionString, (db) =>
    db
      .select({ id: sources.id, title: sources.title, happenedAt: sources.happenedAt })
      .from(sources)
      .where(and(eq(sources.userId, userId), inArray(sources.id, ids))),
  );
}
