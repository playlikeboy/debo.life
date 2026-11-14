// DEV ONLY. An in-memory Debo journal for trying the screens on a laptop with
// no database and no AI key. Everything is forgotten when the server stops.
//
// It is switched on by DEBO_DEV_MEMORY=1 and only in a sample workspace
// (see createDebo). A live workspace refuses to start with the switch set, so
// this can never hold a real person's words.
import { randomUUID } from "node:crypto";
import type { ActivityItem, AskEvent, DeboBackend, Entry, Memory } from "./backend.ts";

const words = (text: string) => text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
const day = (e: Entry) =>
  e.happenedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

export function devMemoryBackend(): DeboBackend {
  const entries = new Map<string, Entry[]>();
  const memories = new Map<string, Memory[]>();
  const activity = new Map<string, ActivityItem[]>();
  const mine = (owner: string) => entries.get(owner) ?? [];
  const matching = (owner: string, question: string) => {
    const wanted = new Set(words(question));
    return mine(owner).filter((e) => words(e.text).some((w) => wanted.has(w)));
  };

  return {
    entries: {
      async list(owner, { limit, contains }) {
        const needle = contains?.toLowerCase();
        return mine(owner)
          .filter((e) => !needle || e.text.toLowerCase().includes(needle))
          .sort((a, b) => b.happenedAt.getTime() - a.happenedAt.getTime())
          .slice(0, limit);
      },
      async create(owner, text) {
        const entry: Entry = {
          id: randomUUID(),
          title: text.split("\n")[0]?.slice(0, 60) ?? "",
          text,
          happenedAt: new Date(),
        };
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
      const sources = found.map((e) => ({ id: e.id, label: `Journal, ${day(e)}` }));
      const answer = `From your journal: ${found[0]?.text ?? ""}`;
      yield { type: "sources", sources };
      yield { type: "text", delta: answer };
      yield { type: "done", outcome: { status: "answered", answer, sources } };
    },
    async sources(owner, ids) {
      return mine(owner)
        .filter((e) => ids.includes(e.id))
        .map((e) => ({ id: e.id, title: e.title, happenedAt: e.happenedAt }));
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
      if (!entry) return;
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
