// Self-check for deleteAccount: a person's Mem0 rows go with their account,
// and nobody else's do. Run against a disposable Neon branch only:
//   DATABASE_URL_CHECK=<dev branch url> npx tsx scripts/check-delete-account.ts
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { deleteAccount } from "../src/index";

const url = process.env.DATABASE_URL_CHECK;
if (!url) throw new Error("Set DATABASE_URL_CHECK to a disposable branch.");
if (url === process.env.DATABASE_URL || url === process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("Refusing to run against the main database.");
}

const me = randomUUID();
const other = randomUUID();
const c = new Client({ connectionString: url });
await c.connect();
const count = async (table: string, user: string) =>
  (await c.query(`select count(*)::int n from ${table} where payload->>'user_id' = $1`, [user])).rows[0].n as number;
try {
  await c.query(`insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, 'Check', $2, false, now(), now())`, [me, `check-${me}@example.com`]);
  for (const [table, user] of [["debo_memories", me], ["debo_memories_entities", me], ["debo_memories", other]] as const) {
    await c.query(`insert into ${table} (id, vector, payload) values ($1, array_fill(0, array[1024])::vector, $2)`, [randomUUID(), { user_id: user }]);
  }
  const deleted = await deleteAccount(url, me);
  const results = {
    deleted,
    myMemories: await count("debo_memories", me),
    myEntities: await count("debo_memories_entities", me),
    othersMemories: await count("debo_memories", other),
  };
  console.log(results);
  if (!deleted || results.myMemories !== 0 || results.myEntities !== 0 || results.othersMemories !== 1) {
    throw new Error("deleteAccount check FAILED");
  }
  console.log("deleteAccount check passed");
} finally {
  await c.query(`delete from debo_memories where payload->>'user_id' = $1`, [other]);
  await c.query(`delete from neon_auth."user" where id = $1`, [me]);
  await c.end();
}
