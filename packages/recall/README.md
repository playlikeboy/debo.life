# @debo/recall

The recall test set: made-up journal entries for one made-up person, and questions whose right entries are known. Run it before each release, and after any change to search, chunking or embeddings.

Tooling only. The web app never imports this package.

## What is in it

- `src/fixtures.ts`: 21 made-up entries and 26 questions.
  - 9 **keyword** questions share a name, place or number with their entry.
  - 12 **meaning** questions are paraphrases ("my pet" for "Biscuit") that keyword search cannot find.
  - 5 **not in the journal** questions that nothing should answer.
- `src/score.ts`: recall@k and the list of misses. Pure functions.
- `scripts/run.ts`: the runner.

Use made-up data only. Never real user data.

## Run it

Never against production. The script refuses to run unless `RECALL_DATABASE_URL` is set and points at a different Neon endpoint from `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in the repo-root `.env`.

```bash
# Use the dev-ai branch. The connection string is never printed.
export RECALL_DATABASE_URL="$(neon connection-string dev-ai --project-id sweet-dream-71477162)"
pnpm --filter @debo/recall recall
```

It also needs `NEON_AI_GATEWAY_BASE_URL` and `NEON_AI_GATEWAY_TOKEN` (read from the repo-root `.env`) for embeddings. The target database must have every migration applied (`pnpm --filter @debo/db db:migrate` with `DATABASE_URL_UNPOOLED` set to that branch in the shell).

Steps:

1. Make a throwaway user in `neon_auth."user"`.
2. Save every entry with `createEntry` and embed it with `indexSource`, as the app does.
3. Ask every question with `searchPieces`, the search the ask pipeline uses. The answer model is never called, so a run costs only a few hundred embedding tokens.
4. Print recall@1, @3 and @6, for keyword search alone and for keyword plus meaning (what the app uses). @6 matters most: the app sends 6 pieces to the model.
5. Delete the throwaway user with `deleteAccount`. Everything else cascades. This runs even when a step fails.

Exit codes: `0` passed, `1` below the thresholds or a step failed, `2` meaning search could not run (keyword-only numbers are still printed, labelled).

Thresholds (in `scripts/run.ts`, set from the first run): recall@6 at least 90%, and at most 1 "not in the journal" question matched by meaning. Keyword matches on a shared word ("cost") are not counted; the answer model says no to those.
