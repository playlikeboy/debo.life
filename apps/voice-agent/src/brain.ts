// The voice agent never answers by itself. Every question goes to Debo's one
// brain on debo.life (POST /api/voice/brain), which searches the person's own
// entries, applies the daily limit and writes usage and activity, exactly as
// chat does. This file turns that reply into a stream of text to speak.
//
// Never log the question, the answer or source labels: they hold the
// person's own words. Log ids and counts only.
import { z } from "zod";

export type Turn = { role: "user" | "assistant"; text: string };
export type SourceChip = { id: string; label: string };

/** One line of the newline-delimited JSON the brain route streams back. */
export const BrainEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sources"), sources: z.array(z.object({ id: z.string(), label: z.string() })) }),
  z.object({ type: z.literal("text"), delta: z.string() }),
  z.object({ type: z.literal("say"), text: z.string() }),
  z.object({ type: z.literal("done"), status: z.string() }),
]);
export type BrainEvent = z.infer<typeof BrainEvent>;

export type BrainRequest = {
  userId: string;
  sessionId: string;
  question: string;
  history: Turn[];
};

/** Split a byte stream of newline-delimited JSON into parsed events. Bad lines are skipped. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<BrainEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const parsed = safeJson(line);
        const event = BrainEvent.safeParse(parsed);
        if (event.success) yield event.data;
      }
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
  const rest = buffer.trim();
  if (rest) {
    const event = BrainEvent.safeParse(safeJson(rest));
    if (event.success) yield event.data;
  }
}

function safeJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/** Ask the brain. Throws if the route can't be reached or refuses. */
export async function askBrain(
  config: { deboUrl: string; secret: string },
  request: BrainRequest,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(new URL("/api/voice/brain", config.deboUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.secret}` },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`Debo brain replied ${response.status}`);
  return response.body;
}

/** The last few turns before the newest question, oldest first, capped in size. */
export function recentHistory(turns: Turn[], maxTurns = 6, maxChars = 2000): Turn[] {
  const picked: Turn[] = [];
  let size = 0;
  for (let i = turns.length - 1; i >= 0 && picked.length < maxTurns; i--) {
    const turn = turns[i];
    if (!turn || !turn.text.trim()) continue;
    size += turn.text.length;
    if (size > maxChars) break;
    picked.unshift(turn);
  }
  return picked;
}
