import "server-only";
import { getSources, recordActivity, recordUsage, searchPieces, tokensUsedToday, type ActivityAction } from "@debo/db";
import { createLlm } from "@debo/llm";
import { databaseUrl, serverEnv } from "@/lib/server-env";

// The one path from a question to an answer. Every surface (the ask box,
// the chat) goes through here, so the rules hold everywhere:
// - answers come only from the person's own pieces, with sources;
// - no source, no answer ("I don't have anything about that yet");
// - the daily limit is checked before any model call;
// - usage and the activity record are written (ids and numbers only).

export type SourceChip = { id: string; label: string };
export type AskResult =
  | { status: "answered"; answer: string; sources: SourceChip[] }
  | { status: "unknown" }
  | { status: "limit"; message: string };

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

/** Answer a question from this person's own entries. Throws only on unexpected failures. */
export async function answerQuestion(userId: string, question: string): Promise<AskResult> {
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
    return { status: "unknown" };
  }

  // Only spend on the AI when there is something to answer from.
  if ((await tokensUsedToday(db, userId)) >= dailyTokenLimit()) {
    return { status: "limit", message: LIMIT_MESSAGE };
  }

  const result = await llm.answerFromSources(
    question,
    pieces.map((p) => ({ id: p.sourceId, title: p.title, date: p.happenedAt.toISOString().slice(0, 10), text: p.text })),
  );
  await recordUsage(db, userId, { provider: result.provider, units: result.tokens });

  // Re-read the sources by id, scoped to this person, for the chips.
  const rows = result.found ? await getSources(db, userId, result.sourceIds) : [];
  if (rows.length === 0) {
    await logActivity(userId, "debo", "did-not-know");
    return { status: "unknown" };
  }

  const sources = rows.map((row) => ({ id: row.id, label: `Journal, ${formatDay(row.happenedAt)}` }));
  await logActivity(userId, "debo", "answered", sources.map((s) => s.id));
  console.info("asked", { userId, sources: sources.length, provider: result.provider, tokens: result.tokens });
  return { status: "answered", answer: result.answer, sources };
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
