// Voice and video entries: the recording's record, its transcript, and the
// list that shows entries together with their recordings.
//
// A recording is a row in `media` plus a row in `sources` (kind voice or
// video) whose text is the transcript. So search, answers with sources,
// memories, export and delete all keep working the same as for written text.
// The file itself is in a private R2 bucket, never here.
// Every function takes userId and filters by it. Never log transcript text.
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { withDb } from "./client";
import { splitIntoChunks, titleFrom } from "./journal";
import { chunks, media, type SourceKind, sources, type TranscriptSegment, type TranscriptStatus } from "./schema";

export type { TranscriptSegment, TranscriptStatus };

export type MediaRecord = {
  id: string;
  userId: string;
  sourceId: string | null;
  kind: "voice" | "video";
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  recordedAt: Date | null;
  device: Record<string, string | number> | null;
  uploadState: "uploading" | "stored";
  uploadId: string | null;
  transcriptStatus: TranscriptStatus;
  transcriptError: string | null;
  transcriptAttempts: number;
  transcriptStartedAt: Date | null;
  language: string | null;
  segments: TranscriptSegment[] | null;
  contentHash: string | null;
  createdAt: Date;
};

/** An entry as the journal list shows it: written, voice or video. */
export type JournalItem = {
  id: string;
  kind: SourceKind;
  title: string;
  text: string;
  happenedAt: Date;
  media: MediaRecord | null;
};

const mediaColumns = {
  id: media.id,
  userId: media.userId,
  sourceId: media.sourceId,
  kind: media.kind,
  objectKey: media.objectKey,
  mimeType: media.mimeType,
  sizeBytes: media.sizeBytes,
  durationMs: media.durationMs,
  recordedAt: media.recordedAt,
  device: media.device,
  uploadState: media.uploadState,
  uploadId: media.uploadId,
  transcriptStatus: media.transcriptStatus,
  transcriptError: media.transcriptError,
  transcriptAttempts: media.transcriptAttempts,
  transcriptStartedAt: media.transcriptStartedAt,
  language: media.language,
  segments: media.segments,
  contentHash: media.contentHash,
  createdAt: media.createdAt,
};

export type NewMedia = {
  id: string;
  kind: "voice" | "video";
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number | null;
  recordedAt?: Date | null;
  device?: Record<string, string | number> | null;
  uploadId?: string | null;
};

/** Remember an upload that has started. No entry exists until it finishes. */
export async function startMedia(connectionString: string, userId: string, input: NewMedia): Promise<MediaRecord> {
  return withDb(connectionString, async (db) => {
    const [row] = await db
      .insert(media)
      .values({
        id: input.id,
        userId,
        kind: input.kind,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        durationMs: input.durationMs ?? null,
        recordedAt: input.recordedAt ?? null,
        device: input.device ?? null,
        uploadId: input.uploadId ?? null,
      })
      .returning(mediaColumns);
    if (!row) throw new Error("The upload was not started.");
    return row;
  });
}

export async function getMedia(connectionString: string, userId: string, mediaId: string): Promise<MediaRecord | null> {
  return withDb(connectionString, async (db) => {
    const [row] = await db
      .select(mediaColumns)
      .from(media)
      .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
      .limit(1);
    return row ?? null;
  });
}

export async function getMediaForSource(
  connectionString: string,
  userId: string,
  sourceId: string,
): Promise<MediaRecord | null> {
  return withDb(connectionString, async (db) => {
    const [row] = await db
      .select(mediaColumns)
      .from(media)
      .where(and(eq(media.sourceId, sourceId), eq(media.userId, userId)))
      .limit(1);
    return row ?? null;
  });
}

/**
 * The upload is done: create the entry (its words come later) and mark the
 * recording as waiting for its transcript. Safe to call twice: the second
 * call returns the same entry.
 */
export async function finishUpload(
  connectionString: string,
  userId: string,
  mediaId: string,
  input: { sizeBytes: number; happenedAt: Date; title: string },
): Promise<{ record: MediaRecord; created: boolean } | null> {
  return withDb(connectionString, (db) =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select(mediaColumns)
        .from(media)
        .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
        .for("update");
      if (!current) return null;
      if (current.sourceId) return { record: current, created: false };
      const [source] = await tx
        .insert(sources)
        .values({ userId, kind: current.kind, title: input.title, text: "", happenedAt: input.happenedAt })
        .returning({ id: sources.id });
      if (!source) throw new Error("The entry was not saved.");
      const [record] = await tx
        .update(media)
        .set({
          sourceId: source.id,
          uploadState: "stored",
          uploadId: null,
          sizeBytes: input.sizeBytes,
          transcriptStatus: "waiting",
        })
        .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
        .returning(mediaColumns);
      if (!record) throw new Error("The entry was not saved.");
      return { record, created: true };
    }),
  );
}

