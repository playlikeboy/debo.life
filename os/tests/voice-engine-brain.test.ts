import assert from "node:assert/strict";
import { test } from "node:test";
import { type BaseEvent, EventType } from "@ag-ui/client";
import type { AgentRunner } from "@copilotkit/runtime/v2";
import { Observable } from "rxjs";
import type { Config } from "../apps/server/src/config.ts";
import type { AgentService } from "../apps/server/src/engine/service.ts";
import type { ThreadStore } from "../apps/server/src/threads.ts";
import {
  APPROVAL_MESSAGE,
  VOICE_ERROR_MESSAGE,
  type VoiceBrainEvent,
} from "../apps/server/src/voice/brain.ts";
import { EmotionFilter } from "../apps/server/src/voice/emotion.ts";
import { EngineVoiceBrain } from "../apps/server/src/voice/engine-brain.ts";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const question = { userId: ME, sessionId: "s1", question: "Hi love", history: [] };

const text = (...deltas: string[]): BaseEvent[] => [
  { type: EventType.TEXT_MESSAGE_START, messageId: "m", role: "assistant" } as BaseEvent,
  ...deltas.map((delta) => ({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m", delta }) as BaseEvent),
  { type: EventType.TEXT_MESSAGE_END, messageId: "m" } as BaseEvent,
];
const result = (value: unknown): BaseEvent =>
  ({ type: EventType.TOOL_CALL_RESULT, toolCallId: "t", messageId: "r", role: "tool", content: JSON.stringify(value) }) as BaseEvent;

function brain(events: BaseEvent[] | Error, seen: { owner?: string; thread?: string } = {}) {
  const runner = {
    run: (request: { threadId: string }) => {
      seen.thread = request.threadId;
      return new Observable<BaseEvent>((subscriber) => {
        if (events instanceof Error) subscriber.error(events);
        else {
          for (const event of events) subscriber.next(event);
          subscriber.complete();
        }
      });
    },
    stop: async () => true,
  } as unknown as AgentRunner;
  const threads = { history: async () => ({ id: "x", events: [], messages: [] }) } as unknown as ThreadStore;
  return new EngineVoiceBrain({} as Config, {} as AgentService, runner, threads);
}

async function all(gen: AsyncGenerator<VoiceBrainEvent>) {
  const out: VoiceBrainEvent[] = [];
  for await (const event of gen) out.push(event);
  return out;
}
const go = (b: EngineVoiceBrain) => all(b.answer(question, new AbortController().signal));

test("voice brain: runs in the person's own thread, strips the feeling tag and reports it", async () => {
  const seen: { thread?: string } = {};
  const events = await go(brain(text("[[feel:", "happy]] Aww, ", "hi you!"), seen));
  assert.equal(seen.thread, "voice-s1");
  assert.deepEqual(events, [
    { type: "emotion", emotion: "happy" },
    { type: "text", delta: "Aww, " },
    { type: "text", delta: "hi you!" },
    { type: "done", status: "answered" },
  ]);
});

test("voice brain: journal sources from tools come out as chips before the words", async () => {
  const sources = [{ id: "e1", label: "Journal, 14 March" }];
  const events = await go(
    brain([result({ status: "answered", answer: "x", sources }), ...text("You walked with Arun.")]),
  );
  assert.deepEqual(events.map((e) => e.type), ["sources", "text", "done"]);
  assert.deepEqual(events[0], { type: "sources", sources });
  const matched = await go(brain([result({ matches: [{ source: sources[0] }] }), ...text("Yes.")]));
  assert.deepEqual(matched[0], { type: "sources", sources });
});

test("voice brain: a prepared review is always announced out loud, never completed", async () => {
  const events = await go(
    brain([result({ status: "awaiting_review", actionId: "a1" }), ...text("[[feel:calm]] Done, sent.")]),
  );
  assert.ok(events.some((e) => e.type === "say" && e.text === APPROVAL_MESSAGE));
  const said = await go(
    brain([result({ status: "awaiting_review", actionId: "a1" }), ...text("It's on your screen, tap to approve.")]),
  );
  assert.ok(!said.some((e) => e.type === "say"));
});

test("voice brain: a failed run says sorry once and ends with error", async () => {
  const events = await go(brain(new Error("boom")));
  assert.deepEqual(events, [
    { type: "say", text: VOICE_ERROR_MESSAGE },
    { type: "done", status: "error" },
  ]);
});

test("feeling tag filter: plain text and odd tags pass safely", () => {
  const plain = new EmotionFilter();
  assert.deepEqual(plain.push("Hello there"), { text: "Hello there" });
  const bracket = new EmotionFilter();
  assert.deepEqual(bracket.push("[x] ok"), { text: "[x] ok" });
  const unknown = new EmotionFilter();
  assert.deepEqual(unknown.push("[[feel:grumpy]] hey"), { text: "hey" });
  const held = new EmotionFilter();
  assert.deepEqual(held.push("[[fe"), { text: "" });
  assert.equal(held.flush(), "[[fe");
});
