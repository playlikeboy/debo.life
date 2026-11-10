# Voice

Status: plan, phase 3. Do not start before "ask my life" works well in text.

## What the person gets

They press "Talk to Debo", speak, and hear Debo answer in a warm voice. They can interrupt. The sources Debo used appear on screen while it speaks.

## How it works

```
Browser mic  ->  LiveKit room  ->  apps/voice-agent
                                     speech-to-text
                                     @debo/memory (find)
                                     @debo/llm (answer)
                                     text-to-speech
Browser speaker  <-  LiveKit room  <-
```

- **LiveKit Agents** runs the session: live audio, knowing when the person stopped talking, handling interruptions.
- `apps/voice-agent` is a long-running worker. It does not run on serverless.
- The worker uses the same `@debo/memory` and `@debo/llm` as text chat. Voice is a second way in, not a second brain.
- `apps/web` creates a short-lived LiveKit token for the signed-in person and opens the room.

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

## Choices to make in phase 3

| Choice | How to decide |
|---|---|
| Speech-to-text provider | Test on real speech, including mixed Hindi and English. Compare accuracy, delay and cost. |
| Text-to-speech provider and voice | Shortlist three voices, test with five people, pick the one they trust most. |
| Self-host LiveKit or use its cloud | Start with the cloud. Revisit when cost matters. |
| Agent language (Python or Node) | The worker must call `@debo/memory`. If the Node SDK is ready enough, use it and share code. If not, use Python and call the web app's API. Check the current LiveKit docs before choosing. |

Write the choices in [`DECISIONS.md`](./DECISIONS.md).

## Quality bar

- Debo starts answering within about one second of the person finishing.
- Interrupting stops Debo at once.
- A dropped connection reconnects without losing the conversation.
