import { describe, expect, it } from "vitest";
import { readEvents, recentHistory } from "./brain.ts";

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readEvents", () => {
  it("reads events split across chunks and skips bad lines", async () => {
    const events = [];
    for await (const event of readEvents(
      streamOf(['{"type":"sources","sources":[{"id":"a","label":"Journal, 1 May"}]}\n{"type":"te', 'xt","delta":"Hi"}\nnot json\n{"type":"done","status":"answered"}']),
    )) {
      events.push(event);
    }
    expect(events.map((e) => e.type)).toEqual(["sources", "text", "done"]);
  });
});

describe("recentHistory", () => {
  it("keeps the newest turns, oldest first, within the limits", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` }) as const);
    expect(recentHistory([...turns], 3).map((t) => t.text)).toEqual(["t7", "t8", "t9"]);
    expect(recentHistory([{ role: "user", text: "x".repeat(50) }], 6, 10)).toEqual([]);
  });
});
