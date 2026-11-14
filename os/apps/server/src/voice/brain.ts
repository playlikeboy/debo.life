import { randomUUID } from "node:crypto";
import { lastValueFrom, toArray } from "rxjs";
import type { Config } from "../config.ts";
import { ConversationAgent } from "../engine/conversation.ts";
import type { AgentService } from "../engine/service.ts";

/** One source Debo used, shown as a chip next to the answer. */
export interface VoiceSource {
  id: string;
  label: string;
}

export interface VoiceTurn {
  role: "user" | "assistant";
  text: string;
}

export interface VoiceQuestion {
  /** The owner id. It comes from the LiveKit identity, which /api/voice/token set. */
  userId: string;
  /** One voice conversation. */
  sessionId: string;
  question: string;
  /** Recent turns before this question, oldest first. */
  history: VoiceTurn[];
}

/**
 * What a brain streams back. The order is: `sources` (optional, before any
 * text), `text` pieces, then exactly one `done`. `say` is a fixed sentence to
 * speak as is, for example "I don't have anything about that yet".
 */
export type VoiceBrainEvent =
  | { type: "sources"; sources: VoiceSource[] }
  | { type: "text"; delta: string }
  | { type: "say"; text: string }
  | { type: "done"; status: "answered" | "unknown" | "limit" | "stopped" | "error" };

/**
 * The one thing the voice route needs from Debo's brain. Swap the
 * implementation in `createApp` (the `voiceBrain` line in app.ts); the route
 * and the voice agent do not change.
 */
export interface VoiceBrain {
  answer(question: VoiceQuestion, signal: AbortSignal): AsyncGenerator<VoiceBrainEvent>;
}

export const VOICE_ERROR_MESSAGE =
  "Sorry, I couldn't reach my memory just now. Please try again in a moment.";

/**
 * The fallback brain: answers with the conversation engine that already runs
 * Debo's chat (the same agent the Chat tab uses). It has no journal search
 * so it shows no source chips. It is used only when Debo's journal brain is
 * not set up; otherwise createApp uses JournalVoiceBrain (journal-brain.ts).
 *
 * Voice cannot do risky things (docs/VOICE.md rule 4): this runs the chat
 * agent with no client tools, and anything that sends, posts or deletes still
 * stops at a reviewed action the person must approve on screen.
 */
export class EngineVoiceBrain implements VoiceBrain {
  constructor(
    private readonly config: Config,
    private readonly service: AgentService,
  ) {}

  async *answer(question: VoiceQuestion, signal: AbortSignal): AsyncGenerator<VoiceBrainEvent> {
    const messages = [
      ...question.history.map((turn) => ({
        id: randomUUID(),
        role: turn.role,
        content: turn.text,
      })),
      { id: randomUUID(), role: "user" as const, content: question.question },
    ];
    const run = new ConversationAgent(this.config, this.service, question.userId).run({
      threadId: question.sessionId,
      runId: randomUUID(),
      messages,
      tools: [],
      context: [],
      state: {},
    });
    let events: RunEvent[];
    try {
      events = await collect(run, signal);
    } catch {
      yield { type: "say", text: VOICE_ERROR_MESSAGE };
      yield { type: "done", status: "error" };
      return;
    }
    let spoke = false;
    for (const event of events) {
      if (event.type === "TEXT_MESSAGE_CONTENT" && typeof event.delta === "string" && event.delta) {
        spoke = true;
        yield { type: "text", delta: event.delta };
      } else if (event.type === "RUN_ERROR") {
        if (!spoke) yield { type: "say", text: VOICE_ERROR_MESSAGE };
        yield { type: "done", status: "error" };
        return;
      }
    }
    yield { type: "done", status: spoke ? "answered" : "unknown" };
  }
}

type RunEvent = { type: string; delta?: unknown };

/** Collect a whole run. Stops waiting if the voice agent hangs up. */
async function collect(
  run: ReturnType<ConversationAgent["run"]>,
  signal: AbortSignal,
): Promise<RunEvent[]> {
  if (signal.aborted) return [];
  const all = lastValueFrom(run.pipe(toArray())) as Promise<RunEvent[]>;
  const aborted = new Promise<RunEvent[]>((resolve) =>
    signal.addEventListener("abort", () => resolve([]), { once: true }),
  );
  return Promise.race([all, aborted]);
}
