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
2026-11-10 · decided

Choice: `apps/web` builds with `output: "export"` into `apps/web/out`, served as Worker static assets (`apps/web/wrangler.jsonc`, Worker name `debo-web`).
Why: the landing page has no server code, so plain files are the simplest, cheapest host, and the domain already lives in Cloudflare.
Revisit when: sign-in or any server route is added. Static export cannot run those; move to the OpenNext Cloudflare adapter or another Next.js host then.
