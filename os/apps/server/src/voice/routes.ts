import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../errors.ts";
import { VOICE_ERROR_MESSAGE, type VoiceBrain, type VoiceBrainEvent } from "./brain.ts";
import { readVoiceConfig, VOICE_NOT_SET_UP, type VoiceConfig } from "./config.ts";
import { isVoiceAgent } from "./secret.ts";
import { mintVoiceSession } from "./token.ts";

type Env = Record<string, string | undefined>;

const bodySchema = z.object({
  userId: z.string().trim().min(1).max(200),
  sessionId: z.string().trim().min(1).max(200),
  question: z.string().trim().min(1).max(500),
  history: z
    .array(
      z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }),
    )
    .max(12)
    .default([]),
});

/**
 * POST /api/voice/brain. Called only by the voice agent (apps/voice-agent),
 * which proves itself with VOICE_AGENT_SECRET. Mount it BEFORE the owner
 * sign-in check in app.ts: the agent has no owner session.
 *
 * Streams newline-delimited JSON: `sources`, `text`, `say`, then `done`.
 * Never log the question or the answer: they hold the person's own words.
 */
export function voiceAgentRoutes(brain: VoiceBrain, env: () => Env = () => process.env) {
  const app = new Hono();
  app.post("/brain", async (c) => {
    const config = readVoiceConfig(env());
    if (!config) throw new AppError(VOICE_NOT_SET_UP, 503);
    if (!isVoiceAgent(c.req.header("authorization"), config.agentSecret))
      throw new AppError("Not allowed.", 401);
    const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new AppError("Bad request.", 400);

    const signal = c.req.raw.signal;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: VoiceBrainEvent) =>
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        let finished = false;
        let spoke = false;
        try {
          for await (const event of brain.answer(parsed.data, signal)) {
            if (finished) break;
            if (event.type === "text" || event.type === "say") spoke = true;
            if (event.type === "done") finished = true;
            send(event);
          }
        } catch (error) {
          console.error(`[Debo] voice brain failed: ${error instanceof Error ? error.name : "error"}`);
          if (!spoke) send({ type: "say", text: VOICE_ERROR_MESSAGE });
          if (!finished) send({ type: "done", status: "error" });
          finished = true;
        }
        if (!finished) send({ type: "done", status: "error" });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
    });
  });
  return app;
}

/**
 * POST /api/voice/token. Mount it AFTER the owner sign-in check: it reads the
 * signed-in owner from the context. The app never chooses its own identity.
 */
export function voiceTokenRoutes(env: () => Env = () => process.env) {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.post("/token", async (c) => {
    const config: VoiceConfig | undefined = readVoiceConfig(env());
    if (!config) throw new AppError(VOICE_NOT_SET_UP, 503);
    return c.json(await mintVoiceSession(config, c.get("owner")));
  });
  return app;
}
