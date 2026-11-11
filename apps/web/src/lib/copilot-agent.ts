import "server-only";
import { saveExchange, type ChatReply } from "@debo/db";
import { BuiltInAgent, type BuiltInAgentCustomFactoryConfig } from "@copilotkit/runtime/v2";
import { z } from "zod";
import { askStream, UNKNOWN_MESSAGE, type SourceChip } from "@/lib/ask";
import { MAX_QUESTION, NOTICE_TOOL, SOURCES_TOOL, type ReplyKind } from "@/lib/chat";
import { databaseUrl } from "@/lib/server-env";

// Debo's chat agent for CopilotKit, speaking AG-UI.
//
// It never calls a model itself: every question goes through askStream()
// (lib/ask.ts), which keeps the rules: answers only from the person's own
// entries with sources, "I don't have anything about that yet" otherwise,
// the daily limit, usage and the activity record. The runtime adds
// RUN_STARTED and RUN_FINISHED. This factory yields:
// - for an answer: one finished `show_sources` tool call (the chips), then
//   the answer text as it streams. Sources always come first, so a stopped
//   answer still shows where its words came from;
// - for anything else: one finished `show_notice` tool call saying what
//   kind of reply it is, then the reply text.
// Each exchange is then saved to the chat history (the AG-UI thread id is
// the chat id). Nothing here logs the question or the answer.

type CustomFactory = BuiltInAgentCustomFactoryConfig["factory"];
type FactoryContext = Parameters<CustomFactory>[0];
type AgentEvent = Awaited<ReturnType<CustomFactory>> extends AsyncIterable<infer E> ? E : never;

const Question = z.string().trim().min(3).max(MAX_QUESTION);
const ERROR_MESSAGE = "I couldn’t reach my AI helper just now. Nothing was lost. Try again in a moment.";
const INVALID_MESSAGE = `Ask a question of a few words, up to ${MAX_QUESTION} characters.`;

/** Text of the last message the person sent, or null if there is none. */
function lastUserText(input: FactoryContext["input"]): string | null {
  for (let i = input.messages.length - 1; i >= 0; i -= 1) {
    const message = input.messages[i];
    if (message?.role !== "user") continue;
    const content: unknown = message.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part: unknown) =>
          part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "",
        )
        .join(" ");
    }
    return null;
  }
  return null;
}

/**
 * AG-UI event objects. `type` is a plain string on the wire; the runtime's
 * types use an enum we cannot import directly, hence the single cast here.
 */
function event(fields: { type: string } & Record<string, unknown>): AgentEvent {
  return fields as unknown as AgentEvent;
}

function* say(text: string): Generator<AgentEvent> {
  const messageId = crypto.randomUUID();
  yield event({ type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
  yield event({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: text });
  yield event({ type: "TEXT_MESSAGE_END", messageId });
}

/** A tool call the browser draws, already finished so the browser never tries to run it. */
function* finishedToolCall(name: string, args: unknown): Generator<AgentEvent> {
  const toolCallId = crypto.randomUUID();
  yield event({ type: "TOOL_CALL_START", toolCallId, toolCallName: name });
  yield event({ type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(args) });
  yield event({ type: "TOOL_CALL_END", toolCallId });
  yield event({ type: "TOOL_CALL_RESULT", messageId: crypto.randomUUID(), toolCallId, role: "tool", content: "shown" });
}

function* notice(kind: Exclude<ReplyKind, "answer">, text: string): Generator<AgentEvent> {
  yield* finishedToolCall(NOTICE_TOOL, { kind });
  yield* say(text);
}

/** Save the exchange to the chat history. A failure never hides the answer; it is logged with ids only. */
async function save(userId: string, conversationId: string, question: string, reply: ChatReply) {
  try {
    const saved = await saveExchange(databaseUrl(), userId, { conversationId, question, reply });
    if (!saved) console.error("chat not saved: not this person's chat", { userId, conversationId });
  } catch (error) {
    console.error("chat save failed", { userId, conversationId, reason: error instanceof Error ? error.name : "unknown" });
  }
}

async function* answer(userId: string, ctx: FactoryContext): AsyncGenerator<AgentEvent> {
  const parsed = Question.safeParse(lastUserText(ctx.input));
  if (!parsed.success) {
    yield* notice("invalid", INVALID_MESSAGE);
    return;
  }
  const question = parsed.data;
  const chatId = ctx.input.threadId;

  let messageId: string | null = null; // the streamed answer's message, once started
  let text = "";
  let sources: SourceChip[] = [];
  let reply: ChatReply;

  try {
    for await (const step of askStream(userId, question, { signal: ctx.abortSignal })) {
      if (step.type === "sources") {
        sources = step.sources;
        yield* finishedToolCall(SOURCES_TOOL, { sources });
        messageId = crypto.randomUUID();
        yield event({ type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
      } else if (step.type === "text") {
        if (!messageId || !step.delta) continue;
        text += step.delta;
        yield event({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: step.delta });
      } else {
        if (messageId) yield event({ type: "TEXT_MESSAGE_END", messageId });
        const outcome = step.outcome;
        if (outcome.status === "answered") {
          reply = { kind: "answer", text: outcome.answer, sourceIds: outcome.sources.map((s) => s.id) };
        } else if (outcome.status === "stopped") {
          // The browser already shows what it got; save the same.
          reply = { kind: "stopped", text: outcome.answer, sourceIds: outcome.sources.map((s) => s.id) };
        } else if (outcome.status === "limit") {
          yield* notice("limit", outcome.message);
          reply = { kind: "limit", text: outcome.message, sourceIds: [] };
        } else {
          yield* notice("unknown", UNKNOWN_MESSAGE);
          reply = { kind: "unknown", text: UNKNOWN_MESSAGE, sourceIds: [] };
        }
        await save(userId, chatId, question, reply);
        return;
      }
    }
    throw new Error("The answer stream ended without a result.");
  } catch (error) {
    // Never pass provider or database errors to the browser.
    console.error("chat ask failed", { userId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    if (messageId) yield event({ type: "TEXT_MESSAGE_END", messageId });
    if (text) {
      // Part of an answer was already shown with its sources: keep it, marked as cut short.
      await save(userId, chatId, question, { kind: "stopped", text, sourceIds: sources.map((s) => s.id) });
      yield* notice("error", ERROR_MESSAGE);
      return;
    }
    yield* notice("error", ERROR_MESSAGE);
    await save(userId, chatId, question, { kind: "error", text: ERROR_MESSAGE, sourceIds: [] });
  }
}

/** A fresh agent for one signed-in person and one request. */
export function createDeboAgent(userId: string) {
  return new BuiltInAgent({ type: "custom", factory: (ctx) => answer(userId, ctx) });
}
