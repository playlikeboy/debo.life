import assert from "node:assert/strict";
import test from "node:test";
import type { UploadStarted } from "../src/debo-api.ts";
import { micProblemText, type Capture } from "../src/debo-capture-types.ts";
import {
  countWords,
  entryView,
  fileProblem,
  formatDuration,
  formatSize,
  happenedAtFor,
  todayInput,
  wordCountLabel,
} from "../src/debo-data.ts";
import { uploadRecording } from "../src/debo-upload.ts";

const capture = (over: Partial<Capture> = {}): Capture => ({
  name: "Voice note.webm",
  mimeType: "audio/webm",
  sizeBytes: 1700,
  durationMs: 12_000,
  origin: "recorded",
  kind: "voice",
  previewUri: "blob:x",
  data: null,
  ...over,
});

const entry = entryView.parse({
  id: "e",
  title: "Voice note",
  text: "",
  happenedAt: "2026-11-14T00:00:00.000Z",
  kind: "voice",
  media: {
    id: "m",
    kind: "voice",
    mimeType: "audio/webm",
    sizeBytes: 1700,
    durationMs: 12_000,
    recordedAt: null,
    transcript: { status: "waiting", language: null },
  },
});

test("older servers' entries without a kind are written entries", () => {
  const old = entryView.parse({ id: "e", title: "t", text: "x", happenedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(old.kind, "journal");
  assert.equal(old.media, null);
  assert.equal(entry.media?.transcript.status, "waiting");
});

test("lengths, sizes and word counts read plainly", () => {
  assert.equal(formatDuration(65_000), "1:05");
  assert.equal(formatDuration(3_723_000), "1:02:03");
  assert.equal(formatSize(500), "1 KB");
  assert.equal(formatSize(3.2 * 1024 * 1024), "3.2 MB");
  assert.equal(formatSize(150 * 1024 * 1024), "150 MB");
  assert.equal(countWords("  "), 0);
  assert.equal(wordCountLabel("one"), "1 word");
  assert.equal(wordCountLabel("आज मैंने अपनी माँ से बात की"), "7 words");
  assert.equal(wordCountLabel("hello there\n\nfriend"), "3 words");
});

test("the date box sends nothing for today and noon UTC for another day", () => {
  const now = new Date(2026, 10, 14, 9, 30);
  assert.equal(todayInput(now), "2026-11-14");
  assert.equal(happenedAtFor("2026-11-14", now), undefined);
  assert.equal(happenedAtFor("2026-11-03", now), "2026-11-03T12:00:00.000Z");
  assert.equal(happenedAtFor("not a date", now), undefined);
});

test("a picked file is checked in plain words before anything goes up", () => {
  const limits = { maxBytes: 200 * 1024 * 1024 };
  assert.equal(fileProblem({ mimeType: "audio/mpeg", sizeBytes: 5000 }, limits), undefined);
  assert.equal(fileProblem({ mimeType: "video/mp4;codecs=avc1", sizeBytes: 5000 }, limits), undefined);
  assert.match(fileProblem({ mimeType: "application/pdf", sizeBytes: 5000 }, limits) ?? "", /not a voice or video file/);
  assert.match(fileProblem({ mimeType: "audio/mpeg", sizeBytes: 201 * 1024 * 1024 }, limits) ?? "", /under 200 MB/);
  assert.match(fileProblem({ mimeType: "audio/mpeg", sizeBytes: 0 }, limits) ?? "", /empty/);
});

test("a refused microphone says what to do next", () => {
  const denied = Object.assign(new Error("x"), { name: "NotAllowedError" });
  assert.match(micProblemText(denied), /Allow it in your browser/);
  assert.match(micProblemText(Object.assign(new Error("x"), { name: "NotFoundError" })), /can't find a microphone/);
  assert.match(micProblemText(denied, true), /camera and microphone/);
});

function fakeApi(plan: UploadStarted["upload"], seen: { start?: unknown; done?: unknown } = {}) {
  return {
    async startUpload(body: unknown) {
      seen.start = body;
      return { mediaId: "m1", kind: "voice" as const, upload: plan };
    },
    async completeUpload(_id: string, body: unknown) {
      seen.done = body;
      return entry;
    },
  };
}
const noPause = async () => {};

test("a small recording goes up in one piece, then is completed, with progress", async () => {
  const seen: { start?: unknown; done?: unknown } = {};
  const progress: number[] = [];
  const sent: [number, number][] = [];
  const result = await uploadRecording(
    fakeApi({ mode: "single", url: "https://r2/put", headers: { "Content-Type": "audio/webm" } }, seen),
    async (_c, url, headers, from, to, onProgress) => {
      assert.equal(url, "https://r2/put");
      assert.equal(headers["Content-Type"], "audio/webm");
      sent.push([from, to]);
      onProgress(850);
      return {};
    },
    capture(),
    { onProgress: (p) => progress.push(p), happenedAt: "2026-11-03T12:00:00.000Z" },
  );
  assert.deepEqual(sent, [[0, 1700]]);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.includes(0.5));
  assert.equal(result.id, "e");
  assert.deepEqual(seen.done, { happenedAt: "2026-11-03T12:00:00.000Z" });
  const start = seen.start as Record<string, unknown>;
  assert.equal(start.sizeBytes, 1700);
  assert.equal(start.origin, "recorded");
  assert.equal(typeof start.recordedAt, "string");
});

test("a big recording goes up in parts and the confirmations are handed back in order", async () => {
  const seen: { start?: unknown; done?: unknown } = {};
  const plan: UploadStarted["upload"] = {
    mode: "multipart",
    uploadId: "u",
    partBytes: 600,
    parts: [1, 2, 3].map((number) => ({ number, url: `https://r2/part${number}`, headers: {} })),
  };
  const ranges: [string, number, number][] = [];
  await uploadRecording(
    fakeApi(plan, seen),
    async (_c, url, _h, from, to) => {
      ranges.push([url, from, to]);
      return { etag: `"tag${url.at(-1)}"` };
    },
    capture({ origin: "picked", lastModified: 1_700_000_000_000 }),
  );
  assert.deepEqual(ranges, [
    ["https://r2/part1", 0, 600],
    ["https://r2/part2", 600, 1200],
    ["https://r2/part3", 1200, 1700],
  ]);
  assert.deepEqual(seen.done, {
    parts: [
      { number: 1, etag: '"tag1"' },
      { number: 2, etag: '"tag2"' },
      { number: 3, etag: '"tag3"' },
    ],
  });
  assert.equal("recordedAt" in (seen.start as object), false, "a picked file has no recording time");
});

test("one dropped connection is retried, but a part is not skipped", async () => {
  let tries = 0;
  await uploadRecording(
    fakeApi({ mode: "single", url: "https://r2/put", headers: {} }),
    async () => {
      if (++tries < 3) throw new Error("The upload was interrupted. Check your connection and try again.");
      return {};
    },
    capture(),
    { pause: noPause },
  );
  assert.equal(tries, 3);
  await assert.rejects(
    () =>
      uploadRecording(
        fakeApi({ mode: "single", url: "https://r2/put", headers: {} }),
        async () => {
          throw new Error("The upload was refused. Try again.");
        },
        capture(),
        { pause: noPause },
      ),
    /refused/,
  );
});

test("a part with no confirmation stops the upload instead of saving half a file", async () => {
  const plan: UploadStarted["upload"] = {
    mode: "multipart",
    uploadId: "u",
    partBytes: 1000,
    parts: [
      { number: 1, url: "https://r2/1", headers: {} },
      { number: 2, url: "https://r2/2", headers: {} },
    ],
  };
  let completed = false;
  const api = { ...fakeApi(plan), completeUpload: async () => ((completed = true), entry) };
  await assert.rejects(() => uploadRecording(api, async () => ({}), capture(), { pause: noPause }), /did not confirm/);
  assert.equal(completed, false);
});
