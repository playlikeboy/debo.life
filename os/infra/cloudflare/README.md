# Debo OS on Cloudflare

Three Workers. Nothing here touches `debo-web` or `debo.life`.

```
browser ──> debo-os-app (static assets, SPA fallback)          app.debo.life later
browser ──> debo-os-api (Worker) ──> DeboApi container (Hono + task worker) ──> Neon (DATABASE_URL)
                 ^ cron every 5 min wakes it         │ http://browser.internal (intercepted)
                                                     v
                              debo-os-browser (Worker, no public URL) ──> DeboBrowser container (Chromium)
```

| Worker | Config | Runs | Size |
|---|---|---|---|
| `debo-os-api` | `api/wrangler.jsonc`, `api/Dockerfile` | the API, one container named `main` | `basic` (1/4 vCPU, 1 GiB) |
| `debo-os-browser` | `browser/wrangler.jsonc`, `../../apps/worker/Dockerfile` | Playwright + Chromium | `standard-1` (1/2 vCPU, 4 GiB) |
| `debo-os-app` | `app/wrangler.jsonc` | Expo web export from `apps/mobile/dist/web` | assets only |

Preview URLs: `https://debo-os-api.<account>.workers.dev`, `https://debo-os-app.<account>.workers.dev`. No custom-domain routes yet; the commented ones for `api.debo.life` and `app.debo.life` are in the configs.

## Research findings (read 2026-11-14)

