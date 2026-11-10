import { checkDatabase } from "@debo/db";
import { createStorage, deleteFile, putFile, readFileText } from "@debo/ingest";
import { createLlm } from "@debo/llm";
import { databaseUrl, serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Development-only check that each Neon service answers end to end.
 * Returns ok / plain error per service, never secrets or user data.
 * In production it does not exist (404), so nobody can use it to write files.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const env = serverEnv();

  const database = await run(async () => {
    const { serverVersion } = await checkDatabase(databaseUrl());
    return `Postgres ${serverVersion}`;
  });

  const storage = await run(async () => {
    const s3 = createStorage(env);
    const key = `health-check/${crypto.randomUUID()}.txt`;
    const body = `health ${new Date().toISOString()}`;
    await putFile(s3, key, body, "text/plain");
    const readBack = await readFileText(s3, key);
    await deleteFile(s3, key);
    if (readBack !== body) throw new Error("Read back a different file than was written.");
    return "wrote, read back and deleted a test file";
  });

  const ai = await run(async () => {
    const { text } = await createLlm(env).generate("Reply with the single word: ok");
    return `model replied (${text.trim().slice(0, 20)})`;
  });

  return Response.json({ database, storage, ai });
}

async function run(check: () => Promise<string>) {
  try {
    return { ok: true, detail: await check() };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" };
  }
}
