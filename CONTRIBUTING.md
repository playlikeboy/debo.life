# Contributing

Thanks for wanting to help. Debo is early: a landing page and a plan.

## Before you start

1. Read [`AGENTS.md`](./AGENTS.md). The rules there apply to people as much as to AI agents.
2. Check [`docs/ROADMAP.md`](./docs/ROADMAP.md) to see which phase is open. Work outside the current phase will likely wait.
3. For anything bigger than a small fix, open an issue first and describe what you want to do.

## Making a change

```bash
pnpm install
pnpm dev
```

- One thing per pull request.
- Follow [`DESIGN.md`](./DESIGN.md) for anything visible and [`docs/WRITING.md`](./docs/WRITING.md) for any text.
- If you change how something works, update its doc in the same pull request.
- Run `pnpm build` and `pnpm typecheck` before you open it.
- If you change search, chunking or embeddings, run the recall test set on a non-production branch and put its numbers in the pull request (see below).
- Never include real personal data, in code, tests, screenshots or issues. Use made-up data.

## Before each release

1. `pnpm typecheck` and `pnpm build` pass.
2. The recall test set passes on the `dev-ai` branch, never production:

   ```bash
   export RECALL_DATABASE_URL="$(neon connection-string dev-ai --project-id sweet-dream-71477162)"
   pnpm --filter @debo/recall recall
   ```

   See [`docs/MEMORY.md`](./docs/MEMORY.md), "Testing recall", for what the numbers mean.

## Commit messages

Short and plain, starting with a verb: "Add journal list page", "Fix source chip focus ring".

## Security problems

Do not open a public issue. See [`SECURITY.md`](./SECURITY.md).

## Licence

No licence has been chosen yet. Until one is, contributions cannot be accepted under clear terms; open an issue to discuss before doing large work.
