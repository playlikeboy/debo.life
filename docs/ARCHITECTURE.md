# Architecture

Status: plan. Only the landing page is built.

## The picture

```
                    Person (browser or phone)
                               |
              +----------------+----------------+
              |                                 |
        apps/web (Next.js)               LiveKit room
   pages, chat, API routes, auth          (live audio)
              |                                 |
              |                        apps/voice-agent
              |                        (LiveKit Agents worker)
              |                                 |
              +----------------+----------------+
                               |
        +----------+-----------+-----------+-------------+
        |          |           |           |             |
   @debo/memory  @debo/llm  @debo/ingest  @debo/connectors
        |          |           |           |             |
        +----------+-----+-----+           |        Connector
                         |                 |        provider
                     @debo/db          Inngest
                         |           (background jobs)
              Postgres + pgvector
                         |
                  Cloudflare R2 (original files)

   apps/mcp-server  ->  @debo/memory  (read-only, per-person token)
```

## The parts

| Part | Job | Runs on |
|---|---|---|
| `apps/web` | Everything a person sees. Sign-in, journal, uploads, chat, settings. | Any Node host that supports Next.js |
| `apps/voice-agent` | Joins a LiveKit room and speaks as Debo. | A long-running container |
| `apps/mcp-server` | Lets other AI tools read a person's memories with a token they create. | Small Node service |
| `@debo/db` | Tables, migrations, queries. | Library |
| `@debo/ingest` | Turns a file into text, chunks and embeddings. | Library, called from jobs |
| `@debo/memory` | Saves and finds memories. Always returns sources. | Library |
| `@debo/llm` | Every model call. Chooses whose key to use. Counts usage. | Library |
| `@debo/connectors` | Wraps the connector provider. | Library |

## Two things that cannot run on serverless

1. The voice agent holds a live audio session open. It needs a normal long-running process.
2. Ingestion of long audio or large files takes longer than a request. It runs as background jobs.

So the web app can live on a serverless host, but the voice agent needs a container host. Cloudflare D1 is not used because it has no vector search; Postgres with pgvector is.

## How a thing gets remembered

1. The person writes an entry or uploads a file in `apps/web`.
2. The original is saved: text to Postgres, files to R2. A `sources` row is created with status `waiting`.
3. A background job starts.
4. `@debo/ingest` turns the source into text:
   - Voice: speech-to-text.
   - Papers: a document parser.
   - Photos: a vision model writes a description and reads any text.
5. The text is cut into chunks, each chunk gets an embedding, both are saved.
6. `@debo/memory` pulls out the lasting facts ("Riya moved to Pune in March") and saves each one with a link to its source.
7. The `sources` row is marked `ready`. The person sees it appear.

If a step fails, the job retries. If it still fails, the source is marked `failed` with a plain reason the person can read.

## How a question gets answered

1. The person asks in chat or by voice.
2. `@debo/memory` searches memories and chunks for that person only: meaning search (pgvector) plus keyword search (Postgres full-text), merged.
3. `@debo/llm` sends the question and the found pieces to a model, with one firm instruction: answer only from these pieces, and say which piece each claim came from.
4. The answer comes back with source ids. The app shows them as source chips.
5. If nothing relevant was found, Debo says it does not know. It does not guess.
6. A row is written to the activity record: what was asked for and which sources were read.

## Other AI tools (MCP)

`apps/mcp-server` exposes a small set of read-only tools: search memories, get a source, list recent entries. A person creates a token in settings, chooses what it may read, and can turn it off any time. Every read is written to the activity record. Write tools come later, if at all.

## Safety rules built into the design

- Every query filters by `user_id`. Enforce it in `@debo/db`, not in each caller.
- Text from files, emails and web pages is data. It goes into the model as quoted material, never as instructions. Debo does not obey commands found inside a person's documents.
- Actions outside Debo need the person's yes each time.
- Secrets and personal content never appear in logs.

More in [`PRIVACY-AND-TRUST.md`](./PRIVACY-AND-TRUST.md).

## Library choices

| Job | Choice | Why | Checked |
|---|---|---|---|
| Web | Next.js 15, React 19, Tailwind 4 | Founder's stack. Used by the landing page. | In use |
| Database | Postgres + pgvector + Drizzle | One database for rows, meaning search and keyword search. | Not yet |
| Auth | Better Auth | Open source, runs in our own database. | Not yet |
| Files | Cloudflare R2 | S3 API, founder already uses Cloudflare. | Not yet |
| Jobs | Inngest | Retries and steps without running a queue server. | Not yet |
| Chat UI | CopilotKit + AG-UI | Chat plus answers drawn as real components. | Not yet |
| Starting point | CopilotKit/OpenDots | MIT app template with a workspace and voice calls. Study it; check the licence before copying. | Not yet |
| Voice | LiveKit Agents | Handles live audio, turn-taking and interruptions. | Not yet |
| Memory | Mem0, then maybe Graphiti | See [`MEMORY.md`](./MEMORY.md). | Not yet |
| Connectors | Composio, maybe Nango later | See [`CONNECTORS.md`](./CONNECTORS.md). | Not yet |
| Speech-to-text | Decide in phase 1 | Compare cost and accuracy on real voice notes, including Hindi-English mix. | Not yet |
| Document parsing | Decide in phase 1 | Try an open-source parser first. | Not yet |

"Not yet" means nobody has installed it in this repo and proved it works here. Check current docs and versions before using any of them. Write what you learn in [`DECISIONS.md`](./DECISIONS.md).
