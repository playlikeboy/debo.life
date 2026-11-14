import assert from "node:assert/strict";
import test from "node:test";
import { AuthProblem, jwtExpiry, NeonAuthClient, refreshDelay } from "../src/neon-auth.ts";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };
/** A fake Neon Auth: answers by path, and records what was asked. */
function fake(replies: Record<string, Reply | "offline">) {
  const calls: { path: string; method?: string; auth?: string }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace("/neondb/auth", "");
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({ path, method: init?.method, auth: headers?.Authorization });
    const reply = replies[path];
    if (!reply || reply === "offline") throw new TypeError("Network request failed");
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: reply.headers,
    });
  }) as typeof fetch;
  return { client: new NeonAuthClient("https://auth.test/neondb/auth/", impl), calls };
}
const user = { id: "6f1c2a52-0b1e-4f0e-9a52-1d9b7c0d1111", email: "a@example.com", name: "Ada" };
const jwtWithExp = (exp: number) =>
  `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;

test("a wrong password says the email and password do not match, not a network error", async () => {
  const { client } = fake({
    "/sign-in/email": { status: 401, body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "x" } },
  });
  await assert.rejects(client.signIn("a@example.com", "nope"), (error) => {
    assert.ok(error instanceof AuthProblem);
    assert.equal(error.message, "That email and password don't match. Try again.");
    assert.equal(error.kind, "credentials");
    return true;
  });
});

test("only a real network failure says the service could not be reached", async () => {
  const { client } = fake({ "/sign-in/email": "offline" });
  await assert.rejects(
    client.signIn("a@example.com", "pw"),
    /couldn't reach the sign-in service/,
  );
});

test("an unverified email goes to the code step", async () => {
  const { client } = fake({
    "/sign-in/email": { status: 403, body: { code: "EMAIL_NOT_VERIFIED" } },
  });
  assert.deepEqual(await client.signIn("a@example.com", "pw"), {
    status: "needs-code",
    email: "a@example.com",
  });
});

test("sign-in keeps the session token from the set-auth-token header", async () => {
  const { client } = fake({
    "/sign-in/email": { body: { user }, headers: { "set-auth-token": "session-abc" } },
  });
  const result = await client.signIn(user.email, "pw");
  assert.equal(result.status, "signed-in");
  if (result.status === "signed-in") {
    assert.equal(result.sessionToken, "session-abc");
    assert.equal(result.user.id, user.id);
  }
});

test("sign-up asks for the email code, and a duplicate email is explained", async () => {
  const ok = fake({ "/sign-up/email": { body: { user } } });
  assert.deepEqual(await ok.client.signUp("Ada", user.email, "longpassword"), {
    status: "needs-code",
    email: user.email,
  });
  const dup = fake({ "/sign-up/email": { status: 422, body: { code: "USER_ALREADY_EXISTS" } } });
  await assert.rejects(dup.client.signUp("Ada", user.email, "longpassword"), /already an account/);
});

test("a wrong or expired code is explained in plain words", async () => {
  const { client } = fake({
    "/email-otp/verify-email": { status: 400, body: { code: "INVALID_OTP" } },
  });
  await assert.rejects(client.verifyEmail(user.email, "000000"), /code is wrong or has run out/);
});

test("a confirmed email without a session asks the person to sign in", async () => {
  const { client } = fake({ "/email-otp/verify-email": { body: { status: true } } });
  assert.deepEqual(await client.verifyEmail(user.email, "123456"), {
    status: "confirmed",
    email: user.email,
  });
});

test("too many tries tells the person to wait", async () => {
  const { client } = fake({ "/sign-in/email": { status: 429, body: {} } });
  await assert.rejects(client.signIn(user.email, "pw"), /Wait a minute/);
});

test("a fresh JWT comes from get-session with the stored token as Bearer", async () => {
  const jwt = jwtWithExp(2_000_000_000);
  const { client, calls } = fake({
    "/get-session": { body: { user }, headers: { "set-auth-jwt": jwt } },
  });
  const session = await client.jwtFor("session-abc");
  assert.equal(session?.jwt, jwt);
  assert.equal(session?.expiresAt, 2_000_000_000_000);
  assert.equal(calls[0]?.auth, "Bearer session-abc");
});

test("the JWT falls back to the /token endpoint when the header is missing", async () => {
  const jwt = jwtWithExp(2_000_000_000);
  const { client, calls } = fake({
    "/get-session": { body: { user } },
    "/token": { body: { token: jwt } },
  });
  assert.equal((await client.jwtFor("session-abc"))?.jwt, jwt);
  assert.deepEqual(
    calls.map((c) => c.path),
    ["/get-session", "/token"],
  );
});

test("an ended session returns null so the app signs the person out", async () => {
  assert.equal(await fake({ "/get-session": { body: null } }).client.jwtFor("old"), null);
  assert.equal(await fake({ "/get-session": { status: 401, body: {} } }).client.jwtFor("old"), null);
});

test("sign-out never throws, even offline", async () => {
  const { client } = fake({ "/sign-out": "offline" });
  await client.signOut("session-abc");
});

test("refresh happens 90 seconds before the JWT runs out, and never in a tight loop", () => {
  assert.equal(refreshDelay(1_000_000 + 15 * 60_000, 1_000_000), 15 * 60_000 - 90_000);
  assert.equal(refreshDelay(1_000_000, 1_000_000), 15_000);
  assert.equal(jwtExpiry("not-a-jwt", 5), 5 + 600_000);
});
