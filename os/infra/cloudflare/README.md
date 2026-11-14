# Debo OS on Cloudflare

> **Where it runs now (14 November 2026).** The new app is served at `https://my.debo.life` and its API at `https://api.debo.life`. The deploy workflow runs on a push to `main` that touches `os/`, `packages/` or the workflow. `https://my.debo.life` is in Neon Auth's trusted domains. `debo.life` itself is still the older web app (`debo-web`). Where the text below says a `workers.dev` address, read these two addresses.


Three Workers. Nothing here touches `debo-web` or `debo.life`. Nothing is deployed yet.

```
browser ──> debo-os-app (static assets, SPA fallback)          my.debo.life later
browser ──> debo-os-api (Worker) ──> DeboApi container (Hono + task worker) ──> Debo's Neon database
                 ^ cron every 5 min wakes it         │ http://browser.internal (intercepted)
                                                     v
                              debo-os-browser (Worker, no public URL) ──> DeboBrowser container (Chromium)
```

| Worker | Config | Runs | Size |
|---|---|---|---|
| `debo-os-api` | `api/wrangler.jsonc`, `api/Dockerfile` | the API, one container named `main` | `basic` (1/4 vCPU, 1 GiB) |
| `debo-os-browser` | `browser/wrangler.jsonc`, `../../apps/worker/Dockerfile` | Playwright + Chromium | `standard-1` (1/2 vCPU, 4 GiB) |
| `debo-os-app` | `app/wrangler.jsonc` | Expo web export from `apps/mobile/dist/web` | assets only |

Preview URLs: `https://debo-os-api.<account>.workers.dev`, `https://debo-os-app.<account>.workers.dev`. There are no custom-domain routes yet; the commented ones for `api.debo.life` and `my.debo.life` are in the configs.

## How the API image is built

The API imports TypeScript source from the repo root (`@debo/db`, `@debo/llm`, `@debo/memory`, `@debo/brain`). Plain `node` cannot load those files, so the image does not run `tsc` output. Instead `os/scripts/bundle-server.mjs` uses esbuild to make one file, `dist/server.mjs` (about 17 MB). The final image holds only that file on a slim Node 22 image (245 MB). It needs no `node_modules`.

- The Docker build context is the **repo root**, not `os/`. The Dockerfile is `os/infra/cloudflare/api/Dockerfile`, and `wrangler.jsonc` sets `image_build_context` to `../../../..`.
- A repo-root `.dockerignore` sends only `os/` and `packages/` to Docker.
- `pnpm build:server` makes the same bundle, and `pnpm start` runs it. `pnpm start:worker` runs `dist/worker.mjs`.

## Sign-in: Neon Auth

The API runs with `AUTH_MODE=neon`. It needs `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL`, the same values the web app uses. The shared access key (`OPENFUSE_ACCESS_KEY`) is not used. The app does not need its own Neon variable: it asks `GET /api/health` for the Neon Auth address. The Expo web build needs only `EXPO_PUBLIC_API_URL`, which the workflow sets.

