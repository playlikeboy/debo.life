# Voice

Status: built (decision 25), not yet tested with a real microphone on the live site. The pieces below are deployed; the checklist at the end says what has been verified.

## What the person gets

On `/home/voice` ("Talk to Debo") they press "Start talking", allow the microphone, and speak in English, Hindi or a mix. Debo answers out loud from their own entries and shows the source chips on screen. They can talk over Debo, press "Stop Debo", turn the microphone off, type instead, or end the conversation.

## How it works

```
Browser (/home/voice)                 debo.life (Cloudflare Worker)          LiveKit Cloud (ap-south)
  "Start talking"  ── POST /api/voice/token ──>  signs a 10-minute room token
                                                 identity = the person's user id
                                                 dispatches agent "debo-voice"
  mic audio  ─────────────── WebRTC ──────────────────────────────────>  apps/voice-agent
                                                                          Deepgram Nova-3 (multi) hears
                                                 POST /api/voice/brain <── question + recent turns
                                                 askStream (the one brain)  (Bearer VOICE_AGENT_SECRET)
                                                 NDJSON: sources, text ──>  Cartesia Sonic-3 speaks
  speaker, captions (lk.transcription), source chips (debo.sources)  <──
```

- **One brain.** The agent has no model of its own for answers: its `llmNode` streams from `/api/voice/brain`, which runs `askStream`, the same pipeline as chat. The daily limit, usage rows, the activity record, "I don't have anything about that yet" and small talk (decision 24) all behave the same as in chat.
- **Identity.** The browser never chooses who it is. `/api/voice/token` reads the session and puts the user id in the token as the participant identity. The agent passes that id to `/api/voice/brain` together with a shared secret that only the agent and the Worker know.
- **Models.** Speech to text: Deepgram Nova-3 with `language: "multi"` (English and Hindi, including switching mid-sentence), through LiveKit Inference. Text to speech: Cartesia Sonic-3, Hindi pronunciation by default (`VOICE_TTS_LANGUAGE=hi`), which also reads English. End of turn: LiveKit's turn detector. No extra provider keys: LiveKit Inference bills through the LiveKit project.
- **Interrupting.** Speaking over Debo stops it (LiveKit's interruption handling cancels the brain request). "Stop Debo" calls the agent's `debo.interrupt` RPC.
- **Transcripts.** If "Keep voice transcripts" is on in Settings (the default), each exchange is saved as a chat, so it shows in Chat and can be deleted there. Audio is never stored by Debo.
- **Follow-ups.** The agent sends the recent turns with each question. `askStream` does not use them yet (the brain work that adds history is in progress), so a follow-up like "and after that?" is searched on its own words for now.

## Running and deploying

- Secrets: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and `VOICE_AGENT_SECRET` are Worker secrets on `debo-web` and GitHub secrets. The agent gets `VOICE_AGENT_SECRET` and `DEBO_URL` as LiveKit agent secrets; LiveKit injects its own keys.
- `apps/voice-agent` is its own project, outside the pnpm workspace, because LiveKit Cloud builds it alone from its `Dockerfile` and `pnpm-lock.yaml`.
- Deploy a new version: `cd apps/voice-agent && lk agent deploy`. Status and logs: `lk agent status`, `lk agent logs`.

## Debo's voice

- One voice, chosen once, used everywhere. Warm, calm, clear. Not a child's voice, not a cartoon.
- Speaks in short sentences. Spoken answers are shorter than written ones.
- Says sources out loud briefly ("from your journal on the fourteenth of March") and shows the chips on screen.
- Says "I don't have anything about that yet" when it does not know.
- Never claims to be a person.

## Rules

1. **The mic is off unless the person turned it on.** A clear indicator shows when Debo is listening.
2. **Ask before saving a conversation.** Default: keep the transcript as a source, do not keep the audio. Let the person choose.
3. **Never record other people in secret.** If the person uploads a recording with others in it, that is their choice; Debo does not start recording on its own.
4. **Voice cannot do risky things.** Forgetting memories, connecting apps, changing plans and deleting the account need a tap on screen.
5. **Count the minutes.** Voice costs much more than text. Record seconds in `usage` and show the person what they have left.

## Still to do

- Test with real speech on the live site, including mixed Hindi and English, and write the results here.
- Choose Debo's own voice (the current one is a stock Cartesia voice) with a few real listeners.
- Count voice minutes in `usage` (rule 5). LiveKit's dashboard shows them today; Debo's daily limit counts only the answer tokens.
- Use the conversation history in `askStream` for follow-ups.

## Quality bar

- Debo starts answering within about one second of the person finishing.
- Interrupting stops Debo at once.
- A dropped connection reconnects without losing the conversation.
