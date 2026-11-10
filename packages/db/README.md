# @debo/db

Status: journal entries and keyword search work. Tables: `sources` (journal only for now) and `chunks` (no embeddings yet). Users live in Neon Auth's `neon_auth."user"` table.

The only package allowed to talk to the database. Postgres on Neon, Drizzle ORM, node-postgres driver. See `docs/DATA-MODEL.md`.

## Public functions

Every function that touches a person's data takes their `userId` and filters by it.

| Function | What it does |
|---|---|
| `withDb(connectionString, work)` | Opens one connection, runs `work`, always closes it. |
| `checkDatabase(connectionString)` | Reads the server version. No user data. |
| `createEntry(connectionString, userId, { text })` | Saves a journal entry and splits it into searchable pieces. |
| `listEntries(connectionString, userId, limit?)` | The person's entries, newest first. |
| `deleteEntry(connectionString, userId, sourceId)` | Deletes one entry and its pieces. |
| `searchPieces(connectionString, userId, question, limit?)` | Keyword search (any word may match, ranked by `ts_rank`). |
| `getSources(connectionString, userId, ids)` | Looks up entries by id, only among the person's own. |
| `deleteAccount(connectionString, userId)` | Deletes the Neon Auth user row; sessions, entries and pieces cascade. |

## Migrations

Schema: `src/schema.ts`. Migrations: `migrations/`.

```bash
pnpm --filter @debo/db db:generate   # after changing src/schema.ts
pnpm --filter @debo/db db:migrate    # applies them; reads DATABASE_URL_UNPOOLED from the repo-root .env
```

Read every generated SQL file before applying it. It must never touch the `neon_auth` schema. See `docs/SETUP.md`.

Read [`docs/MONOREPO.md`](../../docs/MONOREPO.md) before adding code here.
