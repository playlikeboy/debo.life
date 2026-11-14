import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { TokenVerifier } from "livekit-server-sdk";
import { createApp } from "../apps/server/src/app.ts";
import type { Config } from "../apps/server/src/config.ts";
import { createStore, type Store } from "../apps/server/src/db.ts";
import type {
  VoiceBrain,
  VoiceBrainEvent,
  VoiceQuestion,
} from "../apps/server/src/voice/brain.ts";

const SECRET = "agent-secret-that-is-at-least-32-characters-long";
const LIVEKIT = {
  LIVEKIT_URL: "wss://debo-test.livekit.example",
  LIVEKIT_API_KEY: "APItestkey",
  LIVEKIT_API_SECRET: "livekit-api-secret-that-is-long-enough-for-hs256",
  VOICE_AGENT_SECRET: SECRET,
};

let env: Record<string, string | undefined> = LIVEKIT;
const asked: VoiceQuestion[] = [];
const stub: VoiceBrain = {
  async *answer(question): AsyncGenerator<VoiceBrainEvent> {
    asked.push(question);
    yield { type: "sources", sources: [{ id: "e1", label: "Journal, 11 November" }] };
    yield { type: "text", delta: "You went " };
    yield { type: "text", delta: "walking." };
    yield { type: "done", status: "answered" };
  },
};

let db: Store;
let directory: string;
let app: Awaited<ReturnType<typeof createApp>>["app"];
let token: string;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "debo-voice-"));
  db = await createStore();
  const config: Config = {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: directory,
    agentBackend: "sample",
    googleRedirectUri: "http://localhost:8787/api/google/callback",
    allowedOrigins: ["http://localhost:8081"],
  };
  ({ app } = await createApp(db, config, { voiceBrain: stub, voiceEnv: () => env }));
  const session = await app.request("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  token = (await session.json()).token;
});
after(async () => {
  await db.close();
  await rm(directory, { recursive: true, force: true });
});

const json = { "Content-Type": "application/json" };
const owner = () => ({ ...json, Authorization: `Bearer ${token}` });
const agent = (secret = SECRET) => ({ ...json, Authorization: `Bearer ${secret}` });
const question = { userId: "local-user", sessionId: "s1", question: "What did I do?", history: [] };
const ask = (headers: Record<string, string>, body: unknown = question) =>
  app.request("/api/voice/brain", { method: "POST", headers, body: JSON.stringify(body) });

test("token route needs a signed-in owner", async () => {
  const none = await app.request("/api/voice/token", { method: "POST" });
  assert.equal(none.status, 401);
  const wrong = await app.request("/api/voice/token", {
    method: "POST",
    headers: { Authorization: "Bearer not-a-session" },
  });
  assert.equal(wrong.status, 401);
  // The voice secret is not a session either.
  const secret = await app.request("/api/voice/token", { method: "POST", headers: agent() });
  assert.equal(secret.status, 401);
});

