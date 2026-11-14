import { Hono } from "hono";
import { z } from "zod";
import type { Store } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Files } from "./files.ts";

/** Kinds that hold secrets or session state. They are never part of a person's export. */
const NEVER_EXPORTED = new Set(["credentials", "sessions"]);

/**
 * The person's right to take their data and to remove it. Both act only on the
 * signed-in owner. Deleting the Neon Auth login itself is a separate step: see
 * docs/AUTH.md for everything that lives outside this table.
 */
export function accountRoutes(db: Store, files: Files) {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.get("/export", async (c) => {
    const rows = (await db.listOwner(c.get("owner"))).filter((row) => !NEVER_EXPORTED.has(row.kind));
    c.header("Content-Disposition", 'attachment; filename="debo-data.json"');
    return c.json({ exportedAt: new Date().toISOString(), records: rows });
  });
  app.delete("/", async (c) => {
    const owner = c.get("owner");
    // A body that must say so out loud stops a stray request from wiping an account.
    const body = z
      .object({ confirm: z.literal(true) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success)
      throw new AppError('Send {"confirm": true} to delete all of your Debo data', 400);
    const filesRemoved = await files.removeAll(owner);
    const recordsRemoved = await db.removeOwner(owner);
    return c.json({ ok: true, recordsRemoved, filesRemoved });
  });
  return app;
}
