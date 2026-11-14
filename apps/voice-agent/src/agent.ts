import { type llm, type inference, voice } from "@livekit/agents";
import type { Room } from "@livekit/rtc-node";
import { ReadableStream } from "node:stream/web";
import { type BrainEvent, EMOTIONS, askBrain, readEvents, recentHistory, type Turn } from "./brain.ts";

export type DeboAgentConfig = {
  deboUrl: string;
  secret: string;
  userId: string;
  sessionId: string;
  room: Room;
  /** The speaking voice. Its feeling is set for each reply from the brain's hint. */
  tts?: Pick<inference.TTS<"cartesia/sonic-3">, "updateOptions">;
  /** Turn the per-reply feeling off (VOICE_EMOTION=off) if the voice service rejects it. */
  emotion?: boolean;
  speed?: "slow" | "normal" | "fast" | number | undefined;
};

/**
 * Debo's voice. The LLM step is replaced: instead of a model, it streams the
 * answer from Debo's brain, and sends the answer's sources to the person's
 * screen on the "debo.sources" text topic before speaking. The brain also says
 * how the reply should sound (an `emotion` event before the first words); it is
 * applied to the voice before this reply is spoken.
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

    const applyEmotion = (emotion: string) => {
      if (config.emotion === false || !config.tts || !EMOTIONS.has(emotion)) return;
      try {
        config.tts.updateOptions({
          modelOptions: { emotion, ...(config.speed ? { speed: config.speed } : {}) },
        });
      } catch {
        // A voice that cannot change its feeling still speaks.
      }
    };
    const showSources = async (event: Extract<BrainEvent, { type: "sources" }>) => {
      await config.room.localParticipant
        ?.sendText(JSON.stringify(event.sources), { topic: "debo.sources" })
        .catch(() => {});
    };
    const sorry = "Sorry, I couldn't reach my memory just now. Please try again in a moment.";

    // Read up to the first words before handing the stream to the voice, so the
    // feeling is set before the voice starts speaking this reply.
    const queued: string[] = [];
    let events: AsyncGenerator<BrainEvent> | undefined;
    let failed = false;
    if (question) {
      try {
        const body = await askBrain(
          config,
          { userId: config.userId, sessionId: config.sessionId, question, history },
          abort.signal,
        );
        events = readEvents(body);
        for (;;) {
          const next = await events.next();
          if (next.done) break;
          const event = next.value;
          if (event.type === "sources") await showSources(event);
          else if (event.type === "emotion") applyEmotion(event.emotion);
          else if (event.type === "text" || event.type === "say") {
            queued.push(event.type === "text" ? event.delta : event.text);
            break;
          } else if (event.type === "done") break;
        }
      } catch (error) {
        failed = true;
        if (!abort.signal.aborted)
          console.error("voice brain failed", {
            sessionId: config.sessionId,
            reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          });
      }
    }

    return new ReadableStream<string>({
      async start(controller) {
        if (!question || abort.signal.aborted) {
          controller.close();
          return;
        }
        if (failed) {
          controller.enqueue(sorry);
          controller.close();
          return;
        }
        try {
          for (const piece of queued) controller.enqueue(piece);
          if (events) {
            for (;;) {
              const next = await events.next();
              if (next.done) break;
              const event = next.value;
              if (event.type === "sources") await showSources(event);
              else if (event.type === "text") controller.enqueue(event.delta);
              else if (event.type === "say") controller.enqueue(event.text);
            }
          }
          controller.close();
        } catch (error) {
          if (abort.signal.aborted) return;
          console.error("voice brain failed", {
            sessionId: config.sessionId,
            reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          });
          controller.enqueue(sorry);
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
