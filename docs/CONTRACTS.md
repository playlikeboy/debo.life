# Contracts between parts of Debo

These are the agreements that let several people (or agents) build different parts of Debo at the same time without breaking each other. Change one only together with every part that uses it.

## One brain

Every way of talking to Debo (the ask box, chat, voice, tasks, MCP) answers through `askStream()` in `apps/web/src/lib/ask.ts`. Nothing else calls a model to answer a question about the person's life.

```ts
askStream(userId: string, question: string, options?: {
  signal?: AbortSignal;
  /** Earlier turns of this conversation, oldest first. Used for follow-ups like "and after that?". */
  history?: { role: "user" | "assistant"; text: string }[];
}): AsyncGenerator<AskEvent>
```

`AskEvent` is `sources` (always before the first `text`), `text` deltas, then `done` with the outcome. Voice reads the same events and speaks the text.

## Tools

Every tool has the shape in `@debo/tools` (`packages/tools/src/index.ts`): a name, a risk level, a Zod input, a plain `preview` of the exact action, and `run`. A package that adds tools exports them as an array (for example `browserTools`), and the registry in `apps/web/src/lib/tools.ts` puts them together. Only the task engine calls `run`, and only after the policy engine says allow, or the person approves the exact input.

## Database

Only `@debo/db` talks to Postgres. Each area keeps its tables in its own file, `packages/db/src/schema-<area>.ts`, and its queries in `packages/db/src/<area>.ts`, exported from `packages/db/src/index.ts`. Every table with user data has a `user_id` column and every query filters by it. Migrations are generated once, after the parts are put together, with `pnpm --filter @debo/db exec drizzle-kit generate`. Migrations only add; they never drop or rewrite a table that holds people's data.

## Screens

Signed-in pages live under `/home`. The shell (sidebar on wide screens, bottom bar on phones) links to:

| Path | Screen |
|---|---|
| `/home` | Today |
| `/home/chat` | Chat |
| `/home/voice` | Talk to Debo |
| `/home/tasks` | Tasks and approvals |
| `/home/journal` | Journal |
| `/home/documents` | Documents (uploads) |
| `/home/memories` | What Debo knows |
| `/home/computer` | Debo's browser and computer |
| `/home/connectors` | Connected apps |
| `/home/activity` | What Debo did |
| `/home/settings` | Settings |

## Cloudflare bindings

Bindings are declared in `apps/web/wrangler.jsonc` and read on the server with `getCloudflareContext().env`. `AI` is Workers AI (speech to text, text to speech). `BROWSER` is Browser Rendering. The browser never sees a binding or a secret.
