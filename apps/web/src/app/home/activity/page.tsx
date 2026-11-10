import { listActivity, type ActivityItem } from "@debo/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/server";
import { databaseUrl } from "@/lib/server-env";

export const metadata: Metadata = { title: "What Debo did", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Promise 7: nothing happens in secret. A plain list, newest first, no hiding. */
export default async function ActivityPage() {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const items = await listActivity(databaseUrl(), session.user.id);

  return (
    <main className="wrap max-w-[48rem] py-16">
      <a href="/home" className="font-semibold underline underline-offset-4">
        Back to your entries
      </a>
      <h1 className="h-section mt-8">What Debo did</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">
        Everything Debo saved, changed, deleted and answered for you, newest first. This list keeps when it
        happened and which entries it touched, never your words.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-ink-soft">Nothing yet. Write an entry or ask Debo a question, and it will show here.</p>
      ) : (
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <p className="font-semibold">{describe(item)}</p>
              <p className="shrink-0 text-ink-soft">
                <time dateTime={item.createdAt.toISOString()}>{when(item.createdAt)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function describe(item: ActivityItem): string {
  const count = item.sourceIds.length;
  const entries = count === 1 ? "1 entry" : `${count} entries`;
  switch (item.action) {
    case "saved":
      return "You saved an entry.";
    case "edited":
      return "You changed an entry.";
    case "deleted":
      return "You deleted an entry.";
    case "answered":
      return `Debo answered a question using ${entries}.`;
    case "did-not-know":
      return "Debo had nothing about a question, so it said so.";
  }
}

function when(date: Date): string {
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}
