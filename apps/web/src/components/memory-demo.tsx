"use client";

import { useState } from "react";

type Memory = { id: string; text: string; source: string };

// Made-up examples. Never put real personal data here.
const EXAMPLES: Memory[] = [
  { id: "m1", text: "Riya moved to Pune in March.", source: "Journal, 14 March" },
  { id: "m2", text: "Your passport runs out in August next year.", source: "Photo of passport, 2 Jan" },
  { id: "m3", text: "You promised Dadi you would call every Sunday.", source: "Voice note, 9 Feb" },
];

/**
 * A small working demo of the "What Debo knows" page:
 * each memory shows its source and can be forgotten.
 */
export function MemoryDemo() {
  const [memories, setMemories] = useState(EXAMPLES);
  const [message, setMessage] = useState("");

  const forget = (id: string) => {
    setMemories((list) => list.filter((m) => m.id !== id));
    setMessage("Memory forgotten.");
  };

  const reset = () => {
    setMemories(EXAMPLES);
    setMessage("Examples put back.");
  };

  return (
    <div className="rounded-[24px] border-2 border-ink bg-paper p-5 md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.375rem]">What Debo knows</h3>
        <p className="text-sm text-ink-soft">Example with made-up memories. Try it.</p>
      </div>

      <ul className="mt-5 divide-y divide-line border-y border-line">
        {memories.map((memory) => (
          <li
            key={memory.id}
            className="memory-row flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold">{memory.text}</p>
              <p className="mt-2">
                <span className="chip">{memory.source}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => forget(memory.id)}
              className="btn btn-quiet shrink-0 self-start sm:self-center"
              aria-label={`Forget this memory: ${memory.text}`}
            >
              Forget this
            </button>
          </li>
        ))}
        {memories.length === 0 && (
          <li className="py-6">
            <p className="font-semibold">Debo knows nothing now.</p>
            <p className="text-ink-soft">That is how forgetting will work: gone means gone.</p>
          </li>
        )}
      </ul>

      <div className="mt-4 flex min-h-12 flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm font-semibold">
          {message}
        </p>
        {memories.length < EXAMPLES.length && (
          <button type="button" onClick={reset} className="btn btn-quiet">
            Put the examples back
          </button>
        )}
      </div>
    </div>
  );
}
