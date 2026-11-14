// The plain-TypeScript side of Debo's journal screens: what the server sends,
// how to read it safely, the words we show, and where a draft is kept.
// No React in here, so node:test can run it.
import { z } from "zod";

export const sourceChip = z.object({ id: z.string(), label: z.string() });
export type SourceChip = z.infer<typeof sourceChip>;

/** The recording behind a voice note or video, as the server describes it. */
export const mediaView = z.object({
  id: z.string(),
  kind: z.enum(["voice", "video"]),
  mimeType: z.string(),
  sizeBytes: z.number(),
  durationMs: z.number().nullable(),
  recordedAt: z.string().nullable(),
  transcript: z.object({
    status: z.enum(["waiting", "working", "ready", "failed"]),
    language: z.string().nullable(),
    message: z.string().optional(),
  }),
});
export type MediaView = z.infer<typeof mediaView>;

export const entryView = z.object({
  id: z.string(),
  // Older servers do not send these two: such an entry is a written one.
  kind: z.enum(["journal", "voice", "video"]).default("journal"),
  title: z.string(),
  text: z.string(),
  happenedAt: z.string(),
  media: mediaView.nullish().transform((m) => m ?? null),
});
export type EntryView = z.infer<typeof entryView>;

export const memoryView = z.object({
  id: z.string(),
  text: z.string(),
  editedByUser: z.boolean(),
  createdAt: z.string().nullable(),
  source: sourceChip,
});
export type MemoryView = z.infer<typeof memoryView>;

export const activityView = z.object({
  id: z.string(),
  actor: z.enum(["you", "debo"]),
  action: z.string(),
  sourceIds: z.array(z.string()),
  createdAt: z.string(),
});
export type ActivityView = z.infer<typeof activityView>;

export const deboStatus = z.object({
  configured: z.boolean(),
  message: z.string().optional(),
  journal: z.boolean(),
  ask: z.boolean(),
  memories: z.boolean(),
  /** Voice notes and videos can be added. */
  recordings: z.boolean().default(false),
  /** Speaking into the text works. */
  speaking: z.boolean().default(false),
  limits: z
    .object({
      maxBytes: z.number(),
      maxMinutes: z.number(),
      maxMinutesPerDay: z.number(),
      maxRecordingsPerDay: z.number(),
    })
    .default({ maxBytes: 200 * 1024 * 1024, maxMinutes: 60, maxMinutesPerDay: 240, maxRecordingsPerDay: 40 }),
});
export type DeboStatus = z.infer<typeof deboStatus>;

export const entriesReply = z.object({ entries: z.array(entryView) });
export const memoriesReply = z.object({ memories: z.array(memoryView) });
export const activityReply = z.object({ activity: z.array(activityView) });

/** Read a tool result that may arrive as JSON text or as an object. */
export function parseToolResult(result: unknown): unknown {
  if (typeof result !== "string") return result;
  try {
    return JSON.parse(result);
  } catch {
    return undefined;
  }
}

const answerResult = z.union([
  z.object({ status: z.literal("answered"), answer: z.string(), sources: z.array(sourceChip) }),
  z.object({ status: z.literal("stopped"), answer: z.string(), sources: z.array(sourceChip) }),
  z.object({ status: z.literal("unknown"), message: z.string() }),
  z.object({ status: z.literal("limit"), message: z.string() }),
]);
const searchResult = z.object({
  matches: z.array(
    z.object({ source: sourceChip, title: z.string(), date: z.string(), excerpt: z.string() }),
  ),
  message: z.string().optional(),
});
const prepareResult = z.object({
  status: z.string(),
  actionId: z.string(),
  title: z.string(),
  preview: z.string(),
});
const errorResult = z.object({ error: z.string() });

export type DeboToolView =
  | { kind: "error"; message: string }
  | { kind: "answer"; answer: string; sources: SourceChip[] }
  | { kind: "nothing"; message: string }
  | { kind: "matches"; sources: SourceChip[]; excerpts: { source: SourceChip; date: string; excerpt: string }[] }
  | { kind: "review"; actionId: string; preview: string }
  | { kind: "unreadable" };

