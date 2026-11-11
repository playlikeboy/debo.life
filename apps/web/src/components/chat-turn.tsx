"use client";

import { useEffect, useState } from "react";
import type { Reply, Turn } from "@/lib/chat";
import { entryHref } from "@/lib/links";

/**
 * One question and Debo's reply. While Debo works, `pending` shows a calm
 * "looking" line until the first words arrive. An answer always ends with
 * its source chips; anything else says what to do next.
 */
export function ChatTurn({
  turn,
  pending,
  onRetry,
  onCopied,
}: {
  turn: Turn;
  pending: boolean;
  onRetry: (question: string) => void;
  onCopied: (ok: boolean) => void;
}) {
  const reply = turn.reply;
  return (
    <li className="grid gap-3">
      <div className="ml-auto max-w-[85%] rounded-[24px] rounded-br-[12px] border border-line bg-paper px-4 py-3">
        <p className="sr-only">You asked:</p>
        <p className="whitespace-pre-wrap wrap-anywhere">{turn.question}</p>
      </div>

      <div className="max-w-[40rem]">
        <p className="mb-1 font-semibold text-ink-soft" aria-hidden="true">
          Debo
        </p>
        {!reply?.text && pending ? (
          <Looking />
        ) : reply ? (
          <ReplyView reply={reply} pending={pending} question={turn.question} onRetry={onRetry} onCopied={onCopied} />
        ) : null}
      </div>
    </li>
  );
}

function Looking() {
  return (
    <p className="flex items-center gap-3 text-ink-soft">
      <span className="flex gap-1" aria-hidden="true">
        <span className="size-2 rounded-full bg-ink-soft motion-safe:animate-pulse" />
        <span className="size-2 rounded-full bg-ink-soft motion-safe:animate-pulse [animation-delay:200ms]" />
        <span className="size-2 rounded-full bg-ink-soft motion-safe:animate-pulse [animation-delay:400ms]" />
      </span>
      Looking through your entries&hellip;
    </p>
  );
}

function ReplyView({
  reply,
  pending,
  question,
  onRetry,
  onCopied,
}: {
  reply: Reply;
  pending: boolean;
  question: string;
  onRetry: (question: string) => void;
  onCopied: (ok: boolean) => void;
}) {
  const isAnswer = (reply.kind === "answer" || reply.kind === "stopped") && reply.text.length > 0;

  if (isAnswer) {
    return (
      <div className="rounded-[24px] border-2 border-ink bg-paper p-5" style={{ boxShadow: "var(--shadow-hard)" }}>
        <p className="sr-only">Debo said:</p>
        <p className="whitespace-pre-wrap wrap-anywhere">{reply.text}</p>
        {reply.kind === "stopped" && <p className="mt-3 text-ink-soft">You stopped this answer here.</p>}
        {reply.sources.length > 0 && (
          <div className="mt-4">
            <p className="text-ink-soft">From your entries:</p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Where this answer came from">
              {reply.sources.map((source) => (
                <li key={source.id}>
                  <a href={entryHref(source.id)} className="chip min-h-11 no-underline hover:underline">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {reply.missingSources > 0 && (
          <p className="mt-3 text-ink-soft">
            {reply.missingSources === 1
              ? "1 entry this answer came from has since been deleted."
              : `${reply.missingSources} entries this answer came from have since been deleted.`}
          </p>
        )}
        {!pending && <CopyButton text={reply.text} onCopied={onCopied} />}
      </div>
    );
  }

  if (reply.kind === "stopped") {
    return <p className="text-ink-soft">You stopped this before Debo answered.</p>;
  }

  return (
    <div className="rounded-[24px] border border-line bg-paper p-5">
      <p className="whitespace-pre-wrap wrap-anywhere">{reply.text}</p>
      {reply.kind === "unknown" && (
        <p className="mt-3">
          <a href="/home/journal" className="font-semibold underline underline-offset-4">
            Write an entry about it
          </a>
        </p>
      )}
      {reply.kind === "limit" && <LimitTime />}
      {reply.kind === "error" && !pending && (
        <button type="button" className="btn btn-quiet mt-4" onClick={() => onRetry(question)}>
          Try again
        </button>
      )}
    </div>
  );
}

/** The daily limit resets at midnight UTC. Say when that is in the person's own time. */
function LimitTime() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const now = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    setTime(reset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  }, []);
  if (!time) return null;
  return <p className="mt-3 text-ink-soft">For you, that is at {time}.</p>;
}

function CopyButton({ text, onCopied }: { text: string; onCopied: (ok: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied(true);
    } catch {
      // The browser can block the clipboard. The text stays selectable.
      onCopied(false);
    }
  }

  return (
    <button type="button" className="btn btn-quiet mt-4 min-h-11 px-4 py-1" onClick={copy}>
      {copied ? "Copied" : "Copy answer"}
    </button>
  );
}
