# Setup

## Today

You need Node 22 or newer and pnpm 10.

```bash
git clone https://github.com/playlikeboy/debo.life
cd debo.life
pnpm install
pnpm dev
```

Open http://localhost:3000. The landing page needs no accounts. Sign-in, the database, file storage and the AI gateway need the Neon values; see "Running locally" below.

## Accounts you will need, by phase

Create each one only when its phase starts. Names of the variables are in `.env.example`.

| Phase | Service | For | Variables |
|---|---|---|---|
| 1 | Neon: Postgres with pgvector | Database | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| 1 | Neon Auth | Sign-in | `NEON_AUTH_*` |
| 1 | Neon Object Storage | Original files | `AWS_*` |
| 1 | Anthropic | Answers (tried first) | `ANTHROPIC_API_KEY` |
| 1 | Neon AI Gateway (needs prepaid credits) | Answers if Anthropic fails; later embeddings and reading photos | `NEON_AI_GATEWAY_*` |
| 1 | Cloudflare | Hosting (Workers) and Hyperdrive | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` in your shell |
| 1 | A speech-to-text provider | Voice notes to text | add when chosen |
| 1 | Inngest | Background jobs | add when chosen |
| 3 | LiveKit | Live voice | `LIVEKIT_*` |
| 3 | A text-to-speech provider | Debo's voice | add when chosen |
| 4 | Composio | Connected apps | `COMPOSIO_API_KEY` |
| 4 | Google Cloud project | Calendar access | add when needed |
| 5 | A payments provider | Plans | add when chosen |

When you add a variable, add its name (never its value) to `.env.example` in the same change.

## Secrets

- Local: `.env` in the repo root, written by `neon env pull`. It is git-ignored.
- Deployed: the host's secret store (`wrangler secret put`).
- Make `NEON_AUTH_COOKIE_SECRET` and `BYOK_ENCRYPTION_KEY` with a real random generator, for example `openssl rand -base64 32`.
- If a secret is ever committed, treat it as leaked: replace it at once, then remove it from history.

## Running locally

You need Node 22 or newer, pnpm 10 and the Neon CLI (`npm i -g neon`).

```bash
pnpm install
neon login          # opens a browser to sign in to Neon
neon env pull       # in the repo root; writes the Neon values into .env
```

Then add two values Neon does not make for you:

```bash
echo "NEON_AUTH_COOKIE_SECRET=\"$(openssl rand -base64 32)\"" >> .env
echo 'ANTHROPIC_API_KEY="<your Anthropic API key>"' >> .env
```

Create the tables (only needed once per database, and after each new migration):

```bash
pnpm --filter @debo/db db:migrate
```

Start the app:

```bash
pnpm dev
```

- http://localhost:3000 is the landing page.
- http://localhost:3000/auth/sign-up and `/auth/sign-in` are the sign-in pages.
- `/home` needs you to be signed in. There you can write journal entries, ask Debo about them ("Ask Debo about your entries"), and delete entries or your whole account.
- http://localhost:3000/api/health checks the database, file storage and AI gateway. It only works in development; on the live site it does not exist.

## Database changes

Tables are defined in `packages/db/src/schema.ts` and changed through Drizzle migrations in `packages/db/migrations`.

1. Edit `packages/db/src/schema.ts`.
2. Make the migration: `pnpm --filter @debo/db db:generate`.
3. **Read the new SQL file before going on.** It must never create, change or drop anything in the `neon_auth` schema. That schema belongs to Neon Auth. Drizzle tried to `CREATE TABLE "neon_auth"."user"` in the first migration, and that line was removed by hand. Check every new migration for the same.
4. Apply it: `pnpm --filter @debo/db db:migrate`. It reads `DATABASE_URL_UNPOOLED` from the repo-root `.env`.

The deploy workflow also runs migrations.

## End-to-end test

`apps/web/e2e/journal.spec.ts` walks through the whole loop in a real browser with a throwaway account: sign up, write an entry, ask about it (expects an answer with a source chip), ask something it cannot know (expects "I don't have anything about that yet"), delete the entry, delete the account.

```bash
npx playwright install chromium        # once, in apps/web
pnpm --filter @debo/web test:e2e        # starts `next dev` on port 3000
BASE_URL=https://debo.life pnpm --filter @debo/web test:e2e   # against the live site
```

It uses made-up data and deletes its own account at the end.

## Deploying

The web app runs on Cloudflare Workers through the OpenNext adapter (see decision 11 in `DECISIONS.md`).

**Normally you do not deploy by hand.** Every push to `main` runs `.github/workflows/deploy.yml`, which installs with pnpm, typechecks, then runs `bun run deploy` in `apps/web` on Linux. You can also start it from the Actions tab ("Deploy", then "Run workflow"). It needs three GitHub repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `DATABASE_URL_UNPOOLED`.

To deploy by hand (on Windows this needs Developer Mode or WSL, because OpenNext creates symlinks):

```bash
pnpm --filter @debo/web run deploy
```

That builds the app with OpenNext and runs `wrangler deploy`. Wrangler needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your shell, or run `npx wrangler login` first.

- The Worker is called `debo-web` and serves `debo.life` and `www.debo.life`, set in `apps/web/wrangler.jsonc`.
- The database is reached through a Cloudflare Hyperdrive binding called `HYPERDRIVE` (config `debo-db`). **Query caching is off** on that config (`npx wrangler hyperdrive update <id> --caching-disabled true`). With caching on, a person's new entry did not show up for up to a minute, and their journal query results would be cached at the edge. Keep it off. This is a Cloudflare setting, not a file in the repo.
- Secrets are set once per value with `npx wrangler secret put <NAME>` in `apps/web`. Use the names in `.env.example`. Never put them in `wrangler.jsonc`. The Worker needs: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN` and `ANTHROPIC_API_KEY`.

## Repo settings

Set once on GitHub:

- Description: "Debo: a friendly assistant that remembers your life."
- Website: https://debo.life
- Topics: `ai-assistant`, `personal-memory`, `journaling`, `nextjs`, `typescript`, `mcp`, `voice-assistant`, `pgvector`
- Turn on private vulnerability reporting and dependency alerts.

With the GitHub CLI:

```bash
gh repo edit playlikeboy/debo.life \
  --description "Debo: a friendly assistant that remembers your life." \
  --homepage "https://debo.life" \
  --add-topic ai-assistant,personal-memory,journaling,nextjs,typescript,mcp,voice-assistant,pgvector
```
