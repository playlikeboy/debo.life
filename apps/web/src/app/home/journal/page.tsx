import { listEntries, type Entry } from "@debo/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntryItem, EntryTargetFocus, JournalStatus } from "@/components/journal";
import { JournalEditor } from "@/components/journal-editor";
import { getAuth } from "@/lib/auth/server";
import { databaseUrl } from "@/lib/server-env";

export const metadata: Metadata = { title: "Your journal", robots: { index: false } };
export const dynamic = "force-dynamic";

/** How many entries the page shows at once. Older ones are found with the "Find" box. */
const SHOWN = 500;

// Dates use UTC, the same as the source chips ("Journal, 14 March").
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Write, read, find, edit and delete journal entries. */
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";
  const entries = await listEntries(databaseUrl(), session.user.id, SHOWN, query || undefined);
  const months = groupByMonth(entries);

  return (
    <main className="wrap max-w-[48rem] pb-16 pt-10">
      <h1 className="h-section">Your journal</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">
        Write about your day, the people in it and your plans. Only you can read your entries. Debo uses them to
        answer your questions, and shows which entry each answer came from.
      </p>

      <div className="mt-8">
        <JournalEditor userId={session.user.id} />
      </div>

      <section className="mt-12" aria-labelledby="entries-heading">
        <h2 id="entries-heading" tabIndex={-1} className="text-[1.75rem]">
          Your entries
        </h2>

        {(entries.length > 0 || query) && (
          <form method="get" action="/home/journal" role="search" className="mt-4">
            <label htmlFor="find" className="font-semibold">
              Find an entry
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="find"
                name="q"
                type="search"
                defaultValue={query}
                maxLength={200}
                className="block min-h-12 w-full flex-1 rounded-[12px] border-2 border-ink bg-paper px-3 py-2"
              />
              <button type="submit" className="btn btn-quiet shrink-0">
                Find
              </button>
            </div>
          </form>
        )}

        {query && (
          <p className="mt-4">
            <span className="font-semibold">
              {entries.length === 0
                ? `No entries have “${query}”.`
                : `${entries.length === 1 ? "1 entry has" : `${entries.length} entries have`} “${query}”.`}
            </span>{" "}
            {entries.length === 0 && "Try a shorter word, or "}
            <a href="/home/journal" className="font-semibold underline underline-offset-4">
              {entries.length === 0 ? "show all entries" : "Show all entries"}
            </a>
            .
          </p>
        )}

        {!query && entries.length === 0 && (
          <div className="mt-4 rounded-[24px] border border-line bg-paper p-6">
            <p className="font-semibold">Nothing here yet.</p>
            <p className="mt-2 text-ink-soft">
              Start small: write one line about today, like who you saw or what you ate. Your entries show here,
              newest first, and then you can ask Debo about them.
            </p>
          </div>
        )}

        <JournalStatus />

        {months.map((month) => (
          <section key={month.key} className="mt-6" aria-labelledby={`month-${month.key}`}>
            <h3 id={`month-${month.key}`} className="text-[1.375rem]">
              {month.label}
            </h3>
            <ul className="mt-4 grid gap-4">
              {month.entries.map((entry) => (
                <EntryItem
                  key={entry.id}
                  id={entry.id}
                  text={entry.text}
                  dayLabel={dayFormat.format(entry.happenedAt)}
                  isoDate={entry.happenedAt.toISOString()}
                />
              ))}
            </ul>
          </section>
        ))}

        {entries.length === SHOWN && (
          <p className="mt-6 text-ink-soft">
            This page shows your newest {SHOWN} entries. Use &ldquo;Find an entry&rdquo; to reach older ones.
          </p>
        )}
      </section>

      <EntryTargetFocus />
    </main>
  );
}

function groupByMonth(entries: Entry[]) {
  const months: { key: string; label: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const key = entry.happenedAt.toISOString().slice(0, 7);
    const last = months.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else months.push({ key, label: monthFormat.format(entry.happenedAt), entries: [entry] });
  }
  return months;
}
