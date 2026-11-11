// Driver: node-postgres (`pg`). On Cloudflare the connection string comes from
// Hyperdrive, which pools connections for us, so we open one client per
// request and close it when done. Locally it is DATABASE_URL from `.env`.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";

export type Db = NodePgDatabase & { $client: Client };

/**
 * Open a connection, run `work`, then always close the connection.
 * Never log query text or rows from here: they may hold a person's data.
 */
export async function withDb<T>(connectionString: string, work: (db: Db) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  // A dropped socket must not crash the request as an unhandled error.
  client.on("error", () => {});
  await client.connect();
  try {
    return await work(drizzle(client));
  } finally {
    // Do not wait for the close. On Cloudflare Workers, awaiting `end()`
    // can hang or throw "This socket has been closed" after the work is
    // done; Hyperdrive pools the real connections, so closing late is safe.
    client.end().catch(() => {});
  }
}
