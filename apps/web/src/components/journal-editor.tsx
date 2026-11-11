"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveEntry, type SaveState } from "@/app/home/actions";
import { readDraft, writeDraft } from "@/lib/journal-draft";

const PROMPTS = [
  "What happened today?",
  "Who did you see, and what did you talk about?",
  "What is on your mind right now?",
  "What do you want to remember about this week?",
];

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * The writing area on the journal page. The unsaved draft is kept in this
 * browser only, so a closed tab or a lost connection does not lose words.
 * Ctrl+Enter (or Cmd+Enter on a Mac) saves.
 */
export function JournalEditor({ userId }: { userId: string }) {
  const [state, setState] = useState<SaveState>({ ok: false, message: "" });
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [restored, setRestored] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mac, setMac] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Bring back an unsaved draft from last time, once, after the page loads.
  useEffect(() => {
    const draft = readDraft(userId);
    if (draft) {
      setText(draft);
      setRestored(true);
    }
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, [userId]);

  // Keep the draft in this browser a moment after the person stops typing.
  useEffect(() => {
    const timer = window.setTimeout(() => writeDraft(userId, text), 400);
    return () => window.clearTimeout(timer);
  }, [userId, text]);

  // Save by hand rather than as a form action, so a failed save never
  // empties the box (React resets forms after a form action).
  function save() {
    if (pending) return;
    if (!text.trim()) {
      setState({ ok: false, message: "Write something first." });
      return;
    }
    const form = new FormData();
    form.set("text", text);
    startTransition(async () => {
      const result = await saveEntry(state, form);
      setState(result);
      if (!result.ok) return;
      // Empty the box, drop the draft, and fetch the fresh list.
      // revalidatePath alone does not re-render on Cloudflare (OpenNext).
      setText("");
      setRestored(false);
      setPrompt("");
      writeDraft(userId, "");
      router.refresh();
    });
  }

  const words = countWords(text);
  const shortcut = mac ? "Cmd + Enter" : "Ctrl + Enter";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="rounded-[24px] border-2 border-ink bg-paper p-6">
      <label htmlFor="entry-text" className="font-display text-[1.375rem] font-bold">
        Write an entry
      </label>
      <p id="entry-hint" className="mt-1 text-ink-soft">
        A line or a page. Debo keeps it and can answer questions about it later. Until you save, your draft stays
        only in this browser.
      </p>
      {prompt && (
        <p id="entry-prompt" className="mt-3 font-semibold">
          Try this: {prompt}
        </p>
      )}
      <textarea
        ref={boxRef}
        id="entry-text"
        name="text"
        rows={8}
        required
        maxLength={20_000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
          }
        }}
        aria-describedby={prompt ? "entry-hint entry-prompt entry-keys" : "entry-hint entry-keys"}
        className="mt-3 block min-h-48 w-full rounded-[12px] border-2 border-ink bg-paper px-3 py-2 text-[1.125rem]"
      />
      <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-ink-soft">
        <span>{words === 1 ? "1 word" : `${words} words`}</span>
        <span id="entry-keys">Press {shortcut} to save.</span>
      </p>

      {!text.trim() && (
        <div className="mt-4">
          <p id="prompts-heading" className="font-semibold">
            Not sure what to write? Pick a question to start.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="prompts-heading">
            {PROMPTS.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  aria-pressed={prompt === p}
                  onClick={() => {
                    setPrompt(p);
                    boxRef.current?.focus();
                  }}
                  className="min-h-11 rounded-[12px] border-2 border-ink bg-paper px-3 py-1 text-left hover:bg-sky aria-pressed:bg-sky"
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save entry"}
        </button>
        {text.trim() && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setText("");
              setRestored(false);
              writeDraft(userId, "");
              boxRef.current?.focus();
            }}
            className="btn btn-quiet"
          >
            Clear this draft
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-6 font-semibold">
        {state.message || (restored ? "I kept your unsaved draft from last time. It is here for you." : "")}
      </p>
    </form>
  );
}
