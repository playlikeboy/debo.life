// @debo/db: the only package that talks to Postgres.
//
// Driver: node-postgres (`pg`). On Cloudflare the connection string comes from
// Hyperdrive, which pools connections for us, so we open one client per
// request and close it when done. Locally it is DATABASE_URL from `.env`.
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";

export type Db = NodePgDatabase;

/**
 * Open a connection, run `work`, then always close the connection.
 * Never log query text or rows from here: they may hold a person's data.
 */
export async function withDb<T>(connectionString: string, work: (db: Db) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await work(drizzle(client));
  } finally {
    await client.end();
  }
}

/**
 * Delete a person's account for good.
 *
 * Neon Auth keeps users in the `neon_auth` schema of our own database. Its
 * foreign keys cascade from `user`, so this also removes their sessions,
 * sign-in accounts and memberships. When Debo stores entries, sources and
 * memories, delete those rows here too, in the same transaction.
 *
 * Returns whether a row was deleted.
 */
export async function deleteAccount(connectionString: string, userId: string): Promise<boolean> {
  return withDb(connectionString, async (db) =>
    db.transaction(async (tx) => {
      const result = await tx.execute(sql`delete from neon_auth."user" where id = ${userId}`);
      return (result.rowCount ?? 0) > 0;
    }),
  );
}

/** A tiny read that proves the database answers. Returns no user data. */
export async function checkDatabase(connectionString: string): Promise<{ serverVersion: string }> {
  return withDb(connectionString, async (db) => {
    const result = await db.execute<{ server_version: string }>(sql`show server_version`);
    const row = result.rows[0];
    if (!row) throw new Error("The database did not return a version.");
    return { serverVersion: row.server_version };
  });
}
