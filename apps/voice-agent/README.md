# voice-agent

Debo's voice, a LiveKit Agents worker (Node) that runs on LiveKit Cloud. See [`docs/VOICE.md`](../../docs/VOICE.md) and decision 25 in [`docs/DECISIONS.md`](../../docs/DECISIONS.md).

It hears the person (Deepgram Nova-3, English and Hindi), sends the question to Debo's one brain at `https://debo.life/api/voice/brain`, and speaks the answer (Cartesia Sonic-3). It never answers on its own.

This folder is outside the pnpm workspace on purpose: LiveKit Cloud builds it alone from `Dockerfile` and `pnpm-lock.yaml`. Install and check it here with `pnpm install --ignore-workspace`, `pnpm typecheck` and `pnpm test`.

Deploy: `lk agent deploy` (first time: `lk agent create --region ap-south --secrets-file <file>`). Secrets the agent needs: `VOICE_AGENT_SECRET` (same value as the Worker secret) and `DEBO_URL`. Optional: `VOICE_TTS_VOICE`, `VOICE_TTS_LANGUAGE`.

Started from [livekit-examples/agent-starter-node](https://github.com/livekit-examples/agent-starter-node) (MIT, see `LICENSE`).
