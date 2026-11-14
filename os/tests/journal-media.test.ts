import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { Hono } from "hono";
import { fakeAudioTools } from "../apps/server/src/debo/audio.ts";
import { devMemoryBackend } from "../apps/server/src/debo/dev-backend.ts";
import { memoryStore, type MemoryStore } from "../apps/server/src/debo/dev-store.ts";
import { DeboService, deboRoutes } from "../apps/server/src/debo/index.ts";
import { MAX_BYTES, DICTATION_PER_MINUTE } from "../apps/server/src/debo/media-limits.ts";
import { r2Store } from "../apps/server/src/debo/object-store.ts";
import {
  cloudflareWhisper,
  fakeTranscriber,
  mergePieces,
  planChunks,
  readReply,
} from "../apps/server/src/debo/transcriber.ts";
import { ALICE, BOB } from "./helpers/debo.ts";

type Upload = Awaited<ReturnType<DeboService["startUpload"]>>;

function rig(options: { transcriber?: Parameters<typeof fakeTranscriber>[0]; seconds?: number; noEngine?: boolean } = {}) {
  const backend = devMemoryBackend();
  const store = memoryStore();
  const transcriber = fakeTranscriber(options.transcriber);
  const audio = fakeAudioTools({ durationSeconds: options.seconds ?? 12 });
  const debo = new DeboService(backend, [], {
    store,
    audio,
    transcriber: options.noEngine ? undefined : transcriber,
    singleMaxBytes: 1000,
    partBytes: 600,
  });
  const app = new Hono<{ Variables: { owner: string } }>();
  app.use("*", async (c, next) => {
    c.set("owner", c.req.header("x-owner") ?? ALICE);
    await next();
  });
  app.route("/api/debo", deboRoutes(debo));
  return { backend, store, transcriber, audio, debo, app };
}

const path = (url: string) => new URL(url).pathname.replace("/api/dev-r2", "");

/** Upload the way the app does: ask for links, PUT the bytes (in parts if told), then say it is done. */
async function add(
  r: ReturnType<typeof rig>,
  owner: string,
  bytes: Uint8Array,
  extra: Record<string, unknown> = {},
) {
  const started: Upload = await r.debo.startUpload(owner, {
    kind: "voice",
    mimeType: "audio/webm;codecs=opus",
    sizeBytes: bytes.byteLength,
    durationMs: 12_000,
    ...extra,
  });
  const routes = r.store.routes();
  let parts: { number: number; etag: string }[] | undefined;
  if (started.upload.mode === "single") {
    const res = await routes.request(path(started.upload.url), { method: "PUT", body: bytes });
    assert.equal(res.status, 200);
  } else {
    parts = [];
    for (const part of started.upload.parts) {
      const from = (part.number - 1) * started.upload.partBytes;
      const res = await routes.request(path(part.url), { method: "PUT", body: bytes.slice(from, from + started.upload.partBytes) });
      parts.push({ number: part.number, etag: res.headers.get("etag") ?? "" });
    }
  }
  const entry = await r.debo.completeUpload(owner, started.mediaId, { parts });
  return { started, entry };
}

const sample = (n = 400, seed = 1) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) % 251);

test("upload, then waiting, then ready, then searchable and listed with its source label", async () => {
  const r = rig({ transcriber: { text: "We planted a lemon tree behind the garage." } });
  const { entry } = await add(r, ALICE, sample());
  assert.equal(entry.kind, "voice");
  assert.ok(["waiting", "working"].includes(entry.media?.transcript.status ?? ""));
  assert.equal(entry.text, "");

  await r.debo.idle();
  const [listed] = await r.debo.listEntries(ALICE);
  assert.equal(listed?.media?.transcript.status, "ready");
  assert.match(listed?.text ?? "", /lemon tree/);
  assert.equal(listed?.media?.transcript.language, "en");

  const found = await r.debo.searchJournal(ALICE, "lemon");
  assert.equal(found.length, 1);
  assert.match(found[0]?.source.label ?? "", /^Voice note, \d+ \w+$/);
  // Memories ran too: the dev backend turns the first line into one.
  assert.equal((await r.debo.listMemories(ALICE))[0]?.source.id, entry.id);
});

