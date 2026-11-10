# Roadmap

Build in this order. Do not start a phase until the one before it meets its "done when" line. Each phase leaves something a real person can use.

## Phase 0: foundation (done)

- [x] Monorepo with pnpm and Turborepo
- [x] Docs and agent rules
- [x] Landing page in `apps/web`

## Phase 1: save things and ask about them

The smallest version that is truly useful.

- [ ] `@debo/db`: Postgres, pgvector, Drizzle, first migration (`users`, `sources`, `chunks`, `conversations`, `messages`, `usage`, `activity`)
- [ ] Sign-in with Better Auth
- [ ] Delete account, built now, not later
- [ ] Journal: write, edit, list
- [ ] Upload a voice note, a PDF, a photo to R2
- [ ] `@debo/ingest` and background jobs: file to text to chunks to embeddings
- [ ] `@debo/llm`: one door for model calls, usage rows
- [ ] Ask my life: chat that answers only from the person's sources and shows source chips
- [ ] "I don't have anything about that yet" when nothing is found
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
