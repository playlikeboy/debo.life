// Adding a recording: ask the server for links, send the file straight to the
// private bucket (in parts if it is big), then tell the server it is done.
// No React in here. The sending itself comes from debo-capture (web or phone),
// so tests can pass a fake.
import type { UploadStarted } from "./debo-api";
import type { Capture, SentRange } from "./debo-capture-types";
import type { EntryView } from "./debo-data";

export type UploadApi = {
  startUpload(body: {
    kind: "voice" | "video";
    mimeType: string;
    sizeBytes: number;
    durationMs?: number;
    recordedAt?: string;
    origin: "recorded" | "picked";
    fileName?: string;
    lastModified?: number;
  }): Promise<UploadStarted>;
  completeUpload(mediaId: string, body: { parts?: { number: number; etag: string }[]; happenedAt?: string }): Promise<EntryView>;
};

export type Sender = (
  capture: Capture,
  url: string,
  headers: Record<string, string>,
  from: number,
  to: number,
  onProgress: (sent: number) => void,
) => Promise<SentRange>;

/** Each part is tried three times: one dropped connection should not lose a long upload. */
async function withRetries<T>(work: () => Promise<T>, tries = 3, pause = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await work();
    } catch (error) {
      last = error;
      if (attempt < tries - 1) await pause(800 * 2 ** attempt);
    }
  }
  throw last;
}

/**
 * Upload one recording and save it as an entry. `onProgress` gets 0 to 1.
 * Returns the new entry (its words may still be on the way).
 */
export async function uploadRecording(
  api: UploadApi,
  send: Sender,
  capture: Capture,
  options: { happenedAt?: string; onProgress?: (fraction: number) => void; pause?: (ms: number) => Promise<void> } = {},
): Promise<EntryView> {
  const report = options.onProgress ?? (() => {});
  const started = await api.startUpload({
    kind: capture.kind,
    mimeType: capture.mimeType,
    sizeBytes: capture.sizeBytes,
    ...(capture.durationMs ? { durationMs: capture.durationMs } : {}),
    ...(capture.origin === "recorded" ? { recordedAt: new Date().toISOString() } : {}),
    origin: capture.origin,
    fileName: capture.name,
    ...(capture.lastModified ? { lastModified: capture.lastModified } : {}),
  });
  report(0);

  const plan = started.upload;
  let parts: { number: number; etag: string }[] | undefined;
  if (plan.mode === "single") {
    await withRetries(
      () => send(capture, plan.url, plan.headers, 0, capture.sizeBytes, (sent) => report(Math.min(0.99, sent / capture.sizeBytes))),
      3,
      options.pause,
    );
  } else {
    parts = [];
    let done = 0;
    for (const part of plan.parts) {
      const from = (part.number - 1) * plan.partBytes;
      const to = Math.min(capture.sizeBytes, from + plan.partBytes);
      const sent = await withRetries(
        () => send(capture, part.url, part.headers, from, to, (n) => report(Math.min(0.99, (done + n) / capture.sizeBytes))),
        3,
        options.pause,
      );
      if (!sent.etag) throw new Error("The upload finished but the storage did not confirm it. Try again.");
      parts.push({ number: part.number, etag: sent.etag });
      done += to - from;
    }
  }
  const entry = await api.completeUpload(started.mediaId, { ...(parts ? { parts } : {}), ...(options.happenedAt ? { happenedAt: options.happenedAt } : {}) });
  report(1);
  return entry;
}
