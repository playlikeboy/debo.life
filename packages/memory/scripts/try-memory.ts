// Manual check of @debo/memory against a NON-production Neon branch.
// Proves: memories carry source_id, fixing works, forgetting really deletes
// rows, and Mem0 sends no telemetry. Prints ids and counts only.
//
// Usage (from packages/memory):
//   DEBO_TEST_DATABASE_URL="$(neon connection-string dev-ai)" \
//   ANTHROPIC_API_KEY=... NEON_AI_GATEWAY_BASE_URL=... NEON_AI_GATEWAY_TOKEN=... \
//   node scripts/try-memory.ts
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createMemory } from "../src/index.ts";

const url = process.env.DEBO_TEST_DATABASE_URL;
if (!url) throw new Error("Set DEBO_TEST_DATABASE_URL to a test branch. Never production.");
if (url === process.env.DATABASE_URL) throw new Error("That is the production database. Use a test branch.");

// Count any call to Mem0's telemetry host.
let telemetryCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (target.includes("posthog")) telemetryCalls += 1;
  return realFetch(input, init);
};

const userId = randomUUID();
const otherUser = randomUUID();
const sourceA = randomUUID();
const sourceB = randomUUID();
const memory = createMemory(url, process.env);

async function rows(user: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const main = await client.query("select count(*)::int n from debo_memories where payload->>'user_id' = $1", [user]);
    const ent = await client
      .query("select count(*)::int n from debo_memories_entities where payload->>'user_id' = $1", [user])
      .catch(() => ({ rows: [{ n: "no table" }] }));
    return `memories rows=${main.rows[0].n}, entity rows=${ent.rows[0].n}`;
  } finally {
    await client.end();
  }
}

const step = (name: string, detail: unknown) => console.log(`${name}:`, detail);

const idsA = await memory.rememberFromSource({ userId, sourceId: sourceA, text: "My sister Riya moved to Pune in March." });
const idsB = await memory.rememberFromSource({ userId, sourceId: sourceB, text: "I started learning the guitar in October." });
step("added from A / B (ids)", `${idsA.length} / ${idsB.length}`);

let list = await memory.list(userId);
step("list count", list.length);
step("every memory has a source_id", list.every((m) => m.sourceId === sourceA || m.sourceId === sourceB));
step("by source", { A: list.filter((m) => m.sourceId === sourceA).length, B: list.filter((m) => m.sourceId === sourceB).length });
step("db after add", await rows(userId));

const first = list.find((m) => m.sourceId === sourceA);
if (first) {
  step("other user cannot fix it", await memory.update(otherUser, first.id, "Changed by someone else"));
  step("other user cannot forget it", await memory.forget(otherUser, first.id));
  step("owner fixes it", await memory.update(userId, first.id, "My sister Riya moved to Pune in March 2026."));
  list = await memory.list(userId);
  step("fixed one is marked edited", list.find((m) => m.id === first.id)?.editedByUser);
}

step("forgetSource(A, keep edited)", await memory.forgetSource(userId, sourceA, { keepEditedByUser: true }));
step("forgetSource(A)", await memory.forgetSource(userId, sourceA));
list = await memory.list(userId);
step("after forgetting A: from A / from B", `${list.filter((m) => m.sourceId === sourceA).length} / ${list.filter((m) => m.sourceId === sourceB).length}`);

await memory.forgetAll(userId);
step("list after forgetAll", (await memory.list(userId)).length);
step("db after forgetAll", await rows(userId));
step("telemetry calls", telemetryCalls);
