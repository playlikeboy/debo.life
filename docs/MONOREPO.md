# Monorepo

One repo, pnpm workspaces, Turborepo.

## Layout

```
debo.life/
  AGENTS.md  CLAUDE.md  DESIGN.md  README.md
  package.json  pnpm-workspace.yaml  turbo.json  .env.example
  docs/
  apps/
    web/            @debo/web       Next.js 15. Landing page now, product later.
    voice-agent/    @debo/voice-agent  LiveKit Agents worker
    mcp-server/     @debo/mcp-server   MCP server
  packages/
    db/             @debo/db        Drizzle schema, migrations, queries
    memory/         @debo/memory    Save and recall, always with sources
    ingest/         @debo/ingest    Files and audio to text, chunks, embeddings
    connectors/     @debo/connectors  Wrapper around the connector provider
    llm/            @debo/llm       Model calls, key choice, usage counting
    ui/             @debo/ui        Shared components and tokens
```

Planned folders hold only a README today. A folder becomes a real package when it gets a `package.json`.

## Who may depend on whom

```
apps/*  ->  any package
@debo/memory      ->  @debo/db, @debo/llm
@debo/ingest      ->  @debo/db, @debo/llm
@debo/connectors  ->  @debo/db
@debo/llm         ->  @debo/db
@debo/ui          ->  nothing in this repo
@debo/db          ->  nothing in this repo
```

Packages never import from `apps/`. No circles.

## One job per package

| Only this package | May do this |
|---|---|
| `@debo/db` | Talk to Postgres |
| `@debo/llm` | Call a model or read an AI key |
| `@debo/connectors` | Call the connector provider |
| `@debo/ingest` | Parse files and audio |
| `@debo/memory` | Decide what is worth remembering and find it again |

This keeps swaps cheap. Changing the memory library touches one package.

## Inside `apps/web`

```
apps/web/src/
  app/
    (site)/        public pages: landing, privacy, pricing
    (app)/         signed-in pages: home, journal, ask, memories, settings
    api/           route handlers
  components/      components used only by the web app
  lib/             small helpers
```

Today only `app/page.tsx` and `app/layout.tsx` exist. Add the route groups when the first signed-in page is built.

## Adding a package

1. Create `packages/<name>/package.json` with the name `@debo/<name>`.
2. Add `src/index.ts` as the only public entry.
3. Add `build`, `typecheck` and `test` scripts so Turborepo picks it up.
4. Replace the placeholder README with what the package does and its public functions.
5. Add it to the tables in this file.

## Commands

```bash
pnpm install
pnpm dev                          # run everything
pnpm --filter @debo/web dev       # run one app
pnpm build
pnpm typecheck
```
