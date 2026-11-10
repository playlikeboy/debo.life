// Make one source searchable by meaning: embed its chunks and store the vectors.
// Keyword search works without this, so a failure here never loses an entry;
// the backfill script (pnpm --filter @debo/db db:backfill-embeddings) catches up.
import { chunksForSource, recordUsage, setChunkEmbeddings } from "@debo/db";
import { createLlm } from "@debo/llm";

export async function indexSource(
  connectionString: string,
  env: Record<string, string | undefined>,
  userId: string,
  sourceId: string,
): Promise<{ embedded: number }> {
  const chunks = await chunksForSource(connectionString, userId, sourceId);
  if (chunks.length === 0) return { embedded: 0 };
  const { vectors, tokens } = await createLlm(env).embed(chunks.map((c) => c.text));
  const embedded = await setChunkEmbeddings(connectionString, userId, sourceId, vectors);
  await recordUsage(connectionString, userId, { provider: "neon", units: tokens });
  return { embedded };
}