/**
 * Take the job of writing out a recording. Only one worker wins: a recording
 * that is `waiting` (or was `working` for over `staleMs`, because the server
 * stopped) becomes `working`. Returns null when someone else has it.
 */
export async function claimTranscript(
  connectionString: string,
  userId: string,
  mediaId: string,
  staleMs = 10 * 60_000,
): Promise<MediaRecord | null> {
  return withDb(connectionString, async (db) => {
    const stale = new Date(Date.now() - staleMs);
    const [row] = await db
      .update(media)
      .set({
        transcriptStatus: "working",
        transcriptError: null,
        transcriptStartedAt: new Date(),
        transcriptAttempts: sql`${media.transcriptAttempts} + 1`,
      })
      .where(
        and(
          eq(media.id, mediaId),
          eq(media.userId, userId),
          eq(media.uploadState, "stored"),
          or(
            eq(media.transcriptStatus, "waiting"),
            and(eq(media.transcriptStatus, "working"), lt(media.transcriptStartedAt, stale)),
          ),
        ),
      )
      .returning(mediaColumns);
    return row ?? null;
  });
}

/** Recordings still waiting (or stuck working) across all people, for the recovery sweep only. */
export async function pendingTranscripts(
  connectionString: string,
  staleMs = 10 * 60_000,
  limit = 20,
): Promise<{ id: string; userId: string }[]> {
  return withDb(connectionString, (db) => {
    const stale = new Date(Date.now() - staleMs);
    return db
      .select({ id: media.id, userId: media.userId })
      .from(media)
      .where(
        and(
          eq(media.uploadState, "stored"),
          or(
            eq(media.transcriptStatus, "waiting"),
            and(eq(media.transcriptStatus, "working"), lt(media.transcriptStartedAt, stale)),
          ),
          lt(media.transcriptAttempts, 4),
        ),
      )
      .limit(limit);
  });
}

/** Put a failed recording back in the queue ("Try again"). False if it is not this person's or not failed. */
export async function requeueTranscript(connectionString: string, userId: string, mediaId: string): Promise<boolean> {
  return withDb(connectionString, async (db) => {
    const rows = await db
      .update(media)
      .set({ transcriptStatus: "waiting", transcriptError: null, transcriptAttempts: 0 })
      .where(
        and(
          eq(media.id, mediaId),
          eq(media.userId, userId),
          eq(media.uploadState, "stored"),
          eq(media.transcriptStatus, "failed"),
        ),
      )
      .returning({ id: media.id });
    return rows.length > 0;
  });
}

export async function failTranscript(
  connectionString: string,
  userId: string,
  mediaId: string,
  reason: string,
): Promise<void> {
  await withDb(connectionString, (db) =>
    db
      .update(media)
      .set({ transcriptStatus: "failed", transcriptError: reason.slice(0, 40) })
      .where(and(eq(media.id, mediaId), eq(media.userId, userId))),
  );
}

export type Transcript = {
  text: string;
  language: string | null;
  segments: TranscriptSegment[];
  contentHash: string | null;
  durationMs: number | null;
};

/**
 * Save the finished transcript: the media row, the entry's text and its
 * pieces, in one transaction, so search never sees half of it. Returns false
 * if the entry was deleted while the transcript was being made.
 */
export async function saveTranscript(
  connectionString: string,
  userId: string,
  mediaId: string,
  transcript: Transcript,
): Promise<boolean> {
  return withDb(connectionString, (db) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .select({ sourceId: media.sourceId, kind: media.kind })
        .from(media)
        .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
        .for("update");
      if (!row?.sourceId) return false;
      const sourceId = row.sourceId;
      const text = transcript.text.trim();
      await tx
        .update(media)
        .set({
          transcriptStatus: "ready",
          transcriptError: null,
          language: transcript.language,
          segments: transcript.segments,
          contentHash: transcript.contentHash,
          ...(transcript.durationMs ? { durationMs: transcript.durationMs } : {}),
        })
        .where(and(eq(media.id, mediaId), eq(media.userId, userId)));
      const fallback = row.kind === "video" ? "Video" : "Voice note";
      await tx
        .update(sources)
        .set({ text, title: text ? titleFrom(text) : fallback, updatedAt: new Date() })
        .where(and(eq(sources.id, sourceId), eq(sources.userId, userId)));
      await tx.delete(chunks).where(and(eq(chunks.sourceId, sourceId), eq(chunks.userId, userId)));
      const pieces = text ? splitIntoChunks(text) : [];
      if (pieces.length > 0)
        await tx.insert(chunks).values(pieces.map((piece, position) => ({ userId, sourceId, position, text: piece })));
      return true;
    }),
  );
}

