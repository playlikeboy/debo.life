"use client";

import type { ReactNode } from "react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatHistory } from "@/components/chat-history";
import { ChatTurn } from "@/components/chat-turn";
import { Debo } from "@/components/debo";
import type { ChatListItem, Turn } from "@/lib/chat";

// The chat page's layout and its first paint. Nothing here imports
// CopilotKit, so the server can draw the page without loading it.
// debo-chat.tsx uses the same layout once CopilotKit has loaded in the browser.

const STARTERS = [
  "What plans have I made?",
  "Who did I spend time with lately?",
  "What did I write about work?",
  "How have I been feeling?",
];

export type ChatProps = {
  chatId: string;
  isSaved: boolean;
  initialTurns: Turn[];
  initialChats: ChatListItem[];
  hasEntries: boolean;
  missingChat: boolean;
};

/** The thread beside the list of past chats (above it on phones). */
export function ChatLayout({
  title,
  newChat,
  thread,
  history,
  announcement,
}: {
  title: string;
  newChat: ReactNode;
  thread: ReactNode;
  history: ReactNode;
  announcement: string;
}) {
  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-12">
      <div className="min-w-0 lg:order-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.375rem]">{title}</h2>
          {newChat}
        </div>
        {thread}
      </div>
      <aside className="lg:order-1">{history}</aside>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

export function chatTitle(turns: Turn[], chats: ChatListItem[], chatId: string) {
  return turns.length > 0 || chats.some((c) => c.id === chatId) ? "This chat" : "New chat";
}

export function MissingChatNote() {
  return (
    <p className="mb-4 rounded-[12px] border border-line bg-paper p-4">
      That chat isn&rsquo;t here any more. It may have been deleted. You can start again below.
    </p>
  );
}

export function EmptyState({ hasEntries, ready, onAsk }: { hasEntries: boolean; ready: boolean; onAsk: (q: string) => boolean }) {
  return (
    <div className="grid gap-6 py-6 sm:grid-cols-[6rem_1fr] sm:items-start">
      <Debo className="w-20 sm:w-24" />
      {hasEntries ? (
        <div>
          <p className="text-[1.125rem] font-semibold">What would you like to remember?</p>
          <p className="mt-2 text-ink-soft">Ask in your own words, or try one of these.</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Questions to try">
            {STARTERS.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  className="btn btn-quiet min-h-11 px-4 py-1 text-left font-normal"
                  disabled={!ready}
                  onClick={() => onAsk(question)}
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <p className="text-[1.125rem] font-semibold">Debo answers from your journal, and it&rsquo;s empty so far.</p>
          <p className="mt-2 text-ink-soft">Write a few entries about your days, then come back and ask about them.</p>
          <a href="/home/journal" className="btn btn-primary mt-4">
            Write your first entry
          </a>
        </div>
      )}
    </div>
  );
}

const never = () => false;
const nothing = () => {};

/**
 * What the page shows until CopilotKit has loaded in the browser: the same
 * layout, the saved chat and the list of chats, with the question box saying
 * "Getting Debo ready…". "Start a new chat" is a plain link, so it works
 * even now.
 */
export function ChatShell({ chatId, initialTurns, initialChats, hasEntries, missingChat }: ChatProps) {
  return (
    <ChatLayout
      title={chatTitle(initialTurns, initialChats, chatId)}
      newChat={
        <a href="/home/chat" className="btn btn-quiet">
          Start a new chat
        </a>
      }
      thread={
        <div className="mt-4">
          {missingChat && <MissingChatNote />}
          {initialTurns.length === 0 ? (
            <EmptyState hasEntries={hasEntries} ready={false} onAsk={never} />
          ) : (
            <ol className="grid gap-8 pb-6" aria-label="Your chat with Debo">
              {initialTurns.map((turn) => (
                <ChatTurn key={turn.id} turn={turn} pending={false} onRetry={nothing} onCopied={nothing} />
              ))}
            </ol>
          )}
          <ChatComposer running={false} ready={false} pinned={initialTurns.length > 0} onSend={never} onStop={nothing} />
        </div>
      }
      history={<ChatHistory chats={initialChats} activeId={chatId} onDeleted={nothing} />}
      announcement=""
    />
  );
}
