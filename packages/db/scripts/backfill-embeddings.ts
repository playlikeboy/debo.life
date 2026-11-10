// Embed every piece that has no embedding yet (for meaning search).
//
//   pnpm --filter @debo/db db:backfill-embeddings
//
// Reads DATABASE_URL_UNPOOLED and the NEON_AI_GATEWAY_* values from the
// environment, falling back to the repo-root .env (shell values win).
// Prints counts only, never any text.
//
// Tooling, not package code: this is why @debo/db has @debo/llm as a
// dev dependency. src/ still imports nothing from the repo.
import { createLlm } from "@debo/llm";
import { chunksMissingEmbeddings, setEmbeddingById } from "../src/index";

try {
  process.loadEnvFile("../../.env");
} catch {
  // In CI the values come from the environment.
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set.");

const llm = createLlm(process.env);
const BATCH = 50;
let done = 0;
let tokens = 0;

for (;;) {
  const pieces = await chunksMissingEmbeddings(url, BATCH);
  if (pieces.length === 0) break;
  const result = await llm.embed(pieces.map((p) => p.text));
  for (const [i, piece] of pieces.entries()) {
    const vector = result.vectors[i];
    if (vector) await setEmbeddingById(url, piece.id, vector);
  }
  done += pieces.length;
  tokens += result.tokens;
  console.log(`embedded ${done} pieces so far`);
}

console.log(`done: ${done} pieces embedded, ${tokens} tokens`);
