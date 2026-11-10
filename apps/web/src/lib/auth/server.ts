import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";

// Neon Auth is managed Better Auth: users and sessions live in the `neon_auth`
// schema of our Neon database. We do not run Better Auth ourselves.
//
// Created on first use, not at import, so a build without secrets still works.
let instance: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth() {
  if (instance) return instance;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret) {
    throw new Error("NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set. See docs/SETUP.md.");
  }
  instance = createNeonAuth({ baseUrl, cookies: { secret: cookieSecret } });
  return instance;
}
