import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeboChat } from "@/components/debo-chat";
import { getAuth } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Chat with Debo", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) redirect("/auth/sign-in");

  return (
    <main className="wrap max-w-[48rem] py-16">
      <a href="/home" className="font-semibold underline underline-offset-4">
        Back to your entries
      </a>
      <h1 className="h-section mt-8">Chat with Debo</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">
        Ask about your entries. Debo only answers from what you wrote, shows which entry each answer came from,
        and says so when it doesn&rsquo;t know.
      </p>
      <div className="mt-8">
        <DeboChat />
      </div>
    </main>
  );
}
