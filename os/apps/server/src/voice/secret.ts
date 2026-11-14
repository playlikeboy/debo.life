import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Check the shared secret the voice agent sends as `Authorization: Bearer ...`.
 * Both sides are hashed first, so the comparison always takes the same time
 * and does not show how much of a guess was right.
 */
export function isVoiceAgent(header: string | undefined, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(secret));
}
