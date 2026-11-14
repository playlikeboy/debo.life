import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import { createApp } from "../apps/server/src/app.ts";
import { type Config, resolveAuth } from "../apps/server/src/config.ts";
import { createStore, type Store } from "../apps/server/src/db.ts";
import { createSamplePdf } from "../packages/integrations/src/pdf.ts";

// A throwaway keypair stands in for Neon Auth. The server only ever sees the
// public half, through a local key set, exactly as it would from NEON_AUTH_JWKS_URL.
const ORIGIN = "https://auth.example.test";
const ALICE = "6f1c2a52-0b1e-4f0e-9a52-1d9b7c0d1111";
const BOB = "0a9d8e3f-7c2b-4c5a-8f6d-2b1e3c4d2222";

let directory: string, db: Store, server: Awaited<ReturnType<typeof createApp>>;
let privateKey: CryptoKey;
let otherKey: CryptoKey;

async function jwt(
  sub: string,
  claims: { key?: CryptoKey; iss?: string; aud?: string; exp?: string | number } = {},
) {
  return new SignJWT({ id: sub })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setSubject(sub)
    .setIssuer(claims.iss ?? ORIGIN)
    .setAudience(claims.aud ?? ORIGIN)
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? "15m")
    .sign(claims.key ?? privateKey);
}
const call = (token: string | undefined, path: string, init: RequestInit = {}) =>
  server.app.request(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });

before(async () => {
  const pair = await generateKeyPair("EdDSA", { extractable: true });
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("EdDSA")).privateKey;
  const publicJwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "EdDSA" };
  directory = await mkdtemp(join(tmpdir(), "debo-neon-auth-"));
  db = await createStore({ dataDir: join(directory, "db"), schema: "os" });
  const config: Config = {
    mode: "sample",
    port: 8787,
    host: "127.0.0.1",
    publicUrl: "http://localhost:8787",
    dataDir: directory,
    agentBackend: "sample",
    googleRedirectUri: "http://localhost:8787/api/google/callback",
    allowedOrigins: [],
    authMode: "neon",
    neonAuthBaseUrl: `${ORIGIN}/neondb/auth`,
    neonAuthJwksUrl: `${ORIGIN}/neondb/auth/.well-known/jwks.json`,
    dbSchema: "os",
  };
  server = await createApp(db, config, { jwks: createLocalJWKSet({ keys: [publicJwk] }) });
});
after(async () => {
  await db.close();
  await rm(directory, { recursive: true, force: true });
});

