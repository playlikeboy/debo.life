# Data model

Status: `sources`, `chunks`, `usage` and `activity` exist (journal entries only, and `chunks` has no `embedding` column yet; see decision 17). Users live in Neon Auth's `neon_auth."user"` table. Everything else here is a plan. The schema code is `packages/db/src/schema.ts`. Change it when real code shows a better one, and update this file in the same change.

Database: Postgres with the `pgvector` extension. ORM: Drizzle.

## Rules for every table

- Every table that holds a person's data has a `user_id` column and an index on it.
- Every query filters by `user_id`. Put this in the query helpers so callers cannot forget.
- Deleting a user deletes every row and every file that belongs to them. Every `user_id` has a foreign key to `neon_auth."user"(id)` with `on delete cascade`. Files in Neon Object Storage are removed by the account-delete route (`/api/account/delete`) before the user row goes.
- Timestamps are `timestamptz` in UTC.
- Ids are UUIDs.

## Tables

### users
Created and managed by Better Auth. Add only: `display_name`, `timezone`, `plan`, `created_at`.

### sources
One row per thing the person gave Debo. The original of every memory.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| kind | text | `journal`, `voice`, `document`, `photo`, `connector` |
| title | text | Short name shown on source chips |
| text | text | Full text: the entry, the transcript, the parsed document, the photo description |
| file_key | text | Path in file storage (Neon Object Storage) for the original file, if any |
| happened_at | timestamptz | When the thing happened, as best known |
| status | text | `waiting`, `ready`, `failed` |
| fail_reason | text | Plain words the person can read |
| connection_id | uuid | Set when it came from a connected app |
| created_at | timestamptz | |

### chunks
Pieces of a source, for search.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| source_id | uuid | |
| position | int | Order inside the source |
| text | text | |
| embedding | vector | Size depends on the embedding model chosen |
| search | tsvector | For keyword search |

Indexes: a vector index on `embedding`, a GIN index on `search`.

### memories
One lasting fact Debo knows. Shown on the "What Debo knows" page.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| text | text | One plain sentence |
| source_id | uuid | Where Debo learned it. Never null. |
| true_from | timestamptz | When it started being true, if known |
| true_until | timestamptz | Set when a newer memory replaces it |
| edited_by_user | boolean | True if the person fixed it. Never overwrite these automatically. |
| embedding | vector | |
| created_at | timestamptz | |

If Mem0 stores memories itself, this table mirrors what the person sees and stays the record for source links and edits. Decide in phase 2 and note it in `DECISIONS.md`.

### people
People the person mentions.

| Column | Type |
|---|---|
| id, user_id | uuid |
| name | text |
| also_called | text[] |
| note | text |

Plus `memory_people (memory_id, person_id)`.

### conversations and messages
Chat history. Each assistant message stores `source_ids uuid[]`, the sources it used.

### connections
One row per connected app.

| Column | Type | Notes |
|---|---|---|
| id, user_id | uuid | |
| app | text | `google_calendar`, `notion`, ... |
| provider_ref | text | The connector provider's id for this connection. We do not store the app's tokens ourselves in phase 4. |
| can_read | text[] | What the person allowed |
| status | text | `active`, `paused`, `removed` |
| last_synced_at | timestamptz | |

### user_keys
A person's own AI keys.

| Column | Type | Notes |
|---|---|---|
| id, user_id | uuid | |
| provider | text | |
| encrypted_key | bytea | Never the plain key |
| last_four | text | For display: "ends in a1b2" |
| created_at | timestamptz | |

See [`BYOK-AND-PLANS.md`](./BYOK-AND-PLANS.md).

### usage
One row per model call or voice minute, for limits and billing.

| Column | Type | Notes |
|---|---|---|
| id, user_id | uuid | |
| kind | text | `chat`, `ingest`, `voice`, `embedding` |
| key_owner | text | `user` or `debo` |
| units | numeric | Tokens or seconds |
| created_at | timestamptz | |

Never store the prompt or answer here.

### activity
The record the person can read: what Debo read and did.

| Column | Type | Notes |
|---|---|---|
| id, user_id | uuid | |
| actor | text | `debo`, `voice`, `connector:<app>`, `mcp:<token name>` |
| action | text | `read`, `saved`, `forgot`, `connected`, `asked` |
| source_ids | uuid[] | What was touched |
| created_at | timestamptz | |

### access_tokens
Tokens a person makes for other AI tools.

| Column | Type | Notes |
|---|---|---|
| id, user_id | uuid | |
| name | text | "My laptop assistant" |
| token_hash | text | Only the hash is stored |
| can_read | text[] | |
| last_used_at, revoked_at | timestamptz | |
