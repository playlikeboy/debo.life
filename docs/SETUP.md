# Setup

## Today

You need Node 22 or newer and pnpm 10.

```bash
git clone https://github.com/playlikeboy/debo.life
cd debo.life
pnpm install
pnpm dev
```

Open http://localhost:3000. No accounts or environment variables are needed for the landing page.

## Accounts you will need, by phase

Create each one only when its phase starts. Names of the variables are in `.env.example`.

| Phase | Service | For | Variables |
|---|---|---|---|
| 1 | A Postgres host with pgvector | Database | `DATABASE_URL` |
| 1 | Cloudflare R2 | Original files | `R2_*` |
| 1 | An AI provider or gateway | Answers, embeddings, reading photos | `LLM_GATEWAY_*` |
| 1 | A speech-to-text provider | Voice notes to text | add when chosen |
| 1 | Inngest | Background jobs | add when chosen |
| 3 | LiveKit | Live voice | `LIVEKIT_*` |
| 3 | A text-to-speech provider | Debo's voice | add when chosen |
| 4 | Composio | Connected apps | `COMPOSIO_API_KEY` |
| 4 | Google Cloud project | Calendar access | add when needed |
| 5 | A payments provider | Plans | add when chosen |

When you add a variable, add its name (never its value) to `.env.example` in the same change.

## Secrets

- Local: `.env.local` in the app that needs it. It is git-ignored.
- Deployed: the host's secret store.
- Make `BETTER_AUTH_SECRET` and `BYOK_ENCRYPTION_KEY` with a real random generator, for example `openssl rand -base64 32`.
- If a secret is ever committed, treat it as leaked: replace it at once, then remove it from history.

## Deploying the landing page

`apps/web` builds to static files and runs on Cloudflare Workers (see decision 10 in `DECISIONS.md`).

```bash
pnpm install
pnpm build
cd apps/web
npx wrangler deploy
```

Wrangler needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your shell, or run `npx wrangler login` first. The Worker is called `debo-web` and serves `debo.life` and `www.debo.life` as custom domains, set in `apps/web/wrangler.jsonc`.

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
