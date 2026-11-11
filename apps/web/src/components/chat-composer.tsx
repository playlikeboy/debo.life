"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { MAX_QUESTION } from "@/lib/chat";

export type ComposerHandle = { focus: () => void };

/**
 * The question box. Enter sends, Shift and Enter makes a new line. While
 * Debo answers, the send button becomes "Stop answering". The box grows
 * with the text up to about five lines.
 */
export const ChatComposer = forwardRef<
  ComposerHandle,
  { running: boolean; ready: boolean; onSend: (question: string) => boolean; onStop: () => void }
>(function ChatComposer({ running, ready, onSend, onStop }, ref) {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => box.current?.focus() }), []);

  // Grow with the text. CSS caps the height; past it, the box scrolls.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [value]);

  const left = MAX_QUESTION - value.length;

  function send() {
    const question = value.trim();
    if (running || !ready) return;
    if (question.length < 3) {
      setHint("Write a question of a few words first.");
      return;
    }
    if (question.length > MAX_QUESTION) {
      setHint(`Keep your question under ${MAX_QUESTION} characters.`);
      return;
    }
    if (onSend(question)) {
      setValue("");
      setHint("");
    }
  }

  return (
    <form
      className="sticky bottom-0 z-10 -mx-5 border-t border-line bg-sky px-5 pb-4 pt-3 md:mx-0 md:px-0"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="chat-question" className="font-semibold">
        Your question
      </label>
      <div className="mt-2 flex items-end gap-2">
        <textarea
          id="chat-question"
          ref={box}
          rows={1}
          value={value}
          maxLength={MAX_QUESTION + 100}
          aria-describedby="chat-question-help"
          aria-invalid={hint ? true : undefined}
          placeholder="When did I last see Riya?"
          className="block max-h-40 min-h-12 w-full resize-none rounded-[12px] border-2 border-ink bg-paper px-3 py-2"
          onChange={(e) => {
            setValue(e.target.value);
            if (hint) setHint("");
          }}
          onKeyDown={(e) => {
            // Shift+Enter is a new line. Never send while an input method is composing a word.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        {running ? (
          <button type="button" className="btn btn-quiet shrink-0" onClick={onStop}>
            Stop answering
          </button>
        ) : (
          <button type="submit" className="btn btn-primary shrink-0" disabled={!ready} aria-disabled={!ready}>
            Ask Debo
          </button>
        )}
      </div>
      <p id="chat-question-help" className="mt-2 text-ink-soft">
        {hint ? (
          <span className="font-semibold text-ink">{hint}</span>
        ) : !ready ? (
          "Getting Debo ready…"
        ) : left < 50 ? (
          left >= 0 ? `${left} characters left.` : `${-left} characters too many.`
        ) : (
          <>
            <span className="hidden [@media(pointer:fine)]:inline">Press Enter to ask, or Shift and Enter for a new line. </span>
            Debo only reads your own entries.
          </>
        )}
      </p>
    </form>
  );
});