test("token identity is the signed-in owner, never what the app sends", async () => {
  const response = await app.request("/api/voice/token", {
    method: "POST",
    headers: owner(),
    body: JSON.stringify({ identity: "someone-else", userId: "someone-else", room: "other" }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { url: string; room: string; token: string };
  assert.equal(body.url, LIVEKIT.LIVEKIT_URL);
  const claims = await new TokenVerifier(LIVEKIT.LIVEKIT_API_KEY, LIVEKIT.LIVEKIT_API_SECRET).verify(
    body.token,
  );
  assert.equal(claims.sub, "local-user");
  assert.equal(claims.video?.room, body.room);
  assert.notEqual(body.room, "other");
});

test("token grants only its own room, for ten minutes, and dispatches the voice agent", async () => {
  const mint = async () =>
    (await (await app.request("/api/voice/token", { method: "POST", headers: owner() })).json()) as {
      room: string;
      token: string;
    };
  const [a, b] = [await mint(), await mint()];
  assert.notEqual(a.room, b.room);
  const verifier = new TokenVerifier(LIVEKIT.LIVEKIT_API_KEY, LIVEKIT.LIVEKIT_API_SECRET);
  const claims = await verifier.verify(a.token);
  assert.equal(claims.video?.room, a.room);
  assert.equal(claims.video?.roomJoin, true);
  assert.equal(claims.video?.roomAdmin, undefined);
  assert.equal(claims.video?.roomCreate, undefined);
  assert.equal(claims.video?.roomList, undefined);
  assert.equal(claims.roomConfig?.agents?.[0]?.agentName, "debo-voice");
  const [header, payload] = a.token.split(".");
  assert.ok(header && payload);
  const { exp, nbf } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    exp: number;
    nbf: number;
  };
  assert.equal(exp - nbf, 600);
  // The API secret never leaves the server.
  assert.ok(!JSON.stringify(a).includes(LIVEKIT.LIVEKIT_API_SECRET));
});

test("token route says 503 in plain words when voice is not set up", async () => {
  const original = env;
  try {
    for (const missing of Object.keys(LIVEKIT)) {
      env = { ...LIVEKIT, [missing]: undefined };
      const response = await app.request("/api/voice/token", { method: "POST", headers: owner() });
      assert.equal(response.status, 503, missing);
      assert.equal((await response.json()).error, "Talking to Debo is not set up yet.");
    }
    env = { ...LIVEKIT, VOICE_AGENT_SECRET: "too-short" };
    assert.equal(
      (await app.request("/api/voice/token", { method: "POST", headers: owner() })).status,
      503,
    );
  } finally {
    env = original;
  }
});

test("brain route rejects a missing or wrong secret", async () => {
  asked.length = 0;
  assert.equal((await ask(json)).status, 401);
  assert.equal((await ask(agent("wrong-secret-wrong-secret-wrong-secret"))).status, 401);
  assert.equal((await ask(agent(`${SECRET}x`))).status, 401);
  assert.equal((await ask(agent(SECRET.slice(0, -1)))).status, 401);
  assert.equal((await ask({ ...json, Authorization: SECRET })).status, 401);
  // A signed-in owner session is not the voice agent.
  assert.equal((await ask(owner())).status, 401);
  assert.equal(asked.length, 0);
});

test("brain route rejects a bad body", async () => {
  const bad: unknown[] = [
    null,
    {},
    { ...question, question: "" },
    { ...question, question: "x".repeat(501) },
    { ...question, userId: "" },
    { ...question, sessionId: undefined },
    { ...question, history: [{ role: "system", text: "hi" }] },
    { ...question, history: Array.from({ length: 13 }, () => ({ role: "user", text: "hi" })) },
  ];
  for (const body of bad) assert.equal((await ask(agent(), body)).status, 400, JSON.stringify(body));
  const notJson = await app.request("/api/voice/brain", {
    method: "POST",
    headers: agent(),
    body: "{nope",
  });
  assert.equal(notJson.status, 400);
});

test("brain route streams events in order as one JSON object per line", async () => {
  asked.length = 0;
  const response = await ask(agent(), {
    ...question,
    history: [
      { role: "user", text: "Hi" },
      { role: "assistant", text: "Hello!" },
    ],
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/x-ndjson/);
  const lines = (await response.text()).trim().split("\n");
  const events = lines.map((line) => JSON.parse(line));
  assert.deepEqual(
    events.map((e) => e.type),
    ["sources", "text", "text", "done"],
  );
  assert.deepEqual(events[0].sources, [{ id: "e1", label: "Journal, 11 November" }]);
  assert.equal(events[1].delta + events[2].delta, "You went walking.");
  assert.equal(events[3].status, "answered");
  assert.equal(asked[0]?.userId, "local-user");
  assert.equal(asked[0]?.history.length, 2);
});

test("brain route turns a crashing brain into a spoken apology and a done event", async () => {
  const crash: VoiceBrain = {
    // biome-ignore lint/correctness/useYield: it fails before it can say anything
    async *answer() {
      throw new Error("private words that must not be logged");
    },
  };
  const { app: other } = await createApp(db, {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: directory,
    agentBackend: "sample",
    googleRedirectUri: "http://localhost:8787/api/google/callback",
    allowedOrigins: [],
  }, { voiceBrain: crash, voiceEnv: () => env });
  const response = await other.request("/api/voice/brain", {
    method: "POST",
    headers: agent(),
    body: JSON.stringify(question),
  });
  const events = (await response.text()).trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(events.map((e) => e.type), ["say", "done"]);
  assert.equal(events[1].status, "error");
});

test("brain route says 503 when voice is not set up", async () => {
  const original = env;
  try {
    env = {};
    assert.equal((await ask(agent())).status, 503);
  } finally {
    env = original;
  }
});

test("the default brain answers through Debo's conversation engine", async () => {
  const { app: plain } = await createApp(db, {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: directory,
    agentBackend: "sample",
    googleRedirectUri: "http://localhost:8787/api/google/callback",
    allowedOrigins: [],
  }, { voiceEnv: () => env });
  const response = await plain.request("/api/voice/brain", {
    method: "POST",
    headers: agent(),
    body: JSON.stringify({ ...question, question: "Show my calendar" }),
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(events.at(-1).type, "done");
  assert.equal(events.at(-1).status, "answered");
  assert.match(events.filter((e) => e.type === "text").map((e) => e.delta).join(""), /calendar/i);
});
