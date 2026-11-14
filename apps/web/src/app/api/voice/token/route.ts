import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { getAuth } from "@/lib/auth/server";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/** The LiveKit agent that joins the room (apps/voice-agent, agentName). */
const AGENT_NAME = "debo-voice";

/**
 * Start a voice session for the signed-in person.
 *
 * Returns a LiveKit room token that lasts 10 minutes and works for one new
 * room only. The participant identity is the person's user id, taken from
 * the session here on the server; the browser cannot choose it. The token
 * also asks LiveKit to send Debo's voice agent into the room.
 * The browser never sees the LiveKit API key or secret.
 */
export async function POST() {
  const { data: session } = await getAuth().getSession();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first, then try again." }, { status: 401 });

  const env = serverEnv();
  const url = env.LIVEKIT_URL;
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret || !env.VOICE_AGENT_SECRET) {
    return Response.json({ error: "Talking to Debo is not set up yet." }, { status: 503 });
  }

  const room = `debo-${crypto.randomUUID()}`;
  const token = new AccessToken(apiKey, apiSecret, { identity: userId, ttl: "10m" });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  token.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })] });

  return Response.json(
    { url, room, token: await token.toJwt() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
