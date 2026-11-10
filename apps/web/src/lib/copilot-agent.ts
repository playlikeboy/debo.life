import "server-only";
import { BuiltInAgent, type BuiltInAgentCustomFactoryConfig } from "@copilotkit/runtime/v2";
import { z } from "zod";
import { answerQuestion, UNKNOWN_MESSAGE, type SourceChip } from "@/lib/ask";

// Debo's chat agent for CopilotKit, speaking AG-UI.
//
// It never calls a model itself: every question goes through answerQuestion()
// (lib/ask.ts), which keeps the rules — answers only from the person's own
// entries with sources, "I don't have anything about that yet" otherwise,
// the daily limit, usage and the activity record. The runtime adds
// RUN_STARTED and RUN_FINISHED; this factory yields the answer text and, when
// there are sources, one finished `show_sources` tool call that the browser
// renders as source chips (generative UI).

/** Name of the tool call the chat page renders as source chips. */
export const SOURCES_TOOL = "show_sources";

type CustomFactory = BuiltInAgentCustomFactoryConfig["factory"];
type FactoryContext = Parameters<CustomFactory>[0];
type AgentEvent = Awaited<ReturnType<CustomFactory>> extends AsyncIterable<infer E> ? E : never;

const Question = z.string().trim().min(3).max(500);

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

function* showSources(sources: SourceChip[]): Generator<AgentEvent> {
  const toolCallId = crypto.randomUUID();
  yield event({ type: "TOOL_CALL_START", toolCallId, toolCallName: SOURCES_TOOL });
  yield event({ type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify({ sources }) });
  yield event({ type: "TOOL_CALL_END", toolCallId });
  // A result marks the call finished, so the browser never tries to run it.
  yield event({ type: "TOOL_CALL_RESULT", messageId: crypto.randomUUID(), toolCallId, role: "tool", content: "shown" });
}

async function* answer(userId: string, ctx: FactoryContext): AsyncGenerator<AgentEvent> {
  const parsed = Question.safeParse(lastUserText(ctx.input));
  if (!parsed.success) {
    yield* say("Ask a question of a few words, up to 500 characters.");
    return;
  }

  let result: Awaited<ReturnType<typeof answerQuestion>>;
  try {
    result = await answerQuestion(userId, parsed.data);
  } catch (error) {
    // Never pass provider or database errors to the browser.
    console.error("chat ask failed", { userId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    yield* say("I couldn't reach my AI helper just now. Try again in a moment.");
    return;
  }

  if (result.status === "unknown") {
    yield* say(UNKNOWN_MESSAGE);
  } else if (result.status === "limit") {
    yield* say(result.message);
  } else {
    yield* say(result.answer);
    yield* showSources(result.sources);
  }
}

/** A fresh agent for one signed-in person and one request. */
export function createDeboAgent(userId: string) {
  return new BuiltInAgent({ type: "custom", factory: (ctx) => answer(userId, ctx) });
}
