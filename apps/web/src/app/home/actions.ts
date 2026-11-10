"use server";

import { createEntry, deleteEntry, getSources, searchPieces } from "@debo/db";
import { createLlm } from "@debo/llm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { databaseUrl, serverEnv } from "@/lib/server-env";

// Server Actions: Next checks that each call comes from our own origin.
// Every action checks the session itself and passes the user id down.

async function requireUserId(): Promise<string | null> {
  const { data: session } = await getAuth().getSession();
  return session?.user?.id ?? null;
}

export type SaveState = { ok: boolean; message: string };

export async function saveEntry(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Your session ended. Sign in again, then save." };
  try {
    await createEntry(databaseUrl(), userId, { text: formData.get("text") });
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Check your entry." };
    console.error("save entry failed", { userId, reason: error instanceof Error ? error.name : "unknown" });
    return { ok: false, message: "I couldn't save that entry. Try again in a moment." };
  }
  revalidatePath("/home");
  return { ok: true, message: "Entry saved." };
}

export async function removeEntry(sourceId: string): Promise<SaveState> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Your session ended. Sign in again." };
  const deleted = await deleteEntry(databaseUrl(), userId, sourceId);
  revalidatePath("/home");
  return deleted ? { ok: true, message: "Entry deleted." } : { ok: false, message: "That entry was already gone." };
}

export type Chip = { id: string; label: string };
export type AskState = {
  status: "idle" | "answered" | "unknown" | "error";
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
    if (pieces.length === 0) return { status: "unknown", question, answer: "", sources: [] };

    const result = await createLlm(serverEnv()).answerFromSources(
      parsed.data,
      pieces.map((p) => ({ id: p.sourceId, title: p.title, date: p.happenedAt.toISOString().slice(0, 10), text: p.text })),
    );
    if (!result.found) return { status: "unknown", question, answer: "", sources: [] };

    // Re-read the sources by id, scoped to this person, for the chips.
    const rows = await getSources(databaseUrl(), userId, result.sourceIds);
    const sources = rows.map((row) => ({ id: row.id, label: `Journal, ${formatDay(row.happenedAt)}` }));
    if (sources.length === 0) return { status: "unknown", question, answer: "", sources: [] };

    console.info("asked", { userId, sources: sources.length, provider: result.provider });
    return { status: "answered", question, answer: result.answer, sources };
  } catch (error) {
    console.error("ask failed", { userId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { status: "error", question, answer: "I couldn't reach my AI helper just now. Try again in a moment.", sources: [] };
  }
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
