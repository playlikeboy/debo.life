import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../apps/server/src/app.ts";
import type { Config } from "../apps/server/src/config.ts";
import { createStore, type Store } from "../apps/server/src/db.ts";

// Every outbound call this file makes through global fetch is recorded. The app is driven
// in-process through app.request, so any entry here would be real network traffic.
const outbound: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  outbound.push(String((input as { url?: string }).url ?? input));
  throw new Error("The thread tests must not use the network");
}) as typeof fetch;

let directory: string;
function config(): Config {
  return {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: directory,
    agentBackend: "sample",
    googleRedirectUri: "http://localhost:8787/api/google/callback",
    allowedOrigins: ["http://localhost:8081"],
  };
}
async function start(db: Store) {
  const { app } = await createApp(db, config());
  return app;
}
type App = Awaited<ReturnType<typeof start>>;
const auth = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});
async function signIn(app: App) {
  const session = await app.request("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return (await session.json()).token as string;
}
/** A second signed-in person, written the way auth.ts stores a session. */
async function signInAs(db: Store, owner: string) {
  const token = `token-for-${owner}`;
  await db.put("system", "sessions", {
    id: createHash("sha256").update(token).digest("hex"),
    owner,
    expiresAt: Date.now() + 60_000,
  });
  return token;
}
const input = (threadId: string, runId: string, content: string, messageId = `m-${runId}`) =>
  JSON.stringify({
    threadId,
    runId,
    messages: [{ id: messageId, role: "user", content }],
    tools: [],
    context: [],
    state: {},
    forwardedProps: {},
  });
async function post(app: App, token: string, path: string, body: unknown = {}, method = "POST") {
  return app.request(path, {
    method,
    headers: auth(token),
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
/** Sends one chat turn through the real CopilotKit runtime and returns its event stream as text. */
async function chat(app: App, token: string, threadId: string, content: string, runId = "r1") {
  const response = await post(
    app,
    token,
    "/api/copilotkit/agent/default/run",
    input(threadId, runId, content),
  );
  assert.equal(response.status, 200);
  return response.text();
}
async function replay(app: App, token: string, threadId: string) {
  const response = await post(
    app,
    token,
    "/api/copilotkit/agent/default/connect",
    input(threadId, "connect", ""),
  );
  assert.equal(response.status, 200);
  return response.text();
}
async function list(app: App, token: string, query = "?includeArchived=true") {
  const response = await app.request(`/api/threads${query}`, { headers: auth(token) });
  assert.equal(response.status, 200);
  return (await response.json()) as {
    threads: { id: string; name: string | null; archived: boolean }[];
    nextCursor: string | null;
  };
}

let db: Store, app: App, alice: string, bob: string;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "debo-threads-"));
  db = await createStore();
  app = await start(db);
  alice = await signIn(app);
  bob = await signInAs(db, "bob");
});
after(async () => {
  globalThis.fetch = realFetch;
  await db.close();
  await rm(directory, { recursive: true, force: true });
});

test("a chat turn creates a saved thread named from the first message", async () => {
  const stream = await chat(app, alice, "side-1", "Show my calendar");
  assert.match(stream, /RUN_FINISHED/);
  const { threads } = await list(app, alice);
  const saved = threads.find((t) => t.id === "side-1");
  assert.ok(saved, "thread was saved");
  assert.equal(saved.name, "Show my calendar");
  assert.equal(saved.archived, false);
});

test("the main chat id is stable and its conversation is listed once it is used", async () => {
  const first = await (await app.request("/api/main-thread", { headers: auth(alice) })).json();
  const again = await (await app.request("/api/main-thread", { headers: auth(alice) })).json();
  assert.equal(first.threadId, again.threadId);
  await chat(app, alice, first.threadId, "Hello from the main chat");
  assert.ok((await list(app, alice)).threads.some((t) => t.id === first.threadId));
  assert.equal((await app.request("/api/main-thread")).status, 401);
});

test("history replays every saved turn through the runtime's connect endpoint", async () => {
  await chat(app, alice, "replay-1", "Show my calendar", "r1");
  await chat(app, alice, "replay-1", "What is on my calendar tomorrow", "r2");
  const stream = await replay(app, alice, "replay-1");
  assert.match(stream, /Show my calendar/);
  assert.match(stream, /What is on my calendar tomorrow/);
  assert.match(stream, /Your local calendar has/);
  const messages = await (
    await app.request("/api/threads/replay-1/messages", { headers: auth(alice) })
  ).json();
  assert.deepEqual(
    messages.messages.map((m: { role: string }) => m.role),
    ["user", "assistant", "user", "assistant"],
  );
});

