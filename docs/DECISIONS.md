# Decisions

A short log of choices and why. Newest at the bottom. Add an entry whenever you choose or change a library, a service or a rule.

Format:

```
## N. Title
Date · Status (decided / to verify / replaced by N)
Choice:
Why:
Check before relying on it:
```

---

## 1. Next.js for the whole web app, not Astro
2026-11-10 · decided

Choice: one Next.js 15 app for the landing page and the product.
Why: the product is signed-in, stateful and streams answers. Astro suits content sites. One app is less to run for one developer, who already knows Next.js.

## 2. Postgres with pgvector, not Cloudflare D1
2026-11-10 · decided

Choice: Postgres for rows, meaning search and keyword search.
Why: D1 has no vector search. One database is simpler than a database plus a separate vector store.
Check before relying on it: pick a host (for example Neon or Supabase) and confirm pgvector and index support on its current plans.

## 3. Voice agent runs as a long-lived worker
2026-11-10 · decided

Choice: `apps/voice-agent` on a container host, separate from the web app.
Why: a live audio session cannot run inside a short serverless request.

## 4. CopilotKit for chat and generated UI; study OpenDots
2026-11-10 · to verify

Choice: build chat with CopilotKit and AG-UI. Use CopilotKit/OpenDots as a reference or starting point.
Why: OpenDots is described as an MIT-licensed, self-hostable app template with a workspace and real-time voice calls, which overlaps a lot with Debo.
Check before relying on it: read the repo and its licence file yourself; confirm it runs with our stack; note what extra services it needs (reports say a CopilotKit project and a separate voice provider). Note that two different projects use the name "Open Intelligent UI" (one from CopilotKit, one from Thesys built on OpenUI). Do not mix them up.
Checked 2026-11-10: the LICENSE file in CopilotKit/OpenDots is MIT. CopilotKit 1.85.0 is installed in `apps/web`. OpenDots itself is a template to study, not a dependency; it is cloned beside this repo, not inside it.

## 5. Mem0 first, Graphiti maybe later
2026-11-10 · to verify

Choice: Mem0 behind `@debo/memory`.
Why: fastest path to per-person memory. Graphiti handles time and relationships better but needs a graph database.
Check before relying on it: Mem0 must let each memory carry our source id and must truly delete on request. If not, do not use it.
Checked 2026-11-10 on the hosted platform (decision 20): each memory carries `source_id`, and deleted memories no longer come back from the API. How long Mem0 keeps deleted data in backups is not stated.

## 6. Composio first for connectors
2026-11-10 · to verify

Choice: Composio behind `@debo/connectors`.
Why: handles app sign-in and ready-made actions; fastest for one developer.
Trade-off: hosted, so it holds users' app tokens. Nango is the self-hosted alternative.
Check before relying on it: current pricing, limits, and what its terms say about user data. Much of the public comparison between Composio and Nango is written by Composio; read Nango's own docs too.

## 7. Inngest for background jobs
2026-11-10 · to verify

Choice: Inngest.
Why: retries and multi-step jobs without running a queue.
Check before relying on it: limits on step duration for long audio; Trigger.dev is the alternative.

## 8. Fonts are self-hosted
2026-11-10 · decided

Choice: `@fontsource-variable` packages for Bricolage Grotesque and Figtree.
Why: no requests to an outside font service, which fits the privacy stance and makes builds work offline.

## 9. No licence chosen yet
2026-11-10 · open

Choice: none. The repo is public with all rights reserved until the owner picks one.
Why: open source versus closed is a business decision for the owner.

## 10. Landing page is a static export on Cloudflare Workers
2026-11-10 · replaced by 11

Choice: `apps/web` builds with `output: "export"` into `apps/web/out`, served as Worker static assets (`apps/web/wrangler.jsonc`, Worker name `debo-web`).
Why: the landing page has no server code, so plain files are the simplest, cheapest host, and the domain already lives in Cloudflare.
Revisit when: sign-in or any server route is added. Static export cannot run those; move to the OpenNext Cloudflare adapter or another Next.js host then.

