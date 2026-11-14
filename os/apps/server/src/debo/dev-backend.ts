// DEV ONLY. An in-memory Debo journal for trying the screens on a laptop with
// no database and no AI key. Everything is forgotten when the server stops.
//
// It is switched on by DEBO_DEV_MEMORY=1 and only in a sample workspace
// (see createDebo). A live workspace refuses to start with the switch set, so
// this can never hold a real person's words.
//
// Tests for recordings use it too, together with the in-memory bucket
// (dev-store.ts) and the fake speech engine (transcriber.ts).
import { randomUUID } from "node:crypto";
import type { ActivityItem, AskEvent, DeboBackend, DeboMediaDb, Item, MediaRecord, Memory } from "./backend.ts";
import { chipLabel } from "./service.ts";

const words = (text: string) => text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
const titleOf = (text: string, fallback: string) => (text.split("\n")[0]?.slice(0, 60) || fallback).trim();

export function devMemoryBackend(): DeboBackend {
  const entries = new Map<string, Item[]>();
  const memories = new Map<string, Memory[]>();
  const activity = new Map<string, ActivityItem[]>();
  /** Recordings by id, with who owns each. */
  const records = new Map<string, MediaRecord>();
  const mine = (owner: string) => entries.get(owner) ?? [];
  const mineRecords = (owner: string) => [...records.values()].filter((r) => r.userId === owner);
  const recordOf = (owner: string, id: string) => {
    const r = records.get(id);
    return r && r.userId === owner ? r : undefined;
  };
  const matching = (owner: string, question: string) => {
    const wanted = new Set(words(question));
    return mine(owner).filter((e) => words(e.text).some((w) => wanted.has(w)));
  };

  const media: DeboMediaDb = {
    async start(owner, input) {
      const record: MediaRecord = {
        id: input.id,
        userId: owner,
        sourceId: null,
        kind: input.kind,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        durationMs: input.durationMs ?? null,
        recordedAt: input.recordedAt ?? null,
        device: input.device ?? null,
        uploadState: "uploading",
        uploadId: input.uploadId ?? null,
        transcriptStatus: "waiting",
        transcriptError: null,
        transcriptAttempts: 0,
        transcriptStartedAt: null,
        language: null,
        segments: null,
        contentHash: null,
        createdAt: new Date(),
      };
      records.set(record.id, record);
      return record;
    },
    async get(owner, id) {
      return recordOf(owner, id) ?? null;
    },
    async forSource(owner, sourceId) {
      return mineRecords(owner).find((r) => r.sourceId === sourceId) ?? null;
    },
    async text(owner, sourceId) {
      return mine(owner).find((e) => e.id === sourceId)?.text ?? "";
    },
    async finish(owner, id, input) {
      const r = recordOf(owner, id);
      if (!r) return null;
      if (r.sourceId) return { record: r, created: false };
      const sourceId = randomUUID();
      entries.set(owner, [
        ...mine(owner),
        { id: sourceId, kind: r.kind, title: input.title, text: "", happenedAt: input.happenedAt },
      ]);
      Object.assign(r, { sourceId, uploadState: "stored", uploadId: null, sizeBytes: input.sizeBytes, transcriptStatus: "waiting" });
      return { record: r, created: true };
    },
    async claim(owner, id) {
      const r = recordOf(owner, id);
      if (!r || r.uploadState !== "stored" || r.transcriptStatus !== "waiting") return null;
      Object.assign(r, {
        transcriptStatus: "working",
        transcriptError: null,
        transcriptStartedAt: new Date(),
        transcriptAttempts: r.transcriptAttempts + 1,
      });
      return r;
    },
    async pending() {
      return [...records.values()]
        .filter((r) => r.uploadState === "stored" && r.transcriptStatus === "waiting")
        .map((r) => ({ id: r.id, userId: r.userId }));
    },
    async requeue(owner, id) {
      const r = recordOf(owner, id);
      if (!r || r.transcriptStatus !== "failed") return false;
      Object.assign(r, { transcriptStatus: "waiting", transcriptError: null, transcriptAttempts: 0 });
      return true;
    },
    async fail(owner, id, reason) {
      const r = recordOf(owner, id);
      if (r) Object.assign(r, { transcriptStatus: "failed", transcriptError: reason });
    },
    async save(owner, id, t) {
      const r = recordOf(owner, id);
      const entry = r?.sourceId ? mine(owner).find((e) => e.id === r.sourceId) : undefined;
      if (!r || !entry) return false;
      Object.assign(r, {
        transcriptStatus: "ready",
        transcriptError: null,
        language: t.language,
        segments: t.segments,
        contentHash: t.contentHash,
      });
      if (t.durationMs) r.durationMs = t.durationMs;
      entry.text = t.text.trim();
      entry.title = titleOf(entry.text, r.kind === "video" ? "Video" : "Voice note");
      return true;
    },
    async findByHash(owner, hash, exceptId) {
      const other = mineRecords(owner).find(
        (r) => r.contentHash === hash && r.id !== exceptId && r.transcriptStatus === "ready",
      );
      const entry = other?.sourceId ? mine(owner).find((e) => e.id === other.sourceId) : undefined;
      return other && entry ? { text: entry.text, language: other.language, segments: other.segments ?? [] } : null;
    },
    async keys(owner) {
      return mineRecords(owner).map((r) => ({ id: r.id, objectKey: r.objectKey, uploadId: r.uploadId }));
    },
    async remove(owner, id) {
      return recordOf(owner, id) ? records.delete(id) : false;
    },
    async stale() {
      const cutoff = Date.now() - 24 * 3_600_000;
      return [...records.values()]
        .filter((r) => !r.sourceId && r.createdAt.getTime() < cutoff)
        .map((r) => ({ id: r.id, userId: r.userId, objectKey: r.objectKey, uploadId: r.uploadId }));
    },
    async today(owner) {
      const midnight = new Date().setUTCHours(0, 0, 0, 0);
      const todays = mineRecords(owner).filter((r) => r.createdAt.getTime() >= midnight);
      return { count: todays.length, ms: todays.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) };
    },
    async export(owner) {
      return mineRecords(owner).filter((r) => r.uploadState === "stored");
    },
  };

  return {
    entries: {
      async list(owner, { limit, contains }) {
        const needle = contains?.toLowerCase();
        return mine(owner)
          .filter((e) => !needle || e.text.toLowerCase().includes(needle))
          .sort((a, b) => b.happenedAt.getTime() - a.happenedAt.getTime())
          .slice(0, limit)
          .map((e) => ({ ...e, media: mineRecords(owner).find((r) => r.sourceId === e.id) ?? null }));
      },
      async create(owner, text, happenedAt) {
        const entry: Item = { id: randomUUID(), title: titleOf(text, ""), text, happenedAt: happenedAt ?? new Date() };
        entries.set(owner, [...mine(owner), entry]);
        return entry;
      },
      async update(owner, id, text) {
        const entry = mine(owner).find((e) => e.id === id);
        if (!entry) return false;
        entry.text = text;
        return true;
      },
      async remove(owner, id) {
        const before = mine(owner).length;
        for (const r of mineRecords(owner)) if (r.sourceId === id) records.delete(r.id);
        entries.set(
          owner,
          mine(owner).filter((e) => e.id !== id),
        );
        memories.set(
          owner,
          (memories.get(owner) ?? []).filter((m) => m.sourceId !== id),
        );
        return mine(owner).length < before;
      },
    },
    async search(owner, query, limit) {
      return matching(owner, query)
        .slice(0, limit)
        .map((e) => ({
          chunkId: e.id,
          sourceId: e.id,
          kind: e.kind ?? "journal",
          title: e.title,
          happenedAt: e.happenedAt,
          text: e.text,
        }));
    },
    async *ask(owner, question): AsyncGenerator<AskEvent, void> {
      const found = matching(owner, question);
      if (found.length === 0) {
        yield { type: "done", outcome: { status: "unknown" } };
        return;
      }
      const sources = found.map((e) => ({ id: e.id, label: chipLabel(e.happenedAt, e.kind) }));
      const answer = `From your journal: ${found[0]?.text ?? ""}`;
      yield { type: "sources", sources };
      yield { type: "text", delta: answer };
      yield { type: "done", outcome: { status: "answered", answer, sources } };
    },
    async sources(owner, ids) {
      return mine(owner)
        .filter((e) => ids.includes(e.id))
        .map((e) => ({ id: e.id, kind: e.kind, title: e.title, happenedAt: e.happenedAt }));
    },
    memories: {
      async list(owner) {
        return memories.get(owner) ?? [];
      },
      async update(owner, id, text) {
        const m = (memories.get(owner) ?? []).find((x) => x.id === id);
        if (!m) return null;
        m.text = text;
        m.editedByUser = true;
        m.updatedAt = new Date().toISOString();
        return m;
      },
      async forget(owner, id) {
        const m = (memories.get(owner) ?? []).find((x) => x.id === id);
        if (!m) return null;
        memories.set(
          owner,
          (memories.get(owner) ?? []).filter((x) => x.id !== id),
        );
        return m;
      },
    },
    media,
    activity: {
      async list(owner) {
        return [...(activity.get(owner) ?? [])].reverse();
      },
      async record(owner, item) {
        activity.set(owner, [
          ...(activity.get(owner) ?? []),
          {
            id: randomUUID(),
            actor: item.actor,
            action: item.action,
            sourceIds: item.sourceIds ?? [],
            createdAt: new Date(),
          },
        ]);
      },
    },
    // Stands in for "Debo remembers what is in it": the first line becomes a memory.
    async afterChange(owner, entryId, change) {
      if (change !== "saved") return;
      const entry = mine(owner).find((e) => e.id === entryId);
      if (!entry || !entry.text.trim()) return;
      const kept = (memories.get(owner) ?? []).filter((m) => m.sourceId !== entryId);
      kept.push({
        id: randomUUID(),
        text: entry.text.split("\n")[0]?.slice(0, 200) ?? "",
        sourceId: entryId,
        editedByUser: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      });
      memories.set(owner, kept);
    },
    askConfigured: true,
  };
}
