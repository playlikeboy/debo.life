import { randomUUID } from "node:crypto";
import { type BaseEvent, EventType, type Message } from "@ag-ui/client";
import type { AgentRunner } from "@copilotkit/runtime/v2";
import type { Config } from "../config.ts";
import { ConversationAgent } from "../engine/conversation.ts";
import type { AgentService } from "../engine/service.ts";
import { threadOwner } from "../thread-runner.ts";
import type { ThreadStore } from "../threads.ts";
import {
  APPROVAL_MESSAGE,
  VOICE_ERROR_MESSAGE,
  type VoiceBrain,
  type VoiceBrainEvent,
  type VoiceQuestion,
  type VoiceSource,
} from "./brain.ts";
import { EmotionFilter } from "./emotion.ts";

/** How many earlier messages of the call the agent sees. */
const CONTEXT_MESSAGES = 40;

/**
 * Debo's voice brain: the same conversation agent as chat (journal search and
 * saving, memories, tasks, web, browser, computer, mail, calendar, connected
 * apps), told it is speaking out loud. Each call is one conversation in the
 * person's Chat, saved by the same runner chat uses, so it can be read and
 * deleted there. Audio is never stored.
 *
 * Voice cannot do risky things (docs/VOICE.md rule 4). The agent's tools only
 * prepare a review for anything that sends, posts, pays, changes or deletes,
 * and a review is approved only by a tap on screen. When a turn prepared one,
 * this brain says so out loud, whatever the model wrote.
 *
 * Source chips come from what the tools returned (journal search and ask), not
 * from the model's words. Never log the question or the answer.
 */
export class EngineVoiceBrain implements VoiceBrain {
  constructor(
    private readonly config: Config,
    private readonly service: AgentService,
    private readonly runner: AgentRunner,
    private readonly threads: ThreadStore,
  ) {}

  async *answer(question: VoiceQuestion, signal: AbortSignal): AsyncGenerator<VoiceBrainEvent> {
    const owner = question.userId;
    const threadId = `voice-${question.sessionId}`.slice(0, 128);
    const runId = randomUUID();
    let earlier: Message[] = [];
    try {
      earlier = (await this.threads.history(owner, threadId)).messages;
    } catch {
      // A new call has no history yet; carry on.
    }
    earlier = earlier.slice(-CONTEXT_MESSAGES);
    // Start on a person's message so a tool result never loses its call.
    while (earlier.length > 0 && earlier[0]?.role !== "user") earlier = earlier.slice(1);
    const messages: Message[] = [
      ...earlier,
      { id: randomUUID(), role: "user", content: question.question },
    ];
    const agent = new ConversationAgent(
      this.config,
      this.service,
      owner,
      undefined,
      "voice",
    );
    agent.setMessages(messages);
    agent.threadId = threadId;

    const queue: BaseEvent[] = [];
    let finished = false;
    let failure: Error | undefined;
    let wake: (() => void) | undefined;
    const poke = () => {
      wake?.();
      wake = undefined;
    };
    let subscription: { unsubscribe(): void };
    try {
      subscription = this.start(owner, { threadId, runId, agent, messages }, {
        next: (event) => {
          queue.push(event);
          poke();
        },
        end: (error) => {
          if (error) failure = error;
          finished = true;
          poke();
        },
      });
    } catch {
      yield { type: "say", text: VOICE_ERROR_MESSAGE };
      yield { type: "done", status: "error" };
      return;
    }
    const onAbort = () => {
      subscription.unsubscribe();
      void threadOwner
        .run(owner, () => this.runner.stop({ threadId, runId }))
        .catch(() => undefined);
      finished = true;
      poke();
    };
    signal.addEventListener("abort", onAbort, { once: true });

    const filter = new EmotionFilter();
    const sources = new Map<string, VoiceSource>();
    let sourcesSent = 0;
    let spoke = false;
    let spokenText = "";
    let approval = false;
    let errored = false;
    const flushSources = function* (): Generator<VoiceBrainEvent> {
      if (sources.size > sourcesSent) {
        sourcesSent = sources.size;
        yield { type: "sources", sources: [...sources.values()] };
      }
    };
    try {
      while (!signal.aborted) {
        const event = queue.shift();
        if (!event) {
          if (finished) break;
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          continue;
        }
        if (event.type === EventType.TEXT_MESSAGE_START) {
          filter.reset();
        } else if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
          const delta = (event as { delta?: unknown }).delta;
          if (typeof delta !== "string" || !delta) continue;
          const piece = filter.push(delta);
          if (piece.emotion) yield { type: "emotion", emotion: piece.emotion };
          if (piece.text) {
            yield* flushSources();
            spoke = true;
            spokenText += piece.text;
            yield { type: "text", delta: piece.text };
          }
        } else if (event.type === EventType.TEXT_MESSAGE_END) {
          const held = filter.flush();
          if (held) {
            yield* flushSources();
            spoke = true;
            spokenText += held;
            yield { type: "text", delta: held };
          }
        } else if (event.type === EventType.TOOL_CALL_RESULT) {
          const result = readResult((event as { content?: unknown }).content);
          for (const source of result.sources) sources.set(source.id, source);
          if (result.approval) approval = true;
        } else if (event.type === EventType.RUN_ERROR) {
          errored = true;
          break;
        }
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
      subscription.unsubscribe();
    }
    if (signal.aborted) {
      yield { type: "done", status: "stopped" };
      return;
    }
    yield* flushSources();
    if (errored || failure) {
      if (!spoke) yield { type: "say", text: VOICE_ERROR_MESSAGE };
      yield { type: "done", status: "error" };
      return;
    }
    // Whatever the model wrote, the person hears that the decision is on their screen.
    if (approval && !/screen/i.test(spokenText)) {
      spoke = true;
      yield { type: "say", text: APPROVAL_MESSAGE };
    }
    yield { type: "done", status: spoke ? "answered" : "unknown" };
  }

  /** Start the run through the runner chat uses, as the person, so it is saved to their Chat. */
  private start(
    owner: string,
    run: { threadId: string; runId: string; agent: ConversationAgent; messages: Message[] },
    sink: { next: (event: BaseEvent) => void; end: (error?: Error) => void },
  ) {
    const { threadId, runId, agent, messages } = run;
    return threadOwner.run(owner, () =>
      this.runner
        .run({
          threadId,
          agent,
          input: { threadId, runId, messages, tools: [], context: [], state: {}, forwardedProps: {} },
        })
        .subscribe({
          next: sink.next,
          error: (error) => sink.end(error instanceof Error ? error : new Error("voice run failed")),
          complete: () => sink.end(),
        }),
    );
  }
}

/** What a tool result means for the call: journal sources it showed, a review it prepared. */
function readResult(content: unknown): { sources: VoiceSource[]; approval: boolean } {
  const out: { sources: VoiceSource[]; approval: boolean } = { sources: [], approval: false };
  let value: unknown = content;
  if (typeof content === "string") {
    try {
      value = JSON.parse(content);
    } catch {
      return out;
    }
  }
  if (!value || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  const chip = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const { id, label } = item as { id?: unknown; label?: unknown };
    if (typeof id === "string" && typeof label === "string") out.sources.push({ id, label });
  };
  if (Array.isArray(record.sources)) for (const item of record.sources) chip(item);
  if (Array.isArray(record.matches))
    for (const match of record.matches) chip((match as { source?: unknown } | null)?.source);
  if (typeof record.actionId === "string" && record.status === "awaiting_review")
    out.approval = true;
  return out;
}
