# Debo

**A friendly assistant that remembers your life.**

Website: [debo.life](https://debo.life)

Debo keeps your journals, voice notes, papers and photos in one place. Ask it anything about your own life, by typing or by talking, and it answers with a link to where it learned it. You can see, fix and delete everything Debo knows.

## Status

Debo is being rebuilt from scratch. **Today this repo holds a landing page and the plan.** Nothing below is live yet.

| Part | Status |
|---|---|
| Landing page (`apps/web`) | Built |
| Journal, uploads, "ask my life" | Planned, phase 1 |
| Memory you can see and edit | Planned, phase 2 |
| Talk to Debo by voice | Planned, phase 3 |
| Connect your apps | Planned, phase 4 |
| Use Debo's memory in other AI tools (MCP) | Planned, phase 4 |
| Plans and "bring your own key" | Planned, phase 5 |

The full plan is in [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## What Debo will do

- **Remember.** Write, talk, or drop in a file or photo. Debo keeps it.
- **Answer with sources.** Every answer links to the entry, recording or file it came from.
- **Talk.** Speak to Debo and hear it answer.
- **Stay in your control.** See every memory. Fix it or forget it. Export or delete everything.
- **Connect.** Bring in your calendar, notes and more, only when you say so.
- **Work your way.** Use your own AI key for free, or pay for a plan and use ours.

## Run it

You need Node 22 or newer and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The landing page needs no environment variables.

Other commands:

```bash
pnpm build       # build everything
pnpm typecheck   # check types
```

## What is in this repo

```
apps/
  web/           Next.js app. Landing page today, the product later.
  voice-agent/   Voice worker (planned)
  mcp-server/    MCP server (planned)
packages/
  db/            Database schema and queries (planned)
  memory/        Save and recall memories (planned)
  ingest/        Turn files and audio into text (planned)
  connectors/    Connect other apps (planned)
  llm/           Model calls, keys and usage (planned)
  ui/            Shared components (planned)
docs/            The plan
```

## Docs

| Doc | What it covers |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | Rules for anyone, human or AI, working here. Start here. |
| [`DESIGN.md`](./DESIGN.md) | Look, feel, colours, type, patterns |
| [`docs/PRODUCT.md`](./docs/PRODUCT.md) | What Debo is, who it is for, features |
| [`docs/WRITING.md`](./docs/WRITING.md) | Plain-English rules for all text |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | How the parts fit together |
| [`docs/MONOREPO.md`](./docs/MONOREPO.md) | Folder layout and package rules |
| [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md) | Database tables |
| [`docs/MEMORY.md`](./docs/MEMORY.md) | How Debo remembers and recalls |
| [`docs/VOICE.md`](./docs/VOICE.md) | Talking to Debo |
| [`docs/CONNECTORS.md`](./docs/CONNECTORS.md) | Connecting other apps |
| [`docs/BYOK-AND-PLANS.md`](./docs/BYOK-AND-PLANS.md) | Your own key, plans, billing |
| [`docs/PRIVACY-AND-TRUST.md`](./docs/PRIVACY-AND-TRUST.md) | Promises about data, and how we keep them |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Build order |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | Why we chose what we chose |
| [`docs/SETUP.md`](./docs/SETUP.md) | Accounts and services you will need |

## Contributing

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md). To report a security problem, read [`SECURITY.md`](./SECURITY.md).

## Licence

Not chosen yet. Until a `LICENSE` file is added, all rights are reserved by the owner.