- **Containers model.** A container is bound to a Durable Object class. The Worker reaches it with `getContainer(env.X, "name").fetch(req)` from `@cloudflare/containers` 0.3.x. Config: `containers[]` with `class_name`, `image` (Dockerfile path), `image_build_context`, `instance_type`, `max_instances`; plus a `durable_objects` binding and a `migrations` entry with `new_sqlite_classes`. [Get started](https://developers.cloudflare.com/containers/get-started/), [Container class](https://github.com/cloudflare/containers).
- **Instance types.** lite 1/16 vCPU 256 MiB; basic 1/4, 1 GiB, 4 GB disk; standard-1 1/2, 4 GiB, 8 GB; standard-2 1, 6 GiB; standard-3 2, 8 GiB; standard-4 4, 12 GiB. [Limits](https://developers.cloudflare.com/containers/platform-details/limits/).
- **Sleep and wake.** `sleepAfter` (default 10m) is an idle timer. Any `fetch` or `renewActivityTimeout()` resets it. On sleep the platform sends SIGTERM, waits up to 15 minutes, then SIGKILL. Cold start is about 1 to 3 seconds plus the app's own boot. The next request starts it again. [Lifecycle](https://developers.cloudflare.com/containers/platform-details/architecture/).
- **Disk is ephemeral.** After sleep the container starts from a fresh image disk. Options: snapshots (beta, `durable_object` scheduling policy) or FUSE mount of R2. Same page.
- **Long-lived loop.** A container can run any process, so the API's in-process `setInterval` task loop works while the container is awake. It does not run while asleep. A Worker cron (or DO alarm) must wake it. Waking runs the engine's own first tick, so no new "tick" endpoint was needed. Tasks use SQL leases, so overlap during a restart is safe.
- **Env and secrets.** Worker secrets are visible to the Durable Object as `this.env`. The class copies them into `envVars`, which become container environment variables at start. Secrets never go in the image or `wrangler.jsonc`.
- **Outbound.** `enableInternet` true by default. `outboundByHost` lets Worker code answer calls to a chosen hostname, using Worker bindings. [Outbound traffic](https://developers.cloudflare.com/containers/platform-details/outbound-traffic/).
- **Private container-to-container.** There is no native container-to-container address. Used here: the API container calls `http://browser.internal`; `outboundByHost` hands that request to a service binding for `debo-os-browser`, which has no workers.dev URL and no route. The browser also checks `WORKER_TOKEN` itself (upstream behavior). Nothing public reaches the browser.
- **Database.** Hyperdrive is a Worker binding and is not available inside a container. The container connects straight to Neon with `DATABASE_URL` (the server uses `pg`, pool of 5; use a direct connection string).
- **Static assets.** `assets.directory` plus `not_found_handling: "single-page-application"` serves `index.html` for unknown paths. [Static assets](https://developers.cloudflare.com/workers/static-assets/).
- **Deploy.** `wrangler deploy` builds the image with local Docker (needs buildx) and pushes it. After the first deploy, containers can take several minutes to provision.

## What changed in the server

One small change, `os/apps/server/src/auth.ts`: if `SESSION_SIGNING_KEY` is set, it is used instead of a key file under `DATA_DIR`. Without it every container restart makes a new key and signs everyone out. No other server change. `/api/health` already exists; no tick endpoint was added.

## What is lost without a disk

The API container's disk is wiped on every sleep or rollout. Things upstream keeps under `DATA_DIR` are lost with it: uploaded and imported files under `files/` (their database rows stay and then point at nothing), `computer-*` files (the computer feature is off here). Tasks, threads and settings live in Postgres and are safe. Persistent file storage is the main gap; the fix is to move `files.ts` to R2 or Neon Object Storage (not built).

Browser container: upstream gives it a disk for `/data`. Without it you lose saved Chromium profiles (logins and cookies that "Take control" set up), session metadata, and downloaded PDFs after each sleep (15 minutes idle). Open sessions also end. Best alternatives, not built: (1) Cloudflare container snapshots with the `durable_object` policy (beta, free during beta); (2) a FUSE mount of an R2 bucket at `/data` with `tigrisfs`/`s3fs` (slower than SSD, but profiles are small); (3) sync the profile directory to R2 on SIGTERM and restore on start. Option 3 is a small wrapper script around the worker and is the cheapest to build.

## Variables and secrets

Plain vars (in `api/wrangler.jsonc`): `WORKSPACE_MODE=live`, `AGENT_BACKEND=model`, `MODEL`, `TASK_WORKER_ENABLED`, `TRUST_PROXY`, `API_SLEEP_AFTER`, `PUBLIC_API_URL`, `ALLOWED_ORIGINS`. The workflow overrides the last two with the real workers.dev URLs.

| Secret (Worker) | GitHub secret name | Exists now | How to create |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (CI only) | same | yes | The token needs Workers Scripts edit and Containers edit. Check it. |
| `DATABASE_URL` (api) | `DEBO_OS_DATABASE_URL` | no (`DATABASE_URL_UNPOOLED` exists for the web app) | Make a separate Neon branch or database for Debo OS. It creates its own `records` table. Use that direct URL. |
| `OPENFUSE_ACCESS_KEY` (api) | `DEBO_OS_ACCESS_KEY` | no | `openssl rand -base64 36`. 24+ characters. This is the sign-in key. |
| `TOKEN_ENCRYPTION_KEY` (api) | `DEBO_OS_TOKEN_ENCRYPTION_KEY` | no | `openssl rand -base64 32` |
| `SESSION_SIGNING_KEY` (api) | `DEBO_OS_SESSION_SIGNING_KEY` | no | `openssl rand -base64 32` |
| `WORKER_TOKEN` (api and browser) | `DEBO_OS_WORKER_TOKEN` | no | `openssl rand -hex 32`. Same value on both. |
| `CPK_INTELLIGENCE_API_KEY` (api) | same | no | `npx copilotkit@latest login`, then `project select` |
| `CPK_TELEMETRY_ID` (api) | same | no | Generated by the same command. Optional. |
| `OPENAI_API_KEY` (api) | same | no | Provider key for `MODEL`. Swap for `ANTHROPIC_API_KEY` if you change `MODEL`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (api, optional) | not wired in CI | no | Add to the workflow secrets file when Gmail or Calendar is wanted. Register `${PUBLIC_API_URL}/api/google/callback`. |

Existing GitHub secrets (names only): `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `DATABASE_URL_UNPOOLED`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `MEM0_API_KEY`, `VOICE_AGENT_SECRET`. Build-time only: `EXPO_PUBLIC_API_URL` (set by the workflow).

## First preview deploy

Set the secrets, then run the workflow (needs the branch on GitHub):

```sh
gh secret set DEBO_OS_ACCESS_KEY        --body "$(openssl rand -base64 36)"
gh secret set DEBO_OS_TOKEN_ENCRYPTION_KEY --body "$(openssl rand -base64 32)"
gh secret set DEBO_OS_SESSION_SIGNING_KEY  --body "$(openssl rand -base64 32)"
gh secret set DEBO_OS_WORKER_TOKEN      --body "$(openssl rand -hex 32)"
gh secret set DEBO_OS_DATABASE_URL      # paste the Neon URL when prompted
gh secret set CPK_INTELLIGENCE_API_KEY  # paste when prompted
gh secret set OPENAI_API_KEY            # paste when prompted
gh workflow run deploy-os.yml --ref <branch>
```

Or by hand from `os/infra/cloudflare` (Docker with buildx required):

```sh
npm ci
(cd ../.. && pnpm install --frozen-lockfile && EXPO_PUBLIC_API_URL=https://debo-os-api.<sub>.workers.dev pnpm build:web)
npx wrangler deploy -c browser/wrangler.jsonc --secrets-file browser-secrets.json
npx wrangler deploy -c api/wrangler.jsonc --secrets-file api-secrets.json \
  --var PUBLIC_API_URL:https://debo-os-api.<sub>.workers.dev --var ALLOWED_ORIGINS:https://debo-os-app.<sub>.workers.dev
npx wrangler deploy -c app/wrangler.jsonc
curl https://debo-os-api.<sub>.workers.dev/api/health
```

Deploy the browser first: the API config has a service binding to it. Never commit the secrets files.

## Switching to debo.life later

Uncomment the `routes` in `api/wrangler.jsonc` and `app/wrangler.jsonc`, set `PUBLIC_API_URL=https://api.debo.life` and `ALLOWED_ORIGINS=https://app.debo.life`, rebuild the web app with `EXPO_PUBLIC_API_URL=https://api.debo.life`, redeploy. Update the Google redirect URI. `debo-web` is not involved.

## Cost estimate (Workers Paid, $5 per month base)

Rates: memory $0.0000025 per GiB-second, CPU $0.000020 per vCPU-second (active use only), disk $0.00000007 per GB-second. Included each month: 25 GiB-hours, 375 vCPU-minutes, 200 GB-hours. Billing runs only while a container is awake. Egress: first 1 TB free in North America and Europe. Source: [Containers pricing](https://developers.cloudflare.com/containers/pricing/). Workers requests and Durable Object charges are small at this scale.

- **API, awake all month (the 5-minute cron keeps it awake):** 1 GiB x 730 h = 730 GiB-h, minus 25 included = 705 x 3600 x 0.0000025 = about $6.35. Disk 4 GB x 730 h = 2,920 GB-h, minus 200 = 2,720 x 3600 x 0.00000007 = about $0.69. CPU at idle is near zero. About **$7 on top of the $5 base**.
- **API, cron removed, light use (about 2 h awake per day):** about 60 GiB-h, so about $0.30 total.
- **Browser, light use (about 1 h awake per day):** 4 GiB x 30 h = 120 GiB-h, minus the 25 already used by the API allowance = about $0.9 to $1; disk 8 GB x 30 h is under the allowance; CPU small. About **$1**. Idle: $0.
- **Total:** about **$12 to $13 per month** with the API always awake, about **$6** if it is allowed to sleep. These are estimates from list prices, not a bill.

## Verified here, and not

Verified on this machine (Docker 27 without buildx, Node 22): API image builds (542 MB) and starts, `/api/health` answers `{"ok":true,"mode":"live",...}` with the fake test environment; browser image builds and `/health` answers; `pnpm build:server` and `pnpm build:web` pass; `tsc --noEmit` passes for the Workers; `wrangler deploy --dry-run` passes for all three (with `--containers-rollout none` for the two container configs, because wrangler's own image build needs buildx, which this host lacks; CI installs it).

Not verified: a real deploy; the `outboundByHost` path from the API container to the browser Worker; that `basic` (1 GiB) is enough for the API under load; cron wake behavior; SPA fallback on the real Workers runtime; whether the API token has Containers permission.
