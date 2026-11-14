// Journal entries and keyword search over them.
// Every function takes userId and filters by it. Callers cannot skip that.
import { and, asc, cosineDistance, desc, eq, ilike, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { withDb } from "./client";
import { chunks, type SourceKind, sources } from "./schema";

export const NewEntry = z.object({
  /** When it happened, if the person changed the date. Not in the future by more than a day. */
  happenedAt: z.coerce
    .date()
    .refine((d) => d.getTime() < Date.now() + 86_400_000, "Pick a day that is not in the future.")
    .optional(),
  text: z.string().trim().min(1, "Write something first.").max(20_000, "That entry is too long. Keep it under 20,000 characters."),
});

export type Entry = { id: string; title: string; text: string; happenedAt: Date };

/** Short name for source chips: the first line, cut to 60 characters. */
export function titleFrom(text: string) {
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
  const { text, happenedAt } = NewEntry.parse(input);
  return withDb(connectionString, (db) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .insert(sources)
        .values({ userId, kind: "journal", title: titleFrom(text), text, ...(happenedAt ? { happenedAt } : {}) })
        .returning({ id: sources.id, title: sources.title, text: sources.text, happenedAt: sources.happenedAt });
      if (!row) throw new Error("The entry was not saved.");
      const pieces = splitIntoChunks(text);
      await tx.insert(chunks).values(pieces.map((piece, position) => ({ userId, sourceId: row.id, position, text: piece })));
      return row;
    }),
  );
}

/**
 * The person's journal entries, newest first. With `contains`, only entries
 * whose text has those exact letters (any case), for the journal's "Find" box.
 */