test("a video is labelled Video, and an audio file is always a voice note", async () => {
  const r = rig();
  const video = await add(r, ALICE, sample(300), { kind: "video", mimeType: "video/mp4" });
  assert.equal(video.entry.kind, "video");
  const wrong = await add(r, ALICE, sample(300, 2), { kind: "video", mimeType: "audio/mpeg" });
  assert.equal(wrong.entry.kind, "voice");
  await r.debo.idle();
  const labels = (await r.debo.searchJournal(ALICE, "sample transcript")).map((m) => m.source.label.split(",")[0]).sort();
  assert.deepEqual(labels, ["Video", "Voice note"]);
});

test("a big file goes up in parts and is joined; a missing part is refused", async () => {
  const r = rig();
  const bytes = sample(1700);
  const started = await r.debo.startUpload(ALICE, { kind: "voice", mimeType: "audio/mp4", sizeBytes: bytes.length });
  assert.equal(started.upload.mode, "multipart");
  if (started.upload.mode !== "multipart") return;
  assert.equal(started.upload.parts.length, 3);
  await assert.rejects(() => r.debo.completeUpload(ALICE, started.mediaId, { parts: [{ number: 1, etag: "x" }] }), /not complete/);
  const parts = [];
  for (const part of started.upload.parts) {
    const from = (part.number - 1) * 600;
    const res = await r.store.routes().request(path(part.url), { method: "PUT", body: bytes.slice(from, from + 600) });
    parts.push({ number: part.number, etag: res.headers.get("etag") ?? "" });
  }
  const entry = await r.debo.completeUpload(ALICE, started.mediaId, { parts });
  assert.equal(entry.media?.sizeBytes, 1700);
  assert.equal([...r.store.objects.values()][0]?.byteLength, 1700);
});

test("another person cannot play, read, retry or finish someone else's recording", async () => {
  const r = rig();
  const { entry, started } = await add(r, ALICE, sample());
  await r.debo.idle();
  const before = r.store.issued.length;
  for (const call of [
    () => r.debo.playback(BOB, entry.id),
    () => r.debo.transcript(BOB, entry.id),
    () => r.debo.retryTranscript(BOB, entry.id),
    () => r.debo.completeUpload(BOB, started.mediaId, {}),
  ])
    await assert.rejects(call, (e: Error & { status?: number }) => e.status === 404);
  assert.equal(r.store.issued.length, before, "no link was made for the wrong person");
  // And through the routes, as the signed-in person.
  const res = await r.app.request(`/api/debo/entries/${entry.id}/playback`, { headers: { "x-owner": BOB } });
  assert.equal(res.status, 404);
  const mine = await r.app.request(`/api/debo/entries/${entry.id}/playback`, { headers: { "x-owner": ALICE } });
  assert.equal(mine.status, 200);
  const link = (await mine.json()) as { url: string; expiresInSeconds: number };
  assert.equal(link.expiresInSeconds, 3600);
  const played = await r.store.routes().request(path(link.url), { headers: { range: "bytes=0-9" } });
  assert.equal(played.status, 206);
  // Keys are made on the server and start with the owner.
  assert.ok([...r.store.objects.keys()].every((k) => k.startsWith(`${ALICE}/`)));
  // Bob's own list shows nothing of Alice's.
  assert.equal((await r.debo.listEntries(BOB)).length, 0);
});

