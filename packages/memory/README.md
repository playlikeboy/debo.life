# @debo/memory

Status: works in Node (tested on a Neon test branch). Not wired into the app yet. **Does not run inside a Cloudflare Worker as-is** (see below).

What Debo knows about a person, always with the entry it came from. Mem0 (open-source, self-hosted, `mem0ai/oss` 3.3.1) behind one small API. See `docs/MEMORY.md` and decision 5 in `docs/DECISIONS.md`.

## Public API

`createMemory(connectionString, env)` returns:

| Function | What it does |
|---|---|
| `rememberFromSource({ userId, sourceId, text })` | Reads an entry and saves the lasting facts in it, each tagged with `source_id`. Returns memory ids. |
| `list(userId)` | Every memory for this person, with `sourceId` and `editedByUser`. Memories without a source are never returned. |
| `update(userId, memoryId, text)` | The person fixes a memory. Checks ownership. Marks it `edited_by_user`. |
| `forget(userId, memoryId)` | Deletes one memory for good. Checks ownership. |
| `forgetSource(userId, sourceId, { keepEditedByUser? })` | Deletes what came from one entry. On entry delete: everything. On entry edit: keep the person's fixes, then call `rememberFromSource` again. |
| `forgetAll(userId)` | Deletes everything about this person. Call on account delete. |

`env` needs `ANTHROPIC_API_KEY`, `NEON_AI_GATEWAY_BASE_URL` and `NEON_AI_GATEWAY_TOKEN`.

## How it is set up

- Model: Anthropic `claude-haiku-5-5` (our key). Mem0 always sends `temperature`, which this model rejects, so the wrapper clears it on each instance.
- Embeddings: Neon AI Gateway, `qwen3-embedding-0-6b`, 1024 dimensions, through Mem0's OpenAI-compatible embedder.
- Store: pgvector in our own Postgres. Mem0 creates `debo_memories`, `debo_memories_entities` and `memory_migrations` in the `public` schema by itself (not through Drizzle).
- Each entry is its own Mem0 "run", so Mem0's merge step can only change memories from the same entry.
- No history store (Mem0's default is a SQLite file on disk).
- Telemetry off: Mem0 sends usage events to PostHog unless `MEM0_TELEMETRY=false` is set before it loads. The wrapper sets it; the test counts 0 calls.
- One Mem0 instance per call; its database connections are closed afterwards.

## Cloudflare Workers

Mem0's build imports `better-sqlite3` (a native addon), `fs`, `os` and `path` at the top level, even though we use neither SQLite nor disk. Native addons cannot load in a Worker. Options: run memory work in a Node runtime (for example a Neon Function or a background worker), or alias `better-sqlite3` to an empty stub in the Worker build and test it there. Mem0 also tries to read and write `~/.mem0/config.json` for notices; those calls are wrapped in try/catch.

## Testing

`scripts/try-memory.ts` runs the whole loop against a **test** branch, never production:

```bash
DEBO_TEST_DATABASE_URL="$(neon connection-string dev-ai)" node scripts/try-memory.ts
```

(with `ANTHROPIC_API_KEY` and the `NEON_AI_GATEWAY_*` values in the environment). It prints ids and counts only.

Read [`docs/MONOREPO.md`](../../docs/MONOREPO.md) before adding code here.
