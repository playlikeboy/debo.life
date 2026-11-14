// Voice notes and videos: upload, playback, transcript, retry, delete, and the
// short dictation clips. The rules live here so routes, tests and the sample
// server all share them. See os/docs/JOURNAL-MEDIA.md.
//
// - The app uploads straight to the private bucket with a link made here.
//   Nothing a person sends can name an object key: keys are made here, and
//   every call looks the recording up by owner first.
// - The transcript is made in the background and never blocks the save.
// - Never log the transcript, the file name or the audio. Ids and counts only.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { AppError } from "../errors.ts";
import type { AudioTools } from "./audio.ts";
import type { DeboMediaDb, MediaRecord } from "./backend.ts";
import {
  BAD_TYPE,
  cleanMimeType,
  DAILY_FULL,
  DICTATION_MAX_BYTES,
  DICTATION_PER_DAY,
  DICTATION_PER_MINUTE,
  extensionFor,
  MAX_BYTES,
  MAX_MINUTES,
  MAX_MINUTES_PER_DAY,
  MAX_RECORDINGS_PER_DAY,
  PART_BYTES,
  PLAYBACK_LINK_SECONDS,
  SINGLE_UPLOAD_MAX_BYTES,
  TOO_BIG,
  TOO_LONG,
  UPLOAD_LINK_SECONDS,
} from "./media-limits.ts";
import type { ObjectStore, UploadPlan } from "./object-store.ts";
import { mergePieces, planChunks, type Segment, type Transcriber, type TranscriptPiece } from "./transcriber.ts";

export type MediaDeps = {
  store: ObjectStore;
  /** Missing: recordings are kept, but nothing can be written out. */
  transcriber?: Transcriber;
  audio: AudioTools;
  /** Smaller sizes let the sample server try multipart with small files. */
  singleMaxBytes?: number;
  partBytes?: number;
};

export type MediaView = {
  id: string;
  kind: "voice" | "video";
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  recordedAt: string | null;
  transcript: { status: "waiting" | "working" | "ready" | "failed"; language: string | null; message?: string };
};

const REASONS: Record<string, string> = {
  engine: "The writing service did not answer. Try again in a moment.",
  "too-long": "This recording is longer than 60 minutes. You can still play it.",
  unreadable: "I couldn't read the sound in this recording. You can still try to play it.",
  off: "Writing out recordings is not turned on yet. Your recording is safe.",
};
const GONE = "I couldn't find that recording. It may have been deleted.";

export const UploadStart = z.object({
  kind: z.enum(["voice", "video"]),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(1, "That file is empty.").max(10 * MAX_BYTES, TOO_BIG),
  durationMs: z.number().int().min(0).max(24 * 3_600_000).optional(),
  recordedAt: z.coerce.date().optional(),
  origin: z.enum(["recorded", "picked"]).default("picked"),
  fileName: z.string().max(300).optional(),
  lastModified: z.number().int().min(0).optional(),
});

export const UploadDone = z.object({
  parts: z.array(z.object({ number: z.number().int().min(1), etag: z.string().min(1).max(200) })).max(10_000).optional(),
  happenedAt: z.coerce.date().optional(),
});

const Uuid = z.string().uuid();

/** Counts hits in a window per owner. Resets when the server restarts. */
function counter(windowMs: number, max: number) {
  const hits = new Map<string, { n: number; until: number }>();
  return (owner: string, now = Date.now()) => {
    const entry = hits.get(owner);
    if (!entry || entry.until <= now) {
      hits.set(owner, { n: 1, until: now + windowMs });
      return true;
    }
    entry.n += 1;
    return entry.n <= max;
  };
}