**Owner step, before anyone can sign in:** add the app's origin, `https://debo-os-app.<account>.workers.dev`, to the trusted origins of Debo's Neon Auth project (Neon console, the project's Auth settings). Without it, the browser's sign-in call is refused. Do the same for any custom domain later. See `os/docs/AUTH.md`.

## What the database gets on first boot

`DATABASE_URL` is Debo's existing Neon database (the secret `DATABASE_URL_UNPOOLED`, a direct connection). os keeps its own rows in schema `os`. On every start it runs, in this order:

```sql
CREATE SCHEMA IF NOT EXISTS os;
CREATE TABLE IF NOT EXISTS os.records(owner text NOT NULL, kind text NOT NULL, id text NOT NULL, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner,kind,id));
UPDATE os.records SET data = data || '{"status":"outcome_unknown", ...}'::jsonb WHERE kind='actions' AND data->>'status'='executing';
```

That is all (`apps/server/src/db.ts`, `index.ts`). There is no `CREATE INDEX`; the primary key makes its own index. The last line is not a schema change: it marks actions that were mid-run when the server stopped. It only touches `os.records`. Nothing else in the server or in `@debo/db` runs `CREATE`, `ALTER` or `DROP`. The role in the URL needs permission to create a schema in the database.

The journal features read and write Debo's existing `public` tables (`sources`, `chunks`, `activity`, `usage`, `conversations`, `messages`, `user_settings`) through the same URL (or `DEBO_DATABASE_URL` if you set it). os never creates or changes them. They must already exist: run Debo's migrations `0000` to `0004` first (they are in `packages/db/migrations`; the web app's deploy normally does this).

## Variables and secrets

Plain settings in `api/wrangler.jsonc`: `WORKSPACE_MODE=live`, `AGENT_BACKEND=model`, `MODEL=anthropic/claude-haiku-5-5`, `AUTH_MODE=neon`, `OS_DB_SCHEMA=os`, `TASK_WORKER_ENABLED`, `TRUST_PROXY`, `API_SLEEP_AFTER`, `PUBLIC_API_URL`, `ALLOWED_ORIGINS`. The workflow overrides the last two with the real workers.dev URLs. `MODEL` is an Anthropic model, so no OpenAI key is needed. `DAILY_TOKEN_LIMIT` (default 40000 per person per day) can be added as a plain var.

The container entry (`api/src/index.ts`) passes a fixed list of names into the container. Anything not on that list never reaches the API.

| Variable the API reads | GitHub secret | Status | Service |
|---|---|---|---|
| Cloudflare token, account id (CI only) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | exists (token needs Containers edit; check) | Cloudflare |
| `DATABASE_URL` | `DATABASE_URL_UNPOOLED` | exists | Neon (Debo's database) |
| `NEON_AUTH_BASE_URL` | `NEON_AUTH_BASE_URL` | **create** (same as the web app) | Neon Auth |
| `NEON_AUTH_JWKS_URL` | `NEON_AUTH_JWKS_URL` | **create** (same as the web app) | Neon Auth |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | **create** | Anthropic |
| `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN` | same names | **create** (optional: search by meaning) | Neon AI Gateway |
| `MEM0_API_KEY` | `MEM0_API_KEY` | exists | Mem0 |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | same names | exist | LiveKit |
| `VOICE_AGENT_SECRET` | `VOICE_AGENT_SECRET` | exists (32+ characters) | LiveKit agent |
| `TOKEN_ENCRYPTION_KEY` | `DEBO_OS_TOKEN_ENCRYPTION_KEY` | **create**: `openssl rand -base64 32` | os only |
| `SESSION_SIGNING_KEY` | `DEBO_OS_SESSION_SIGNING_KEY` | **create**: `openssl rand -base64 32` | os only |
| `WORKER_TOKEN` (api and browser) | `DEBO_OS_WORKER_TOKEN` | **create**: `openssl rand -hex 32` | os only |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | not wired in CI | optional | Google |

`CPK_INTELLIGENCE_API_KEY` is gone. `OPENFUSE_ACCESS_KEY` and `OPENAI_API_KEY` are no longer needed. Secrets never go in the image or in `wrangler.jsonc`. Worker secrets are copied into the container's environment at start.

Voice: the LiveKit voice agent (`apps/voice-agent`) sends questions to the address in its `DEBO_URL`, which is `https://debo.life` today. To have it use this preview, point `DEBO_URL` at the API preview URL. Both sides must use the same `VOICE_AGENT_SECRET`.

## First preview deploy

1. Create the secrets that are marked **create** above. Set the required ones; the Neon AI Gateway pair is optional.
2. Add the app origin to Neon Auth's trusted origins (see above). You get the exact workers.dev address from the workflow summary or `https://debo-os-app.<subdomain>.workers.dev`.
3. Make sure Debo's database migrations are applied.
4. Run the workflow (the branch must be on GitHub):

```sh
gh secret set NEON_AUTH_BASE_URL
gh secret set NEON_AUTH_JWKS_URL
gh secret set ANTHROPIC_API_KEY
gh secret set DEBO_OS_TOKEN_ENCRYPTION_KEY --body "$(openssl rand -base64 32)"
gh secret set DEBO_OS_SESSION_SIGNING_KEY  --body "$(openssl rand -base64 32)"
gh secret set DEBO_OS_WORKER_TOKEN         --body "$(openssl rand -hex 32)"
# optional, for search by meaning:
gh secret set NEON_AI_GATEWAY_BASE_URL
gh secret set NEON_AI_GATEWAY_TOKEN
gh workflow run deploy-os.yml --ref <branch>
```

Or by hand from `os/infra/cloudflare` (Docker with buildx required). Put secret values in `api-secrets.json` and `browser-secrets.json` first, and never commit them:

```sh
npm ci
(cd ../.. && pnpm install --frozen-lockfile && EXPO_PUBLIC_API_URL=https://debo-os-api.<sub>.workers.dev pnpm build:web)
npx wrangler deploy -c browser/wrangler.jsonc --secrets-file browser-secrets.json
npx wrangler deploy -c api/wrangler.jsonc --secrets-file api-secrets.json \
  --var PUBLIC_API_URL:https://debo-os-api.<sub>.workers.dev --var ALLOWED_ORIGINS:https://debo-os-app.<sub>.workers.dev
npx wrangler deploy -c app/wrangler.jsonc
curl https://debo-os-api.<sub>.workers.dev/api/health
```

Deploy the browser first: the API config has a service binding to it. The workflow's smoke test checks that `/api/health` says `auth.mode` is `neon`, that the browser is configured, that `/api/debo/status` answers 401 without a sign-in, and that the app serves a deep link.

## Switching to debo.life later

Uncomment the `routes` in `api/wrangler.jsonc` and `app/wrangler.jsonc`, set `PUBLIC_API_URL=https://api.debo.life` and `ALLOWED_ORIGINS=https://my.debo.life`, rebuild the web app with `EXPO_PUBLIC_API_URL=https://api.debo.life`, add `https://my.debo.life` to Neon Auth's trusted origins, redeploy. Update the Google redirect URI. `debo-web` is not involved.

## What is lost without a disk

The API container's disk is wiped on every sleep or rollout. Uploaded and imported files under `files/` are lost (their database rows stay and then point at nothing). The computer feature is off here. Tasks, threads, settings and the journal live in Postgres and are safe. Persistent file storage is the main gap; the fix is to move `files.ts` to R2 or Neon Object Storage (not built).

Browser container: saved Chromium profiles (logins that "Take control" set up), session metadata and downloaded PDFs are lost after each sleep (15 minutes idle). Open sessions also end. Options, not built: Cloudflare container snapshots (beta), a FUSE mount of R2 at `/data`, or syncing the profile folder to R2 on SIGTERM.

## Research notes on Cloudflare Containers (read 2026-11-14)

- A container is bound to a Durable Object class. The Worker reaches it with `getContainer(env.X, "name").fetch(req)` from `@cloudflare/containers`. Config needs `containers[]`, a `durable_objects` binding and a `migrations` entry with `new_sqlite_classes`.
- Instance types: lite 1/16 vCPU 256 MiB; basic 1/4 vCPU 1 GiB; standard-1 1/2 vCPU 4 GiB; standard-2 1 vCPU 6 GiB.
- `sleepAfter` is an idle timer, reset by any `fetch`. On sleep the platform sends SIGTERM, then SIGKILL after up to 15 minutes. Cold start is a few seconds plus the app's own boot.
- The in-process task loop only runs while the container is awake. The Worker cron wakes it every 5 minutes. Tasks use SQL leases, so overlap during a restart is safe.
- `outboundByHost` lets Worker code answer calls to a made-up host. The API calls `http://browser.internal`, which is handed to a service binding for `debo-os-browser` (no public URL). The browser also checks `WORKER_TOKEN`.
- Hyperdrive is not available inside a container, so the API connects straight to Neon with `pg` (pool of 5). Use the direct (unpooled) URL.
- Static assets use `not_found_handling: "single-page-application"`.
- `wrangler deploy` builds images with local Docker and needs buildx (CI installs it).

## Cost estimate (Workers Paid, $5 per month base)

From list prices, not a bill. Containers bill only while awake. Memory $0.0000025 per GiB-second, CPU $0.000020 per vCPU-second, disk $0.00000007 per GB-second; monthly allowance 25 GiB-hours, 375 vCPU-minutes, 200 GB-hours.

- API awake all month (the 5-minute cron keeps it awake): about $7 on top of the base.
- API with the cron removed and light use: about $0.30.
- Browser at about 1 hour a day: about $1.
- Total: about $12 to $13 a month with the API always awake, about $6 if it may sleep.

## Verified here, and not

Verified on this machine (Docker 27 without buildx, Node 22):
- API image builds from the repo root and starts against a throwaway local Postgres with fake keys; `/api/health` answers `"mode":"live","auth":{"mode":"neon",...}`.
- With a locally made test token, `/api/debo/status` answers `{"configured":true,"journal":true,"ask":true,"memories":false}` and `/api/debo/entries` answers `{"entries":[]}`. So the shared packages load and query the `public` tables. First boot created only `os.records`.
- Expo web export builds with `EXPO_PUBLIC_API_URL` inside the JavaScript.
- `wrangler deploy --dry-run` passes for all three configs (`--containers-rollout none` for the two container configs, since wrangler's own image build needs buildx).
- os `pnpm typecheck` and `pnpm test` (656 tests) pass.

Not verified: a real deploy; real Neon Auth sign-in (token checks used a local test key set; see `os/docs/AUTH.md`); a real model answer, Mem0 or LiveKit call; the `outboundByHost` path to the browser Worker; that `basic` (1 GiB) is enough under load; cron wake behavior; SPA fallback on the real runtime; whether the Cloudflare token has Containers permission; the browser image was not rebuilt in this round.
