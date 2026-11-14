import type { FoundPiece } from "@debo/db";
import { describe, expect, it } from "vitest";
import { type AskEvent, type BrainLlm, type BrainStore, createBrain, dailyTokenLimit, LIMIT_MESSAGE } from "./index";

const ME = "11111111-1111-4111-8111-111111111111";
const ENTRY = "22222222-2222-4222-8222-222222222222";

const piece: FoundPiece = {
  chunkId: "c1",
  sourceId: ENTRY,
  title: "Walk with Arun",
  happenedAt: new Date("2026-03-14T10:00:00Z"),
  text: "Walked with my brother Arun.",
};

function fakeStore(overrides: Partial<BrainStore> & { found?: FoundPiece[]; used?: number } = {}) {
  const calls = { usage: [] as number[], activity: [] as string[], searchedFor: [] as string[] };
  const store: BrainStore = {
    async searchPieces(userId) {
      calls.searchedFor.push(userId);
      return overrides.found ?? [];
    },
    async recordUsage(_u, row) {
      calls.usage.push(row.units);
    },
    async tokensUsedToday() {
      return overrides.used ?? 0;
    },
    async recordActivity(_u, item) {
      calls.activity.push(item.action);
    },
    ...overrides,
  };
  return { store, calls };
}

type Answer = Parameters<BrainLlm["streamAnswerFromSources"]>;
function fakeLlm(opts: {
  found?: boolean;
  talk?: boolean;
  embedFails?: boolean;
  answerCalled?: { n: number };
  replyCalled?: { n: number };
}): BrainLlm {
  return {
    async embed() {
      if (opts.embedFails) throw new Error("gateway down");
      return { vectors: [[0.1, 0.2]], tokens: 3 };
    },
    async *streamAnswerFromSources(..._args: Answer) {
      if (opts.answerCalled) opts.answerCalled.n += 1;
      yield { type: "sources" as const, sourceIds: opts.found ? [ENTRY, "not-a-piece"] : [] };
      yield { type: "text" as const, delta: opts.found ? "You walked with Arun." : "" };
      yield {
        type: "done" as const,
        found: Boolean(opts.found),
        answer: opts.found ? "You walked with Arun." : "",
        sourceIds: opts.found ? [ENTRY] : [],
        stopped: false,
        provider: "neon" as const,
        tokens: 20,
      };
    },
    async *streamReply() {
      if (opts.replyCalled) opts.replyCalled.n += 1;
      if (opts.talk) yield { type: "text" as const, delta: "Hi!" };
      yield {
        type: "done" as const,
        talk: Boolean(opts.talk),
        reply: opts.talk ? "Hi!" : "",
        stopped: false,
        provider: "neon" as const,
        tokens: 5,
      };
    },
  } as BrainLlm;
}

const quiet = { info() {}, error() {} };