## 11. Web app runs on Cloudflare Workers with the OpenNext adapter
2026-11-10 · decided (replaces 10)

Choice: `apps/web` is a normal server-rendered Next.js app, built with `@opennextjs/cloudflare` 1.20.16 and deployed as the Worker `debo-web` at debo.life. Next.js goes from 15 to 16.4.6.
Why: sign-in needs server routes (`/api/auth/...`), which a static export cannot run. OpenNext keeps us on Cloudflare, where the domain already lives. Neon Auth needs Next 16 or newer, and OpenNext 1.20.16 supports Next 16.4.5 or newer.
Check before relying on it: OpenNext's list of supported Next.js features, and the Worker size and CPU limits on our Cloudflare plan.

## 12. Postgres host is Neon
2026-11-10 · decided

Choice: Neon Postgres (project `sweet-dream-71477162`, branch `production`, AWS us-east-2). Driver is node-postgres (`pg`): through Cloudflare Hyperdrive (binding `HYPERDRIVE`) in production, and `DATABASE_URL` from `.env` locally. This replaces the `postgres` driver installed earlier. Decision 2 still holds (Postgres with pgvector); this picks the host.
Why: Neon also gives us sign-in, file storage and an AI gateway that branch with the database. Neon's own agent guide says to use node-postgres with Hyperdrive on Cloudflare.
Check before relying on it: pgvector index support and storage limits on our Neon plan; Hyperdrive must use the direct (not pooled) connection string.

## 13. Sign-in is Neon Auth (managed Better Auth)
2026-11-10 · decided

Choice: `@neon/auth` 0.8.2. Users and sessions live in the `neon_auth` schema of our Neon database. We do not run Better Auth ourselves, and `better-auth` is no longer a direct dependency.
Why: it is Better Auth, as `AGENTS.md` already chose, without us running the auth server or a mailer.
Check before relying on it:
- Auth emails use Neon's shared mail sender, which is for development only. Production needs our own mail sender (custom SMTP): https://neon.com/docs/auth/production-checklist.md
- Deleting an account: Neon's managed `delete-user` route returned 404 in testing. Our own `/api/account/delete` route does it instead: it deletes the person's files under `users/<id>/` through `@debo/ingest`, then their user row in the `neon_auth` schema through `@debo/db` (sessions and sign-in accounts cascade). When Debo stores entries, sources and memories, that route must delete those too.

## 14. File storage is Neon Object Storage, not Cloudflare R2
2026-11-10 · decided

Choice: Neon Object Storage through the S3 API (`@aws-sdk/client-s3`), in the private bucket `assets` declared in `neon.ts`. Files are handed out only through short-lived signed links.
Why: files branch together with the database rows that point at them, and it is one provider instead of two.
Check before relying on it: storage and download (egress) pricing, and that deleting a file is permanent.

## 15. Model calls go through the Neon AI Gateway
2026-11-10 · changed by 16

Choice: the Vercel AI SDK (`ai` 7.0.166) with `@neon/ai-sdk-provider` 1.3.2, inside `@debo/llm`. Default model `claude-haiku-5-5`.
Why: one key reaches many model makers, switching models is a one-word change, and it is the same provider as the rest of the backend.
Check before relying on it: the gateway needs prepaid AI Gateway credits. On 2026-11-10 none were bought, so every call fails with "credits required". Also check each model maker's terms on training, per `docs/PRIVACY-AND-TRUST.md`; Neon says the models are hosted by Databricks.

## 16. Anthropic first, Neon AI Gateway as fallback
2026-11-10 · decided · terms checked 2026-11-10

