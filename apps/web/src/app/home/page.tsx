import { listEntries } from "@debo/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountActions } from "@/components/account-actions";
import { AskBox, DeleteEntryButton, EntryForm } from "@/components/journal";
import { getAuth } from "@/lib/auth/server";
import { databaseUrl } from "@/lib/server-env";

export const metadata: Metadata = { title: "Your Debo", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const entries = await listEntries(databaseUrl(), session.user.id);

  return (
    <main className="wrap max-w-[48rem] py-16">
      <h1 className="h-section">Hi, {session.user.name}</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">
        You are signed in as <span className="font-semibold text-ink">{session.user.email}</span>.
      </p>

      <div className="mt-10">
        <AskBox />
      </div>

      <div className="mt-10">
        <EntryForm />
      </div>

      <section className="mt-12" aria-labelledby="entries-heading">
        <h2 id="entries-heading" className="text-[1.75rem]">
          Your entries
        </h2>
        {entries.length === 0 ? (
          <p className="mt-4 text-ink-soft">
            Nothing here yet. Write your first entry above, then ask Debo about it.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {entries.map((entry) => (
              <li
                key={entry.id}
                id={`entry-${entry.id}`}
                className="scroll-mt-6 rounded-[24px] border border-line bg-paper p-6 target:border-2 target:border-ink"
              >
                <p className="chip">
                  Journal,{" "}
                  {entry.happenedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                </p>
                <p className="mt-3 whitespace-pre-wrap">{entry.text}</p>
                <div className="mt-4">
                  <DeleteEntryButton id={entry.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AccountActions />
    </main>
  );
}
