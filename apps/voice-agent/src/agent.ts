import { type llm, voice } from "@livekit/agents";
import type { Room } from "@livekit/rtc-node";
import { ReadableStream } from "node:stream/web";
import { askBrain, readEvents, recentHistory, type Turn } from "./brain.ts";

export type DeboAgentConfig = {
  deboUrl: string;
  secret: string;
  userId: string;
  sessionId: string;
  room: Room;
};

/**
 * Debo's voice. The LLM step is replaced: instead of a model, it streams the
 * answer from Debo's brain, and sends the answer's sources to the person's
 * screen on the "debo.sources" text topic before speaking.
 */
export class DeboVoiceAgent extends voice.Agent {
  readonly #config: DeboAgentConfig;

  constructor(config: DeboAgentConfig) {
    super({
      // Not used for answers (llmNode below asks Debo's brain). Kept short
      // in case the framework shows it anywhere.
      instructions: "You are Debo, a kind assistant that helps a person remember their own life.",
    });
    this.#config = config;
  }

  override async llmNode(
    chatCtx: llm.ChatContext,
    _toolCtx: llm.ToolContext,
    _modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<string>> {
    const turns: Turn[] = [];
    for (const item of chatCtx.items) {
      if (item.type !== "message") continue;
      if (item.role !== "user" && item.role !== "assistant") continue;
      const text = item.textContent?.trim();
      if (text) turns.push({ role: item.role, text });
    }
    const last = turns.at(-1);
    const question = last?.role === "user" ? last.text : "";
    const history = recentHistory(turns.slice(0, -1));
    const config = this.#config;
    const abort = new AbortController();

    return new ReadableStream<string>({
      async start(controller) {
        if (!question) {
          controller.close();
          return;
        }
        try {
          const body = await askBrain(
            config,
            { userId: config.userId, sessionId: config.sessionId, question, history },
            abort.signal,
          );
          for await (const event of readEvents(body)) {
            if (event.type === "sources") {
              await config.room.localParticipant
                ?.sendText(JSON.stringify(event.sources), { topic: "debo.sources" })
                .catch(() => {});
            } else if (event.type === "text") {
              controller.enqueue(event.delta);
            } else if (event.type === "say") {
              controller.enqueue(event.text);
            }
          }
          controller.close();
        } catch (error) {
          if (abort.signal.aborted) return;
          console.error("voice brain failed", {
            sessionId: config.sessionId,
            reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          });
          controller.enqueue("Sorry, I couldn't reach my memory just now. Please try again in a moment.");
          controller.close();
        }
      },
      cancel() {
        // The person interrupted: stop asking the brain.
        abort.abort();
      },
    });
  }
}
