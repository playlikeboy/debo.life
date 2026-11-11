"use client";

import { CopilotKitProvider, useAgent, useCopilotKit, type AbstractAgent } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import { ChatComposer, type ComposerHandle } from "@/components/chat-composer";
import { ChatHistory } from "@/components/chat-history";
import { ChatTurn } from "@/components/chat-turn";
import { Debo } from "@/components/debo";
import { AGENT_ID, NOTICE_TOOL, SOURCES_TOOL, type ChatListItem, type Chip, type ReplyKind, type Turn } from "@/lib/chat";

// The chat page, drawn by us on CopilotKit's headless hooks (useAgent,
// useCopilotKit) over AG-UI. CopilotKit runs the connection and the stream;
// this file decides how it looks and behaves for the person.

const STARTERS = [
  "What plans have I made?",
  "Who did I spend time with lately?",
  "What did I write about work?",
  "How have I been feeling?",
];

const CONNECTION_ERROR = "I couldn’t reach Debo just now. Check your internet connection, then try again.";

type Props = {
  chatId: string;
  isSaved: boolean;
  initialTurns: Turn[];
  initialChats: ChatListItem[];
  hasEntries: boolean;
  missingChat: boolean;
};

export function DeboChat(props: Props) {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" showDevConsole={false} enableInspector={false}>
      <ChatScreen {...props} />
    </CopilotKitProvider>
  );
}

