import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Where to reach Postgres.
 * On Cloudflare: the Hyperdrive binding, which pools connections near the Worker.
 * Locally (`next dev`): DATABASE_URL from the repo-root `.env`.
 */
export function databaseUrl(): string {
  try {
    const { env } = getCloudflareContext();
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
    if (hyperdrive) return hyperdrive.connectionString;
  } catch {
    // Not running inside a Cloudflare Worker.
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `neon env pull` in the repo root.");
  return url;
}

/** Server-side environment for packages that validate their own settings. */
export function serverEnv(): Record<string, string | undefined> {
  return process.env;
}