Choice: `@debo/llm` calls Anthropic first, with our `ANTHROPIC_API_KEY` and `@ai-sdk/anthropic` 4.0.99, model `claude-haiku-5-5`. If that call fails for any reason, it tries the same model through the Neon AI Gateway.
Why: the gateway has no credits yet, so every call there fails. Our Anthropic key works today. Keeping the gateway as a fallback means one outage does not stop answers.
Checked 2026-11-10 (training and retention terms, for the privacy page):
- Anthropic, Commercial Terms of Service (effective Jun 17, 2025), section B: "Anthropic may not train models on Customer Content from Services." https://www.anthropic.com/legal/commercial-terms
- Anthropic privacy center, commercial products: "By default, we will not use your inputs or outputs from our commercial products" to train models. The exception is feedback or bug reports a customer sends on purpose, which Debo does not send. https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- Anthropic retention for the API: "we automatically delete inputs and outputs on our backend within 30 days of receipt or generation." Exceptions: a different agreement (such as zero data retention), Usage Policy enforcement, the law, and chats flagged by trust and safety, where "We retain inputs and outputs for up to 2 years". https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- Anthropic's consumer privacy policy (effective Sep 10, 2026) "does not apply to content that we process on behalf of customers of our business offerings". https://www.anthropic.com/legal/privacy
- Anthropic's safety retention for Mythos-class models ("retained for 30 days") covers "Mythos-class models and future models with similar capabilities" and only changes things for zero-data-retention workspaces. It does not name Haiku, so it should not apply to `claude-haiku-5-5`. https://support.claude.com/en/articles/15425996-data-retention-practices-for-mythos-class-models
- Neon AI Gateway data retention (last updated 2026-10-29): "Most models are served through Databricks Model Serving, and data retention for those requests follows Databricks' policy". Databricks "may temporarily store inputs and outputs for up to 30 days to prevent, detect, and mitigate abuse." The Neon page says nothing about training. https://neon.com/docs/ai-gateway/data-retention
- Databricks Model Serving: "For all paid accounts, Model Serving does not use user inputs submitted to the service or outputs from the service to train any models or improve any Databricks services." Inputs and outputs are "stored in the same region as your workspace for up to thirty (30) days, and only accessible for detecting and responding to security or abuse concerns." "Partner model providers may retain data for safety purposes." https://docs.databricks.com/aws/en/machine-learning/model-serving#data-retention
Not verified: that Neon's account counts as a Databricks "paid account" (Neon does not say), and what Anthropic keeps when it is reached as a partner model through Databricks rather than directly. The privacy page says only what the pages above say. Check these pages again before launch and whenever a model changes.

## 17. Keyword search first, meaning search later
2026-11-10 · done: meaning search added (see below)

Choice: "Ask" finds the person's pieces with Postgres full-text search only (any word may match, ranked by `ts_rank`). There is no embedding column yet.
Why: there is no working embedding model. The gateway's `qwen3-embedding-0-6b` needs credits, and Anthropic does not make embeddings.
Check before relying on it: questions that use different words from the entry ("physician" vs "doctor") will miss. Add embeddings and a pgvector index on `chunks` when the gateway has credits or another embedding provider is chosen, then merge both searches as `docs/MEMORY.md` describes.
Done 2026-11-10: the gateway has credits. `chunks.embedding vector(1024)` with an HNSW cosine index; `qwen3-embedding-0-6b` through the gateway; keyword and meaning results merged with reciprocal rank fusion; meaning hits beyond cosine distance 0.60 dropped. Entries are embedded after save (Next `after()`); questions are embedded when asked, falling back to keyword search if that fails.

## 18. Mem0 is built, but not in the web app yet
2026-11-10 · replaced by 20