test("size, type, length and daily limits are enforced in plain words", async () => {
  const r = rig();
  const start = (body: Record<string, unknown>) =>
    r.debo.startUpload(ALICE, { kind: "voice", mimeType: "audio/mpeg", sizeBytes: 1000, ...body });
  await assert.rejects(() => start({ sizeBytes: MAX_BYTES + 1 }), /under 200 MB/);
  await assert.rejects(() => start({ mimeType: "application/pdf" }), /Pick a voice or video file/);
  await assert.rejects(() => start({ mimeType: "text/html" }), /can't use that kind/);
  await assert.rejects(() => start({ sizeBytes: 0 }), /empty/);
  await assert.rejects(() => start({ durationMs: 61 * 60_000 }), /under 60 minutes/);
  await start({ durationMs: 60 * 60_000 }); // exactly an hour is fine
  for (let i = 0; i < 3; i++) await start({ durationMs: 60 * 60_000 });
  await assert.rejects(() => start({ durationMs: 60 * 60_000 }), /midnight UTC/); // 4 hours a day
  // The object never arrived whole: the size has to match what was promised.
  const bad = await r.debo.startUpload(BOB, { kind: "voice", mimeType: "audio/mpeg", sizeBytes: 500 });
  if (bad.upload.mode !== "single") throw new Error("expected a single upload");
  const key = `${BOB}/${bad.mediaId}.mp3`;
  r.store.put(key, sample(499));
  await assert.rejects(() => r.debo.completeUpload(BOB, bad.mediaId, {}), /did not arrive whole/);
  assert.equal(r.store.objects.has(key), false, "a wrong-size object is removed");
  // 429 for too many in a day.
  const many = rig();
  for (let i = 0; i < 40; i++) await many.debo.startUpload(ALICE, { kind: "voice", mimeType: "audio/mpeg", sizeBytes: 10 });
  await assert.rejects(() => many.debo.startUpload(ALICE, { kind: "voice", mimeType: "audio/mpeg", sizeBytes: 10 }), /midnight UTC/);
});

test("a failed transcript leaves a playable entry, says so, and Try again works", async () => {
  let failing = true;
  const r = rig({ transcriber: { fail: () => (failing ? "retryable" : false), text: "Mum called about the wedding." } });
  const { entry } = await add(r, ALICE, sample());
  await r.debo.idle();
  const [failed] = await r.debo.listEntries(ALICE);
  assert.equal(failed?.media?.transcript.status, "failed");
  assert.match(failed?.media?.transcript.message ?? "", /^I couldn't write out this recording yet\./);
  assert.equal((await r.debo.playback(ALICE, entry.id)).mimeType, "audio/webm");
  assert.equal(JSON.stringify(await r.debo.transcript(ALICE, entry.id)).includes("wedding"), false);

  failing = false;
  assert.deepEqual(await r.debo.retryTranscript(ALICE, entry.id), { status: "waiting" });
  await r.debo.idle();
  const [ok] = await r.debo.listEntries(ALICE);
  assert.equal(ok?.media?.transcript.status, "ready");
  assert.match(ok?.text ?? "", /wedding/);
  // Retry on a finished one does nothing.
  assert.deepEqual(await r.debo.retryTranscript(ALICE, entry.id), { status: "ready" });
});

test("without a speech engine the recording is kept and says it is not written out yet", async () => {
  const r = rig({ noEngine: true });
  const { entry } = await add(r, ALICE, sample());
  await r.debo.idle();
  const [item] = await r.debo.listEntries(ALICE);
  assert.equal(item?.media?.transcript.status, "failed");
  assert.match(item?.media?.transcript.message ?? "", /not turned on yet/);
  assert.equal(r.debo.status().speaking, false);
  await assert.rejects(() => r.debo.dictate(ALICE, sample(10)), /not turned on/);
  assert.ok((await r.debo.playback(ALICE, entry.id)).url);
});

test("the same file added twice is written out once", async () => {
  const r = rig({ transcriber: { text: "Dinner with Priya on Friday." } });
  const bytes = sample(500, 9);
  await add(r, ALICE, bytes);
  await r.debo.idle();
  await add(r, ALICE, bytes);
  await r.debo.idle();
  assert.equal(r.transcriber.calls, 1);
  const items = await r.debo.listEntries(ALICE);
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.text.includes("Priya")));
  // Another person's identical file is theirs to pay for: not shared.
  await add(r, BOB, bytes);
  await r.debo.idle();
  assert.equal(r.transcriber.calls, 2);
});

test("a long recording is cut into overlapping pieces", async () => {
  const r = rig({ seconds: 700, transcriber: { text: "Part of a long talk." } });
  await add(r, ALICE, sample(800), { durationMs: 700_000 });
  await r.debo.idle();
  assert.equal(r.transcriber.calls, 3);
  assert.equal(r.audio.slices, 3);
  const [item] = await r.debo.listEntries(ALICE);
  assert.equal(item?.media?.transcript.status, "ready");
  assert.equal(item?.media?.durationMs, 700_000);
  // Too long once the sound itself is measured: kept, not written out.
  const long = rig({ seconds: 4000 });
  await add(long, ALICE, sample(300));
  await long.debo.idle();
  assert.match((await long.debo.listEntries(ALICE))[0]?.media?.transcript.message ?? "", /longer than 60 minutes/);
});

