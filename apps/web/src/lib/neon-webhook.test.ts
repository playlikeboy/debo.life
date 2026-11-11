import { expect, test } from "vitest";
import { verifyNeonWebhook } from "./neon-webhook";

// Signs a body the way Neon Auth does (detached JWS, Ed25519) with a key we
// make here, then checks verifyNeonWebhook accepts it and rejects tampering.

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

async function signedDelivery(body: string, timestamp: number, kid = "test-key") {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid };
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "EdDSA", kid })));
  const payload = b64url(new TextEncoder().encode(`${timestamp}.${b64url(new TextEncoder().encode(body))}`));
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", pair.privateKey, new TextEncoder().encode(`${header}.${payload}`)));
  const headers = new Headers({
    "x-neon-signature": `${header}..${b64url(sig)}`,
    "x-neon-signature-kid": kid,
    "x-neon-timestamp": String(timestamp),
  });
  const fetchFn = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as typeof fetch;
  return { headers, fetchFn };
}

const body = JSON.stringify({ event_type: "send.otp", user: { email: "a@example.com" } });

test("accepts a fresh, correctly signed delivery", async () => {
  const now = Date.now();
  const { headers, fetchFn } = await signedDelivery(body, now);
  await expect(verifyNeonWebhook(body, headers, "https://jwks.test/1", { now, fetchFn })).resolves.toMatchObject({
    event_type: "send.otp",
  });
});

test("rejects a changed body", async () => {
  const now = Date.now();
  const { headers, fetchFn } = await signedDelivery(body, now);
  await expect(verifyNeonWebhook(body.replace("a@", "b@"), headers, "https://jwks.test/2", { now, fetchFn })).rejects.toThrow(
    "Invalid webhook signature",
  );
});

test("rejects an old delivery", async () => {
  const sentAt = Date.now() - 10 * 60 * 1000;
  const { headers, fetchFn } = await signedDelivery(body, sentAt);
  await expect(verifyNeonWebhook(body, headers, "https://jwks.test/3", { fetchFn })).rejects.toThrow("out of range");
});

test("rejects a key Neon does not publish", async () => {
  const now = Date.now();
  const { headers } = await signedDelivery(body, now, "real-key");
  const { fetchFn: otherKeys } = await signedDelivery(body, now, "other-key");
  await expect(verifyNeonWebhook(body, headers, "https://jwks.test/4", { now, fetchFn: otherKeys })).rejects.toThrow(
    "Unknown signing key",
  );
});

test("rejects missing headers", async () => {
  await expect(verifyNeonWebhook(body, new Headers(), "https://jwks.test/5")).rejects.toThrow("Missing Neon webhook headers");
});
