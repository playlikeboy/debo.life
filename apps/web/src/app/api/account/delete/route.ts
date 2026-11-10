import { deleteAccount } from "@debo/db";
import { createStorage, deleteUserFiles } from "@debo/ingest";
import { cookies } from "next/headers";
import { getAuth } from "@/lib/auth/server";
import { memoryStore } from "@/lib/memory";
import { databaseUrl, serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Delete the signed-in person's account and everything they own, for good.
 *
 * Neon's managed sign-in does not offer self-service deletion, so we do it
 * ourselves: memories in Mem0 first, then files, then the account row
 * (which cascades to sessions, entries and records).
 * Logs ids only, never names or emails.
 */
export async function POST(request: Request) {
  // Only accept this from our own pages, never from another site.
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "This request must come from Debo itself." }, { status: 403 });
  }

  const { data: session } = await getAuth().getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in first, then try again." }, { status: 401 });
  }

  try {
    // Memories in Mem0 first: once the account row is gone, the person cannot
    // retry, and Mem0 has no link to our database to clean up by itself.
    // If MEM0_API_KEY is not set, memory is off and there is nothing to delete.
    const memory = memoryStore();
    if (memory) await memory.forgetAll(userId);
    const filesDeleted = await deleteUserFiles(createStorage(serverEnv()), userId);
    const accountDeleted = await deleteAccount(databaseUrl(), userId);
    if (!accountDeleted) {
      return Response.json({ error: "I couldn't find your account. It may already be deleted." }, { status: 404 });
    }

    // The session rows are gone; also drop the sign-in cookies in this browser.
    const jar = await cookies();
    // `__Secure-` cookies can only be cleared by a cookie that is also Secure.
    for (const cookie of jar.getAll()) {
      if (cookie.name.includes("neon-auth")) {
        jar.set(cookie.name, "", { maxAge: 0, path: "/", secure: true, httpOnly: true, sameSite: "lax" });
      }
    }

    console.info("account deleted", { userId, filesDeleted, memoriesDeleted: memory !== null });
    return Response.json({ deleted: true });
  } catch (error) {
    // Library error messages carry ids and codes, not a person's content.
    const reason = error instanceof Error ? `${error.name}: ${error.message.slice(0, 160)}` : "unknown";
    console.error("account delete failed", { userId, reason });
    return Response.json(
      { error: "I couldn't finish deleting your account. Some files may already be gone. Try again to finish." },
      { status: 500 },
    );
  }
}
