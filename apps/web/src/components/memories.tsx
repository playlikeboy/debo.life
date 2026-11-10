"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fixMemory, forgetMemory } from "@/app/home/actions";

const box = "mt-2 block w-full rounded-[12px] border-2 border-ink bg-paper px-3 py-2";

/** One thing Debo knows: the sentence, where it learned it, "Fix this" and "Forget this". */
export function MemoryItem({
  id,
  text,
  sourceId,
  sourceLabel,
}: {
  id: string;
  text: string;
  sourceId: string;
  sourceLabel: string;
}) {
  const [mode, setMode] = useState<"read" | "fixing" | "confirm-forget" | "forgotten">("read");
  const [draft, setDraft] = useState(text);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function saveFix() {
    startTransition(async () => {
      const result = await fixMemory(id, draft);
      setMessage(result.message);
      if (result.ok) {
        setMode("read");
        router.refresh();
      }
    });
  }

  function forget() {
    startTransition(async () => {
      const result = await forgetMemory(id);
      setMessage(result.message);
      setMode(result.ok ? "forgotten" : "read");
    });
  }

  if (mode === "forgotten") {
    return (
      <li className="rounded-[24px] border border-line bg-paper p-6">
        <p role="status" aria-live="polite" className="font-semibold">
          {message}
        </p>
      </li>
    );
  }

  return (
    <li className="rounded-[24px] border border-line bg-paper p-6">
      {mode === "fixing" ? (
        <div>
          <label htmlFor={`fix-${id}`} className="font-semibold">
            Fix this memory
          </label>
          <textarea
            id={`fix-${id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMode("read");
            }}
            rows={3}
            maxLength={1000}
            autoFocus
            className={box}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={saveFix} disabled={pending} className="btn btn-quiet">
              {pending ? "Saving…" : "Save fix"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(text);
                setMode("read");
              }}
              disabled={pending}
              className="btn btn-quiet"
            >
              Keep as it was
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[1.125rem]">{text}</p>
      )}

      <p className="mt-3">
        <a href={`/home#entry-${sourceId}`} className="chip no-underline">
          {sourceLabel}
        </a>
      </p>

      {mode === "read" && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setDraft(text);
              setMessage("");
              setMode("fixing");
            }}
            className="btn btn-quiet"
          >
            Fix this
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setMode("confirm-forget");
            }}
            className="btn btn-quiet"
          >
            Forget this
          </button>
        </div>
      )}

      {mode === "confirm-forget" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="font-semibold">Forget this memory for good? Your entry stays.</span>
          <button type="button" onClick={forget} disabled={pending} className="btn btn-quiet">
            {pending ? "Forgetting…" : "Yes, forget it"}
          </button>
          <button type="button" onClick={() => setMode("read")} disabled={pending} className="btn btn-quiet">
            Keep it
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-2 font-semibold">
        {message}
      </p>
    </li>
  );
}