export async function listEntries(
  connectionString: string,
  userId: string,
  limit = 50,
  contains?: string,
): Promise<Entry[]> {
  const needle = contains?.trim().slice(0, 200);
  // Escape LIKE's wildcards so "50%" finds "50%", not everything.
  const pattern = needle ? `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
  return withDb(connectionString, (db) =>
    db
      .select({ id: sources.id, title: sources.title, text: sources.text, happenedAt: sources.happenedAt })
      .from(sources)
      .where(and(eq(sources.userId, userId), eq(sources.kind, "journal"), pattern ? ilike(sources.text, pattern) : undefined))
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

export type FoundPiece = {
  chunkId: string;
  sourceId: string;
  /** Missing on pieces made before kinds existed: those are journal entries. */
  kind?: SourceKind;
  title: string;
  happenedAt: Date;
  text: string;
};

export type SearchOptions = {
  /** The question's embedding. Without it, search is keyword-only. */
  embedding?: number[];
  /** How many pieces to return. */
  limit?: number;
  /**
   * Vector matches farther than this cosine distance are dropped, so an
   * unrelated question finds nothing instead of the "least bad" piece.
   */
  maxDistance?: number;
};

/**
 * Cosine distance cut-off for meaning matches (qwen3-embedding-0-6b).
 * Measured on dev-ai: "what did the doctor say" vs an entry about seeing
 * the physician = 0.52; unrelated pairs = 0.71 to 0.88. 0.60 sits between.
 * The model still decides whether the pieces answer the question.
 */
export const DEFAULT_MAX_DISTANCE = 0.6;

const pieceColumns = {
  chunkId: chunks.id,
  sourceId: chunks.sourceId,
  kind: sources.kind,
  title: sources.title,
  happenedAt: sources.happenedAt,
  text: chunks.text,
};

/**
 * Search the person's pieces. Two searches, both filtered by user_id:
 * keyword (any word may match, ranked by ts_rank) and, when an embedding is
 * given, meaning (cosine distance, within maxDistance). Results are merged
 * with reciprocal rank fusion and de-duplicated by piece.
 */
export async function searchPieces(
  connectionString: string,
  userId: string,
  question: string,
  options: SearchOptions | number = {},
): Promise<FoundPiece[]> {
  const opts = typeof options === "number" ? { limit: options } : options;
  const limit = opts.limit ?? 6;
  const maxDistance = opts.maxDistance ?? DEFAULT_MAX_DISTANCE;

  return withDb(connectionString, async (db) => {
    const query = sql`nullif(replace(plainto_tsquery('english', ${question})::text, '&', '|'), '')::tsquery`;
    const keyword = await db
      .select(pieceColumns)
      .from(chunks)
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(and(eq(chunks.userId, userId), eq(sources.userId, userId), sql`${chunks.search} @@ ${query}`))
      .orderBy(sql`ts_rank(${chunks.search}, ${query}) desc`, desc(sources.happenedAt))
      .limit(limit * 2);

    if (!opts.embedding) return keyword.slice(0, limit);

    const distance = cosineDistance(chunks.embedding, opts.embedding);
    const meaning = await db
      .select(pieceColumns)
      .from(chunks)
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(
        and(
          eq(chunks.userId, userId),
          eq(sources.userId, userId),
          isNotNull(chunks.embedding),
          lt(distance, maxDistance),
        ),
      )
      .orderBy(distance)
      .limit(limit * 2);

    return mergeByRank([keyword, meaning], limit);
  });
}

/** Reciprocal rank fusion: score = sum of 1 / (60 + rank) across lists. */
function mergeByRank(lists: FoundPiece[][], limit: number): FoundPiece[] {
  const scores = new Map<string, { piece: FoundPiece; score: number }>();
  for (const list of lists) {
    list.forEach((piece, rank) => {
      const entry = scores.get(piece.chunkId) ?? { piece, score: 0 };
      entry.score += 1 / (60 + rank + 1);
      scores.set(piece.chunkId, entry);
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || b.piece.happenedAt.getTime() - a.piece.happenedAt.getTime())
    .slice(0, limit)
    .map((entry) => entry.piece);
}

/** The pieces of one source, in order, for embedding. Only this person's. */
export async function chunksForSource(
  connectionString: string,
  userId: string,
  sourceId: string,
): Promise<{ id: string; text: string }[]> {
  return withDb(connectionString, (db) =>
    db
      .select({ id: chunks.id, text: chunks.text })
      .from(chunks)
      .where(and(eq(chunks.sourceId, sourceId), eq(chunks.userId, userId)))
      .orderBy(asc(chunks.position)),
  );
}

/**
 * Store embeddings for one source's pieces, in position order.
 * `vectors[i]` belongs to the piece at position i. Only this person's pieces.
 */
export async function setChunkEmbeddings(
  connectionString: string,
  userId: string,
  sourceId: string,
  vectors: number[][],
): Promise<number> {
  return withDb(connectionString, (db) =>
    db.transaction(async (tx) => {
      const pieces = await tx
        .select({ id: chunks.id })
        .from(chunks)
        .where(and(eq(chunks.sourceId, sourceId), eq(chunks.userId, userId)))
        .orderBy(asc(chunks.position));
      if (pieces.length !== vectors.length) {
        throw new Error(`Expected ${pieces.length} embeddings for this entry, got ${vectors.length}.`);
      }
      for (const [i, piece] of pieces.entries()) {
        await tx
          .update(chunks)
          .set({ embedding: vectors[i] })
          .where(and(eq(chunks.id, piece.id), eq(chunks.userId, userId)));
      }
      return pieces.length;
    }),
  );
}

/**
 * Pieces that still need an embedding, across all people, for the backfill
 * job only. Returns ids and text; never log the text.
 */
export async function chunksMissingEmbeddings(
  connectionString: string,
  limit = 100,
): Promise<{ id: string; userId: string; text: string }[]> {
  return withDb(connectionString, (db) =>
    db
      .select({ id: chunks.id, userId: chunks.userId, text: chunks.text })
      .from(chunks)
      .where(isNull(chunks.embedding))
      .limit(limit),
  );
}

/** Backfill only: set one piece's embedding by id. */
export async function setEmbeddingById(connectionString: string, chunkId: string, vector: number[]) {
  await withDb(connectionString, (db) => db.update(chunks).set({ embedding: vector }).where(eq(chunks.id, chunkId)));
}

/** Look up sources by id, only among this person's own. */
export async function getSources(connectionString: string, userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return withDb(connectionString, (db) =>
    db
      .select({ id: sources.id, kind: sources.kind, title: sources.title, happenedAt: sources.happenedAt })
      .from(sources)
      .where(and(eq(sources.userId, userId), inArray(sources.id, ids))),
  );
}
