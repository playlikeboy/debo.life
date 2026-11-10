# voice-agent

Status: wired, switched off until the LiveKit keys are set. Not deployed. No speech provider chosen yet.

LiveKit Agents worker that will let people talk to Debo. It is a long-running process, not a serverless function, so it does not run on Cloudflare (decision 3 in [`docs/DECISIONS.md`](../../docs/DECISIONS.md)). See [`docs/VOICE.md`](../../docs/VOICE.md). Read [`docs/MONOREPO.md`](../../docs/MONOREPO.md) before adding code here.

## What it does today

- `src/index.ts` checks for the keys. Without them it prints "Voice is switched off…" and exits.
- `src/agent.ts` joins a room and says nothing. Speech-to-text and text-to-speech are marked TODO until a provider is chosen (phase 3).
- Voice must never answer about a person's life by itself. Answers will come from the web app's answer pipeline (`apps/web/src/lib/ask.ts`), so sources, the daily limit and the activity record hold for voice too.

## Keys to create

| Name | Where it comes from |
|---|---|
| `LIVEKIT_URL` | LiveKit Cloud project, the `wss://` URL |
| `LIVEKIT_API_KEY` | LiveKit Cloud project, API keys |
| `LIVEKIT_API_SECRET` | Same place, shown once when the key is made |

## Running it once keys exist

```bash
pnpm --filter @debo/voice-agent dev     # development mode
pnpm --filter @debo/voice-agent start   # production mode
```

Node 22.18 or newer runs the TypeScript files directly. Host it on a container service, not Cloudflare.
