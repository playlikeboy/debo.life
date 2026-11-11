"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { askDebo, editEntry, removeEntry, type AskState } from "@/app/home/actions";
import { entryHref } from "@/lib/links";

const box = "mt-2 block w-full rounded-[12px] border-2 border-ink bg-paper px-3 py-2";

/** Ask a question; answer only from the person's entries, with source chips. */
export function AskBox() {
  const [state, action, pending] = useActionState<AskState, FormData>(askDebo, {
    status: "idle",
    question: "",
    answer: "",
    sources: [],
  });

  return (
    <section aria-labelledby="ask-heading">
      <form action={action}>
        <label id="ask-heading" htmlFor="question" className="text-[1.375rem] font-display font-bold">
          Ask Debo about your entries
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="question"
            name="question"
            required
            minLength={3}
            maxLength={500}
            defaultValue={state.question}
            placeholder="When did I last see Riya?"
            className={`${box} mt-0 min-h-12 flex-1`}
          />
          <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
            {pending ? "Looking…" : "Ask Debo"}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-4">
        {state.status === "answered" && (
          <div className="rounded-[24px] border-2 border-ink bg-paper p-6" style={{ boxShadow: "var(--shadow-hard)" }}>
            <p className="text-[1.125rem] font-semibold">{state.answer}</p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Where this answer came from">
              {state.sources.map((source) => (
                <li key={source.id}>
                  <a href={entryHref(source.id)} className="chip no-underline">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.status === "unknown" && (
          <p className="rounded-[24px] border-2 border-ink bg-paper p-6 font-semibold">
            I don&rsquo;t have anything about that yet.{" "}
            <a href="/home/journal" className="underline underline-offset-4">
              Write an entry about it
            </a>
            , then ask again.
          </p>
        )}
        {(state.status === "error" || state.status === "limit") && (
          <p className="font-semibold">{state.answer}</p>
        )}
      </div>
    </section>
  );
}

/** "Delete this entry", with a short confirm step. */
export function DeleteEntryButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-quiet">
        Delete this entry
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-semibold">Delete for good?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeEntry(id);
            setMessage(result.message);
            if (result.ok) {
              // This entry is about to vanish, so say so where it stays heard.
              announce(result.message);
              document.getElementById("entries-heading")?.focus();
            }
            router.refresh();
          })
        }
        className="btn btn-quiet"
      >
        Yes, delete it
      </button>
      <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="btn btn-quiet">
        Keep it
      </button>
      <span role="status" className="font-semibold">
        {message}
      </span>
    </div>
  );
}

/** One entry: read it, edit it, or delete it. Its anchor is what source chips link to. */
export function EntryItem({
  id,
  text,
  dayLabel,
  isoDate,
}: {
  id: string;
  text: string;
  /** "Tuesday 11 November 2026" */
  dayLabel: string;
  isoDate: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    if (pending) return;
    startTransition(async () => {
      const result = await editEntry(id, draft);
      setMessage(result.message);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <li
      id={`entry-${id}`}
      tabIndex={-1}
      className="group scroll-mt-6 rounded-[24px] border border-line bg-paper p-6 target:border-[3px] target:border-ink"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={`entry-date-${id}`} className="font-semibold text-ink-soft">
          <time dateTime={isoDate}>{dayLabel}</time>
        </h4>
        <p className="chip hidden group-target:inline-flex">The entry you opened</p>
      </div>
      {editing ? (
        <div className="mt-3">
          <label htmlFor={`edit-${id}`} className="font-semibold">
            Edit this entry
          </label>
          <textarea
            id={`edit-${id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                save();
              }
            }}
            rows={8}
            maxLength={20_000}
            autoFocus
            aria-describedby={`edit-keys-${id}`}
            className={`${box} min-h-48 text-[1.125rem]`}
          />
          <p id={`edit-keys-${id}`} className="mt-2 text-ink-soft">
            Press Ctrl + Enter (Cmd + Enter on a Mac) to save, or Escape to stop editing.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={save} disabled={pending} className="btn btn-quiet">
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(text);
                setEditing(false);
              }}
              disabled={pending}
              className="btn btn-quiet"
            >
              Keep as it was
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-[1.125rem]">{text}</p>
      )}
      {!editing && (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => {
              setDraft(text);
              setMessage("");
              setEditing(true);
            }}
            className="btn btn-quiet"
          >
            Edit this entry
          </button>
          <DeleteEntryButton id={id} />
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-2 font-semibold">
        {message}
      </p>
    </li>
  );
}

const STATUS_EVENT = "debo:journal-status";

/** Say something in the journal's page-level status line. */
function announce(message: string) {
  window.dispatchEvent(new CustomEvent<string>(STATUS_EVENT, { detail: message }));
}

/** A status line that outlives single entries, so "Entry deleted." is still heard after the entry is gone. */
export function JournalStatus() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const listener = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener(STATUS_EVENT, listener);
    return () => window.removeEventListener(STATUS_EVENT, listener);
  }, []);
  return (
    <p role="status" aria-live="polite" className="mt-4 min-h-6 font-semibold">
      {message}
    </p>
  );
}

/**
 * When the page opens at /home/journal#entry-<id> (from a source chip), move
 * keyboard and screen reader focus to that entry. The CSS :target style
 * draws the thick border and the "The entry you opened" label.
 */
export function EntryTargetFocus() {
  useEffect(() => {
    function focusTarget() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("entry-")) return;
      const element = document.getElementById(id);
      if (!element) return;
      element.focus({ preventScroll: true });
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    }
    focusTarget();
    window.addEventListener("hashchange", focusTarget);
    return () => window.removeEventListener("hashchange", focusTarget);
  }, []);
  return null;
}
