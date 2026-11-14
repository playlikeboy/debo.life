// Debo's voice worker, run by LiveKit Cloud.
//
// debo.life signs a short-lived room token for a signed-in person, with the
// person's user id as the participant identity, and asks LiveKit to send this
// agent ("debo-voice") into the room. The agent hears the person (Deepgram
// Nova-3 through LiveKit Inference, English and Hindi mixed), asks Debo's
// brain for the answer, and speaks it (Cartesia Sonic-3 through LiveKit
// Inference). Interrupting stops the answer at once.
//
// Audio is never stored by Debo. Based on livekit-examples/agent-starter-node (MIT).
import { ServerOptions, cli, defineAgent, inference, voice } from "@livekit/agents";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DeboVoiceAgent } from "./agent.ts";

const Env = z.object({
  DEBO_URL: z.string().url().default("https://debo.life"),
  VOICE_AGENT_SECRET: z.string().min(32),
  VOICE_TTS_VOICE: z.string().min(1).default("9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"),
  VOICE_TTS_LANGUAGE: z.string().min(2).default("hi"),
});

const UserId = z.string().uuid();

export default defineAgent({
  entry: async (ctx) => {
    const env = Env.parse(process.env);
    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    // The identity was set by debo.life when it signed the token, not by the browser.
    const userId = UserId.safeParse(participant.identity);
    if (!userId.success) {
      console.error("voice: participant is not a Debo user, leaving", { room: ctx.room.name });
      ctx.shutdown("not a Debo user");
      return;
    }
    const sessionId = randomUUID();

    const session = new voice.AgentSession({
      stt: new inference.STT({ model: "deepgram/nova-3", language: "multi" }),
      // Never used for answers: DeboVoiceAgent.llmNode asks Debo's brain.
      // The framework needs an LLM object to run the reply pipeline.
      llm: new inference.LLM({ model: "google/gemma-4-31b-it" }),
      tts: new inference.TTS({
        model: "cartesia/sonic-3",
        voice: env.VOICE_TTS_VOICE,
        language: env.VOICE_TTS_LANGUAGE,
      }),
      turnHandling: { turnDetection: new inference.TurnDetector() },
    });

    await session.start({
      agent: new DeboVoiceAgent({
        deboUrl: env.DEBO_URL,
        secret: env.VOICE_AGENT_SECRET,
        userId: userId.data,
        sessionId,
        room: ctx.room,
      }),
      room: ctx.room,
    });

    // The "Stop Debo" button on the Talk page: stop speaking now.
    ctx.room.localParticipant?.registerRpcMethod("debo.interrupt", async () => {
      try {
        await session.interrupt().await;
      } catch {
        // Nothing was playing, or it already stopped.
      }
      return "ok";
    });

    session.say("Hi, I'm listening. Ask me about anything you've written in Debo.");
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "debo-voice",
  }),
);
