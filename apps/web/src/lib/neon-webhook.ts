// Checks that a webhook really comes from Neon Auth (docs:
// https://neon.com/docs/auth/guides/webhooks). Neon signs each delivery with an
// Ed25519 key from the branch's JWKS, as a detached JWS over
// `${timestamp}.${base64url(body)}`. Uses WebCrypto so it runs on Cloudflare
// Workers and in Node alike.

type Jwk = JsonWebKey & { kid?: string };

const MAX_AGE_MS = 5 * 60 * 1000;
let cachedKeys: { url: string; keys: Jwk[]; at: number } | null = null;

async function jwks(url: string, fetchFn: typeof fetch): Promise<Jwk[]> {
  if (cachedKeys && cachedKeys.url === url && Date.now() - cachedKeys.at < 10 * 60 * 1000) return cachedKeys.keys;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`JWKS fetch failed (${response.status})`);
  const { keys } = (await response.json()) as { keys: Jwk[] };
  cachedKeys = { url, keys, at: Date.now() };
  return keys;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Returns the parsed body if the signature is valid and fresh; throws otherwise.
 * `now` and `fetchFn` are injectable for the self-check in neon-webhook.test.ts.
 */
export async function verifyNeonWebhook(
  rawBody: string,
  headers: Headers,
  jwksUrl: string,
  { now = Date.now(), fetchFn = fetch }: { now?: number; fetchFn?: typeof fetch } = {},
): Promise<unknown> {
  const signature = headers.get("x-neon-signature");
  const kid = headers.get("x-neon-signature-kid");
  const timestamp = headers.get("x-neon-timestamp");
  if (!signature || !kid || !timestamp) throw new Error("Missing Neon webhook headers");

  const age = now - Number.parseInt(timestamp, 10);
  if (!Number.isFinite(age) || age > MAX_AGE_MS || age < -MAX_AGE_MS) throw new Error("Webhook timestamp out of range");

  const [headerB64, emptyPayload, signatureB64] = signature.split(".");
  if (!headerB64 || emptyPayload !== "" || !signatureB64) throw new Error("Expected a detached JWS");

  let jwk = (await jwks(jwksUrl, fetchFn)).find((k) => k.kid === kid);
  if (!jwk) {
    cachedKeys = null; // the key may have rotated: fetch once more
    jwk = (await jwks(jwksUrl, fetchFn)).find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error("Unknown signing key");

  const encoder = new TextEncoder();
  const payloadB64 = b64url(encoder.encode(rawBody));
  const signingInput = `${headerB64}.${b64url(encoder.encode(`${timestamp}.${payloadB64}`))}`;
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, { name: "Ed25519" }, false, [
    "verify",
  ]);
  const valid = await crypto.subtle.verify("Ed25519", key, fromB64url(signatureB64), encoder.encode(signingInput));
  if (!valid) throw new Error("Invalid webhook signature");
  return JSON.parse(rawBody);
}
