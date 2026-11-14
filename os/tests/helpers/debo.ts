// A fake Debo brain and database for tests: in memory, one list per owner, so
// tests can prove that one person never sees another person's journal.
import { randomUUID } from "node:crypto";
import { UNKNOWN_MESSAGE } from "@debo/brain";
import type { ActivityItem, AskEvent, DeboBackend, Entry, Memory } from "../../apps/server/src/debo/backend.ts";

export const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export type FakeBackend = DeboBackend & {
  /** Everything the fake printed or stored, to check that text never leaks into logs. */
  asked: { owner: string; question: string }[];
  addMemory(owner: string, sourceId: string, text: string): Memory;
  entriesOf(owner: string): Entry[];
};

export function fakeBackend(
  options: { memories?: boolean; askConfigured?: boolean; failActivity?: boolean } = {},
): FakeBackend {
  const entries = new Map<string, Entry[]>();
  const memories = new Map<string, Memory[]>();
  const activity = new Map<string, ActivityItem[]>();
  const asked: { owner: string; question: string }[] = [];
  const mine = (owner: string) => entries.get(owner) ?? [];
  const words = (text: string) => text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const matching = (owner: string, question: string) => {
    const wanted = new Set(words(question));
    return mine(owner).filter((e) => words(e.text).some((w) => wanted.has(w)));
  };
  const day = (e: Entry) => e.happenedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

  const backend: FakeBackend = {
    asked,
    entriesOf: mine,
    addMemory(owner, sourceId, text) {
      const memory: Memory = {
        id: randomUUID(),
        text,
        sourceId,
        editedByUser: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      memories.set(owner, [...(memories.get(owner) ?? []), memory]);
      return memory;
    },
    entries: {
      async list(owner, { limit, contains }) {
        const needle = contains?.toLowerCase();
        return mine(owner)
          .filter((e) => !needle || e.text.toLowerCase().includes(needle))
          .sort((a, b) => b.happenedAt.getTime() - a.happenedAt.getTime())
          .slice(0, limit);
      },
      async create(owner, text) {
        const entry: Entry = { id: randomUUID(), title: text.split("\n")[0]?.slice(0, 60) ?? "", text, happenedAt: new Date() };
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
        entries.set(owner, mine(owner).filter((e) => e.id !== id));
        return mine(owner).length < before;
      },
    },
    async search(owner, query, limit) {
      return matching(owner, query)
        .slice(0, limit)
        .map((e) => ({ chunkId: e.id, sourceId: e.id, title: e.title, happenedAt: e.happenedAt, text: e.text }));
    },
    async *ask(owner, question): AsyncGenerator<AskEvent, void> {
      asked.push({ owner, question });
      const found = matching(owner, question);
      if (found.length === 0) {
        yield { type: "done", outcome: { status: "unknown" } };
        return;
      }
      const sources = found.map((e) => ({ id: e.id, label: `Journal, ${day(e)}` }));
      yield { type: "sources", sources };
      yield { type: "text", delta: "From your journal: " };
      yield { type: "text", delta: found[0]?.text ?? "" };
      yield { type: "done", outcome: { status: "answered", answer: `From your journal: ${found[0]?.text}`, sources } };
    },
    async sources(owner, ids) {
      return mine(owner).filter((e) => ids.includes(e.id)).map((e) => ({ id: e.id, title: e.title, happenedAt: e.happenedAt }));
    },
    memories: options.memories === false
      ? null
      : {
          async list(owner) {
            return memories.get(owner) ?? [];
          },
          async update(owner, id, text) {
            const m = (memories.get(owner) ?? []).find((x) => x.id === id);
            if (!m) return null;
            m.text = text;
            m.editedByUser = true;
            return m;
          },
          async forget(owner, id) {
            const m = (memories.get(owner) ?? []).find((x) => x.id === id);
            if (!m) return null;
            memories.set(owner, (memories.get(owner) ?? []).filter((x) => x.id !== id));
            return m;
          },
        },
    activity: {
      async list(owner) {
        return [...(activity.get(owner) ?? [])].reverse();
      },
      async record(owner, item) {
        if (options.failActivity) throw new Error("activity table is down");
        activity.set(owner, [
          ...(activity.get(owner) ?? []),
          { id: randomUUID(), actor: item.actor, action: item.action, sourceIds: item.sourceIds ?? [], createdAt: new Date() },
        ]);
      },
    },
    async afterChange() {},
    askConfigured: options.askConfigured !== false,
  };
  return backend;
}

export { UNKNOWN_MESSAGE };