function ChatScreen({ chatId, initialTurns, initialChats, hasEntries, missingChat }: Props) {
  const [chats, setChats] = useState(initialChats);
  const [active, setActive] = useState({ id: chatId, turns: initialTurns, missing: missingChat });
  const [announcement, setAnnouncement] = useState("");
  const composer = useRef<ComposerHandle>(null);

  const announce = useCallback((text: string) => {
    // Clear first, so the same words twice are still read out.
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(text));
  }, []);

  const startNewChat = useCallback(() => {
    setActive({ id: crypto.randomUUID(), turns: [], missing: false });
    window.history.replaceState(null, "", "/home/chat");
    announce("New chat started.");
    requestAnimationFrame(() => composer.current?.focus());
  }, [announce]);

  /** The server saved an exchange: put this chat at the top of the list and in the address bar. */
  const onSaved = useCallback((id: string, question: string) => {
    setChats((list) => {
      const existing = list.find((c) => c.id === id);
      const title = existing?.title ?? titleFrom(question);
      return [{ id, title, updatedAt: new Date().toISOString() }, ...list.filter((c) => c.id !== id)];
    });
    window.history.replaceState(null, "", `/home/chat?c=${id}`);
  }, []);

  const onDeleted = useCallback(
    (id: string, message: string, ok: boolean) => {
      if (ok || message === "That chat was already gone.") setChats((list) => list.filter((c) => c.id !== id));
      announce(message);
      if (ok && id === active.id) {
        startNewChat();
      } else {
        document.getElementById("past-chats-heading")?.focus();
      }
    },
    [active.id, announce, startNewChat],
  );

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-12">
      <div className="min-w-0 lg:order-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.375rem]">{active.turns.length > 0 || chats.some((c) => c.id === active.id) ? "This chat" : "New chat"}</h2>
          <button type="button" className="btn btn-quiet" onClick={startNewChat}>
            Start a new chat
          </button>
        </div>
        <ChatThread
          key={active.id}
          chatId={active.id}
          initialTurns={active.turns}
          hasEntries={hasEntries}
          missingChat={active.missing}
          onSaved={onSaved}
          announce={announce}
          composer={composer}
        />
      </div>
      <aside className="lg:order-1">
        <ChatHistory chats={chats} activeId={active.id} onDeleted={onDeleted} />
      </aside>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function ChatThread({
  chatId,
  initialTurns,
  hasEntries,
  missingChat,
  onSaved,
  announce,
  composer,
}: {
  chatId: string;
  initialTurns: Turn[];
  hasEntries: boolean;
  missingChat: boolean;
  onSaved: (id: string, question: string) => void;
  announce: (text: string) => void;
  composer: RefObject<ComposerHandle | null>;
}) {
  // A private agent for this chat, so its AG-UI thread id is the chat id.
  const { agent, isReady } = useAgent({ agentId: `debo-chat-${chatId}`, runtimeAgentId: AGENT_ID, threadId: chatId });
  const { copilotkit } = useCopilotKit();
  const [stopped, setStopped] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  // The question being answered, from Send until the run settles. Covers the
  // moment before CopilotKit marks the agent as running.
  const [inFlight, setInFlight] = useState<string | null>(null);
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;
  // Keep the newest words in view, unless the person has scrolled up to read.
  const stick = useRef(true);
  // The thread and its question box. On a phone, "Your chats" comes after it,
  // so "the newest words" means the end of this, not the end of the page.
  const thread = useRef<HTMLDivElement>(null);

  const running = agent.isRunning || inFlight !== null;
  const live = turnsFromMessages(agent.messages).map((turn, i, all) =>
    withOverrides(turn, { stopped, failed, settled: !running || i < all.length - 1 }),
  );
  const turns = [...initialTurns, ...live];
  const last = turns.at(-1);

  const ask = useCallback(
    (question: string): boolean => {
      if (agent.isRunning || inFlight !== null || !isReady) return false;
      const id = crypto.randomUUID();
      setInFlight(id);
      agent.addMessage({ id, role: "user", content: question });
      stick.current = true;
      announce("Debo is looking through your entries.");
      requestAnimationFrame(() => composer.current?.focus());
      void (async () => {
        let ok = true;
        try {
          await copilotkit.runAgent({ agent });
        } catch {
          ok = false;
          if (!stoppedRef.current.has(id)) setFailed((s) => new Set(s).add(id));
        }
        setInFlight(null);
        const turn = turnsFromMessages(agent.messages).find((t) => t.id === id);
        if (stoppedRef.current.has(id)) {
          announce("You stopped the answer.");
        } else if (!ok || !turn?.reply) {
          announce(CONNECTION_ERROR);
        } else {
          announce(spoken(turn.reply.kind, turn.reply.text, turn.reply.sources.length));
        }
        // The server saves every exchange it answered, even a stopped one.
        if (ok && turn?.reply && turn.reply.kind !== "invalid") onSaved(chatId, question);
      })();
      return true;
    },
    [agent, inFlight, isReady, copilotkit, announce, composer, onSaved, chatId],
  );

  const stop = useCallback(() => {
    const lastLive = turnsFromMessages(agent.messages).at(-1);
    if (lastLive) setStopped((s) => new Set(s).add(lastLive.id));
    copilotkit.stopAgent({ agent });
    requestAnimationFrame(() => composer.current?.focus());
  }, [agent, copilotkit, composer]);

  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      stick.current = nearThreadEnd(thread.current);
      if (stick.current) setShowJump(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const contentSize = turns.length * 100_000 + (last?.reply?.text.length ?? 0);
  useLayoutEffect(() => {
    if (turns.length === 0) return;
    if (stick.current) window.scrollTo({ top: threadEndTop(thread.current) });
    else setShowJump(true);
    // Runs only when the content grows (a new turn or more words), not on every render.
  }, [contentSize, turns.length]);

  function jumpToNewest() {
    stick.current = true;
    setShowJump(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: threadEndTop(thread.current), behavior: reduce ? "auto" : "smooth" });
    composer.current?.focus();
  }

  return (
    <div ref={thread} className="mt-4">
      {missingChat && (
        <p className="mb-4 rounded-[12px] border border-line bg-paper p-4">
          That chat isn&rsquo;t here any more. It may have been deleted. You can start again below.
        </p>
      )}

      {turns.length === 0 ? (
        <EmptyState hasEntries={hasEntries} ready={isReady} onAsk={ask} />
      ) : (
        <ol className="grid gap-8 pb-6" aria-label="Your chat with Debo">
          {turns.map((turn) => (
            <ChatTurn
              key={turn.id}
              turn={turn}
              pending={running && turn === last}
              onRetry={(q) => ask(q)}
              onCopied={(ok) => announce(ok ? "Answer copied." : "I couldn’t copy that. Select the text and copy it yourself.")}
            />
          ))}
        </ol>
      )}

      {showJump && (
        <div className="sticky bottom-40 z-10 flex justify-center">
          <button type="button" className="btn btn-quiet" onClick={jumpToNewest}>
            Jump to the newest message
          </button>
        </div>
      )}

      <ChatComposer ref={composer} running={running} ready={isReady} onSend={ask} onStop={stop} />
    </div>
  );
}

