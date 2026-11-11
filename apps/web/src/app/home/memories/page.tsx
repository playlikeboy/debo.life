import { getSources } from "@debo/db";
import { speakToPerson, type Memory } from "@debo/memory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MemoryItem } from "@/components/memories";
import { getAuth } from "@/lib/auth/server";
import { memoryStore } from "@/lib/memory";
import { databaseUrl } from "@/lib/server-env";

export const metadata: Metadata = { title: "What Debo knows", robots: { index: false } };
export const dynamic = "force-dynamic";

type Shown = Memory & { sourceLabel: string };
type Loaded = { status: "off" } | { status: "error" } | { status: "ok"; memories: Shown[] };

/** Promises 3 and 4: see everything Debo knows, where it learned it, and fix or forget it. */
export default async function MemoriesPage() {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const loaded = await load(session.user.id);

  return (
    <main className="wrap max-w-[48rem] pb-16 pt-10">
      <h1 className="h-section">What Debo knows</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">
        After you save an entry, Debo picks out the lasting facts in it, like people, places and plans. Each memory
        shows the entry it came from. Fix anything that is wrong, or forget anything you don&rsquo;t want Debo to keep.
      </p>

      {loaded.status === "off" && (
        <p className="mt-8 text-ink-soft">
          Debo is not keeping memories right now. Your entries are safe, and you can still ask about them.
        </p>
      )}
      {loaded.status === "error" && (
        <p className="mt-8 font-semibold">I couldn&rsquo;t load what Debo knows just now. Try again in a moment.</p>
      )}
      {loaded.status === "ok" && loaded.memories.length === 0 && (
        <p className="mt-8 text-ink-soft">
          Nothing yet. Write an entry about the people, places and plans in your life, and Debo will remember them
          here within a minute or so.
        </p>
      )}
      {loaded.status === "ok" && loaded.memories.length > 0 && (
        <ul className="mt-8 grid gap-4" aria-label="Memories">
          {loaded.memories.map((m) => (
            <MemoryItem key={m.id} id={m.id} text={m.text} sourceId={m.sourceId} sourceLabel={m.sourceLabel} />
          ))}
        </ul>
      )}
    </main>
  );
}

/** Mem0 usually answers in under a second. Past this, show the error state instead of waiting on. */
const MEM0_WAIT_MS = 10_000;

/**
 * Everything that can fail is inside the try, so the page always draws:
 * at worst it says it couldn't load what Debo knows. Errors are logged with
 * ids and the error's name only.
 */
async function load(userId: string): Promise<Loaded> {
  try {
    const memory = memoryStore();
    if (!memory) return { status: "off" };
    const memories = await withTimeout(memory.list(userId), MEM0_WAIT_MS);
    // Show a memory only when its entry is still this person's. An entry
    // deleted a moment ago may still have memories waiting to be forgotten.
    const ids = [...new Set(memories.map((m) => m.sourceId))].filter((id) => z.string().uuid().safeParse(id).success);
    const sources = await getSources(databaseUrl(), userId, ids);
    const labels = new Map(sources.map((s) => [s.id, `Journal, ${formatDay(s.happenedAt)}`]));
    return {
      status: "ok",
      memories: memories.flatMap((m) => {
        const sourceLabel = labels.get(m.sourceId);
        if (!sourceLabel) return [];
        // Older memories say "User went…"; show them as "You went…". Display only, nothing
        // stored changes. A memory the person fixed is shown exactly as they wrote it.
        return [{ ...m, text: m.editedByUser ? m.text : speakToPerson(m.text), sourceLabel }];
      }),
    };
  } catch (error) {
    console.error("list memories failed", {
      userId,
      reason: error instanceof Error ? (error.message === "Mem0 took too long" ? "timeout" : error.name) : "unknown",
    });
    return { status: "error" };
  }
}

/** Resolve with `work`, or reject after `ms`. The timer is always cleared. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Mem0 took too long")), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    // If the timeout won, a late failure of `work` must not become an unhandled rejection.
    work.catch(() => {});
  }
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
