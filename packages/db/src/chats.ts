// Chat history: conversations and their messages.
// Every function takes userId and filters by it. Callers must never log
// message text or titles: they hold the person's own words.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withDb } from "./client";
import { conversations, messages, type ChatKind, type ChatRole } from "./schema";

export type { ChatKind, ChatRole };

export type ChatSummary = { id: string; title: string; updatedAt: Date };

export type ChatMessage = {
  id: string;
  role: ChatRole;
  kind: ChatKind;
  text: string;
  sourceIds: string[];
  createdAt: Date;
};

/** Debo's side of one exchange. */
export type ChatReply = { kind: Exclude<ChatKind, "question">; text: string; sourceIds: string[] };

const Id = z.string().uuid();

/** Short name for the chat list: the first question's first line, cut to 60 characters. */
export function chatTitleFrom(question: string): string {
  const line = question.split("\n").find((l) => l.trim())?.trim() ?? "Chat with Debo";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

/** This person's chats, most recently used first. */
export async function listConversations(connectionString: string, userId: string, limit = 50): Promise<ChatSummary[]> {
  return withDb(connectionString, (db) =>
    db
      .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit),
  );
}

/**
 * One chat with its messages, oldest first, or null if it is not this
 * person's (or does not exist). Keeps the newest `limit` messages.
 */
export async function getConversation(
  connectionString: string,
  userId: string,
  conversationId: string,
  limit = 200,
): Promise<{ id: string; title: string; messages: ChatMessage[] } | null> {
  if (!Id.safeParse(conversationId).success) return null;
  return withDb(connectionString, async (db) => {
    const [chat] = await db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
    if (!chat) return null;
    const rows = await db
      .select({
        id: messages.id,
        role: messages.role,
        kind: messages.kind,
        text: messages.text,
        sourceIds: messages.sourceIds,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId)))
      // Newest first to keep the newest `limit`, then reversed. On a tie the
      // question ("person") must come out before the reply ("debo").
      .orderBy(desc(messages.createdAt), asc(messages.role))
      .limit(limit);
    return { ...chat, messages: rows.reverse() };
  });
}

/**
 * Save one question and Debo's reply, in one transaction and one connection.
 * Creates the chat on its first exchange. Returns false, and saves nothing,
 * if a chat with this id belongs to someone else.
 */
export async function saveExchange(
  connectionString: string,
  userId: string,
  input: { conversationId: string; question: string; reply: ChatReply },
): Promise<boolean> {
  if (!Id.safeParse(input.conversationId).success) return false;
  return withDb(connectionString, (db) =>
    db.transaction(async (tx) => {
      await tx
        .insert(conversations)
        .values({ id: input.conversationId, userId, title: chatTitleFrom(input.question) })
        .onConflictDoNothing({ target: conversations.id });
      const touched = await tx
        .update(conversations)
        .set({ updatedAt: sql`now()` })
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, userId)))
        .returning({ id: conversations.id });
      if (touched.length === 0) return false;
      // The question takes the transaction's start time and the reply the
      // current clock, so the reply always sorts after its question.
      await tx.insert(messages).values([
        {
          userId,
          conversationId: input.conversationId,
          role: "person",
          kind: "question",
          text: input.question,
          createdAt: sql`now()`,
        },
        {
          userId,
          conversationId: input.conversationId,
          role: "debo",
          kind: input.reply.kind,
          text: input.reply.text,
          sourceIds: input.reply.sourceIds,
          createdAt: sql`clock_timestamp()`,
        },
      ]);
      return true;
    }),
  );
}

/** Delete one chat and all its messages, for good. Returns false if it is not this person's. */
export async function deleteConversation(
  connectionString: string,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  if (!Id.safeParse(conversationId).success) return false;
  return withDb(connectionString, async (db) => {
    const deleted = await db
      .delete(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .returning({ id: conversations.id });
    return deleted.length > 0;
  });
}

export type ExportChat = { id: string; title: string; createdAt: Date; messages: ChatMessage[] };

/** Every chat this person has, with every message, oldest first. For "Download everything". */
export async function exportChats(connectionString: string, userId: string): Promise<ExportChat[]> {
  return withDb(connectionString, async (db) => {
    const chats = await db
      .select({ id: conversations.id, title: conversations.title, createdAt: conversations.createdAt })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(asc(conversations.createdAt));
    const rows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        kind: messages.kind,
        text: messages.text,
        sourceIds: messages.sourceIds,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(asc(messages.createdAt), desc(messages.role));
    const byChat = new Map<string, ChatMessage[]>(chats.map((c) => [c.id, []]));
    for (const { conversationId, ...message } of rows) byChat.get(conversationId)?.push(message);
    return chats.map((chat) => ({ ...chat, messages: byChat.get(chat.id) ?? [] }));
  });
}
