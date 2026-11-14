import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { VOICE_AGENT_NAME, VOICE_TOKEN_TTL, type VoiceConfig } from "./config.ts";

export interface VoiceSession {
  url: string;
  room: string;
  token: string;
}

/**
 * A LiveKit room token for one person.
 *
 * - The identity is the owner id from the signed-in session, never anything the app sent.
 * - The room is new every time, so a token never opens someone else's conversation.
 * - It lasts 10 minutes and joins that one room only.
 * - It asks LiveKit to send the "debo-voice" agent into the room.
 */
export async function mintVoiceSession(config: VoiceConfig, owner: string): Promise<VoiceSession> {
  const room = `debo-${crypto.randomUUID()}`;
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: owner,
    ttl: VOICE_TOKEN_TTL,
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: VOICE_AGENT_NAME })],
  });
  return { url: config.livekitUrl, room, token: await token.toJwt() };
}