test("planning and joining pieces keeps every word once", () => {
  assert.deepEqual(planChunks(0), []);
  assert.deepEqual(planChunks(100), [{ index: 0, start: 0, length: 100 }]);
  const plan = planChunks(650);
  assert.deepEqual(plan, [
    { index: 0, start: 0, length: 304 },
    { index: 1, start: 300, length: 304 },
    { index: 2, start: 600, length: 50 },
  ]);
  const seg = (start: number, end: number, text: string) => ({ start, end, text });
  const merged = mergePieces(plan, [
    { text: "", language: "en", segments: [seg(10, 12, "one"), seg(301, 303, "two")] }, // two is at 301-303 in piece 0
    { text: "", language: "en", segments: [seg(1, 3, "two"), seg(100, 102, "three")] }, // two again at 301-303
    { text: "", language: "hi", segments: [seg(5, 8, "four")] },
  ]);
  assert.deepEqual(merged.text.split(/\s+/), ["one", "two", "three", "four"]);
  assert.deepEqual(
    merged.segments.map((s) => s.text),
    ["one", "two", "three", "four"],
  );
  assert.equal(merged.segments[2]?.start, 400);
  assert.equal(merged.language, "en");
});

test("deleting an entry deletes its file; deleting the account deletes every file", async () => {
  const r = rig();
  const a = await add(r, ALICE, sample(300, 1));
  await add(r, ALICE, sample(300, 2));
  await add(r, BOB, sample(300, 3));
  await r.debo.idle();
  // An unfinished upload and a stray object count too.
  await r.debo.startUpload(ALICE, { kind: "voice", mimeType: "audio/mpeg", sizeBytes: 5000 });
  r.store.put(`${ALICE}/stray.bin`, sample(5));
  assert.equal(r.store.objects.size, 4);

  await r.debo.deleteEntry(ALICE, a.entry.id);
  assert.equal([...r.store.objects.keys()].filter((k) => k.startsWith(ALICE)).length, 2);
  await assert.rejects(() => r.debo.playback(ALICE, a.entry.id));

  await r.debo.deleteMine(ALICE);
  assert.equal([...r.store.objects.keys()].filter((k) => k.startsWith(ALICE)).length, 0);
  assert.equal([...r.store.objects.keys()].filter((k) => k.startsWith(BOB)).length, 1, "Bob's file is untouched");
  assert.equal((await r.debo.listEntries(BOB)).length, 1);
});

test("a file that cannot be deleted stops the entry delete, so nothing is left behind unseen", async () => {
  const r = rig();
  const { entry } = await add(r, ALICE, sample());
  r.store.delete = async () => {
    throw new Error("R2 is down");
  };
  await assert.rejects(() => r.debo.deleteEntry(ALICE, entry.id));
  assert.equal((await r.debo.listEntries(ALICE)).length, 1);
});

test("download my data lists each recording with its transcript and a 24 hour link", async () => {
  const r = rig({ transcriber: { text: "Remember the blue door." } });
  await add(r, ALICE, sample(), { fileName: "C:\\Users\\me\\Voice 1.m4a" });
  await r.debo.idle();
  const out = await r.debo.exportMine(ALICE);
  const rec = out?.recordings[0] as Record<string, unknown>;
  assert.equal(rec.transcript, "Remember the blue door.");
  assert.equal(rec.fileName, "Voice 1.m4a");
  assert.equal(rec.downloadUrlValidFor, "24 hours");
  assert.match(String(rec.downloadUrl), /dev-r2/);
  assert.equal((await r.debo.exportMine(BOB))?.recordings.length, 0);
});

test("a stopped server picks up waiting recordings, and clears uploads nobody finished", async () => {
  const r = rig();
  const stale = await r.debo.startUpload(ALICE, { kind: "voice", mimeType: "audio/mpeg", sizeBytes: 10 });
  r.store.put(`${ALICE}/${stale.mediaId}.mp3`, sample(10));
  const records = await r.backend.media?.keys(ALICE);
  assert.equal(records?.length, 1);
  const first = await add(r, ALICE, sample(222));
  // Simulate a restart before the transcript ran: put it back to waiting.
  await r.debo.idle();
  const record = await r.backend.media?.forSource(ALICE, first.entry.id);
  Object.assign(record ?? {}, { transcriptStatus: "waiting" });
  const sweeps = r.debo as unknown as { recordings: { sweep(): Promise<void> } };
  await sweeps.recordings.sweep();
  await r.debo.idle();
  assert.equal((await r.backend.media?.forSource(ALICE, first.entry.id))?.transcriptStatus, "ready");
});

test("recordings that are not set up say so, and written entries still work", async () => {
  const debo = new DeboService(devMemoryBackend(), []);
  assert.equal(debo.status().recordings, false);
  await assert.rejects(() => debo.startUpload(ALICE, {}), /not set up yet/);
  assert.equal((await debo.createEntry(ALICE, { text: "A plain entry." })).kind, "journal");
});

