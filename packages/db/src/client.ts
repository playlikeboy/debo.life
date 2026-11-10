// Driver: node-postgres (`pg`). On Cloudflare the connection string comes from
// Hyperdrive, which pools connections for us, so we open one client per
// request and close it when done. Locally it is DATABASE_URL from `.env`.
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