/** Another finished recording of this person with the same file hash, so its transcript can be reused. */
export async function findTranscriptByHash(
  connectionString: string,
  userId: string,
  contentHash: string,
  exceptMediaId: string,
): Promise<{ text: string; language: string | null; segments: TranscriptSegment[] } | null> {
  return withDb(connectionString, async (db) => {
    const [row] = await db
      .select({ text: sources.text, language: media.language, segments: media.segments })
      .from(media)
      .innerJoin(sources, eq(sources.id, media.sourceId))
      .where(
        and(
          eq(media.userId, userId),
          eq(media.contentHash, contentHash),
          eq(media.transcriptStatus, "ready"),
          ne(media.id, exceptMediaId),
        ),
      )
      .limit(1);
    return row ? { text: row.text, language: row.language, segments: row.segments ?? [] } : null;
  });
}

/**
 * The journal list: written entries, voice notes and videos, newest first,
 * each with its recording record. With `contains`, only entries whose words
 * have those letters (transcripts count).
 */
export async function listJournalItems(
  connectionString: string,
  userId: string,
  limit = 50,
  contains?: string,
): Promise<JournalItem[]> {
  const needle = contains?.trim().slice(0, 200);
  const pattern = needle ? `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
  return withDb(connectionString, async (db) => {
    const rows = await db
      .select({
        id: sources.id,
        kind: sources.kind,
        title: sources.title,
        text: sources.text,
        happenedAt: sources.happenedAt,
      })
      .from(sources)
      .where(
        and(
          eq(sources.userId, userId),
          inArray(sources.kind, ["journal", "voice", "video"]),
          pattern ? sql`${sources.text} ilike ${pattern}` : undefined,
        ),
      )
      .orderBy(desc(sources.happenedAt))
      .limit(limit);
    const ids = rows.filter((r) => r.kind !== "journal").map((r) => r.id);
    const records = ids.length
      ? await db
          .select(mediaColumns)
          .from(media)
          .where(and(eq(media.userId, userId), inArray(media.sourceId, ids)))
      : [];
    const bySource = new Map(records.map((r) => [r.sourceId, r]));
    return rows.map((r) => ({ ...r, media: bySource.get(r.id) ?? null }));
  });
}

/** Every recording this person has, including unfinished uploads. For delete-everything. */
export async function listMediaKeys(
  connectionString: string,
  userId: string,
): Promise<{ id: string; objectKey: string; uploadId: string | null }[]> {
  return withDb(connectionString, (db) =>
    db
      .select({ id: media.id, objectKey: media.objectKey, uploadId: media.uploadId })
      .from(media)
      .where(eq(media.userId, userId)),
  );
}

/** Forget a recording's record. Returns whether it existed. */
export async function deleteMediaRecord(connectionString: string, userId: string, mediaId: string): Promise<boolean> {
  return withDb(connectionString, async (db) => {
    const rows = await db
      .delete(media)
      .where(and(eq(media.id, mediaId), eq(media.userId, userId)))
      .returning({ id: media.id });
    return rows.length > 0;
  });
}

/** Uploads that never finished (no entry) and are older than `olderThanMs`. For the cleanup sweep. */
export async function staleUploads(
  connectionString: string,
  olderThanMs = 24 * 3_600_000,
  limit = 50,
): Promise<{ id: string; userId: string; objectKey: string; uploadId: string | null }[]> {
  return withDb(connectionString, (db) =>
    db
      .select({ id: media.id, userId: media.userId, objectKey: media.objectKey, uploadId: media.uploadId })
      .from(media)
      .where(and(isNull(media.sourceId), lt(media.createdAt, new Date(Date.now() - olderThanMs))))
      .limit(limit),
  );
}

/** Milliseconds of recordings this person added since midnight UTC (declared lengths), for the daily limit. */
export async function recordedMsToday(connectionString: string, userId: string): Promise<number> {
  return withDb(connectionString, async (db) => {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${media.durationMs}), 0)::bigint` })
      .from(media)
      .where(
        and(
          eq(media.userId, userId),
          isNotNull(media.durationMs),
          gte(media.createdAt, sql`date_trunc('day', now() at time zone 'utc') at time zone 'utc'`),
        ),
      );
    return Number(row?.total ?? 0);
  });
}

/** All of this person's finished recordings, for "Download my data". Metadata and transcripts; never the file. */
export async function exportMedia(connectionString: string, userId: string): Promise<MediaRecord[]> {
  return withDb(connectionString, (db) =>
    db
      .select(mediaColumns)
      .from(media)
      .where(and(eq(media.userId, userId), eq(media.uploadState, "stored"))),
  );
}
