// Manual check of @debo/memory against the hosted Mem0 Platform.
// Uses a throwaway user id and made-up text, and deletes everything at the end.
// Proves: memories carry source_id, other people cannot fix or forget them,
// fixing works, forgetting really deletes, and no telemetry is sent.
// Prints ids and counts only.
//
// Usage (from packages/memory):
//   node --env-file=../../.env scripts/try-memory.ts
import { randomUUID } from "node:crypto";
import { createMemory } from "../src/index.ts";

// Count any call to Mem0's telemetry host.
let telemetryCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (target.includes("posthog")) telemetryCalls += 1;
  return realFetch(input, init);
};

const memory = createMemory(process.env);
if (!memory) throw new Error("Set MEM0_API_KEY first.");

const userId = `debo-dev-test-${randomUUID().slice(0, 8)}`;
const otherUser = `debo-dev-test-${randomUUID().slice(0, 8)}`;
const sourceA = randomUUID();
const sourceB = randomUUID();
const step = (name: string, detail: unknown) => console.log(`${name}:`, detail);

/** Mem0 reads entries in the background. Wait until both have memories. */
async function waitForMemories(expectedSources: string[]) {
  for (let i = 0; i < 40; i += 1) {
    const list = await memory!.list(userId);
    if (expectedSources.every((s) => list.some((m) => m.sourceId === s))) return list;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return memory!.list(userId);
}

try {
  step("event A", Boolean(await memory.rememberFromSource({ userId, sourceId: sourceA, text: "My sister Riya moved to Pune in March." })));
  step("event B", Boolean(await memory.rememberFromSource({ userId, sourceId: sourceB, text: "I started learning the guitar in October." })));

  let list = await waitForMemories([sourceA, sourceB]);
  step("list count", list.length);
  step("every memory has a source_id", list.every((m) => m.sourceId === sourceA || m.sourceId === sourceB));
  step("other person sees none", (await memory.list(otherUser)).length);

  const first = list.find((m) => m.sourceId === sourceA);
  if (first) {
    step("other person cannot fix it", (await memory.update(otherUser, first.id, "Changed by someone else")) === null);
    step("other person cannot forget it", (await memory.forget(otherUser, first.id)) === null);
    step("owner fixes it", (await memory.update(userId, first.id, "My sister Riya moved to Pune in March 2026."))?.editedByUser);
    list = await memory.list(userId);
    step("fixed one is marked edited", list.find((m) => m.id === first.id)?.editedByUser);
  }

  step("forgetSource(A, keep edited)", await memory.forgetSource(userId, sourceA, { keepEditedByUser: true }));
  step("forgetSource(A)", await memory.forgetSource(userId, sourceA));
  list = await memory.list(userId);
  step("after forgetting A: from A / from B", `${list.filter((m) => m.sourceId === sourceA).length} / ${list.filter((m) => m.sourceId === sourceB).length}`);
} finally {
  await memory.forgetAll(userId);
  step("list after forgetAll", (await memory.list(userId)).length);
  step("telemetry calls", telemetryCalls);
}
