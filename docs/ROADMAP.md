# Roadmap

Build in this order. Do not start a phase until the one before it meets its "done when" line. Each phase leaves something a real person can use.

## What's next (as of 10 November 2026)

Where we are: a person can sign up, write journal entries, ask Debo about them and get answers with source chips, edit and delete entries, read a record of what Debo did, and delete their account. Each person has a daily AI limit. It runs at debo.life and passes the end-to-end test. Phase 1 is not done: voice notes, papers and photos cannot be saved yet.

Do these in order. The first four protect people and our bill, so they come before new features.

1. ~~**Cap spending on our AI key.**~~ Done: `usage` table, a row per model call with token counts only, and a per-person daily limit (`DAILY_TOKEN_LIMIT`, default 40,000 tokens, resets at midnight UTC). Anyone can sign up, and every question costs us money on the Anthropic key. Add the `usage` table, write a row per model call (never the text), and stop asking for the day at a per-person limit with a plain message. See `BYOK-AND-PLANS.md`, "Limits".
2. ~~**Keep the activity record.**~~ Done: `activity` table (ids and times only) and the "What Debo did" page at `/home/activity`. Promise 7, "Nothing happens in secret", is not true yet. Add the `activity` table and write a row when Debo saves, deletes or answers (ids only).
3. **Use our own mail sender for sign-in emails.** Neon's shared sender is for development only. Set up custom SMTP, then decide whether to require email verification at sign-up.
4. ~~**Publish a privacy page.**~~ Done: `/privacy`. Still to do: confirm Anthropic's training terms. List every company that touches data today: Neon (database, sign-in, files, AI gateway), Databricks (hosts the gateway's models), Cloudflare (hosting) and Anthropic (answers). Confirm Anthropic's current terms on training first (decision 16).
5. ~~**Journal: edit an entry.**~~ Done: "Edit this entry" replaces the text and its chunks in one transaction. Saving an edit must replace its chunks too.
6. **Uploads: voice notes, papers and photos.** Store the original in Neon Object Storage under `users/<id>/`, turn it into text with `@debo/ingest` in a background job (Inngest), and make it searchable like entries. Choose a speech-to-text provider first.
7. **Meaning search.** When the AI gateway has credits (or another embedding provider is chosen), add embeddings and a pgvector index to `chunks`, and merge the results with keyword search (decision 17).
8. **Recall test set.** Made-up entries and questions with known answers, run before each release, so search changes can be checked.
9. **Export everything.** A zip with entries as Markdown and the original files. Then Phase 1 is done and Phase 2 starts.

Housekeeping, not features:

- Replace the keys that were pasted into chat on 10 November (Neon database password, storage keys, AI gateway token, Cloudflare token), then update the Worker secrets and GitHub secrets.
- Buy Neon AI Gateway credits if the fallback should work, or remove it.

## Phase 0: foundation (done)

- [x] Monorepo with pnpm and Turborepo
- [x] Docs and agent rules
- [x] Landing page in `apps/web`

## Phase 1: save things and ask about them

The smallest version that is truly useful.

- [x] `@debo/db`: Postgres, Drizzle, first migration (`sources` and `chunks`; users live in Neon Auth)
- [x] `@debo/db`: `usage` and `activity` tables
- [ ] `@debo/db`: `conversations`, `messages` tables, and pgvector embeddings on `chunks`
- [x] Sign-in with Neon Auth (managed Better Auth)
- [x] Delete account, built now, not later (deletes files, the account, entries, sessions and sign-in cookies)
- [x] Journal: write, list, delete
- [x] Journal: edit
- [ ] Upload a voice note, a PDF, a photo to file storage (Neon Object Storage)
- [ ] `@debo/ingest` and background jobs: file to text to chunks to embeddings
- [x] `@debo/llm`: one door for model calls (Anthropic first, Neon AI Gateway as fallback)
- [x] `@debo/llm`: usage rows and a daily limit per person
- [x] Ask my life: answers only from the person's entries and shows source chips (keyword search for now)
- [x] "I don't have anything about that yet" when nothing is found
- [ ] Recall test set with made-up data

**Done when:** a new person can sign up, save three things, ask a question, get a correct answer with the right source, and delete their account, with no help.

## Phase 2: memory you can see

- [ ] `@debo/memory` with Mem0 behind it, every memory linked to a source
- [ ] "What Debo knows" page: list, search, fix, forget
- [ ] People page
- [ ] Activity record page
- [ ] Export everything
- [ ] Daily note (opt-in)

**Done when:** the recall test set passes at a level you would trust with your own journal, and a person can find and remove any single thing Debo knows.

## Phase 3: talk to Debo

- [ ] `apps/voice-agent` with LiveKit Agents
- [ ] Choose speech-to-text, text-to-speech and Debo's voice
- [ ] "Talk to Debo" screen with a clear listening indicator and live source chips
- [ ] Voice minutes counted in `usage`

**Done when:** a spoken question gets a spoken answer within about a second, with sources on screen, and interrupting works.

## Phase 4: connect

- [ ] `@debo/connectors` with Composio behind it
- [ ] Google Calendar, read-only
- [ ] Notion, chosen pages
- [ ] Telegram capture bot
- [ ] `apps/mcp-server`, read-only, with tokens the person creates and can turn off
- [ ] Start Google verification early if Gmail or Drive are wanted

**Done when:** a person can connect one app, see what came in, disconnect, and forget everything from it.

## Phase 5: plans

- [ ] "Use your own key": add, test, remove, stored encrypted
- [ ] Limits from real cost numbers
- [ ] Payments through a provider's hosted checkout
- [ ] Pricing page with plain words
- [ ] Privacy policy and terms checked by someone qualified

**Done when:** a person can pay, hit a limit, see a clear message, and cancel in one click.

## Later, in no fixed order

- Rich answers: timelines, lists and cards drawn by the assistant (CopilotKit generated UI)
- On this day, life timeline, weekly look back
- Phone app or installable web app with share-to-Debo
- Browser button
- Import history from other AI assistants
- Graphiti, if time-based questions keep failing
- Gmail and Drive
- Dark theme

## What not to do

- Do not start with voice or connectors. Without good recall, Debo is only a cute chatbot.
- Do not add a second feature to a phase to "save time".
- Do not launch publicly before the checklist in [`PRIVACY-AND-TRUST.md`](./PRIVACY-AND-TRUST.md) is complete.
