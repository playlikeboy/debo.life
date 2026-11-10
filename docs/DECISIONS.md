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
2026-11-10 · decided

Choice: `@debo/llm` calls Anthropic first, with our `ANTHROPIC_API_KEY` and `@ai-sdk/anthropic` 4.0.99, model `claude-haiku-5-5`. If that call fails for any reason, it tries the same model through the Neon AI Gateway.
Why: the gateway has no credits yet, so every call there fails. Our Anthropic key works today. Keeping the gateway as a fallback means one outage does not stop answers.
Check before relying on it: Anthropic's API terms say API data is not used for training by default. Confirm that on their current commercial terms before launch, and list Anthropic on the privacy page.

## 17. Keyword search first, meaning search later
2026-11-10 · decided

Choice: "Ask" finds the person's pieces with Postgres full-text search only (any word may match, ranked by `ts_rank`). There is no embedding column yet.
Why: there is no working embedding model. The gateway's `qwen3-embedding-0-6b` needs credits, and Anthropic does not make embeddings.
Check before relying on it: questions that use different words from the entry ("physician" vs "doctor") will miss. Add embeddings and a pgvector index on `chunks` when the gateway has credits or another embedding provider is chosen, then merge both searches as `docs/MEMORY.md` describes.
