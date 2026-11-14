import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Hono } from "hono";
import { ActionService } from "../apps/server/src/actions.ts";
import { createStore, type Store } from "../apps/server/src/db.ts";
import { createDebo, deboRoutes, deboTools, DeboService } from "../apps/server/src/debo/index.ts";
import { NOT_A_DEBO_ACCOUNT, NOT_SET_UP } from "../apps/server/src/debo/service.ts";
import { ALICE, BOB, type FakeBackend, fakeBackend, UNKNOWN_MESSAGE } from "./helpers/debo.ts";

/** The routes, signed in as whoever the x-owner header names (the real app sets it from the session). */
function appFor(debo: DeboService) {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.use("*", async (c, next) => {
    c.set("owner", c.req.header("x-owner") ?? ALICE);
    await next();
  });
  app.route("/api/debo", deboRoutes(debo));
  return app;
}
const call = (app: ReturnType<typeof appFor>, method: string, path: string, owner: string, body?: unknown) =>
  app.request(`/api/debo${path}`, {
    method,
    headers: { "x-owner": owner, "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

const SECRET = "my password is the-blue-heron-42";

function setup(options?: Parameters<typeof fakeBackend>[0]) {
  const backend = fakeBackend(options);
  const debo = new DeboService(backend);
  return { backend, debo, app: appFor(debo) };
}

test("without a Debo database every feature says it is not set up", async () => {
  const debo = createDebo({ mode: "sample" }, {});
  const app = appFor(debo);
  const status = await (await call(app, "GET", "/status", ALICE)).json();
  assert.equal(status.configured, false);
  assert.equal(status.message, NOT_SET_UP);
  for (const [method, path, body] of [
    ["GET", "/entries"],
    ["POST", "/entries", { text: "hello" }],
    ["POST", "/ask", { question: "hi", stream: false }],
    ["GET", "/memories"],
    ["GET", "/activity"],
  ] as const) {
    const response = await call(app, method, path, ALICE, body);
    assert.equal(response.status, 503, `${method} ${path}`);
    assert.equal((await response.json()).error, NOT_SET_UP);
  }
});

test("a demo workspace ignores DATABASE_URL, a live one falls back to it", () => {
  const env = { DATABASE_URL: "postgres://demo-store.invalid/x" };
  assert.equal(createDebo({ mode: "sample" }, env).configured, false);
  assert.equal(createDebo({ mode: "sample" }, { ...env, DEBO_DATABASE_URL: "postgres://debo.invalid/x" }).configured, true);
  assert.equal(createDebo({ mode: "live" }, env).configured, true);
  assert.equal(createDebo({ mode: "live" }, {}).configured, false);
});

test("only a Debo account (a UUID) has a journal", async () => {
  const { app } = setup();
  const response = await call(app, "GET", "/entries", "local-user");
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, NOT_A_DEBO_ACCOUNT);
});

test("write, find, edit and delete an entry", async () => {
  const { app } = setup();
  const created = await call(app, "POST", "/entries", ALICE, { text: "  Walked with Arun by the river  " });
  assert.equal(created.status, 201);
  const { entry } = await created.json();
  assert.equal(entry.text, "Walked with Arun by the river");

  await call(app, "POST", "/entries", ALICE, { text: "Dentist on Tuesday" });
  const all = await (await call(app, "GET", "/entries", ALICE)).json();
  assert.equal(all.entries.length, 2);
  const found = await (await call(app, "GET", "/entries?find=arun", ALICE)).json();
  assert.deepEqual(found.entries.map((e: { id: string }) => e.id), [entry.id]);

  assert.equal((await call(app, "PUT", `/entries/${entry.id}`, ALICE, { text: "Walked with Arun and Mia" })).status, 200);
  const after = await (await call(app, "GET", "/entries?find=mia", ALICE)).json();
  assert.equal(after.entries.length, 1);

  assert.equal((await call(app, "DELETE", `/entries/${entry.id}`, ALICE)).status, 200);
  assert.equal((await call(app, "DELETE", `/entries/${entry.id}`, ALICE)).status, 404);
  assert.equal((await (await call(app, "GET", "/entries", ALICE)).json()).entries.length, 1);
});

test("one person never sees, changes or deletes another person's entries", async () => {
  const { app, backend } = setup();
  const { entry } = await (await call(app, "POST", "/entries", ALICE, { text: SECRET })).json();

  const bobList = await (await call(app, "GET", "/entries", BOB)).json();
  assert.deepEqual(bobList.entries, []);
  assert.deepEqual((await (await call(app, "GET", "/entries?find=heron", BOB)).json()).entries, []);
  assert.equal((await call(app, "PUT", `/entries/${entry.id}`, BOB, { text: "hijacked" })).status, 404);
  assert.equal((await call(app, "DELETE", `/entries/${entry.id}`, BOB)).status, 404);
  assert.equal(backend.entriesOf(ALICE)[0]?.text, SECRET);

  // Bob asking about Alice's words finds nothing; the answer never carries her text.
  const answer = await (await call(app, "POST", "/ask", BOB, { question: "what is my password heron", stream: false })).json();
  assert.equal(answer.status, "unknown");
  assert.ok(!JSON.stringify(answer).includes("heron"));
  assert.deepEqual(await (await call(app, "GET", "/activity", BOB)).json(), { activity: [] });
});

test("input is checked in plain words", async () => {
  const { app } = setup();
  const empty = await call(app, "POST", "/entries", ALICE, { text: "   " });
  assert.equal(empty.status, 422);
  assert.equal((await empty.json()).error, "Write something first.");
  const long = await call(app, "POST", "/entries", ALICE, { text: "x".repeat(20_001) });
  assert.equal(long.status, 422);
  assert.match((await long.json()).error, /too long/);
  assert.equal((await call(app, "POST", "/entries", ALICE, { nope: 1 })).status, 422);
  assert.equal((await call(app, "POST", "/entries", ALICE, "{not json")).status, 400);
  assert.equal((await call(app, "PUT", "/entries/not-an-id", ALICE, { text: "x" })).status, 404);
  assert.equal((await call(app, "GET", `/entries?find=${"a".repeat(201)}`, ALICE)).status, 422);
  assert.equal((await call(app, "POST", "/ask", ALICE, { question: "" })).status, 422);
  assert.equal((await call(app, "POST", "/ask", ALICE, { question: "q".repeat(501) })).status, 422);
  assert.equal((await call(app, "PUT", "/memories/nope", ALICE, { text: "x" })).status, 404);
});

async function lines(response: Response) {
  return (await response.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

test("an answer streams its sources before any text, and names the entry", async () => {
  const { app } = setup();
  const { entry } = await (await call(app, "POST", "/entries", ALICE, { text: "Walked with Arun by the river" })).json();
  const response = await call(app, "POST", "/ask", ALICE, { question: "Who did I walk with?" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /ndjson/);
  const events = await lines(response);
  assert.deepEqual(events.map((e) => e.type), ["sources", "text", "text", "done"]);
  const sources = events[0]?.sources as { id: string; label: string }[];
  assert.equal(sources[0]?.id, entry.id);
  assert.match(sources[0]?.label ?? "", /^Journal, \d+ \w+$/);
  assert.equal(events.at(-1)?.status, "answered");
  assert.equal((events.at(-1)?.sources as unknown[]).length, 1);
});

test("a question the journal cannot answer says so and never guesses", async () => {
  const { app } = setup();
  await call(app, "POST", "/entries", ALICE, { text: "Dentist on Tuesday" });
  const events = await lines(await call(app, "POST", "/ask", ALICE, { question: "What is my passport number?" }));
  assert.deepEqual(events, [{ type: "done", status: "unknown", message: UNKNOWN_MESSAGE }]);
  assert.match(UNKNOWN_MESSAGE, /I don’t have anything about that yet/);
  const whole = await (await call(app, "POST", "/ask", ALICE, { question: "What is my passport number?", stream: false })).json();
  assert.deepEqual(whole, { status: "unknown", message: UNKNOWN_MESSAGE });
});

test("asking without an AI key is reported, not faked", async () => {
  const { app } = setup({ askConfigured: false });
  const response = await call(app, "POST", "/ask", ALICE, { question: "hello there", stream: false });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not set up/);
  assert.equal((await (await call(app, "GET", "/status", ALICE)).json()).ask, false);
});

test("a failure mid-answer ends the stream with a plain message", async () => {
  const backend = fakeBackend();
  backend.ask = async function* () {
    yield { type: "sources" as const, sources: [] };
    throw new Error(`provider exploded near ${SECRET}`);
  };
  const app = appFor(new DeboService(backend));
  const events = await lines(await call(app, "POST", "/ask", ALICE, { question: "anything at all" }));
  assert.equal(events.at(-1)?.type, "error");
  assert.ok(!JSON.stringify(events).includes("exploded"));
});

test("memories show their entry, and can be fixed or forgotten", async () => {
  const { app, backend } = setup();
  const { entry } = await (await call(app, "POST", "/entries", ALICE, { text: "Walked with Arun" })).json();
  const memory = backend.addMemory(ALICE, entry.id, "User walked with Arun");
  backend.addMemory(ALICE, "99999999-9999-4999-8999-999999999999", "A memory whose entry is gone");

  const list = await (await call(app, "GET", "/memories", ALICE)).json();
  assert.equal(list.memories.length, 1, "a memory without its entry is not shown");
  assert.equal(list.memories[0].text, "You walked with Arun");
  assert.equal(list.memories[0].source.id, entry.id);
  assert.match(list.memories[0].source.label, /^Journal, /);

  // Bob cannot touch Alice's memory.
  assert.equal((await call(app, "PUT", `/memories/${memory.id}`, BOB, { text: "mine now" })).status, 404);
  assert.equal((await call(app, "DELETE", `/memories/${memory.id}`, BOB)).status, 404);
  assert.deepEqual((await (await call(app, "GET", "/memories", BOB)).json()).memories, []);

  assert.equal((await call(app, "PUT", `/memories/${memory.id}`, ALICE, { text: "You walked with Arun by the river" })).status, 200);
  const fixed = await (await call(app, "GET", "/memories", ALICE)).json();
  assert.equal(fixed.memories[0].text, "You walked with Arun by the river");
  assert.equal(fixed.memories[0].editedByUser, true);
  assert.equal((await call(app, "PUT", `/memories/${memory.id}`, ALICE, { text: "" })).status, 422);

  assert.equal((await call(app, "DELETE", `/memories/${memory.id}`, ALICE)).status, 200);
  assert.equal((await call(app, "DELETE", `/memories/${memory.id}`, ALICE)).status, 404);
  assert.deepEqual((await (await call(app, "GET", "/memories", ALICE)).json()).memories, []);
});

test("without hosted memory, What Debo knows says so", async () => {
  const { app } = setup({ memories: false });
  const response = await call(app, "GET", "/memories", ALICE);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not keeping memories/);
  assert.equal((await (await call(app, "GET", "/status", ALICE)).json()).memories, false);
});

test("every change leaves an activity line with ids only", async () => {
  const { app, debo } = setup();
  const { entry } = await (await call(app, "POST", "/entries", ALICE, { text: SECRET })).json();
  await call(app, "PUT", `/entries/${entry.id}`, ALICE, { text: `${SECRET} again` });
  await call(app, "POST", "/ask", ALICE, { question: "nothing matches this", stream: false });
  await call(app, "DELETE", `/entries/${entry.id}`, ALICE);
  await debo.idle();
  const { activity } = await (await call(app, "GET", "/activity", ALICE)).json();
  assert.deepEqual(
    activity.map((a: { action: string }) => a.action).reverse(),
    ["saved", "edited", "deleted"],
  );
  assert.ok(!JSON.stringify(activity).includes("heron"));
  assert.deepEqual(activity.at(-1).sourceIds, [entry.id]);
});

test("a broken activity record never undoes what the person did", async () => {
  const { app } = setup({ failActivity: true });
  const created = await call(app, "POST", "/entries", ALICE, { text: "still saved" });
  assert.equal(created.status, 201);
});

test("entry text never reaches the logs", async () => {
  const seen: string[] = [];
  const originals = { info: console.info, error: console.error, warn: console.warn, log: console.log };
  for (const name of Object.keys(originals) as (keyof typeof originals)[])
    console[name] = (...args: unknown[]) => void seen.push(args.map(String).join(" "));
  try {
    const { app, debo } = setup({ failActivity: true });
    const { entry } = await (await call(app, "POST", "/entries", ALICE, { text: SECRET })).json();
    await call(app, "POST", "/entries", ALICE, { text: "" });
    await call(app, "POST", "/ask", ALICE, { question: `${SECRET}?`, stream: false });
    await call(app, "PUT", `/entries/${entry.id}`, BOB, { text: SECRET });
    await debo.idle();
    // A provider error that quotes the question must not be logged either.
    const backend = fakeBackend();
    backend.ask = () => {
      throw new Error(`boom ${SECRET}`);
    };
    await call(appFor(new DeboService(backend)), "POST", "/ask", ALICE, { question: "what about it", stream: false });
  } finally {
    Object.assign(console, originals);
  }
  assert.ok(!seen.join("\n").includes("heron"), seen.join("\n"));
});

// ---- Agent tools ----

type Tool = { name: string; execute: (args: unknown) => Promise<unknown> };
let db: Store;
before(async () => {
  db = await createStore();
});
after(async () => {
  await db.close();
});

function toolsFor(owner: string, backend: FakeBackend) {
  const debo = new DeboService(backend);
  const actions = new ActionService(db, {
    execute: async (who, input) => {
      if (input.kind !== "journal.add") throw new Error("unexpected action");
      return debo.executeProposal(who, input.data.text);
    },
    connected: async () => false, // no Google at all: journal actions must not need it
    connection: async () => null,
  });
  const tools = deboTools(debo, actions, owner, { key: (name, value) => `${name}:${JSON.stringify(value)}` }) as unknown as Tool[];
  const byName = (name: string) => {
    const tool = tools.find((t) => t.name === name);
    assert.ok(tool, name);
    return tool.execute;
  };
  return { debo, actions, tools, byName };
}

test("the agent gets three journal tools", () => {
  const { tools } = toolsFor(ALICE, fakeBackend());
  assert.deepEqual(tools.map((t) => t.name), ["search_my_journal", "ask_my_life", "add_journal_entry"]);
});

test("search_my_journal and ask_my_life return sources, and only the owner's own", async () => {
  const backend = fakeBackend();
  const alice = toolsFor(ALICE, backend);
  const bob = toolsFor(BOB, backend);
  const entry = await alice.debo.createEntry(ALICE, { text: "Walked with Arun by the river" });

  const found = (await alice.byName("search_my_journal")({ query: "river walk Arun" })) as { matches: { source: { id: string } }[] };
  assert.equal(found.matches[0]?.source.id, entry.id);

  const answer = (await alice.byName("ask_my_life")({ question: "Who did I walk with?" })) as { status: string; sources: { id: string; label: string }[] };
  assert.equal(answer.status, "answered");
  assert.equal(answer.sources[0]?.id, entry.id);

  const nothing = (await bob.byName("ask_my_life")({ question: "Who did I walk with?" })) as { status: string; message: string };
  assert.equal(nothing.status, "unknown");
  assert.equal(nothing.message, UNKNOWN_MESSAGE);
  assert.deepEqual(await bob.byName("search_my_journal")({ query: "river walk Arun" }), {
    matches: [],
    message: "Nothing in the journal matches that.",
  });
});

test("add_journal_entry only prepares a review; the entry is saved after approval", async () => {
  const backend = fakeBackend();
  const { byName, actions } = toolsFor(ALICE, backend);
  const result = (await byName("add_journal_entry")({ text: "Started piano lessons today" })) as {
    status: string;
    actionId: string;
    title: string;
  };
  assert.equal(result.status, "awaiting_review");
  assert.equal(result.title, "Add to your journal");
  assert.equal(backend.entriesOf(ALICE).length, 0, "nothing is saved before approval");

  // The same call again (a retry) returns the same review, not a second one.
  const again = (await byName("add_journal_entry")({ text: "Started piano lessons today" })) as { actionId: string };
  assert.equal(again.actionId, result.actionId);

  const proposal = await db.get<{ hash: string; kind: string; data: { text: string } }>(ALICE, "actions", result.actionId);
  assert.equal(proposal?.kind, "journal.add");
  assert.equal(proposal?.data.text, "Started piano lessons today");
  const done = await actions.decide(ALICE, result.actionId, proposal?.hash ?? "", "approve");
  assert.equal(done.status, "succeeded");
  assert.equal(backend.entriesOf(ALICE).length, 1);
  assert.equal(backend.entriesOf(ALICE)[0]?.text, "Started piano lessons today");
});

test("a denied journal review saves nothing, and other people cannot decide it", async () => {
  const backend = fakeBackend();
  const { byName, actions } = toolsFor(ALICE, backend);
  const result = (await byName("add_journal_entry")({ text: "Something private" })) as { actionId: string };
  const proposal = await db.get<{ hash: string }>(ALICE, "actions", result.actionId);
  await assert.rejects(() => actions.decide(BOB, result.actionId, proposal?.hash ?? "", "approve"), /not found/i);
  const denied = await actions.decide(ALICE, result.actionId, proposal?.hash ?? "", "deny");
  assert.equal(denied.status, "denied");
  assert.equal(backend.entriesOf(ALICE).length, 0);
});

test("tools report 'not set up' and bad input as plain results, never as crashes", async () => {
  const off = new DeboService(null);
  const actions = new ActionService(db, { execute: async () => "", connected: async () => false });
  const tools = deboTools(off, actions, ALICE, { key: (n, v) => `${n}${JSON.stringify(v)}` }) as unknown as Tool[];
  for (const tool of tools) {
    const args = tool.name === "search_my_journal" ? { query: "x" } : tool.name === "ask_my_life" ? { question: "x" } : { text: "x" };
    assert.deepEqual(await tool.execute(args), { error: NOT_SET_UP });
  }
  const { byName } = toolsFor(ALICE, fakeBackend());
  assert.deepEqual(await byName("add_journal_entry")({ text: "   " }), { error: "Write something first." });
  const local = toolsFor("local-user", fakeBackend());
  assert.deepEqual(await local.byName("ask_my_life")({ question: "hi" }), { error: NOT_A_DEBO_ACCOUNT });
});
