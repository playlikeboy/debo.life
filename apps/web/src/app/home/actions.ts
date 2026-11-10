"use server";

import {
  createEntry,
  deleteEntry,
  getSources,
  recordActivity,
  recordUsage,
  searchPieces,
  tokensUsedToday,
  updateEntry,
  type ActivityAction,
} from "@debo/db";
import { createLlm } from "@debo/llm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { databaseUrl, serverEnv } from "@/lib/server-env";

// Server Actions: Next checks that each call comes from our own origin.
// Every action checks the session itself and passes the user id down.
// Logs and records carry ids and numbers only, never note text.

async function requireUserId(): Promise<string | null> {
  const { data: session } = await getAuth().getSession();
  return session?.user?.id ?? null;
}

/** Tokens one person may use on our AI key per day (UTC). See docs/BYOK-AND-PLANS.md, "Limits". */
function dailyTokenLimit(): number {
  const fromEnv = Number(process.env.DAILY_TOKEN_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 40_000;
}

/**
 * Write to the activity record. If that write fails, the person's action
 * still stands; log it so the gap can be found and fixed.
 */
async function logActivity(userId: string, actor: "you" | "debo", action: ActivityAction, sourceIds: string[] = []) {
  try {
    await recordActivity(databaseUrl(), userId, { actor, action, sourceIds });
  } catch (error) {
    console.error("activity record failed", { userId, action, reason: error instanceof Error ? error.name : "unknown" });
  }
}

export type SaveState = { ok: boolean; message: string };

export async function saveEntry(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Your session ended. Sign in again, then save." };
  try {
    const entry = await createEntry(databaseUrl(), userId, { text: formData.get("text") });
    await logActivity(userId, "you", "saved", [entry.id]);
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Check your entry." };
    console.error("save entry failed", { userId, reason: error instanceof Error ? error.name : "unknown" });
    return { ok: false, message: "I couldn't save that entry. Try again in a moment." };
  }
  revalidatePath("/home");
  return { ok: true, message: "Entry saved." };
}

export async function editEntry(sourceId: string, text: string): Promise<SaveState> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Your session ended. Sign in again, then save." };
  try {
    const updated = await updateEntry(databaseUrl(), userId, sourceId, { text });
    if (!updated) return { ok: false, message: "I couldn't find that entry. It may have been deleted." };
    await logActivity(userId, "you", "edited", [sourceId]);
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Check your entry." };
    console.error("edit entry failed", { userId, reason: error instanceof Error ? error.name : "unknown" });
    return { ok: false, message: "I couldn't save your changes. Try again in a moment." };
  }
  revalidatePath("/home");
  return { ok: true, message: "Changes saved." };
}

export async function removeEntry(sourceId: string): Promise<SaveState> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Your session ended. Sign in again." };
  const deleted = await deleteEntry(databaseUrl(), userId, sourceId);
  if (deleted) await logActivity(userId, "you", "deleted", [sourceId]);
  revalidatePath("/home");
  return deleted ? { ok: true, message: "Entry deleted." } : { ok: false, message: "That entry was already gone." };
}

export type Chip = { id: string; label: string };
export type AskState = {
  status: "idle" | "answered" | "unknown" | "limit" | "error";
  question: string;
  answer: string;
  sources: Chip[];
};

const Question = z.string().trim().min(3, "Ask a question of at least a few words.").max(500, "Keep your question under 500 characters.");

export async function askDebo(_prev: AskState, formData: FormData): Promise<AskState> {
  const raw = formData.get("question");
  const parsed = Question.safeParse(raw);
  const question = typeof raw === "string" ? raw.trim() : "";
  if (!parsed.success) {
    return { status: "error", question, answer: parsed.error.issues[0]?.message ?? "Check your question.", sources: [] };
  }

  const userId = await requireUserId();
  if (!userId) return { status: "error", question, answer: "Your session ended. Sign in again, then ask.", sources: [] };

  try {
    const pieces = await searchPieces(databaseUrl(), userId, parsed.data);
    if (pieces.length === 0) {
      await logActivity(userId, "debo", "did-not-know");
      return { status: "unknown", question, answer: "", sources: [] };
    }

    // Only spend on the AI when there is something to answer from.
    if ((await tokensUsedToday(databaseUrl(), userId)) >= dailyTokenLimit()) {
      return {
        status: "limit",
        question,
        answer:
          "You have asked a lot today, and Debo has reached its daily limit for you. You can ask again after midnight UTC. Your entries are safe.",
        sources: [],
      };
    }

    const result = await createLlm(serverEnv()).answerFromSources(
      parsed.data,
      pieces.map((p) => ({ id: p.sourceId, title: p.title, date: p.happenedAt.toISOString().slice(0, 10), text: p.text })),
    );
    await recordUsage(databaseUrl(), userId, { provider: result.provider, units: result.tokens });

    if (!result.found) {
      await logActivity(userId, "debo", "did-not-know");
      return { status: "unknown", question, answer: "", sources: [] };
    }

    // Re-read the sources by id, scoped to this person, for the chips.
    const rows = await getSources(databaseUrl(), userId, result.sourceIds);
    const sources = rows.map((row) => ({ id: row.id, label: `Journal, ${formatDay(row.happenedAt)}` }));
    if (sources.length === 0) {
      await logActivity(userId, "debo", "did-not-know");
      return { status: "unknown", question, answer: "", sources: [] };
    }

    await logActivity(userId, "debo", "answered", sources.map((s) => s.id));
    console.info("asked", { userId, sources: sources.length, provider: result.provider, tokens: result.tokens });
    return { status: "answered", question, answer: result.answer, sources };
  } catch (error) {
    console.error("ask failed", { userId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { status: "error", question, answer: "I couldn't reach my AI helper just now. Try again in a moment.", sources: [] };
  }
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