/** Turn what a Debo tool returned into something a card can draw. Never throws. */
export function readDeboTool(name: string, raw: unknown): DeboToolView {
  const value = parseToolResult(raw);
  const error = errorResult.safeParse(value);
  if (error.success) return { kind: "error", message: error.data.error };
  if (name === "ask_my_life") {
    const parsed = answerResult.safeParse(value);
    if (!parsed.success) return { kind: "unreadable" };
    const r = parsed.data;
    if (r.status === "unknown" || r.status === "limit") return { kind: "nothing", message: r.message };
    return { kind: "answer", answer: r.answer, sources: dedupe(r.sources) };
  }
  if (name === "search_my_journal") {
    const parsed = searchResult.safeParse(value);
    if (!parsed.success) return { kind: "unreadable" };
    if (parsed.data.matches.length === 0)
      return { kind: "nothing", message: parsed.data.message ?? "Nothing in your journal matches that." };
    return {
      kind: "matches",
      sources: dedupe(parsed.data.matches.map((m) => m.source)),
      excerpts: parsed.data.matches.map((m) => ({ source: m.source, date: m.date, excerpt: m.excerpt })),
    };
  }
  if (name === "add_journal_entry") {
    const parsed = prepareResult.safeParse(value);
    if (!parsed.success) return { kind: "unreadable" };
    return { kind: "review", actionId: parsed.data.actionId, preview: parsed.data.preview };
  }
  return { kind: "unreadable" };
}

function dedupe(sources: SourceChip[]): SourceChip[] {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

/** One plain sentence per activity line (docs/WRITING.md). Counts only; never content. */
export function describeActivity(item: Pick<ActivityView, "action" | "sourceIds">): string {
  const count = item.sourceIds.length;
  const entries = count === 1 ? "1 entry" : `${count} entries`;
  switch (item.action) {
    case "saved":
      return "You saved an entry.";
    case "edited":
      return "You changed an entry.";
    case "deleted":
      return "You deleted an entry.";
    case "answered":
      return count > 0 ? `Debo answered a question using ${entries}.` : "Debo answered a question.";
    case "did-not-know":
      return "Debo had nothing about a question, so it said so.";
    case "exported":
      return "You downloaded a copy of everything.";
    case "fixed-memory":
      return "You fixed a memory.";
    case "forgot-memory":
      return "You asked Debo to forget a memory.";
    default:
      return "Something changed.";
  }
}

/** "Tuesday 14 March" in UTC, the same day the source chips show. */
export function entryDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** First line, cut short, for a collapsed entry. */
export function preview(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// ---- Draft kept on this device ----
// A half-written entry survives leaving the screen, and on the web a reload
// too. It lives only on this device and is cleared once the entry is saved.

export const DRAFT_KEY = "debo.journal.draft.v1";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
let memoryDraft = "";

function storage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage;
  } catch {
    return undefined;
  }
}

export function loadDraft(store: Storage | undefined = storage()): string {
  try {
    return store?.getItem(DRAFT_KEY) ?? memoryDraft;
  } catch {
    return memoryDraft;
  }
}

export function saveDraft(text: string, store: Storage | undefined = storage()) {
  memoryDraft = text;
  try {
    if (text) store?.setItem(DRAFT_KEY, text);
    else store?.removeItem(DRAFT_KEY);
  } catch {
    // Storage can be full or blocked. The in-memory copy still holds the draft.
  }
}

// ---- Opening an entry from a source chip ----

type Listener = (id: string | undefined) => void;
let focused: string | undefined;
const listeners = new Set<Listener>();

/** The entry a source chip asked to open. The Journal screen shows it first. */
export const entryFocus = {
  get: () => focused,
  set(id: string | undefined) {
    focused = id;
    for (const listener of listeners) listener(id);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// ---- Words for the composer and the recordings ----

/** "1:05" or "1:02:03". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "3.2 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Whole words, for the quiet count under the text. Works for Hindi and other scripts too. */
export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** "1 word" or "12 words". */
export function wordCountLabel(text: string): string {
  const n = countWords(text);
  return n === 1 ? "1 word" : `${n} words`;
}

/** Today as yyyy-mm-dd on this device, for the date box. */
export function todayInput(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${String(now.getDate()).padStart(2, "0")}`;
}

/** What to send for the date box: nothing when it is today (the server uses the time it saved), else noon UTC that day. */
export function happenedAtFor(input: string, now = new Date()): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || input === todayInput(now)) return undefined;
  const date = new Date(`${input}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** A plain reason a picked file cannot be used, or undefined when it is fine. */
export function fileProblem(
  file: { mimeType: string; sizeBytes: number },
  limits: { maxBytes: number },
): string | undefined {
  const type = file.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!type.startsWith("audio/") && !type.startsWith("video/"))
    return "That is not a voice or video file. Pick a file such as .m4a, .mp3, .wav, .webm or .mp4.";
  if (file.sizeBytes <= 0) return "That file is empty.";
  if (file.sizeBytes > limits.maxBytes) return `That file is too big. Keep it under ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`;
  return undefined;
}

/** The date a day button shows for a recording, e.g. "Voice note" or "Video". */
export function kindName(kind: "journal" | "voice" | "video"): string {
  return kind === "voice" ? "Voice note" : kind === "video" ? "Video" : "Entry";
}
