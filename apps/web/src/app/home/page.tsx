import { listEntries } from "@debo/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountActions } from "@/components/account-actions";
import { AskBox } from "@/components/journal";
import { getAuth } from "@/lib/auth/server";
import { entryHref } from "@/lib/links";
import { databaseUrl } from "@/lib/server-env";

export const metadata: Metadata = { title: "Your Debo", robots: { index: false } };
export const dynamic = "force-dynamic";

const places = [
  { href: "/home/journal", title: "Your journal", text: "Write a new entry, read old ones, find, fix or delete them." },
  { href: "/home/chat", title: "Chat with Debo", text: "Talk things through. Debo answers only from your entries." },
  { href: "/home/memories", title: "What Debo knows", text: "The facts Debo picked out of your entries. Fix or forget any of them." },
  { href: "/home/activity", title: "What Debo did", text: "Everything Debo saved, changed and answered for you, newest first." },
];

/** The calm front door: ask, glance at recent entries, and go anywhere in Debo. */
export default async function HomePage() {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const recent = await listEntries(databaseUrl(), session.user.id, 3);

  return (
    <main className="wrap max-w-[48rem] pb-16 pt-10">
      <h1 className="h-section">Hi, {session.user.name}</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">
        You are signed in as <span className="font-semibold text-ink">{session.user.email}</span>.
      </p>

      <div className="mt-10">
        <AskBox />
      </div>

      <section className="mt-12" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-[1.75rem]">
          Recent entries
        </h2>
        {recent.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-line bg-paper p-6">
            <p className="font-semibold">Nothing here yet.</p>
            <p className="mt-2 text-ink-soft">Write a line about your day. Then ask Debo about it.</p>
            <a href="/home/journal" className="btn btn-quiet mt-4">
              Write your first entry
            </a>
          </div>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {recent.map((entry) => (
                <li key={entry.id} className="py-3">
                  <a href={entryHref(entry.id)} className="font-semibold underline underline-offset-4">
                    {entry.title}
                  </a>
                  <p className="text-ink-soft">
                    <time dateTime={entry.happenedAt.toISOString()}>
                      {entry.happenedAt.toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      })}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
            <a href="/home/journal" className="btn btn-quiet mt-4">
              Open your journal
            </a>
          </>
        )}
      </section>

      <section className="mt-12" aria-labelledby="places-heading">
        <h2 id="places-heading" className="text-[1.75rem]">
          Everything in Debo
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {places.map((place) => (
            <li key={place.href}>
              <a
                href={place.href}
                className="block h-full rounded-[24px] border-2 border-ink bg-paper p-6 no-underline hover:bg-sky focus-visible:rounded-[24px]"
              >
                <span className="block font-display text-[1.375rem] font-bold leading-tight">{place.title}</span>
                <span className="mt-2 block text-ink-soft">{place.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <AccountActions />
    </main>
  );
}
