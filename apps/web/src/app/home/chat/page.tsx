import { getConversation, getSources, listConversations, listEntries, type ChatMessage } from "@debo/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeboChat } from "@/components/debo-chat";
import { getAuth } from "@/lib/auth/server";
import type { ChatListItem, Chip, ReplyKind, Turn } from "@/lib/chat";
import { databaseUrl } from "@/lib/server-env";

export const metadata: Metadata = { title: "Chat with Debo", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Chat with Debo. `?c=<id>` opens a past chat; without it, a new chat starts. */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");
  const userId = session.user.id;
  const db = databaseUrl();

  const raw = (await searchParams).c;
  const wanted = Array.isArray(raw) ? raw[0] : raw;

  const [chats, entries, chat] = await Promise.all([
    listConversations(db, userId),
    listEntries(db, userId, 1),
    wanted ? getConversation(db, userId, wanted) : Promise.resolve(null),
  ]);

  const turns = chat ? await turnsFrom(db, userId, chat.messages) : [];
  const chatList: ChatListItem[] = chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
  // A new chat's id is made here, not in the browser, so the first render
  // on the server and in the browser agree.
  const chatId = chat?.id ?? crypto.randomUUID();

  return (
    <main className="wrap max-w-[72rem] pb-8 pt-10">
      <h1 className="h-section">Chat with Debo</h1>
      <p className="mt-4 max-w-[40rem] text-[1.125rem] text-ink-soft">
        Ask about your entries. Debo only answers from what you wrote, shows which entry each answer came from, and
        says so when it doesn&rsquo;t know.
      </p>
      <DeboChat
        key={chatId}
        chatId={chatId}
        isSaved={Boolean(chat)}
        initialTurns={turns}
        initialChats={chatList}
        hasEntries={entries.length > 0}
        missingChat={Boolean(wanted) && !chat}
      />
    </main>
  );
}

/** Pair each question with Debo's reply, with chip labels for entries that still exist. */
async function turnsFrom(db: string, userId: string, messages: ChatMessage[]): Promise<Turn[]> {
  const ids = [...new Set(messages.flatMap((m) => m.sourceIds))];
  const found = await getSources(db, userId, ids);
  const labels = new Map(found.map((s) => [s.id, `Journal, ${formatDay(s.happenedAt)}`]));

  const turns: Turn[] = [];
  for (const message of messages) {
    if (message.role === "person") {
      turns.push({ id: message.id, question: message.text, reply: null });
      continue;
    }
    const turn = turns.at(-1);
    if (!turn || turn.reply) continue;
    const sources: Chip[] = message.sourceIds.flatMap((id) => {
      const label = labels.get(id);
      return label ? [{ id, label }] : [];
    });
    turn.reply = {
      kind: message.kind as ReplyKind,
      text: message.text,
      sources,
      missingSources: message.sourceIds.length - sources.length,
    };
  }
  // A question saved without a reply cannot happen (they are saved together), but never show a spinner forever.
  return turns.map((t) => t.reply ? t : { ...t, reply: { kind: "error", text: "This answer was not saved.", sources: [], missingSources: 0 } });
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
