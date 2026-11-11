import "server-only";
import { recordActivity, recordUsage, searchPieces, tokensUsedToday, type ActivityAction } from "@debo/db";
import { createLlm } from "@debo/llm";
import { databaseUrl, serverEnv } from "@/lib/server-env";

// The one path from a question to an answer. Every surface (the ask box,
// the chat) goes through here, so the rules hold everywhere:
// - answers come only from the person's own pieces, with sources;
// - no source, no answer ("I don't have anything about that yet");
// - the daily limit is checked before any model call;
// - usage and the activity record are written (ids and numbers only).
//
// askStream() is the pipeline; answerQuestion() is the same pipeline
// without streaming, for surfaces that want the whole answer at once.

export type SourceChip = { id: string; label: string };
export type AskResult =
  | { status: "answered"; answer: string; sources: SourceChip[] }
  | { status: "unknown" }
  | { status: "limit"; message: string };

/**
 * How a streamed question ended. `stopped` means the person stopped it:
 * `answer` and `sources` are what was shown by then (both may be empty).
 */
export type AskOutcome = AskResult | { status: "stopped"; answer: string; sources: SourceChip[] };

/**
 * What askStream yields. `sources` always comes before the first `text`,
 * and `done` always comes last.
 */
export type AskEvent =
  | { type: "sources"; sources: SourceChip[] }
  | { type: "text"; delta: string }
  | { type: "done"; outcome: AskOutcome };

export const UNKNOWN_MESSAGE = "I don’t have anything about that yet. Write an entry about it, then ask again.";
export const LIMIT_MESSAGE =
  "You have asked a lot today, and Debo has reached its daily limit for you. You can ask again after midnight UTC. Your entries are safe.";

/** Tokens one person may use on our AI key per day (UTC). See docs/BYOK-AND-PLANS.md, "Limits". */
export function dailyTokenLimit(): number {
  const fromEnv = Number(process.env.DAILY_TOKEN_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 40_000;
}

/**
 * Write to the activity record. If that write fails, the person's action
 * still stands; log it so the gap can be found and fixed.
 */
export async function logActivity(
  userId: string,
  actor: "you" | "debo",
  action: ActivityAction,
  sourceIds: string[] = [],
) {
  try {
    await recordActivity(databaseUrl(), userId, { actor, action, sourceIds });
  } catch (error) {
    console.error("activity record failed", { userId, action, reason: error instanceof Error ? error.name : "unknown" });
  }
}

/**
 * Answer a question from this person's own entries, streaming the answer.
 * Pass `signal` to let the person stop it. Throws only on unexpected failures.
 */
export async function* askStream(
  userId: string,
  question: string,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<AskEvent, void> {
  const db = databaseUrl();
  const llm = createLlm(serverEnv());

  // Meaning search needs the question as a vector. If that fails, keyword
  // search alone still answers, so the question never fails because of it.
  let embedding: number[] | undefined;
  try {
    const { vectors, tokens } = await llm.embed([question]);
    embedding = vectors[0];
    await recordUsage(db, userId, { provider: "neon", units: tokens });
  } catch (error) {
    console.error("question embedding failed", { userId, reason: error instanceof Error ? error.name : "unknown" });
  }

  const pieces = await searchPieces(db, userId, question, { embedding });
  if (pieces.length === 0) {
    await logActivity(userId, "debo", "did-not-know");
    yield { type: "done", outcome: { status: "unknown" } };
    return;
  }

  // Only spend on the AI when there is something to answer from.
  if ((await tokensUsedToday(db, userId)) >= dailyTokenLimit()) {
    yield { type: "done", outcome: { status: "limit", message: LIMIT_MESSAGE } };
    return;
  }

  // Chips come from the pieces search found, which are already this
  // person's own (searchPieces filters by userId), and the model can only
  // name ids from those pieces. So no second read is needed.
  const days = new Map(pieces.map((p) => [p.sourceId, p.happenedAt]));
  const chipsFor = (ids: string[]): SourceChip[] =>
    ids.flatMap((id) => {
      const day = days.get(id);
      return day ? [{ id, label: `Journal, ${formatDay(day)}` }] : [];
    });

  const stream = llm.streamAnswerFromSources(
    question,
    pieces.map((p) => ({ id: p.sourceId, title: p.title, date: p.happenedAt.toISOString().slice(0, 10), text: p.text })),
    { signal: options.signal },
  );
  for await (const event of stream) {
    if (event.type === "sources") {
      yield { type: "sources", sources: chipsFor(event.sourceIds) };
    } else if (event.type === "text") {
      yield { type: "text", delta: event.delta };
    } else {
      await recordUsage(db, userId, { provider: event.provider, units: event.tokens });
      const sources = chipsFor(event.sourceIds);
      const shown = event.found && sources.length > 0;
      if (shown) await logActivity(userId, "debo", "answered", sources.map((s) => s.id));
      console.info("asked", { userId, sources: sources.length, provider: event.provider, tokens: event.tokens, stopped: event.stopped });

      if (event.stopped) {
        yield { type: "done", outcome: { status: "stopped", answer: shown ? event.answer : "", sources: shown ? sources : [] } };
      } else if (shown) {
        yield { type: "done", outcome: { status: "answered", answer: event.answer, sources } };
      } else {
        await logActivity(userId, "debo", "did-not-know");
        yield { type: "done", outcome: { status: "unknown" } };
      }
      return;
    }
  }
  throw new Error("The answer stream ended without a result.");
}

/** Answer a question from this person's own entries, all at once. Throws only on unexpected failures. */
export async function answerQuestion(userId: string, question: string): Promise<AskResult> {
  for await (const event of askStream(userId, question)) {
    if (event.type !== "done") continue;
    // Without a signal nothing can stop the answer, so `stopped` cannot happen.
    if (event.outcome.status === "stopped") throw new Error("An answer stopped without being asked to.");
    return event.outcome;
  }
  throw new Error("The answer stream ended without a result.");
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
