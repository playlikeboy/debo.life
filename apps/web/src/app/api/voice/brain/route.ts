import { getUserSettings, saveExchange, type ChatReply } from "@debo/db";
import { z } from "zod";
import { askStream, LIMIT_MESSAGE, UNKNOWN_MESSAGE, type SourceChip } from "@/lib/ask";
import { databaseUrl, serverEnv } from "@/lib/server-env";
import { isVoiceAgent } from "@/lib/voice/secret";

export const dynamic = "force-dynamic";

const Turn = z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) });
const Body = z.object({
  userId: z.string().uuid(),
  /** One voice session; its transcript is saved as one chat with this id. */
  sessionId: z.string().uuid(),
  question: z.string().trim().min(1).max(500),
  history: z.array(Turn).max(12).default([]),
});

const ERROR_SPOKEN = "Sorry, I couldn't reach my memory just now. Please try again in a moment.";

/**
 * Debo's one brain, for the voice agent (apps/voice-agent).
 *
 * Only the voice agent may call this: it sends VOICE_AGENT_SECRET. The user id
 * comes from the LiveKit participant identity, which debo.life set itself
 * when it signed the room token (/api/voice/token).
 *
 * Streams newline-delimited JSON: `sources` (before any text), `text` deltas,
 * `say` (a fixed message such as "I don't have anything about that yet"),
 * then `done`. The answer comes from askStream, the same pipeline as chat,
 * so the daily limit, usage rows and the activity record all apply.
 * If the person keeps transcripts (Settings), the exchange is saved as a chat.
 * Audio never reaches this route. Never log the question or the answer.
 */
export async function POST(request: Request) {
  const env = serverEnv();
  if (!(await isVoiceAgent(request.headers.get("authorization"), env.VOICE_AGENT_SECRET))) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const { userId, sessionId, question } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let text = "";
      let sources: SourceChip[] = [];
      let reply: ChatReply;
      try {
        reply = { kind: "error", text: ERROR_SPOKEN, sourceIds: [] };
        for await (const step of askStream(userId, question, { signal: request.signal })) {
          if (step.type === "sources") {
            sources = step.sources;
            if (sources.length > 0) send({ type: "sources", sources });
          } else if (step.type === "text") {
            text += step.delta;
            send({ type: "text", delta: step.delta });
          } else {
            const outcome = step.outcome;
            if (outcome.status === "answered") {
              reply = { kind: "answer", text: outcome.answer, sourceIds: outcome.sources.map((s) => s.id) };
            } else if (outcome.status === "stopped") {
              reply = { kind: "stopped", text: outcome.answer, sourceIds: outcome.sources.map((s) => s.id) };
            } else if (outcome.status === "limit") {
              send({ type: "say", text: LIMIT_MESSAGE });
              reply = { kind: "limit", text: LIMIT_MESSAGE, sourceIds: [] };
            } else {
              send({ type: "say", text: UNKNOWN_MESSAGE });
              reply = { kind: "unknown", text: UNKNOWN_MESSAGE, sourceIds: [] };
            }
            send({ type: "done", status: outcome.status });
          }
        }
      } catch (error) {
        console.error("voice ask failed", { userId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        if (text) {
          reply = { kind: "stopped", text, sourceIds: sources.map((s) => s.id) };
        } else {
          send({ type: "say", text: ERROR_SPOKEN });
          reply = { kind: "error", text: ERROR_SPOKEN, sourceIds: [] };
        }
        send({ type: "done", status: "error" });
      }
      controller.close();
      await keepTranscript(userId, sessionId, question, reply);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}

/** Save the exchange as a chat if the person keeps voice transcripts. A failure here never breaks the answer. */
async function keepTranscript(userId: string, sessionId: string, question: string, reply: ChatReply) {
  try {
    const settings = await getUserSettings(databaseUrl(), userId);
    if (!settings.voice.keepTranscripts) return;
    await saveExchange(databaseUrl(), userId, { conversationId: sessionId, question, reply });
  } catch (error) {
    console.error("voice transcript save failed", { userId, reason: error instanceof Error ? error.name : "unknown" });
  }
}
