// Debo's voice worker, run by LiveKit Cloud.
//
// debo.life signs a short-lived room token for a signed-in person, with the
// person's user id as the participant identity, and asks LiveKit to send this
// agent ("debo-voice") into the room. The agent hears the person (Deepgram
// Nova-3 through LiveKit Inference, English and Hindi mixed), asks Debo's
// brain for the answer (the same agent as chat), and speaks it (Cartesia Sonic-3 through LiveKit
// Inference). Interrupting stops the answer at once.
//
// Audio is never stored by Debo. Based on livekit-examples/agent-starter-node (MIT).
import { ServerOptions, cli, defineAgent, inference, voice } from "@livekit/agents";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DeboVoiceAgent } from "./agent.ts";

const Env = z.object({
  // The Debo app's server. Voice runs through the same agent as chat there.
  DEBO_URL: z.string().url().default("https://api.debo.life"),
  VOICE_AGENT_SECRET: z.string().min(32),
  VOICE_TTS_VOICE: z.string().min(1).default("9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"),
  VOICE_TTS_LANGUAGE: z.string().min(2).default("hi"),
  // "off" stops Debo from changing her feeling per reply (if the voice service ever rejects it).
  VOICE_EMOTION: z.enum(["on", "off"]).default("on"),
  VOICE_TTS_SPEED: z.coerce.number().min(0.6).max(1.5).optional(),
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

    const tts = new inference.TTS({
      model: "cartesia/sonic-3",
      voice: env.VOICE_TTS_VOICE,
      language: env.VOICE_TTS_LANGUAGE,
      ...(env.VOICE_TTS_SPEED ? { modelOptions: { speed: env.VOICE_TTS_SPEED } } : {}),
    });
    const session = new voice.AgentSession({
      stt: new inference.STT({ model: "deepgram/nova-3", language: "multi" }),
      // Never used for answers: DeboVoiceAgent.llmNode asks Debo's brain.
      // The framework needs an LLM object to run the reply pipeline.
      llm: new inference.LLM({ model: "google/gemma-4-31b-it" }),
      tts,
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
        // Answer sooner than the 500 ms default after the person stops talking.
        endpointing: { minDelay: 350, maxDelay: 2500 },
        // Do not give up a reply for a cough or "mm-hm", and carry on after one.
        interruption: { falseInterruptionTimeout: 1500, resumeFalseInterruption: true },
        // Off on purpose: the brain can run tools (save, search, apps), and a
        // guessed-early run would repeat them if the person kept talking.
        preemptiveGeneration: { enabled: false },
      },
    });

    await session.start({
      agent: new DeboVoiceAgent({
        deboUrl: env.DEBO_URL,
        secret: env.VOICE_AGENT_SECRET,
        userId: userId.data,
        sessionId,
        room: ctx.room,
        tts,
        emotion: env.VOICE_EMOTION === "on",
        speed: env.VOICE_TTS_SPEED,
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

    session.say("Hey! I'm here. What's on your mind?");
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "debo-voice",
  }),
);