test("an entry can say which day it happened, but not in the future", async () => {
  const r = rig();
  const entry = await r.debo.createEntry(ALICE, { text: "Last week we went to the lake.", happenedAt: "2026-11-03T00:00:00.000Z" });
  assert.equal(entry.happenedAt, "2026-11-03T00:00:00.000Z");
  await assert.rejects(() => r.debo.createEntry(ALICE, { text: "From next year.", happenedAt: "2099-01-01" }), /not in the future/);
});

// ---- Dictation ----

const clip = (owner: string, app: ReturnType<typeof rig>["app"], body: BodyInit, query = "") =>
  app.request(`/api/debo/transcribe${query}`, { method: "POST", headers: { "x-owner": owner, "Content-Type": "audio/webm" }, body });

test("dictation returns words and keeps no audio", async () => {
  const r = rig({ transcriber: { text: "Buy milk and bread.", language: "en" } });
  const res = await clip(ALICE, r.app, sample(2000), "?language=hi");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "Buy milk and bread.", language: "en" });
  assert.equal(r.store.objects.size, 0);
  assert.deepEqual(await (await clip(ALICE, r.app, new Uint8Array(0))).json(), { text: "", language: null });
});

test("dictation checks size, signed-in person, engine and its own rate limit", async () => {
  const r = rig();
  const big = await clip(ALICE, r.app, new Uint8Array(3 * 1024 * 1024 + 1));
  assert.equal(big.status, 413);
  assert.match(((await big.json()) as { error: string }).error, /shorter parts/);
  const notAnAccount = await clip("not-a-uuid", r.app, sample(10));
  assert.equal(notAnAccount.status, 403);

  let last = 200;
  for (let i = 0; i < DICTATION_PER_MINUTE + 2; i++) last = (await clip(BOB, r.app, sample(10))).status;
  assert.equal(last, 429);
  assert.equal((await clip(ALICE, r.app, sample(10))).status, 200, "one person's limit is not another's");

  const broken = rig({ transcriber: { fail: "permanent" } });
  const res = await clip(ALICE, broken.app, sample(10));
  assert.equal(res.status, 502);
  assert.match(((await res.json()) as { error: string }).error, /couldn't write that out/);
});

test("the server never logs what was said", async () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void lines.push(JSON.stringify(args));
  try {
    const r = rig({ transcriber: { fail: "permanent", text: "my secret pin is 4821" } });
    await add(r, ALICE, sample());
    await r.debo.idle();
    await clip(ALICE, r.app, sample(10));
  } finally {
    console.error = original;
  }
  assert.ok(lines.length > 0);
  assert.equal(lines.join("").includes("4821"), false);
});

// ---- The real adapters, with the network faked ----

test("Workers AI is called the documented way, retries when busy, and reads the answer safely", async () => {
  const seen: { url: string; auth: string | null; body: Record<string, unknown> }[] = [];
  let busy = 1;
  const fetchFake = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) });
    if (busy-- > 0) return new Response("slow down", { status: 503 });
    return Response.json({
      success: true,
      result: {
        text: " Namaste, how are you? ",
        segments: [{ start: 0, end: 2.5, text: " Namaste, how are you? " }, { start: "x", end: 1, text: "bad" }],
        transcription_info: { language: "hi" },
      },
    });
  }) as typeof fetch;
  const engine = cloudflareWhisper({ accountId: "acct123", apiToken: "tok-secret" }, fetchFake, async () => {});
  const out = await engine.transcribe(Uint8Array.from([1, 2, 3]));
  assert.equal(seen.length, 2);
  assert.equal(seen[0]?.url, "https://api.cloudflare.com/client/v4/accounts/acct123/ai/run/@cf/openai/whisper-large-v3-turbo");
  assert.equal(seen[0]?.auth, "Bearer tok-secret");
  assert.equal(seen[0]?.body.audio, "AQID");
  assert.equal(seen[0]?.body.vad_filter, true);
  assert.equal("language" in (seen[0]?.body ?? {}), false, "language is detected unless asked for");
  assert.deepEqual(out, { text: "Namaste, how are you?", language: "hi", segments: [{ start: 0, end: 2.5, text: "Namaste, how are you?" }] });

  const refusing = cloudflareWhisper({ accountId: "a", apiToken: "tok-secret" }, (async () => new Response("no", { status: 400 })) as typeof fetch, async () => {});
  await assert.rejects(() => refusing.transcribe(new Uint8Array(1)), (e: Error) => !e.message.includes("tok-secret"));
  assert.throws(() => readReply({ success: false }), /could not read/);
});

