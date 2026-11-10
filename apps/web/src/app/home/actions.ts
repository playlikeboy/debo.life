"use server";

import { createEntry, deleteEntry, updateEntry } from "@debo/db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { afterEntryChanged } from "@/lib/after-entry";
import { z } from "zod";
import { answerQuestion, logActivity, type SourceChip } from "@/lib/ask";
import { getAuth } from "@/lib/auth/server";
import { databaseUrl } from "@/lib/server-env";

// Server Actions: Next checks that each call comes from our own origin.
// Every action checks the session itself and passes the user id down.
// Logs and records carry ids and numbers only, never note text.

async function requireUserId(): Promise<string | null> {
  const { data: session } = await getAuth().getSession();
  return session?.user?.id ?? null;
}

export type SaveState = { ok: boolean; message: string };

export async function saveEntry(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Your session ended. Sign in again, then save." };
  try {
    const entry = await createEntry(databaseUrl(), userId, { text: formData.get("text") });
    await logActivity(userId, "you", "saved", [entry.id]);
    after(() => afterEntryChanged(userId, entry.id));
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
    after(() => afterEntryChanged(userId, sourceId));
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

export type Chip = SourceChip;
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
    const result = await answerQuestion(userId, parsed.data);
    if (result.status === "answered") return { status: "answered", question, answer: result.answer, sources: result.sources };
    if (result.status === "limit") return { status: "limit", question, answer: result.message, sources: [] };
    return { status: "unknown", question, answer: "", sources: [] };
  } catch (error) {
    console.error("ask failed", { userId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { status: "error", question, answer: "I couldn't reach my AI helper just now. Try again in a moment.", sources: [] };
  }
}
