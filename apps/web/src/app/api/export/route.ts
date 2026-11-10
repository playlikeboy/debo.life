import { exportRecords, recordActivity } from "@debo/db";
import { getAuth } from "@/lib/auth/server";
import { activitySection, buildExportZip, entriesSection } from "@/lib/export";
import { databaseUrl } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Download everything the signed-in person has saved, as a zip.
 * Writes one activity row so the download shows in "What Debo did".
 * Never logs entry text: only the user id and a short error reason.
 */
export async function GET() {
  const { data: session } = await getAuth().getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in first, then try again." }, { status: 401 });
  }

  try {
    const exportedAt = new Date();
    const records = await exportRecords(databaseUrl(), userId);
    // Add a section here when Debo stores more (files, memories).
    const zip = buildExportZip([entriesSection(records.entries), activitySection(records.activity)], exportedAt);
    await recordActivity(databaseUrl(), userId, { actor: "you", action: "exported" });

    return new Response(zip as Uint8Array<ArrayBuffer>, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="debo-export-${exportedAt.toISOString().slice(0, 10)}.zip"`,
        "Content-Length": String(zip.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Library error messages carry ids and codes, not a person's content.
    const reason = error instanceof Error ? `${error.name}: ${error.message.slice(0, 160)}` : "unknown";
    console.error("export failed", { userId, reason });
    return Response.json(
      { error: "I couldn't make your download. Nothing was changed. Try again in a moment." },
      { status: 500 },
    );
  }
}