Choice: `@debo/memory` wraps self-hosted Mem0 (`mem0ai/oss` 3.3.1): Anthropic `claude-haiku-5-5` as its model, the gateway's `qwen3-embedding-0-6b` as embedder, pgvector in our Neon Postgres (tables `debo_memories`, `debo_memories_entities`, `memory_migrations`, made by Mem0, not Drizzle). Every memory carries `source_id`; deletes are real (tested on the `dev-ai` branch).
Why not in the web app: Mem0 imports the native module `better-sqlite3` at load time, which a Cloudflare Worker cannot load, and bundling it pulls in every optional provider (AWS, Azure and more). Rather than risk the live site, memories wait for a Node runtime.
Already true: deleting an account also deletes the person's rows in Mem0's tables (`deleteAccount`, by `payload.user_id`).
Exception to one-door rule: Mem0 calls the model and embedder itself, not through `@debo/llm`, so those calls are not in `usage` yet.
Check before relying on it: pick where memory work runs (a Neon Function, or a Node worker next to `apps/voice-agent`), then build the "What Debo knows" page on `list`, `update` and `forget`.

## 19. Chat is CopilotKit over AG-UI, on our own answer pipeline
2026-11-10 · decided

Choice: `/home/chat` uses CopilotKit 1.85 (v2 API) with a custom AG-UI agent that calls `answerQuestion` in `apps/web/src/lib/ask.ts`. CopilotKit never calls a model itself. Source chips are a rendered `show_sources` tool call.
Why: decision 4 chose CopilotKit and AG-UI. Open Intelligent UI is a separate app template (Python backend plus its own frontend), so we use CopilotKit directly instead of hosting it.
Check before relying on it: the chat sends only the latest question (no follow-up context yet); CopilotKit's runtime is large, so watch the Worker bundle size; CopilotKit telemetry is switched off.

## 20. Hosted Mem0 Platform, not self-hosted Mem0
2026-11-10 · decided (replaces 18)

Choice: `@debo/memory` uses the hosted Mem0 Platform (`MemoryClient` from `mem0ai` 3.3.1, main entry, API key `MEM0_API_KEY`) instead of self-hosted `mem0ai/oss`. The oss path and its direct dependencies (`pg`, `@anthropic-ai/sdk`) are removed from the package. The web app now extracts memories after an entry is saved or edited, forgets them when the entry is deleted, deletes all of a person's memories on account delete, and shows them on `/home/memories` ("What Debo knows"). With no `MEM0_API_KEY`, memory is off and nothing else changes.
Why: self-hosted Mem0 imports `better-sqlite3`, a native module a Cloudflare Worker cannot load (decision 18). The hosted client makes its calls with `fetch` and does not import it. Checked in a local workerd (`wrangler dev`, `nodejs_compat`): add, list, fix, forget and delete all work, with 0 telemetry calls. Mem0 runs the extraction model and the store, so there is no Node runtime for us to run.
How it keeps the rules: every memory has `metadata.source_id` and `run_id` = the entry id; memories without a source are never shown; every call passes the person's id, and fix or forget first reads the memory and refuses if it is someone else's; Mem0's v3 add only adds, never rewrites, so a fixed memory survives a re-read of its entry.
Trade-off: entry text and the memories made from it now go to, and are stored by, Mem0 (Embedchain, Inc., doing business as Mem0), a US company. Mem0's privacy policy (updated 22 August 2026) says it trains its AI models on data from free plan users and not on paid plan users, names OpenAI and Anthropic among its AI providers, stores data in the United States and other countries, and does not state how long it keeps deleted data. Mem0's model calls run on Mem0's side and are not counted in our `usage` table or the daily limit.
Check before relying on it:
- Which Mem0 plan Debo's account is on. If it is the free plan, Mem0 may train on people's entries: move to a paid plan, or get a Data Processing Addendum that rules training out, before inviting real people. The privacy page says this is not yet confirmed.
- Ask Mem0 for its DPA, sub-processor list and how long deleted data stays in backups.
- The full OpenNext build for the Worker could not run on the dev machine (old glibc). CI builds it; check the Worker bundle size and a real deploy before relying on it.
- Mem0 extraction costs are outside our daily limit. Watch the Mem0 bill.
