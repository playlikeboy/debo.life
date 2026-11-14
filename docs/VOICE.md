# Voice

Status: built and deployed (decision 25). Verified on 14 November 2026 on debo.life with a browser's fake microphone: the token is signed, the `debo-voice` agent joins the room in `ap-south`, speaks its greeting with live captions, answers a typed question through `/api/voice/brain` with the right source chip ("Journal, 11 November") and speaks the answer, and "End conversation" turns the microphone off. Not yet verified: real speech, including mixed Hindi and English, and interrupting by voice.

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

## Voice in the Debo app (`os/`)

The Debo app in `os/` (Hono server plus Expo app for iOS, Android and web) has its own "Talk" tab. It uses the same LiveKit agent (`apps/voice-agent`) and the same event format as the web app. Status: server and screen are built and tested with fakes; not yet tried against a live LiveKit room or on a phone.

- **Server** (`os/apps/server/src/voice/`):
  - `POST /api/voice/token`: needs a signed-in owner. Returns `{ url, room, token }`. The token lasts 10 minutes, opens one new room, uses the owner id as identity and dispatches `debo-voice`. It answers 503 "Talking to Debo is not set up yet." if any of the four variables below is missing (or the secret is under 32 characters).
  - `POST /api/voice/brain`: only the voice agent, with `Authorization: Bearer VOICE_AGENT_SECRET` (compared in constant time). Body `{ userId, sessionId, question, history }`. Streams NDJSON `sources`, `text`, `say`, `done`. It is mounted before the owner sign-in check because the agent has no owner session.
  - Both are limited by the server's general 120 requests a minute per address.
- **Variables** (set on the server; see `os/.env.example`): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `VOICE_AGENT_SECRET`.
- **Point the agent at os.** When os is live, set the LiveKit agent secret `DEBO_URL` to the public address of the os server (its `PUBLIC_API_URL`, for example `https://api.debo.life`) and `VOICE_AGENT_SECRET` to the same value as on the server, then `cd apps/voice-agent && lk agent deploy` (or `lk agent update-secrets`). Until then `DEBO_URL` stays on the web app. The agent calls `{DEBO_URL}/api/voice/brain`.
- **The brain is swappable.** The route only needs a `VoiceBrain` (`voice/brain.ts`): an async generator of `sources`, `text` and `done` events. Today `createApp` uses `EngineVoiceBrain`, which answers with os's chat engine and shows no source chips. To use Debo's journal brain, change one line in `createApp` (`os/apps/server/src/app.ts`, the `voiceBrain` line) to `options.voiceBrain ?? <journal brain wrapper>`, or pass `voiceBrain` in the options. Voice transcripts are not saved yet in os.
- **App** (`os/apps/mobile/src/debo-talk.tsx`, `debo-voice-engine.ts`, `debo-voice-platform.{web,native}.ts`): consent text before the microphone, a status line that says in words whether the microphone is on, Start talking, Stop Debo, Turn microphone off, End conversation, live captions, source chips, a text box, screen-reader labels, reduced motion. If the microphone is refused the conversation stays open for typing.
- **Web**: `livekit-client` 2.24.0, loaded only when "Start talking" is pressed (its own 619 kB file in `expo export`).
- **iOS and Android**: use LiveKit's official route: `@livekit/react-native` 3.1.0, `@livekit/react-native-webrtc` 150.1.1, and the Expo plugins `@livekit/react-native-expo-plugin` and `@config-plugins/react-native-webrtc` (13.x is the line for Expo 54). WebRTC is native code, so voice needs a development build or store build, not Expo Go. In Expo Go the screen says "Voice needs the Debo app build" and typing still works. To build: `cd os/apps/mobile`, `npx expo prebuild --clean` (or `npx expo run:ios` / `npx expo run:android`, or an EAS build), then start with `npx expo start --dev-client`. The plugins in `app.json` add the microphone permission text, the Android audio permissions and the LiveKit pod source. The WebRTC plugin also adds a camera permission string; Debo never opens the camera.
- **Checked**: `tsc`, `expo export` for web, iOS and Android, `expo prebuild` for iOS and Android (permissions and Podfile sources present), and 10 node tests for both routes. **Not checked**: a real LiveKit room from os, a native device or simulator, real speech.

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