async function collect(stream: AsyncGenerator<AskEvent, void>) {
  const events: AskEvent[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

describe("brain: askStream", () => {
  it("answers from the person's own entries, with sources before text", async () => {
    const { store, calls } = fakeStore({ found: [piece] });
    const brain = createBrain({ store, llm: fakeLlm({ found: true }), log: quiet });
    const events = await collect(brain.askStream(ME, "Who did I walk with?"));
    expect(events.map((e) => e.type)).toEqual(["sources", "text", "done"]);
    const done = events.at(-1);
    expect(done).toMatchObject({
      type: "done",
      outcome: { status: "answered", answer: "You walked with Arun.", sources: [{ id: ENTRY, label: "Journal, 14 March" }] },
    });
    // Ids the model invents are dropped; the chip list holds only real pieces.
    expect(events[0]).toEqual({ type: "sources", sources: [{ id: ENTRY, label: "Journal, 14 March" }] });
    expect(calls.searchedFor).toEqual([ME]);
    expect(calls.activity).toEqual(["answered"]);
    expect(calls.usage).toEqual([3, 20]);
  });

  it("says unknown when nothing is found and it is not small talk", async () => {
    const { store, calls } = fakeStore({ found: [] });
    const answerCalled = { n: 0 };
    const brain = createBrain({ store, llm: fakeLlm({ answerCalled }), log: quiet });
    const events = await collect(brain.askStream(ME, "What is my PIN?"));
    expect(events.at(-1)).toEqual({ type: "done", outcome: { status: "unknown" } });
    expect(answerCalled.n).toBe(0);
    expect(calls.activity).toEqual(["did-not-know"]);
  });

  it("gives small talk a reply with no sources", async () => {
    const { store } = fakeStore({ found: [] });
    const brain = createBrain({ store, llm: fakeLlm({ talk: true }), log: quiet });
    const events = await collect(brain.askStream(ME, "hi"));
    expect(events[0]).toEqual({ type: "sources", sources: [] });
    expect(events.at(-1)).toEqual({ type: "done", outcome: { status: "answered", answer: "Hi!", sources: [] } });
  });

  it("falls back to small talk or unknown when the pieces do not answer", async () => {
    const { store } = fakeStore({ found: [piece] });
    const brain = createBrain({ store, llm: fakeLlm({ found: false }), log: quiet });
    const events = await collect(brain.askStream(ME, "What is my PIN?"));
    expect(events.at(-1)).toEqual({ type: "done", outcome: { status: "unknown" } });
  });

  it("stops before any model answer when the daily limit is reached", async () => {
    const { store } = fakeStore({ found: [piece], used: 40_000 });
    const answerCalled = { n: 0 };
    const replyCalled = { n: 0 };
    const brain = createBrain({ store, llm: fakeLlm({ found: true, answerCalled, replyCalled }), log: quiet });
    const events = await collect(brain.askStream(ME, "Who did I walk with?"));
    expect(events).toEqual([{ type: "done", outcome: { status: "limit", message: LIMIT_MESSAGE } }]);
    expect(answerCalled.n + replyCalled.n).toBe(0);
  });

  it("still answers by keywords when the question cannot be embedded", async () => {
    const logs: string[] = [];
    const { store } = fakeStore({ found: [piece] });
    const brain = createBrain({
      store,
      llm: fakeLlm({ found: true, embedFails: true }),
      log: { info() {}, error: (m) => logs.push(m) },
    });
    const events = await collect(brain.askStream(ME, "Who did I walk with?"));
    expect(events.at(-1)).toMatchObject({ outcome: { status: "answered" } });
    expect(logs).toContain("question embedding failed");
  });

  it("never puts the question or answer text in logs", async () => {
    const lines: string[] = [];
    const { store } = fakeStore({ found: [piece] });
    const brain = createBrain({
      store,
      llm: fakeLlm({ found: true }),
      log: { info: (m, f) => lines.push(JSON.stringify([m, f])), error: (m, f) => lines.push(JSON.stringify([m, f])) },
    });
    await collect(brain.askStream(ME, "Who did I walk with?"));
    const all = lines.join("\n");
    expect(all).not.toContain("Arun");
    expect(all).not.toContain("walk with");
  });

  it("keeps the person's action when the activity record fails", async () => {
    const { store } = fakeStore({
      found: [piece],
      async recordActivity() {
        throw new Error("db down");
      },
    });
    const brain = createBrain({ store, llm: fakeLlm({ found: true }), log: quiet });
    const result = await brain.answerQuestion(ME, "Who did I walk with?");
    expect(result.status).toBe("answered");
  });
});

describe("dailyTokenLimit", () => {
  it("uses 40,000 unless DAILY_TOKEN_LIMIT is a positive number", () => {
    expect(dailyTokenLimit({})).toBe(40_000);
    expect(dailyTokenLimit({ DAILY_TOKEN_LIMIT: "100" })).toBe(100);
    expect(dailyTokenLimit({ DAILY_TOKEN_LIMIT: "nope" })).toBe(40_000);
    expect(dailyTokenLimit({ DAILY_TOKEN_LIMIT: "-5" })).toBe(40_000);
  });
});
