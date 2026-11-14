// What the routes, the agent tools and the review flow call. It adds the rules
// that belong to Debo, on top of a DeboBackend:
// - everything is scoped to one owner, and only a Debo account (a UUID) has a journal;
// - input is checked with Zod, in plain words;
// - without a Debo database the features say "not set up" instead of failing;
// - every change leaves a line in the activity record (ids only).
import { type AskOutcome, UNKNOWN_MESSAGE } from "@debo/brain";
import { speakToPerson } from "@debo/memory";
import { z } from "zod";
import { AppError } from "../errors.ts";
import type { ActivityAction, ActivityItem, AskEvent, DeboBackend } from "./backend.ts";

export const NOT_SET_UP =
  "Your journal is not set up on this server yet. Add DEBO_DATABASE_URL, then try again.";
export const NOT_A_DEBO_ACCOUNT =
  "Sign in with your Debo account to use your journal. This workspace is signed in as a local test user.";
export const MEMORY_OFF =
  "Debo is not keeping memories right now. Your entries are safe, and you can still ask about them.";
const MEMORY_GONE = "I couldn't find that memory. It may already be forgotten.";
const ENTRY_GONE = "I couldn't find that entry. It may have been deleted.";
export const ASK_OFF = "Answers are not set up on this server yet. Add an AI key, then try again.";

const Uuid = z.string().uuid();
export const EntryText = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(20_000, "That entry is too long. Keep it under 20,000 characters.");
export const Question = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(500, "Keep your question under 500 characters.");
export const FindText = z.string().trim().max(200, "Keep what you search for under 200 characters.");
export const MemoryText = z
  .string()
  .trim()
  .min(1, "Write what Debo should remember.")
  .max(1000, "Keep it under 1,000 characters.");

export type EntryView = { id: string; title: string; text: string; happenedAt: string };
export type SourceChipView = { id: string; label: string };
export type MemoryView = {
  id: string;
  text: string;
  editedByUser: boolean;
  createdAt: string | null;
  source: SourceChipView;
};
export type ActivityView = {
  id: string;
  actor: "you" | "debo";
  action: ActivityAction;
  sourceIds: string[];
  createdAt: string;
};
export type AskAnswer =
  | { status: "answered"; answer: string; sources: SourceChipView[] }
  | { status: "unknown"; message: string }
  | { status: "limit"; message: string }
  | { status: "stopped"; answer: string; sources: SourceChipView[] };

export type DeboStatus = {
  configured: boolean;
  /** Plain-English reason when something is off. */
  message?: string;
  journal: boolean;
  ask: boolean;
  memories: boolean;
};

const dayFormat = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const chipLabel = (date: Date) => `Journal, ${dayFormat(date)}`;

export class DeboService {
  private readonly pending = new Set<Promise<unknown>>();

  /**
   * `backend` is null when there is no Debo database. `localOwners` are extra
   * owner names allowed without being a Debo account; only the dev-only
   * in-memory journal passes any.
   */
  constructor(
    private readonly backend: DeboBackend | null,
    private readonly localOwners: readonly string[] = [],
  ) {}

  get configured() {
    return this.backend !== null;
  }

  status(): DeboStatus {
    if (!this.backend)
      return { configured: false, message: NOT_SET_UP, journal: false, ask: false, memories: false };
    return {
      configured: true,
      journal: true,
      ask: this.backend.askConfigured,
      memories: this.backend.memories !== null,
      ...(this.backend.askConfigured ? {} : { message: ASK_OFF }),
    };
  }