test("each person sees only their own threads, and cannot read, change or replay another's", async () => {
  await chat(app, alice, "private-1", "Show my calendar");
  assert.ok((await list(app, alice)).threads.some((t) => t.id === "private-1"));
  assert.deepEqual((await list(app, bob)).threads, []);
  // Bob guessing Alice's thread id gets nothing back and changes nothing.
  assert.equal((await post(app, bob, "/api/threads/private-1", { name: "mine" }, "PATCH")).status, 404);
  assert.equal((await post(app, bob, "/api/threads/private-1/archive")).status, 404);
  const bobMessages = await (
    await app.request("/api/threads/private-1/messages", { headers: auth(bob) })
  ).json();
  assert.deepEqual(bobMessages.messages, []);
  const bobReplay = await replay(app, bob, "private-1");
  assert.doesNotMatch(bobReplay, /Show my calendar/);
  const mine = (await list(app, alice)).threads.find((t) => t.id === "private-1");
  assert.equal(mine?.name, "Show my calendar");
  assert.equal(mine?.archived, false);
  // Bob using the same id starts his own separate conversation.
  await chat(app, bob, "private-1", "Hello from Bob");
  assert.equal((await list(app, bob)).threads[0].name, "Hello from Bob");
  assert.equal(
    (await list(app, alice)).threads.find((t) => t.id === "private-1")?.name,
    "Show my calendar",
  );
});

test("rename, archive and restore change the list", async () => {
  await chat(app, alice, "manage-1", "Show my calendar");
  const renamed = await post(app, alice, "/api/threads/manage-1", { name: "  Trip plans " }, "PATCH");
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).name, "Trip plans");
  assert.equal((await post(app, alice, "/api/threads/manage-1", { name: "  " }, "PATCH")).status, 422);
  // A later message does not overwrite a name the person chose.
  await chat(app, alice, "manage-1", "More about the calendar", "r2");
  assert.equal((await list(app, alice)).threads.find((t) => t.id === "manage-1")?.name, "Trip plans");

  assert.equal((await post(app, alice, "/api/threads/manage-1/archive")).status, 200);
  assert.equal((await list(app, alice, "")).threads.some((t) => t.id === "manage-1"), false);
  const archived = (await list(app, alice)).threads.find((t) => t.id === "manage-1");
  assert.equal(archived?.archived, true);
  // Archived conversations still replay.
  assert.match(await replay(app, alice, "manage-1"), /More about the calendar/);

  assert.equal((await post(app, alice, "/api/threads/manage-1/restore")).status, 200);
  assert.equal((await list(app, alice, "")).threads.some((t) => t.id === "manage-1"), true);
  assert.equal((await post(app, alice, "/api/threads/missing-thread/archive")).status, 404);
  assert.equal((await post(app, alice, "/api/threads/bad%20id", { name: "x" }, "PATCH")).status, 400);
});

test("the list pages with a cursor", async () => {
  for (const id of ["page-a", "page-b", "page-c"]) await chat(app, bob, id, "Show my calendar");
  const first = await list(app, bob, "?includeArchived=true&limit=2");
  assert.equal(first.threads.length, 2);
  assert.ok(first.nextCursor);
  const second = await list(app, bob, `?includeArchived=true&limit=2&cursor=${first.nextCursor}`);
  const ids = [...first.threads, ...second.threads].map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 3);
});

test("saved conversations survive a restart of the store", async () => {
  const files = await mkdtemp(join(tmpdir(), "debo-threads-restart-"));
  try {
    let store = await createStore({ dataDir: join(files, "pg") });
    let instance = await start(store);
    const token = await signIn(instance);
    await chat(instance, token, "durable-1", "Show my calendar");
    await post(instance, token, "/api/threads/durable-1", { name: "Kept" }, "PATCH");
    const mainId = (await (await instance.request("/api/main-thread", { headers: auth(token) })).json())
      .threadId;
    await store.close();

    store = await createStore({ dataDir: join(files, "pg") });
    instance = await start(store);
    // The session is stored too, so the same token still works after the restart.
    const saved = (await list(instance, token)).threads.find((t) => t.id === "durable-1");
    assert.equal(saved?.name, "Kept");
    assert.match(await replay(instance, token, "durable-1"), /Your local calendar has/);
    assert.equal(
      (await (await instance.request("/api/main-thread", { headers: auth(token) })).json()).threadId,
      mainId,
    );
    // And the conversation can continue after the restart.
    assert.match(await chat(instance, token, "durable-1", "Show my calendar again", "r2"), /RUN_FINISHED/);
    await store.close();
  } finally {
    await rm(files, { recursive: true, force: true });
  }
});

test("the CopilotKit thread routes that need Intelligence stay closed", async () => {
  for (const path of ["/api/copilotkit/threads?agentId=default", "/api/copilotkit/threads/x/messages"]) {
    const response = await app.request(path, { headers: auth(alice) });
    // No second, unscoped thread store is exposed next to Debo's own.
    assert.ok([404, 422].includes(response.status), `${path} -> ${response.status}`);
    assert.doesNotMatch(await response.text(), /Show my calendar/);
  }
});

test("no thread operation contacts any outside service", () => {
  assert.deepEqual(outbound, []);
});
