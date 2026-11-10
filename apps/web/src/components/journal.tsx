"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { askDebo, editEntry, removeEntry, saveEntry, type AskState, type SaveState } from "@/app/home/actions";

const box = "mt-2 block w-full rounded-[12px] border-2 border-ink bg-paper px-3 py-2";

/** Write a journal entry. */
export function EntryForm() {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveEntry, { ok: false, message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Ask the server for the fresh list. revalidatePath alone does not
  // re-render this page on Cloudflare (OpenNext), so refresh explicitly.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    router.refresh();
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="rounded-[24px] border-2 border-ink bg-paper p-6">
      <label htmlFor="entry-text" className="text-[1.375rem] font-display font-bold">
        Write an entry
      </label>
      <p id="entry-hint" className="mt-1 text-ink-soft">
        A line or a page. Debo keeps it and can answer questions about it later.
      </p>
      <textarea id="entry-text" name="text" rows={5} required aria-describedby="entry-hint" className={`${box} min-h-32`} />
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-quiet">
          {pending ? "Saving…" : "Save entry"}
        </button>
        <p role="status" aria-live="polite" className="font-semibold">
          {state.message}
        </p>
      </div>
    </form>
  );
}

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
                  <a href={`#entry-${source.id}`} className="chip no-underline">
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.status === "unknown" && (
          <p className="rounded-[24px] border-2 border-ink bg-paper p-6 font-semibold">
            I don&rsquo;t have anything about that yet. Write an entry about it, then ask again.
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

/** One entry: read it, edit it, or delete it. */
export function EntryItem({ id, text, dateLabel }: { id: string; text: string; dateLabel: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
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
      className="scroll-mt-6 rounded-[24px] border border-line bg-paper p-6 target:border-2 target:border-ink"
    >
      <p className="chip">Journal, {dateLabel}</p>
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
            }}
            rows={5}
            autoFocus
            className={`${box} min-h-32`}
          />
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
        <p className="mt-3 whitespace-pre-wrap">{text}</p>
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
