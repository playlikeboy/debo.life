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
| 1 | Neon AI Gateway (needs prepaid credits) | Answers, embeddings, reading photos | `NEON_AI_GATEWAY_*` |
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

Then add one value Neon does not make for you:

```bash
echo "NEON_AUTH_COOKIE_SECRET=\"$(openssl rand -base64 32)\"" >> .env
```

Start the app:

```bash
pnpm dev
```

- http://localhost:3000 is the landing page.
- http://localhost:3000/auth/sign-up and `/auth/sign-in` are the sign-in pages. `/home` needs you to be signed in.
- http://localhost:3000/api/health checks the database, file storage and AI gateway. It only works in development; on the live site it does not exist.

## Deploying

The web app runs on Cloudflare Workers through the OpenNext adapter (see decision 11 in `DECISIONS.md`).

```bash
pnpm --filter @debo/web run deploy
```

That builds the app with OpenNext and runs `wrangler deploy`. Wrangler needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your shell, or run `npx wrangler login` first.

- The Worker is called `debo-web` and serves `debo.life` and `www.debo.life`, set in `apps/web/wrangler.jsonc`.
- The database is reached through a Cloudflare Hyperdrive binding called `HYPERDRIVE`.
- Secrets are set once per value with `npx wrangler secret put <NAME>` in `apps/web`. Use the names in `.env.example`. Never put them in `wrangler.jsonc`.

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
