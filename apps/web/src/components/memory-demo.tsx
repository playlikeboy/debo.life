"use client";

import { useEffect, useRef, useState } from "react";

type Memory = { id: string; text: string; source: string; fixed?: boolean };

// Made-up examples. Never put real personal data here.
const EXAMPLES: Memory[] = [
  { id: "m1", text: "Riya moved to Pune in March.", source: "Journal, 14 March" },
  { id: "m2", text: "Your passport runs out in August next year.", source: "Photo of passport, 2 Jan" },
  { id: "m3", text: "You promised Dadi you would call every Sunday.", source: "Voice note, 9 Feb" },
];

/**
 * A small working demo of the "What Debo knows" page:
 * each memory shows its source and can be fixed or forgotten.
 */
export function MemoryDemo() {
  const [memories, setMemories] = useState(EXAMPLES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  // After closing the editor, send focus back to that memory's "Fix this" button.
  const [returnFocusTo, setReturnFocusTo] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!returnFocusTo) return;
    listRef.current?.querySelector<HTMLButtonElement>(`[data-fix="${returnFocusTo}"]`)?.focus();
    setReturnFocusTo(null);
  }, [returnFocusTo]);

  const startFix = (memory: Memory) => {
    setEditingId(memory.id);
    setDraft(memory.text);
    setMessage("");
  };

  const closeEditor = (id: string) => {
    setEditingId(null);
    setReturnFocusTo(id);
  };

  const saveFix = (id: string) => {
    const text = draft.trim();
    if (!text) {
      setMessage("A memory can't be empty. Write the right version, or choose Keep as it was.");
      return;
    }
    setMemories((list) => list.map((m) => (m.id === id ? { ...m, text, fixed: true } : m)));
    setMessage("Memory fixed.");
    closeEditor(id);
  };

  const forget = (id: string) => {
    setMemories((list) => list.filter((m) => m.id !== id));
    setEditingId(null);
    setMessage("Memory forgotten.");
  };

  const reset = () => {
    setMemories(EXAMPLES);
    setEditingId(null);
    setMessage("Examples put back.");
  };

  const changed = memories.length < EXAMPLES.length || memories.some((m) => m.fixed);

  return (
    <div className="rounded-[24px] border-2 border-ink bg-paper p-5 md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.375rem]">What Debo knows</h3>
        <p className="text-ink-soft">Made-up memories. Try it.</p>
      </div>

      <ul ref={listRef} className="mt-5 divide-y divide-line border-y border-line">
        {memories.map((memory) =>
          editingId === memory.id ? (
            <li key={memory.id} className="py-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveFix(memory.id);
                }}
              >
                <label htmlFor={`fix-${memory.id}`} className="font-semibold">
                  Fix this memory
                </label>
                <input
                  id={`fix-${memory.id}`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeEditor(memory.id);
                  }}
                  autoFocus
                  className="mt-2 block min-h-12 w-full rounded-[12px] border-2 border-ink bg-paper px-3 py-2"
                />
                <p className="mt-2">
                  <span className="chip">{memory.source}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="submit" className="btn btn-quiet">
                    Save fix
                  </button>
                  <button type="button" onClick={() => closeEditor(memory.id)} className="btn btn-quiet">
                    Keep as it was
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li
              key={memory.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">{memory.text}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="chip">{memory.source}</span>
                  {memory.fixed && <span className="text-ink-soft">Fixed by you</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  data-fix={memory.id}
                  onClick={() => startFix(memory)}
                  className="btn btn-quiet"
                  aria-label={`Fix this memory: ${memory.text}`}
                >
                  Fix this
                </button>
                <button
                  type="button"
                  onClick={() => forget(memory.id)}
                  className="btn btn-quiet"
                  aria-label={`Forget this memory: ${memory.text}`}
                >
                  Forget this
                </button>
              </div>
            </li>
          ),
        )}
        {memories.length === 0 && (
          <li className="py-6">
            <p className="font-semibold">Debo knows nothing now.</p>
            <p className="text-ink-soft">That is how forgetting will work: gone means gone.</p>
          </li>
        )}
      </ul>

      <div className="mt-4 flex min-h-12 flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="font-semibold">
          {message}
        </p>
        {changed && (
          <button type="button" onClick={reset} className="btn btn-quiet">
            Put the examples back
          </button>
        )}
      </div>
    </div>
  );
}
