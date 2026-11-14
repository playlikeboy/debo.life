import "server-only";
import type { ActivityAction } from "@debo/db";
import { createBrain, dbStore, type AskEvent, type AskResult } from "@debo/brain";
import { createLlm } from "@debo/llm";
import { databaseUrl, serverEnv } from "@/lib/server-env";

// The one path from a question to an answer. The rules live in @debo/brain
// (shared with the agent platform in os/); this file only plugs in the web
// app's database and AI settings. Every surface (the ask box, the chat, the
// voice) still goes through here.

export {
  dailyTokenLimit,
  LIMIT_MESSAGE,
  UNKNOWN_MESSAGE,
  type AskEvent,
  type AskOutcome,
  type AskResult,
  type SourceChip,
} from "@debo/brain";

/** A brain wired to this request's database and AI settings. */
function brain() {
  return createBrain({ store: dbStore(databaseUrl), llm: createLlm(serverEnv()) });
}

/**
 * Write to the activity record. If that write fails, the person's action
 * still stands; it is logged so the gap can be found and fixed.
 */
export async function logActivity(
  userId: string,
  actor: "you" | "debo",
  action: ActivityAction,
  sourceIds: string[] = [],
) {
  await brain().logActivity(userId, actor, action, sourceIds);
}

/**
 * Answer a question from this person's own entries, streaming the answer.
 * Pass `signal` to let the person stop it. Throws only on unexpected failures.
 */
export function askStream(
  userId: string,
  question: string,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<AskEvent, void> {
  return brain().askStream(userId, question, options);
}

/** Answer a question from this person's own entries, all at once. Throws only on unexpected failures. */
export async function answerQuestion(userId: string, question: string): Promise<AskResult> {
  return brain().answerQuestion(userId, question);
}
