// REST routes for Debo's personal brain, mounted at /api/debo.
// Every route works on the signed-in owner only (c.get("owner")), checks input
// with Zod, and never logs entry text, questions, answers or memories.
import { UNKNOWN_MESSAGE } from "@debo/brain";
import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../errors.ts";
import { DICTATION_MAX_BYTES } from "./media-limits.ts";
import type { DeboService } from "./service.ts";

const ErrorBody = (message: string) => ({ error: message });

export function deboRoutes(debo: DeboService) {
  const app = new Hono<{ Variables: { owner: string } }>();

  // Same plain error shapes as the rest of the API, so this router also works on its own.
  app.onError((error, c) => {
    if (error instanceof z.ZodError)
      return c.json(ErrorBody(error.issues.map((i) => i.message).join("; ")), 422);
    if (error instanceof AppError) return c.json(ErrorBody(error.message), error.status);
    if (error instanceof SyntaxError) return c.json(ErrorBody("Invalid request data"), 400);
    console.error(`[Debo] ${error.name}`);
    return c.json(ErrorBody("I couldn't do that just now. Try again in a moment."), 502);
  });

  /** What is set up. Safe to call without a Debo database. */
  app.get("/status", (c) => c.json(debo.status()));

  // ---- Journal ----
  app.get("/entries", async (c) =>
    c.json({ entries: await debo.listEntries(c.get("owner"), { find: c.req.query("find"), limit: c.req.query("limit") }) }),
  );
  app.post("/entries", async (c) => c.json({ entry: await debo.createEntry(c.get("owner"), await c.req.json()) }, 201));
  app.put("/entries/:id", async (c) => {
    await debo.updateEntry(c.get("owner"), c.req.param("id"), await c.req.json());
    return c.json({ ok: true });
  });
  app.delete("/entries/:id", async (c) => {
    await debo.deleteEntry(c.get("owner"), c.req.param("id"));
    return c.json({ ok: true });
  });

  // ---- Voice notes and videos ----
  // 1. POST /media/uploads        -> links to upload to (straight to the private bucket)
  // 2. PUT the file to those links from the app
  // 3. POST /media/uploads/:id/complete -> the entry is saved; the words come in the background
  app.post("/media/uploads", async (c) => c.json(await debo.startUpload(c.get("owner"), await c.req.json()), 201));
  app.post("/media/uploads/:id/complete", async (c) =>
    c.json({ entry: await debo.completeUpload(c.get("owner"), c.req.param("id"), await c.req.json().catch(() => ({}))) }),
  );
  /** A link that plays this entry's recording for an hour. Only its owner gets one. */
  app.get("/entries/:id/playback", async (c) => c.json(await debo.playback(c.get("owner"), c.req.param("id"))));
  app.get("/entries/:id/transcript", async (c) => c.json(await debo.transcript(c.get("owner"), c.req.param("id"))));
  app.post("/entries/:id/transcript/retry", async (c) =>
    c.json(await debo.retryTranscript(c.get("owner"), c.req.param("id"))),
  );
  /** Speaking into the text box: a short audio clip in, words out. The clip is not kept. */
  app.post("/transcribe", async (c) => {
    const length = Number(c.req.header("content-length") ?? 0);
    if (length > DICTATION_MAX_BYTES) throw new AppError("That clip is too long. Speak in shorter parts.", 413);
    const language = c.req.query("language");
    const clip = new Uint8Array(await c.req.arrayBuffer());
    return c.json(await debo.dictate(c.get("owner"), clip, language));
  });

  // ---- Ask ----
  // By default the answer streams as newline-delimited JSON:
  //   {"type":"sources","sources":[{"id","label"}]}   (always before any text)
  //   {"type":"text","delta":"..."}
  //   {"type":"done","status":"answered|unknown|limit|stopped", ...}
  // Send {"stream": false} to get one JSON answer instead.
  app.post("/ask", async (c) => {
    const body = z.object({ question: z.unknown(), stream: z.boolean().optional() }).parse(await c.req.json());
    const owner = c.get("owner");
    if (body.stream === false) return c.json(await debo.askAll(owner, body.question, c.req.raw.signal));

    const events = debo.ask(owner, body.question, c.req.raw.signal);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        try {
          for await (const event of events) {
            if (event.type === "done") {
              const o = event.outcome;
              if (o.status === "unknown") send({ type: "done", status: "unknown", message: UNKNOWN_MESSAGE });
              else send({ type: "done", ...o });
            } else send(event);
          }
        } catch (error) {
          // Say what happened without leaking provider details or text.
          console.error("ask failed", { owner, reason: error instanceof Error ? error.name : "unknown" });
          send({ type: "error", message: "I couldn't reach my AI helper just now. Try again in a moment." });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });
  });

  // ---- What Debo knows ----
  app.get("/memories", async (c) => c.json({ memories: await debo.listMemories(c.get("owner")) }));
  app.put("/memories/:id", async (c) => {
    await debo.fixMemory(c.get("owner"), c.req.param("id"), await c.req.json());
    return c.json({ ok: true });
  });
  app.delete("/memories/:id", async (c) => {
    await debo.forgetMemory(c.get("owner"), c.req.param("id"));
    return c.json({ ok: true });
  });

  // ---- What Debo did ----
  app.get("/activity", async (c) => c.json({ activity: await debo.listActivity(c.get("owner")) }));

  return app;
}