test("R2 links are signed, short lived, and sized exactly; big files get one link per part", async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(`${input instanceof Request ? input.method : (init?.method ?? "GET")} ${String(input instanceof Request ? input.url : input)}`);
    return new Response("<InitiateMultipartUploadResult><UploadId>up-1</UploadId></InitiateMultipartUploadResult>");
  }) as typeof fetch;
  try {
    const store = r2Store({ accountId: "acct", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI", bucket: "debo-journal-media" });
    const key = `${ALICE}/abc.webm`;
    const one = await store.beginUpload({ key, mimeType: "audio/webm", size: 500, singleMaxBytes: 1000, partBytes: 600, expiresSeconds: 7200 });
    assert.equal(one.mode, "single");
    if (one.mode !== "single") return;
    const url = new URL(one.url);
    assert.equal(url.host, "acct.r2.cloudflarestorage.com");
    assert.equal(url.pathname, `/debo-journal-media/${key}`);
    assert.equal(url.searchParams.get("X-Amz-Expires"), "7200");
    assert.match(url.searchParams.get("X-Amz-Signature") ?? "", /^[0-9a-f]{64}$/);
    assert.match(url.searchParams.get("X-Amz-SignedHeaders") ?? "", /content-length/);
    assert.match(url.searchParams.get("X-Amz-SignedHeaders") ?? "", /content-type/);
    assert.equal(one.url.includes("wJalrXUtnFEMI"), false);

    const many = await store.beginUpload({ key, mimeType: "audio/webm", size: 1700, singleMaxBytes: 1000, partBytes: 600, expiresSeconds: 600 });
    assert.equal(many.mode, "multipart");
    if (many.mode !== "multipart") return;
    assert.equal(many.uploadId, "up-1");
    assert.deepEqual(many.parts.map((p) => p.number), [1, 2, 3]);
    assert.match(many.parts[2]?.url ?? "", /partNumber=3&uploadId=up-1/);
    assert.match(calls[0] ?? "", /^POST https:\/\/acct\.r2\.cloudflarestorage\.com\/debo-journal-media\/.*\?uploads$/);

    const get = new URL(await store.signedGet(key, "audio/webm", 3600));
    assert.equal(get.searchParams.get("X-Amz-Expires"), "3600");
    assert.equal(get.searchParams.get("X-Amz-SignedHeaders"), "host");
  } finally {
    globalThis.fetch = original;
  }
});

// ---- The migration ----

test("the recordings migration only adds: no drops, no changes to existing tables, no row rewrites", () => {
  const dir = new URL("../../packages/db/migrations/", import.meta.url);
  const file = readdirSync(dir).find((f) => f.startsWith("0005_"));
  assert.ok(file, "migration 0005 exists");
  const sql = readFileSync(new URL(file, dir), "utf8");
  assert.doesNotMatch(sql, /\bDROP\b/i);
  // "ON DELETE cascade ON UPDATE no action" belongs to the new foreign keys; anything else is a write.
  const withoutRules = sql.replace(/ON (DELETE|UPDATE) (cascade|no action)/gi, "");
  assert.doesNotMatch(withoutRules, /\bTRUNCATE\b|\bDELETE\b|\bUPDATE\b|\bRENAME\b|\bINSERT\b/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+"?(?!media\b)\w+"?\s+(DROP|ALTER|RENAME)/i);
  const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  for (const s of statements)
    assert.match(s, /^(CREATE TABLE "media"|ALTER TABLE "media" ADD CONSTRAINT|CREATE (UNIQUE )?INDEX "media_)/, s.slice(0, 60));
  // Only the new table is named in ALTER statements.
  assert.equal([...sql.matchAll(/ALTER TABLE "(\w+)"/g)].every((m) => m[1] === "media"), true);
});

test("every migration from 0005 on is additive", () => {
  const dir = new URL("../../packages/db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f >= "0005")) {
    const sql = readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(sql, /\bDROP\b|ALTER\s+TABLE\s+\S+\s+DROP|\bTRUNCATE\b/i, file);
  }
  const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", dir), "utf8")) as { entries: { tag: string }[] };
  assert.ok(journal.entries.some((e) => e.tag.startsWith("0005_")));
});

// Keeps the type import used when the file is checked on its own.
export type { MemoryStore };
