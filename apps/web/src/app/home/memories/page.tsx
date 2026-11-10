import { getSources } from "@debo/db";
import type { Memory } from "@debo/memory";
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
    <main className="wrap max-w-[48rem] py-16">
      <a href="/home" className="font-semibold underline underline-offset-4">
        Back to your entries
      </a>
      <h1 className="h-section mt-8">What Debo knows</h1>
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

async function load(userId: string): Promise<Loaded> {
  const memory = memoryStore();
  if (!memory) return { status: "off" };
  try {
    const memories = await memory.list(userId);
    // Show a memory only when its entry is still this person's. An entry
    // deleted a moment ago may still have memories waiting to be forgotten.
    const ids = [...new Set(memories.map((m) => m.sourceId))].filter((id) => z.string().uuid().safeParse(id).success);
    const sources = await getSources(databaseUrl(), userId, ids);
    const labels = new Map(sources.map((s) => [s.id, `Journal, ${formatDay(s.happenedAt)}`]));
    return {
      status: "ok",
      memories: memories.flatMap((m) => {
        const sourceLabel = labels.get(m.sourceId);
        return sourceLabel ? [{ ...m, sourceLabel }] : [];
      }),
    };
  } catch (error) {
    console.error("list memories failed", { userId, reason: error instanceof Error ? error.name : "unknown" });
    return { status: "error" };
  }
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
