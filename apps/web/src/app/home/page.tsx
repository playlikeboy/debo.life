import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountActions } from "@/components/account-actions";
import { getAuth } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Your Debo", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");

  return (
    <main className="wrap max-w-[40rem] py-16">
      <h1 className="h-section">Hi, {session.user.name}</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">
        You are signed in as <span className="font-semibold text-ink">{session.user.email}</span>.
      </p>
      <div className="mt-8 rounded-[24px] border-2 border-ink bg-paper p-6">
        <h2 className="text-[1.375rem]">Nothing here yet</h2>
        <p className="mt-2 text-ink-soft">
          Journals, voice notes and asking Debo come next. For now your account only holds your name and
          email.
        </p>
      </div>
      <AccountActions />
    </main>
  );
}
