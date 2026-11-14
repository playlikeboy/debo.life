import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMIT_MESSAGE, UNKNOWN_MESSAGE, type AskEvent } from "@debo/brain";
import { VOICE_ERROR_MESSAGE, type VoiceBrainEvent } from "../apps/server/src/voice/brain.ts";
import { JournalVoiceBrain } from "../apps/server/src/voice/journal-brain.ts";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const question = { userId: ME, sessionId: "s1", question: "Who did I walk with?", history: [] };

function brain(steps: AskEvent[] | Error, seen: { owner?: string; question?: string } = {}) {
  return new JournalVoiceBrain({
    ask(owner: string, asked: unknown) {
      seen.owner = owner;
      seen.question = String(asked);
      return (async function* () {
        if (steps instanceof Error) throw steps;
        yield* steps;
      })();
    },
  });
}

async function all(events: AsyncGenerator<VoiceBrainEvent>) {
  const out: VoiceBrainEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

test("voice journal brain: an answer carries its sources first and asks as that owner", async () => {
  const sources = [{ id: "e1", label: "Journal, 14 March" }];
  const seen: { owner?: string; question?: string } = {};
  const events = await all(
    brain(
      [
        { type: "sources", sources },
        { type: "text", delta: "You walked " },
        { type: "text", delta: "with Arun." },
        { type: "done", outcome: { status: "answered", answer: "You walked with Arun.", sources } },
      ],
      seen,
    ).answer(question, new AbortController().signal),
  );
  assert.deepEqual(events, [
    { type: "sources", sources },
    { type: "text", delta: "You walked " },
    { type: "text", delta: "with Arun." },
    { type: "done", status: "answered" },
  ]);
  assert.equal(seen.owner, ME);
  assert.equal(seen.question, "Who did I walk with?");
});

test("voice journal brain: unknown and the daily limit are spoken in the same words as chat", async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(
    await all(brain([{ type: "sources", sources: [] }, { type: "done", outcome: { status: "unknown" } }]).answer(question, signal)),
    [
      { type: "say", text: UNKNOWN_MESSAGE },
      { type: "done", status: "unknown" },
    ],
  );
  assert.deepEqual(
    await all(brain([{ type: "done", outcome: { status: "limit", message: LIMIT_MESSAGE } }]).answer(question, signal)),
    [
      { type: "say", text: LIMIT_MESSAGE },
      { type: "done", status: "limit" },
    ],
  );
});

test("voice journal brain: a failure becomes a spoken apology, never a thrown error", async () => {
  const events = await all(brain(new Error("database down")).answer(question, new AbortController().signal));
  assert.deepEqual(events, [
    { type: "say", text: VOICE_ERROR_MESSAGE },
    { type: "done", status: "error" },
  ]);
});