describe("Neon sign-in", () => {
  test("a valid token opens the workspace as that user", async () => {
    const response = await call(await jwt(ALICE), "/api/workspace");
    assert.equal(response.status, 200);
  });
  test("no token, a garbled token and a shared access key are all refused", async () => {
    assert.equal((await call(undefined, "/api/workspace")).status, 401);
    assert.equal((await call("not-a-jwt", "/api/workspace")).status, 401);
    assert.equal((await call("local-access-key-value-0000000000", "/api/workspace")).status, 401);
  });
  test("an expired token says the session ran out", async () => {
    const expired = await jwt(ALICE, { exp: Math.floor(Date.now() / 1000) - 600 });
    const response = await call(expired, "/api/workspace");
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "Session expired. Sign in again.");
  });
  test("a token signed by a different key is refused", async () => {
    assert.equal((await call(await jwt(ALICE, { key: otherKey }), "/api/workspace")).status, 401);
  });
  test("a token from another issuer or for another audience is refused", async () => {
    const wrongIssuer = await jwt(ALICE, { iss: "https://evil.example.test" });
    const wrongAudience = await jwt(ALICE, { aud: "https://evil.example.test" });
    assert.equal((await call(wrongIssuer, "/api/workspace")).status, 401);
    assert.equal((await call(wrongAudience, "/api/workspace")).status, 401);
  });
  test("an unsigned token (alg none) is refused", async () => {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${part({ alg: "none" })}.${part({ sub: ALICE, iss: ORIGIN, aud: ORIGIN, exp: 9999999999 })}.`;
    assert.equal((await call(unsigned, "/api/workspace")).status, 401);
  });
  test("a subject that is not a user id cannot claim a reserved owner", async () => {
    assert.equal((await call(await jwt("system"), "/api/workspace")).status, 401);
    assert.equal((await call(await jwt("local-user"), "/api/workspace")).status, 401);
  });
  test("the shared-key sign-in endpoint is closed", async () => {
    const response = await call(undefined, "/api/session", {
      method: "POST",
      body: JSON.stringify({ accessKey: "anything" }),
    });
    assert.equal(response.status, 400);
  });
  test("health tells the app to show the email sign-in", async () => {
    const health = await (await call(undefined, "/api/health")).json();
    assert.deepEqual(health.auth, { mode: "neon", neonAuthUrl: `${ORIGIN}/neondb/auth` });
  });
});

describe("Owner isolation", () => {
  test("one person's drafts are invisible to another", async () => {
    const alice = await jwt(ALICE);
    const bob = await jwt(BOB);
    const draft = { to: ["a@example.com"], cc: [], subject: "Private to Alice", body: "Hello" };
    const created = await call(alice, "/api/drafts", { method: "POST", body: JSON.stringify(draft) });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const aliceList = await (await call(alice, "/api/drafts")).json();
    assert.equal(aliceList.length, 1);
    assert.deepEqual(await (await call(bob, "/api/drafts")).json(), []);
    // Bob cannot update Alice's draft by guessing its id.
    const hijack = await call(bob, "/api/drafts", {
      method: "POST",
      body: JSON.stringify({ ...draft, id, subject: "Bob was here" }),
    });
    assert.equal(hijack.status, 404);
    assert.equal(
      (await db.get<{ subject: string }>(ALICE, "drafts", id))?.subject,
      "Private to Alice",
    );
  });
  test("a file is readable only by its owner, and its link only for that owner", async () => {
    const alice = await jwt(ALICE);
    const bob = await jwt(BOB);
    const form = new FormData();
    form.set("file", new File([Buffer.from(await createSamplePdf())], "alice.pdf", { type: "application/pdf" }));
    const upload = await server.app.request("/api/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${alice}` },
      body: form,
    });
    assert.equal(upload.status, 201);
    const file = await upload.json();
    assert.equal((await call(alice, `/api/files/${file.id}/content`)).status, 200);
    assert.equal((await call(bob, `/api/files/${file.id}/content`)).status, 404);
    // The signed link carries Alice's id. Changing the owner in it breaks the signature.
    const link = new URL(file.url);
    assert.equal((await server.app.request(link.pathname + link.search)).status, 200);
    link.searchParams.set("owner", BOB);
    assert.equal((await server.app.request(link.pathname + link.search)).status, 403);
  });
  test("every row is stored under the user's own id", async () => {
    await db.put(BOB, "notes", { id: "bob-note" });
    const bobRows = await db.listOwner(BOB);
    assert.ok(bobRows.length > 0);
    const aliceKinds = new Set((await db.listOwner(ALICE)).map((row) => `${row.kind}/${row.id}`));
    // Nothing of Alice's draft leaks into Bob's rows.
    assert.ok(aliceKinds.has(`drafts/${(await db.list<{ id: string }>(ALICE, "drafts"))[0]?.id}`));
    assert.equal(bobRows.some((row) => row.kind === "drafts"), false);
  });
});