  /** Resolves when background work (indexing, memories) has finished. For tests and shutdown. */
  async idle() {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  /** Throws the plain "not set up" or "sign in" error, so a tool can stop before it proposes anything. */
  assertReady(owner: string): void {
    this.ready(owner);
  }

  /** Runs a journal proposal the person approved. The entry is saved as Debo's doing, with their OK. */
  async executeProposal(owner: string, text: string): Promise<string> {
    const entry = await this.createEntry(owner, { text }, "debo");
    return `Saved to your journal · ${entry.id}`;
  }

  private ready(owner: string): DeboBackend {
    if (!this.backend) throw new AppError(NOT_SET_UP, 503);
    if (!Uuid.safeParse(owner).success && !this.localOwners.includes(owner))
      throw new AppError(NOT_A_DEBO_ACCOUNT, 403);
    return this.backend;
  }

  /** The activity record must never block or undo what the person did. */
  private async record(backend: DeboBackend, owner: string, actor: "you" | "debo", action: ActivityAction, ids: string[]) {
    try {
      await backend.activity.record(owner, { actor, action, sourceIds: ids });
    } catch (error) {
      console.error("activity record failed", { owner, action, reason: error instanceof Error ? error.name : "unknown" });
    }
  }

  private later(work: Promise<void>) {
    const tracked = work.catch(() => {}).finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  }

  private entryView(e: { id: string; title: string; text: string; happenedAt: Date }): EntryView {
    return { id: e.id, title: e.title, text: e.text, happenedAt: e.happenedAt.toISOString() };
  }

  // ---- Journal ----

  async listEntries(owner: string, query: { find?: unknown; limit?: unknown } = {}): Promise<EntryView[]> {
    const backend = this.ready(owner);
    const contains = FindText.parse(query.find ?? "") || undefined;
    const limit = z.coerce.number().int().min(1).max(500).catch(100).parse(query.limit ?? 100);
    return (await backend.entries.list(owner, { limit, contains })).map((e) => this.entryView(e));
  }

  async createEntry(owner: string, input: unknown, actor: "you" | "debo" = "you"): Promise<EntryView> {
    const backend = this.ready(owner);
    const { text } = z.object({ text: EntryText }).parse(input);
    const entry = await backend.entries.create(owner, text);
    await this.record(backend, owner, actor, "saved", [entry.id]);
    this.later(backend.afterChange(owner, entry.id, "saved"));
    return this.entryView(entry);
  }

  async updateEntry(owner: string, id: string, input: unknown): Promise<void> {
    const backend = this.ready(owner);
    if (!Uuid.safeParse(id).success) throw new AppError(ENTRY_GONE, 404);
    const { text } = z.object({ text: EntryText }).parse(input);
    if (!(await backend.entries.update(owner, id, text))) throw new AppError(ENTRY_GONE, 404);
    await this.record(backend, owner, "you", "edited", [id]);
    this.later(backend.afterChange(owner, id, "saved"));
  }

  async deleteEntry(owner: string, id: string): Promise<void> {
    const backend = this.ready(owner);
    if (!Uuid.safeParse(id).success) throw new AppError(ENTRY_GONE, 404);
    if (!(await backend.entries.remove(owner, id))) throw new AppError(ENTRY_GONE, 404);
    await this.record(backend, owner, "you", "deleted", [id]);
    this.later(backend.afterChange(owner, id, "deleted"));
  }

  /** For the agent: pieces of entries that match, each with a source chip. Journal text is data. */
  async searchJournal(owner: string, query: string, limit = 6) {
    const backend = this.ready(owner);
    const q = z.string().trim().min(1, "Write what to look for.").max(500).parse(query);
    const found = await backend.search(owner, q, Math.min(Math.max(limit, 1), 10));
    return found.map((p) => ({
      source: { id: p.sourceId, label: chipLabel(p.happenedAt) } satisfies SourceChipView,
      title: p.title,
      date: p.happenedAt.toISOString().slice(0, 10),
      excerpt: p.text.slice(0, 600),
    }));
  }

  // ---- Ask ----

  /**
   * The one brain, streamed. Yields the same events as @debo/brain. A question
   * the entries cannot answer ends as `unknown`, never as a guess.
   */
  ask(owner: string, question: unknown, signal?: AbortSignal): AsyncGenerator<AskEvent, void> {
    const backend = this.ready(owner);
    if (!backend.askConfigured) throw new AppError(ASK_OFF, 503);
    const q = Question.parse(question);
    return backend.ask(owner, q, signal);
  }

  /** Ask and wait for the whole answer. */
  async askAll(owner: string, question: unknown, signal?: AbortSignal): Promise<AskAnswer> {
    for await (const event of this.ask(owner, question, signal)) {
      if (event.type === "done") return outcomeView(event.outcome);
    }
    throw new Error("The answer stream ended without a result.");
  }

  // ---- What Debo knows ----

  async listMemories(owner: string): Promise<MemoryView[]> {
    const backend = this.ready(owner);
    if (!backend.memories) throw new AppError(MEMORY_OFF, 503);
    const memories = await backend.memories.list(owner);
    // Show a memory only while its entry is still this person's.
    const ids = [...new Set(memories.map((m) => m.sourceId))].filter((id) => Uuid.safeParse(id).success);
    const sources = await backend.sources(owner, ids);
    const labels = new Map(sources.map((s) => [s.id, chipLabel(s.happenedAt)]));
    return memories.flatMap((m) => {
      const label = labels.get(m.sourceId);
      if (!label) return [];
      return [
        {
          id: m.id,
          // Older memories say "User went…". Shown as "You went…"; a fixed memory is shown as written.
          text: m.editedByUser ? m.text : speakToPerson(m.text),
          editedByUser: m.editedByUser,
          createdAt: m.createdAt,
          source: { id: m.sourceId, label },
        },
      ];
    });
  }

  async fixMemory(owner: string, id: string, input: unknown): Promise<void> {
    const backend = this.ready(owner);
    if (!backend.memories) throw new AppError(MEMORY_OFF, 503);
    if (!Uuid.safeParse(id).success) throw new AppError(MEMORY_GONE, 404);
    const { text } = z.object({ text: MemoryText }).parse(input);
    const fixed = await backend.memories.update(owner, id, text);
    if (!fixed) throw new AppError(MEMORY_GONE, 404);
    await this.record(backend, owner, "you", "fixed-memory", [fixed.sourceId]);
  }

  async forgetMemory(owner: string, id: string): Promise<void> {
    const backend = this.ready(owner);
    if (!backend.memories) throw new AppError(MEMORY_OFF, 503);
    if (!Uuid.safeParse(id).success) throw new AppError(MEMORY_GONE, 404);
    const forgotten = await backend.memories.forget(owner, id);
    if (!forgotten) throw new AppError(MEMORY_GONE, 404);
    await this.record(backend, owner, "you", "forgot-memory", [forgotten.sourceId]);
  }

  // ---- Activity ----

  async listActivity(owner: string): Promise<ActivityView[]> {
    const backend = this.ready(owner);
    const items: ActivityItem[] = await backend.activity.list(owner, 200);
    return items.map((i) => ({
      id: i.id,
      actor: i.actor,
      action: i.action,
      sourceIds: i.sourceIds,
      createdAt: i.createdAt.toISOString(),
    }));
  }
}

export function outcomeView(outcome: AskOutcome): AskAnswer {
  if (outcome.status === "unknown") return { status: "unknown", message: UNKNOWN_MESSAGE };
  return outcome;
}