function EmptyState({ hasEntries, ready, onAsk }: { hasEntries: boolean; ready: boolean; onAsk: (q: string) => boolean }) {
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

// --- Turning AG-UI messages into turns -------------------------------------

type AgentMessage = AbstractAgent["messages"][number];

const SourcesArgs = z.object({ sources: z.array(z.object({ id: z.string(), label: z.string() })) });
const NoticeArgs = z.object({ kind: z.enum(["unknown", "limit", "error", "invalid"]) });

/** Group the agent's messages into turns: each person's question, then everything Debo sent after it. */
function turnsFromMessages(messages: AgentMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({ id: message.id, question: textOf(message.content), reply: null });
      continue;
    }
    if (message.role !== "assistant") continue;
    const turn = turns.at(-1);
    if (!turn) continue;
    const reply = turn.reply ?? { kind: "answer" as ReplyKind, text: "", sources: [] as Chip[], missingSources: 0 };
    for (const call of message.toolCalls ?? []) {
      const args = parseJson(call.function.arguments);
      if (call.function.name === SOURCES_TOOL) {
        const parsed = SourcesArgs.safeParse(args);
        if (parsed.success) reply.sources = parsed.data.sources;
      } else if (call.function.name === NOTICE_TOOL) {
        const parsed = NoticeArgs.safeParse(args);
        if (parsed.success) reply.kind = parsed.data.kind;
      }
    }
    reply.text += textOf(message.content);
    turn.reply = reply;
  }
  return turns;
}

/** Apply what only the browser knows: the person pressed Stop, or the connection failed. */
function withOverrides(
  turn: Turn,
  state: { stopped: ReadonlySet<string>; failed: ReadonlySet<string>; settled: boolean },
): Turn {
  const reply = turn.reply;
  if (state.stopped.has(turn.id)) {
    if (reply?.kind === "answer") return { ...turn, reply: { ...reply, kind: "stopped" } };
    if (!reply?.text) return { ...turn, reply: { kind: "stopped", text: "", sources: [], missingSources: 0 } };
    return turn;
  }
  if (state.failed.has(turn.id) || (state.settled && !reply?.text)) {
    return { ...turn, reply: { kind: "error", text: CONNECTION_ERROR, sources: [], missingSources: 0 } };
  }
  return turn;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "",
      )
      .join(" ");
  }
  return "";
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** What the screen reader says when a reply is finished. */
function spoken(kind: ReplyKind, text: string, sources: number): string {
  if (kind !== "answer") return text;
  const from = sources === 1 ? "It came from 1 entry." : `It came from ${sources} entries.`;
  return `Debo answered: ${text} ${from}`;
}

function titleFrom(question: string): string {
  const line = question.split("\n").find((l) => l.trim())?.trim() ?? "Chat with Debo";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

/** The scroll position that puts the end of the thread (the question box) at the bottom of the screen. */
function threadEndTop(thread: HTMLElement | null): number {
  if (!thread) return document.documentElement.scrollHeight;
  return thread.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
}

function nearThreadEnd(thread: HTMLElement | null): boolean {
  return window.scrollY >= threadEndTop(thread) - 96;
}
