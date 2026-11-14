import { LIMIT_MESSAGE, UNKNOWN_MESSAGE } from "@debo/brain";
import type { DeboService } from "../debo/service.ts";
import {
  VOICE_ERROR_MESSAGE,
  type VoiceBrain,
  type VoiceBrainEvent,
  type VoiceQuestion,
} from "./brain.ts";

/**
 * Debo's real voice brain: the same ask pipeline as chat and the journal
 * routes (packages/brain). Answers come only from the person's own entries,
 * with source chips. The daily limit, "I don't have anything about that yet"
 * and small talk behave exactly as they do in chat.
 *
 * The recent turns in `question.history` are not used yet: the ask pipeline
 * searches each question on its own words (docs/VOICE.md, "Follow-ups").
 */
export class JournalVoiceBrain implements VoiceBrain {
  constructor(private readonly debo: Pick<DeboService, "ask">) {}

  async *answer(question: VoiceQuestion, signal: AbortSignal): AsyncGenerator<VoiceBrainEvent> {
    let spoke = false;
    try {
      for await (const step of this.debo.ask(question.userId, question.question, signal)) {
        if (step.type === "sources") {
          if (step.sources.length > 0) yield { type: "sources", sources: step.sources };
        } else if (step.type === "text") {
          spoke = true;
          yield { type: "text", delta: step.delta };
        } else {
          const status = step.outcome.status;
          if (status === "limit") yield { type: "say", text: LIMIT_MESSAGE };
          else if (status === "unknown") yield { type: "say", text: UNKNOWN_MESSAGE };
          yield { type: "done", status };
          return;
        }
      }
      yield { type: "done", status: spoke ? "answered" : "unknown" };
    } catch {
      // Never log the question or the answer: they are the person's own words.
      if (!spoke) yield { type: "say", text: VOICE_ERROR_MESSAGE };
      yield { type: "done", status: "error" };
    }
  }
}
