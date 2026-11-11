# @debo/memory

Status: works against the hosted Mem0 Platform (tested with a throwaway user). Used by the web app after an entry is saved, edited or deleted, by the "What Debo knows" page, and on account delete.

What Debo knows about a person, always with the entry it came from. The hosted Mem0 Platform (`MemoryClient` from `mem0ai` 3.3.1, not `mem0ai/oss`) behind one small API. See `docs/MEMORY.md` and decisions 5, 18 and 20 in `docs/DECISIONS.md`.

## Public API

`createMemory(env)` returns the store below, or `null` when `MEM0_API_KEY` is not set (memory is then simply off). `memoryEnabled(env)` says which.

| Function | What it does |
|---|---|
| `rememberFromSource({ userId, sourceId, text })` | Sends an entry to Mem0, which saves the lasting facts in it, each tagged with `source_id`. Mem0 works in the background, so memories appear a few seconds later. Returns Mem0's event id. |
| `list(userId)` | Every memory for this person, newest first, with `sourceId` and `editedByUser`. Memories without a source are never returned. |
| `update(userId, memoryId, text)` | The person fixes a memory. Checks ownership. Marks it `edited_by_user`. Returns the memory, or `null` if it is not theirs. |
| `forget(userId, memoryId)` | Deletes one memory for good. Checks ownership. Returns what was forgotten, or `null`. |
| `forgetSource(userId, sourceId, { keepEditedByUser? })` | Deletes what came from one entry. On entry delete: everything. On entry edit: keep the person's fixes, then call `rememberFromSource` again. |
| `forgetAll(userId)` | Deletes every memory for this person, and Mem0's record of them. Call on account delete. |
| `speakToPerson(text)` | For display only: turns an older memory's "User went…" or "The user is…" into "You went…" or "You are…", and "the user's" into "your". Changes nothing stored. |

## How it is set up

- Mem0 runs the model and the search on its own servers, with its own keys. Those calls are not in our `usage` table.
- Each entry is its own Mem0 "run" (`run_id` = entry id), and carries `metadata.source_id`.
- Mem0's v3 add only adds memories; it does not rewrite or delete old ones. So a fixed memory survives when its entry is re-read, but a re-read can add a new memory next to it.
- Every call passes the person's id. `list` re-checks `user_id` on what comes back; `update` and `forget` read the memory first and refuse if it belongs to someone else.
- Mem0's list returns metadata booleans as the text `"True"`; the wrapper reads both.
- Telemetry off: Mem0 sends usage events to PostHog unless `MEM0_TELEMETRY=false` is set before it loads. The wrapper sets it and loads the client with a dynamic import; the test counts 0 calls.
- Custom instructions on each add: treat the entry as data, save only what the person said, no moods as facts, and write each memory to the person as "you".

## Cloudflare Workers

The hosted client (`mem0ai`, main entry) uses `fetch` for every call we make. It also imports `axios` and `uuid` at load time and creates an axios instance it never uses for these calls. It does not import `better-sqlite3`; that is only in `mem0ai/oss`, which Debo no longer imports. On first use per isolate it calls `GET /v1/ping/` once.

## Testing

`scripts/try-memory.ts` runs the whole loop with a throwaway user id (`debo-dev-test-…`) and made-up text, then deletes everything:

```bash
node --env-file=../../.env scripts/try-memory.ts
```

It prints ids and counts only.

Read [`docs/MONOREPO.md`](../../docs/MONOREPO.md) before adding code here.