export class MediaService {
  private readonly perMinute = counter(60_000, DICTATION_PER_MINUTE);
  private readonly perDay = counter(24 * 3_600_000, DICTATION_PER_DAY);
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly media: DeboMediaDb,
    private readonly deps: MediaDeps,
    private readonly hooks: {
      /** The transcript is saved: make it searchable and let Debo remember it. */
      afterTranscript(owner: string, sourceId: string): Promise<void>;
      later(work: Promise<void>): void;
    },
  ) {}

  get engineName() {
    return this.deps.transcriber?.name;
  }

  // ---- Upload ----

  async startUpload(owner: string, input: unknown) {
    const parsed = UploadStart.safeParse(input);
    if (!parsed.success) throw new AppError(parsed.error.issues.map((i) => i.message).join("; "), 422);
    const body = parsed.data;
    const mimeType = cleanMimeType(body.mimeType);
    if (!mimeType) throw new AppError(BAD_TYPE, 422);
    if (body.sizeBytes > MAX_BYTES) throw new AppError(TOO_BIG, 413);
    if (body.durationMs !== undefined && body.durationMs > (MAX_MINUTES * 60 + 5) * 1000) throw new AppError(TOO_LONG, 422);
    const today = await this.media.today(owner);
    if (today.count >= MAX_RECORDINGS_PER_DAY || today.ms + (body.durationMs ?? 0) > MAX_MINUTES_PER_DAY * 60_000)
      throw new AppError(DAILY_FULL, 429);

    const id = randomUUID();
    const key = `${owner}/${id}.${extensionFor(mimeType)}`;
    // Audio files are voice notes whatever the app said.
    const kind = mimeType.startsWith("audio/") ? "voice" : body.kind;
    const plan = await this.deps.store.beginUpload({
      key,
      mimeType,
      size: body.sizeBytes,
      singleMaxBytes: this.deps.singleMaxBytes ?? SINGLE_UPLOAD_MAX_BYTES,
      partBytes: this.deps.partBytes ?? PART_BYTES,
      expiresSeconds: UPLOAD_LINK_SECONDS,
    });
    // Only what is safe to keep. Never where the person was.
    const device: Record<string, string | number> = { origin: body.origin };
    if (body.fileName) device.fileName = body.fileName.split(/[\\/]/).at(-1)?.slice(0, 120) ?? "";
    if (body.lastModified) device.lastModified = body.lastModified;
    await this.media.start(owner, {
      id,
      kind,
      objectKey: key,
      mimeType,
      sizeBytes: body.sizeBytes,
      durationMs: body.durationMs ?? null,
      recordedAt: body.recordedAt ?? null,
      device,
      uploadId: plan.mode === "multipart" ? plan.uploadId : null,
    });
    return { mediaId: id, kind, upload: plan satisfies UploadPlan };
  }

  /** The upload is finished: check it arrived whole, make the entry, start the transcript. */
  async completeUpload(owner: string, mediaId: string, input: unknown) {
    if (!Uuid.safeParse(mediaId).success) throw new AppError(GONE, 404);
    const body = UploadDone.parse(input ?? {});
    const record = await this.media.get(owner, mediaId);
    if (!record) throw new AppError(GONE, 404);
    if (record.sourceId) return { record, created: false }; // already finished: the same answer again

    if (record.uploadId) {
      const expected = Math.ceil(record.sizeBytes / (this.deps.partBytes ?? PART_BYTES));
      const parts = body.parts ?? [];
      if (parts.length !== expected || new Set(parts.map((p) => p.number)).size !== expected)
        throw new AppError("The upload is not complete yet. Try again.", 409);
      try {
        await this.deps.store.finishUpload(record.objectKey, record.uploadId, parts);
      } catch {
        throw new AppError("I couldn't finish saving that recording. Try again in a moment.", 502);
      }
    }
    const head = await this.deps.store.head(record.objectKey).catch(() => {
      throw new AppError("I couldn't check that recording. Try again in a moment.", 502);
    });
    if (!head) throw new AppError("The recording did not arrive. Try adding it again.", 409);
    if (head.size > MAX_BYTES || head.size !== record.sizeBytes) {
      // Not what was promised: remove it so nothing odd stays in the bucket.
      await this.deps.store.delete(record.objectKey).catch(() => {});
      await this.media.remove(owner, mediaId);
      throw new AppError(head.size > MAX_BYTES ? TOO_BIG : "The recording did not arrive whole. Try adding it again.", head.size > MAX_BYTES ? 413 : 422);
    }
    const finished = await this.media.finish(owner, mediaId, {
      sizeBytes: head.size,
      happenedAt: body.happenedAt ?? record.recordedAt ?? new Date(),
      title: record.kind === "video" ? "Video" : "Voice note",
    });
    if (!finished) throw new AppError(GONE, 404);
    if (finished.created) this.hooks.later(this.process(owner, mediaId));
    return finished;
  }

  // ---- Playback and transcript ----

  /** A short-lived link to play the recording of this entry. Only its owner gets one. */
  async playback(owner: string, entryId: string) {
    const record = await this.recordFor(owner, entryId);
    const url = await this.deps.store.signedGet(record.objectKey, record.mimeType, PLAYBACK_LINK_SECONDS);
    return { url, expiresInSeconds: PLAYBACK_LINK_SECONDS, mimeType: record.mimeType };
  }

  async transcript(owner: string, entryId: string, text: string) {
    const record = await this.recordFor(owner, entryId);
    return {
      status: record.transcriptStatus,
      language: record.language,
      text: record.transcriptStatus === "ready" ? text : "",
      segments: record.transcriptStatus === "ready" ? (record.segments ?? []) : [],
      ...(record.transcriptStatus === "failed" ? { message: failureMessage(record) } : {}),
    };
  }

  /** "Try again" on a recording whose transcript failed. */
  async retry(owner: string, entryId: string) {
    const record = await this.recordFor(owner, entryId);
    if (record.transcriptStatus !== "failed") return { status: record.transcriptStatus };
    if (!(await this.media.requeue(owner, record.id))) throw new AppError(GONE, 404);
    this.hooks.later(this.process(owner, record.id));
    return { status: "waiting" as const };
  }

  view(record: MediaRecord): MediaView {
    return {
      id: record.id,
      kind: record.kind,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      durationMs: record.durationMs,
      recordedAt: record.recordedAt?.toISOString() ?? null,
      transcript: {
        status: record.transcriptStatus,
        language: record.language,
        ...(record.transcriptStatus === "failed" ? { message: failureMessage(record) } : {}),
      },
    };
  }

  private async recordFor(owner: string, entryId: string): Promise<MediaRecord> {
    if (!Uuid.safeParse(entryId).success) throw new AppError(GONE, 404);
    const record = await this.media.forSource(owner, entryId);
    if (!record || record.uploadState !== "stored") throw new AppError(GONE, 404);
    return record;
  }

  // ---- Writing out the words ----

  private async slot<T>(work: () => Promise<T>): Promise<T> {
    if (this.running >= 2) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.running += 1;
    try {
      return await work();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }

  /** Make the transcript. Never throws: a failure is saved on the recording, which stays playable. */
  async process(owner: string, mediaId: string): Promise<void> {
    const claimed = await this.media.claim(owner, mediaId).catch(() => null);
    if (!claimed) return; // not waiting, or another worker has it
    const dir = await mkdtemp(join(tmpdir(), "debo-media-"));
    try {
      await this.slot(async () => {
        if (!this.deps.transcriber) return this.media.fail(owner, mediaId, "off");
        const input = join(dir, "original");
        await this.deps.store.download(claimed.objectKey, input);
        const hash = await sha256(input);

        // The same file again: reuse the words, so nobody pays twice.
        const same = await this.media.findByHash(owner, hash, mediaId);
        if (same) {
          const saved = await this.media.save(owner, mediaId, {
            text: same.text,
            language: same.language,
            segments: same.segments,
            contentHash: hash,
            durationMs: claimed.durationMs,
          });
          if (saved && claimed.sourceId) await this.hooks.afterTranscript(owner, claimed.sourceId);
          return;
        }

        const { path, durationSeconds } = await this.deps.audio.prepare(input, dir);
        if (durationSeconds > MAX_MINUTES * 60 + 60) return this.media.fail(owner, mediaId, "too-long");
        const plan = planChunks(durationSeconds);
        const pieces: TranscriptPiece[] = new Array(plan.length);
        // Two at a time: quick, and kind to the speech service and to memory.
        let next = 0;
        await Promise.all(
          [0, 1].map(async () => {
            while (next < plan.length) {
              const chunk = plan[next++];
              if (!chunk) break;
              const audio = await this.deps.audio.slice(path, chunk.start, chunk.length);
              pieces[chunk.index] = await this.deps.transcriber?.transcribe(audio) ?? { text: "", language: null, segments: [] };
            }
          }),
        );
        const merged = mergePieces(plan, pieces);
        const saved = await this.media.save(owner, mediaId, {
          text: merged.text,
          language: merged.language,
          segments: merged.segments,
          contentHash: hash,
          durationMs: Math.round(durationSeconds * 1000),
        });
        if (saved && claimed.sourceId) await this.hooks.afterTranscript(owner, claimed.sourceId);
      });
    } catch (error) {
      // The name only: never the message, which could carry text from a provider.
      console.error("recording transcript failed", { owner, mediaId, reason: error instanceof Error ? error.name : "unknown" });
      const code = error instanceof Error && error.name === "AudioError" ? "unreadable" : "engine";
      await this.media.fail(owner, mediaId, code).catch(() => {});
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ---- Dictation: a short clip, words back, nothing kept ----

  /** Writes out one short clip. The audio is not stored. Limited per minute and per day. */
  async dictate(owner: string, clip: Uint8Array, language?: string): Promise<{ text: string; language: string | null }> {
    if (!this.deps.transcriber)
      throw new AppError("Speaking into the text is not turned on yet. You can still type.", 503);
    if (clip.byteLength === 0) return { text: "", language: null };
    if (clip.byteLength > DICTATION_MAX_BYTES) throw new AppError("That clip is too long. Speak in shorter parts.", 413);
    if (!this.perMinute(owner) || !this.perDay(owner))
      throw new AppError("You have used a lot of speaking today. You can still type, and try again later.", 429);
    try {
      const mp3 = await this.deps.audio.toMp3(clip);
      const piece = await this.deps.transcriber.transcribe(mp3, language && /^[a-z]{2,3}$/.test(language) ? { language } : {});
      return { text: piece.text, language: piece.language };
    } catch (error) {
      console.error("dictation failed", { owner, reason: error instanceof Error ? error.name : "unknown" });
      if (error instanceof Error && error.name === "AudioError")
        throw new AppError("I couldn't hear that clip. Try speaking again.", 422);
      throw new AppError("I couldn't write that out just now. Try again in a moment.", 502);
    }
  }

  // ---- Delete ----

  /** Delete the file behind an entry, before the entry itself goes. A failure stops the delete, so nothing is left behind unseen. */
  async deleteFor(owner: string, entryId: string): Promise<void> {
    const record = await this.media.forSource(owner, entryId);
    if (!record) return;
    if (record.uploadId) await this.deps.store.abortUpload(record.objectKey, record.uploadId);
    await this.deps.store.delete(record.objectKey);
  }

  /** Delete every file this person has, including unfinished uploads and any stray object under their folder. */
  async deleteAllFor(owner: string): Promise<number> {
    const records = await this.media.keys(owner);
    for (const r of records) {
      if (r.uploadId) await this.deps.store.abortUpload(r.objectKey, r.uploadId);
      await this.deps.store.delete(r.objectKey);
    }
    // Belt and braces: anything else under this person's folder goes too.
    const strays = await this.deps.store.deletePrefix(`${owner}/`);
    return Math.max(records.length, strays);
  }

  /** Recordings for "Download my data": details, transcript, and a link to download each file for 24 hours. */
  async exportFor(owner: string, entries: { id: string; text: string }[]) {
    const records = await this.media.export(owner);
    const text = new Map(entries.map((e) => [e.id, e.text]));
    return Promise.all(
      records.map(async (r) => ({
        entryId: r.sourceId,
        kind: r.kind,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        durationMs: r.durationMs,
        recordedAt: r.recordedAt?.toISOString() ?? null,
        language: r.language,
        fileName: r.device?.fileName ?? null,
        transcriptStatus: r.transcriptStatus,
        transcript: r.sourceId ? (text.get(r.sourceId) ?? "") : "",
        segments: r.segments ?? [],
        downloadUrl: await this.deps.store.signedGet(r.objectKey, r.mimeType, 24 * 3600).catch(() => null),
        downloadUrlValidFor: "24 hours",
      })),
    );
  }

  // ---- Keeping house ----

  /** Pick up transcripts a stopped server left behind, and clear uploads nobody finished. Never throws. */
  async sweep(): Promise<void> {
    try {
      for (const job of await this.media.pending()) this.hooks.later(this.process(job.userId, job.id));
      for (const u of await this.media.stale()) {
        if (u.uploadId) await this.deps.store.abortUpload(u.objectKey, u.uploadId);
        await this.deps.store.delete(u.objectKey).catch(() => {});
        await this.media.remove(u.userId, u.id);
      }
    } catch (error) {
      console.error("recordings sweep failed", { reason: error instanceof Error ? error.name : "unknown" });
    }
  }
}

function failureMessage(record: MediaRecord): string {
  return `I couldn't write out this recording yet. ${REASONS[record.transcriptError ?? "engine"] ?? REASONS.engine}`;
}

function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (d) => hash.update(d))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

export type { Segment };
