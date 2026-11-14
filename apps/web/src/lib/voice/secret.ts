import "server-only";

/**
 * Check the shared secret the voice agent sends to /api/voice/brain.
 * Compares SHA-256 digests in constant time so the check does not leak
 * how much of a guess was right.
 */
export async function isVoiceAgent(header: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const given = header.slice("Bearer ".length);
  const [a, b] = await Promise.all([digest(given), digest(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
