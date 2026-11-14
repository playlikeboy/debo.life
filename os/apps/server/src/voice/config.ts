// Voice settings come from the environment. They are read on each request (not
// at startup) so the rest of Debo still runs when voice is not set up.

export interface VoiceConfig {
  /** wss:// address of the LiveKit project the app and the voice agent join. */
  livekitUrl: string;
  apiKey: string;
  apiSecret: string;
  /** Shared secret the voice agent sends to POST /api/voice/brain. */
  agentSecret: string;
}

/** The LiveKit agent that joins each room (apps/voice-agent, `agentName`). */
export const VOICE_AGENT_NAME = "debo-voice";

/** A room token lasts ten minutes: long enough to join, short enough to be safe if it leaks. */
export const VOICE_TOKEN_TTL = "10m";

/** A shorter secret than this counts as "not set up", so a weak one is never accepted. */
export const MIN_AGENT_SECRET_LENGTH = 32;

export function readVoiceConfig(
  env: Record<string, string | undefined> = process.env,
): VoiceConfig | undefined {
  const livekitUrl = env.LIVEKIT_URL?.trim();
  const apiKey = env.LIVEKIT_API_KEY?.trim();
  const apiSecret = env.LIVEKIT_API_SECRET?.trim();
  const agentSecret = env.VOICE_AGENT_SECRET?.trim();
  if (!livekitUrl || !apiKey || !apiSecret || !agentSecret) return undefined;
  if (agentSecret.length < MIN_AGENT_SECRET_LENGTH) return undefined;
  return { livekitUrl, apiKey, apiSecret, agentSecret };
}

export const VOICE_NOT_SET_UP = "Talking to Debo is not set up yet.";
