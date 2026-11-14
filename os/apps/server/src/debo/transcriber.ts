// Writing out speech. The engine sits behind a small interface, so another
// one (Deepgram, a local model) can replace Cloudflare Workers AI by changing
// one function, and tests use a fake.
//
// The audio sent here is always a short (about 5 minute) 16 kHz mono mp3 made
// by audio.ts. Never log the text that comes back.

export type Segment = { start: number; end: number; text: string };

export type TranscriptPiece = {
  text: string;
  /** Two-letter code such as "en" or "hi", when the engine says. */
  language: string | null;
  /** Times are seconds from the start of this piece. */
  segments: Segment[];
};

export interface Transcriber {
  /** Which engine, for the privacy page and the activity of the server. */
  readonly name: string;
  transcribe(audio: Uint8Array, options?: { language?: string; signal?: AbortSignal }): Promise<TranscriptPiece>;
}

/** An error the caller may retry later. Its message is safe to log: no text from the audio. */
export class TranscriberError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TranscriberError";
  }
}

const MODEL = "@cf/openai/whisper-large-v3-turbo";

/**
 * Cloudflare Workers AI over its REST API:
 * https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/
 * The audio goes as base64 in the JSON body. Language is detected by the
 * model unless one is given, so English, Hindi and a mix all work as well as
 * the model allows. Silence is cut by the model's voice detection, so quiet
 * parts do not turn into invented words.
 */
export function cloudflareWhisper(
  config: { accountId: string; apiToken: string },
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Transcriber {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${MODEL}`;
  return {
    name: "Cloudflare Workers AI (Whisper large v3 turbo)",
    async transcribe(audio, options = {}) {
      const body = JSON.stringify({
        audio: Buffer.from(audio).toString("base64"),
        task: "transcribe",
        vad_filter: true,
        condition_on_previous_text: false,
        ...(options.language ? { language: options.language } : {}),
      });
      let lastError: TranscriberError | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await sleep(1500 * 2 ** (attempt - 1));
        let response: Response;
        try {
          response = await fetchImpl(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
            body,
            signal: options.signal ?? AbortSignal.timeout(120_000),
          });
        } catch {
          lastError = new TranscriberError("The speech engine did not answer.", true);
          continue;
        }
        if (response.status === 429 || response.status >= 500) {
          lastError = new TranscriberError(`The speech engine was busy (${response.status}).`, true);
          continue;
        }
        if (!response.ok) throw new TranscriberError(`The speech engine refused the audio (${response.status}).`, false);
        return readReply(await response.json().catch(() => null));
      }
      throw lastError ?? new TranscriberError("The speech engine did not answer.", true);
    },
  };
}

type Reply = {
  success?: boolean;
  result?: {
    text?: string;
    segments?: { start?: number; end?: number; text?: string }[];
    transcription_info?: { language?: string };
  };
};

/** Read Workers AI's answer without trusting its shape. */
export function readReply(raw: unknown): TranscriptPiece {
  const reply = (raw ?? {}) as Reply;
  const result = reply.result;
  if (reply.success === false || !result || typeof result.text !== "string")
    throw new TranscriberError("The speech engine sent back something I could not read.", false);
  const segments = (result.segments ?? []).flatMap((s) =>
    typeof s.start === "number" && typeof s.end === "number" && typeof s.text === "string" && s.text.trim()
      ? [{ start: s.start, end: s.end, text: s.text.trim() }]
      : [],
  );
  const language = result.transcription_info?.language?.trim().toLowerCase().slice(0, 8) || null;
  return { text: result.text.trim(), language, segments };
}

/** A stand-in for tests and sample mode. It says the same thing every time and never calls anyone. */
export function fakeTranscriber(
  options: { text?: string; fail?: "retryable" | "permanent" | (() => false | "retryable" | "permanent"); language?: string } = {},
): Transcriber & { calls: number } {
  const fake = {
    name: "Sample engine (no real transcript)",
    calls: 0,
    async transcribe(audio: Uint8Array) {
      fake.calls += 1;
      const failing = typeof options.fail === "function" ? options.fail() : options.fail;
      if (failing) throw new TranscriberError("The fake engine was told to fail.", failing === "retryable");
      const text = options.text ?? "This is a sample transcript. Sample mode does not listen to the recording.";
      return {
        text,
        language: options.language ?? "en",
        segments: [{ start: 0, end: Math.max(1, Math.min(300, audio.byteLength / 4000)), text }],
      };
    },
  };
  return fake;
}

// ---- Long recordings: cut into overlapping pieces, then stitched back together ----

export const CHUNK_SECONDS = 300;
export const OVERLAP_SECONDS = 4;

export type ChunkPlan = { index: number; start: number; length: number };

/**
 * Pieces of CHUNK_SECONDS that each run OVERLAP_SECONDS into the next, so a
 * word that falls on a cut is heard whole in one of them.
 */
export function planChunks(durationSeconds: number, chunk = CHUNK_SECONDS, overlap = OVERLAP_SECONDS): ChunkPlan[] {
  if (!(durationSeconds > 0)) return [];
  const count = Math.max(1, Math.ceil(durationSeconds / chunk));
  return Array.from({ length: count }, (_, index) => {
    const start = index * chunk;
    const end = Math.min(durationSeconds, start + chunk + (index < count - 1 ? overlap : 0));
    return { index, start, length: end - start };
  });
}

/**
 * Join the pieces. Where two pieces overlap, each keeps the segments whose
 * middle falls on its own side of the cut (the middle of the overlap), so no
 * words are repeated or dropped. Times become seconds from the start.
 */
export function mergePieces(
  plan: ChunkPlan[],
  pieces: TranscriptPiece[],
  chunk = CHUNK_SECONDS,
  overlap = OVERLAP_SECONDS,
): { text: string; language: string | null; segments: Segment[] } {
  const segments: Segment[] = [];
  const languages = new Map<string, number>();
  plan.forEach((p, i) => {
    const piece = pieces[i];
    if (!piece) return;
    if (piece.language) languages.set(piece.language, (languages.get(piece.language) ?? 0) + p.length);
    const from = i === 0 ? Number.NEGATIVE_INFINITY : i * chunk + overlap / 2;
    const to = i === plan.length - 1 ? Number.POSITIVE_INFINITY : (i + 1) * chunk + overlap / 2;
    for (const s of piece.segments) {
      const start = p.start + s.start;
      const end = p.start + s.end;
      const middle = (start + end) / 2;
      if (middle >= from && middle < to) segments.push({ start: round(start), end: round(end), text: s.text });
    }
  });
  // An engine that sent text without segments still counts: keep its words.
  const text = segments.length > 0 ? paragraphs(segments) : pieces.map((p) => p.text).filter(Boolean).join("\n\n");
  const language = [...languages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { text: text.replace(/[ \t]+/g, " ").trim(), language, segments };
}

/** Start a new paragraph at a pause of 2 seconds or more, or when one grows past about 600 characters. */
function paragraphs(segments: Segment[]): string {
  const out: string[] = [];
  let current = "";
  let lastEnd = 0;
  for (const s of segments) {
    if (current && (s.start - lastEnd >= 2 || current.length > 600)) {
      out.push(current);
      current = "";
    }
    current += `${current ? " " : ""}${s.text}`;
    lastEnd = s.end;
  }
  if (current) out.push(current);
  return out.join("\n\n");
}

const round = (n: number) => Math.round(n * 100) / 100;
