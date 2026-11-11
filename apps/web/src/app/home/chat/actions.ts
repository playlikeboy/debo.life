"use server";

import { deleteConversation } from "@debo/db";
import { getAuth } from "@/lib/auth/server";
import { databaseUrl } from "@/lib/server-env";

/** Delete one of this person's chats, with every message in it, for good. */
export async function deleteChat(chatId: unknown): Promise<{ ok: boolean; message: string }> {
  const { data: session } = await getAuth().getSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Your session ended. Sign in again, then try." };
  if (typeof chatId !== "string") return { ok: false, message: "I couldn’t find that chat." };
  try {
    const deleted = await deleteConversation(databaseUrl(), userId, chatId);
    return deleted ? { ok: true, message: "Chat deleted." } : { ok: false, message: "That chat was already gone." };
  } catch (error) {
    console.error("chat delete failed", { userId, chatId, reason: error instanceof Error ? error.name : "unknown" });
    return { ok: false, message: "I couldn’t delete that chat just now. Nothing was changed. Try again in a moment." };
  }
}