describe("Account export and deletion", () => {
  before(async () => {
    await db.put(BOB, "notes", { id: "bob-note-2" });
  });
  test("delete needs a clear yes", async () => {
    const response = await call(await jwt(BOB), "/api/account", { method: "DELETE" });
    assert.equal(response.status, 400);
    assert.ok((await db.listOwner(BOB)).length > 0);
  });
  test("export lists the person's rows and leaves out credentials", async () => {
    await db.put(BOB, "credentials", { id: "google", secret: "do-not-export" });
    const response = await call(await jwt(BOB), "/api/account/export");
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text.includes("do-not-export"), false);
    const body = JSON.parse(text);
    assert.ok(body.records.length > 0);
    assert.equal(body.records.some((r: { kind: string }) => r.kind === "credentials"), false);
  });
  test("delete wipes the caller's rows and no one else's", async () => {
    const aliceBefore = (await db.listOwner(ALICE)).length;
    assert.ok(aliceBefore > 0);
    const response = await call(await jwt(BOB), "/api/account", {
      method: "DELETE",
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).recordsRemoved > 0);
    assert.deepEqual(await db.listOwner(BOB), []);
    assert.equal((await db.listOwner(ALICE)).length, aliceBefore);
  });
  test("delete also removes the stored PDF bytes", async () => {
    const carol = "5b7e1d20-3c4f-4a6b-8d9e-3a2b1c0d3333";
    const token = await jwt(carol);
    const form = new FormData();
    form.set("file", new File([Buffer.from(await createSamplePdf())], "carol.pdf", { type: "application/pdf" }));
    const upload = await server.app.request("/api/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const file = await upload.json();
    await call(token, "/api/account", { method: "DELETE", body: JSON.stringify({ confirm: true }) });
    assert.equal(await db.get(carol, "files", file.id), null);
    const { access } = await import("node:fs/promises");
    await assert.rejects(access(join(directory, "files", `${file.id}.pdf`)));
  });
});

describe("Shared database layout", () => {
  test("the records table lives in schema os, not in public", async () => {
    const tables = await createStore({ dataDir: join(directory, "layout"), schema: "os" });
    await tables.put(ALICE, "notes", { id: "n1" });
    assert.deepEqual(await tables.get(ALICE, "notes", "n1"), { id: "n1" });
    await tables.close();
    const raw = new PGlite(join(directory, "layout"));
    const found = await raw.query<{ table_schema: string }>(
      "SELECT table_schema FROM information_schema.tables WHERE table_name='records'",
    );
    await raw.close();
    assert.deepEqual(found.rows, [{ table_schema: "os" }]);
  });
  test("a bad schema name is refused before any SQL runs", async () => {
    await assert.rejects(createStore({ schema: "os; DROP TABLE x" }), /schema/i);
  });
});

describe("Sign-in mode settings", () => {
  const env = {
    NEON_AUTH_BASE_URL: `${ORIGIN}/neondb/auth/`,
    NEON_AUTH_JWKS_URL: `${ORIGIN}/neondb/auth/.well-known/jwks.json`,
  };
  test("sample mode keeps the access key by default", () => {
    assert.equal(resolveAuth("sample", {}).authMode, "access-key");
    assert.equal(resolveAuth("sample", env).authMode, "access-key");
  });
  test("live mode with a key set requires Neon sign-in and the os schema", () => {
    const auth = resolveAuth("live", env);
    assert.equal(auth.authMode, "neon");
    assert.equal(auth.dbSchema, "os");
    assert.equal(auth.neonAuthBaseUrl, `${ORIGIN}/neondb/auth`);
    assert.throws(() => resolveAuth("live", { ...env, AUTH_MODE: "access-key" }), /Neon Auth/);
  });
  test("neon mode needs a base URL, and the key set defaults from it", () => {
    assert.throws(() => resolveAuth("sample", { AUTH_MODE: "neon" }), /NEON_AUTH_BASE_URL/);
    const auth = resolveAuth("sample", { AUTH_MODE: "neon", NEON_AUTH_BASE_URL: ORIGIN });
    assert.equal(auth.neonAuthJwksUrl, `${ORIGIN}/.well-known/jwks.json`);
  });
  test("unknown modes and schema names are rejected", () => {
    assert.throws(() => resolveAuth("sample", { AUTH_MODE: "magic" }), /AUTH_MODE/);
    assert.throws(() => resolveAuth("sample", { OS_DB_SCHEMA: "Bad-Name" }), /OS_DB_SCHEMA/);
  });
});
