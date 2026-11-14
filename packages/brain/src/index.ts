// @debo/brain: the one path from a question to an answer, with no web
// framework in it. The Debo web app and the agent platform in os/ both call
// this, so the rules hold everywhere:
// - answers come only from the person's own pieces, with sources;
// - no source, no answer ("I don't have anything about that yet"), except
//   small talk ("hi", "thanks", "what can you do?"), which gets a short reply
//   with no sources and no facts about the person (decision 24);
// - the daily limit is checked before any model call;
// - usage and the activity record are written (ids and numbers only).
//
// Everything it needs from outside (database, model, log) comes in through
// createBrain(), so tests can pass fakes and each app passes its own settings.
import {
  recordActivity,
  recordUsage,
  searchPieces,
  tokensUsedToday,
  type ActivityAction,
  type FoundPiece,
  type SearchOptions,
} from "@debo/db";
import type { Llm } from "@debo/llm";

export type SourceChip = { id: string; label: string };
export type AskResult =
  | { status: "answered"; answer: string; sources: SourceChip[] }
  | { status: "unknown" }
  | { status: "limit"; message: string };

/**
 * How a streamed question ended. `stopped` means the person stopped it:
 * `answer` and `sources` are what was shown by then (both may be empty).
 */
export type AskOutcome = AskResult | { status: "stopped"; answer: string; sources: SourceChip[] };

/**
 * What askStream yields. `sources` always comes before the first `text`,
 * and `done` always comes last.
 */
export type AskEvent =
  | { type: "sources"; sources: SourceChip[] }
  | { type: "text"; delta: string }
  | { type: "done"; outcome: AskOutcome };

export const UNKNOWN_MESSAGE = "I don’t have anything about that yet. Write an entry about it, then ask again.";
export const LIMIT_MESSAGE =
  "You have asked a lot today, and Debo has reached its daily limit for you. You can ask again after midnight UTC. Your entries are safe.";

/** Tokens one person may use on our AI key per day (UTC). See docs/BYOK-AND-PLANS.md, "Limits". */
export function dailyTokenLimit(env: Record<string, string | undefined> = process.env): number {
  const fromEnv = Number(env.DAILY_TOKEN_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 40_000;
}

/** What the brain reads and writes in the database. The default is @debo/db. */
export type BrainStore = {
  searchPieces(userId: string, question: string, options: SearchOptions): Promise<FoundPiece[]>;
  recordUsage(userId: string, row: { provider: "anthropic" | "neon"; units: number }): Promise<void>;
  tokensUsedToday(userId: string): Promise<number>;
  recordActivity(
    userId: string,
    item: { actor: "you" | "debo"; action: ActivityAction; sourceIds?: string[] },
  ): Promise<void>;
};

/** The store backed by @debo/db. `connection` may be a function so each call can look it up fresh. */
export function dbStore(connection: string | (() => string)): BrainStore {
  const url = () => (typeof connection === "function" ? connection() : connection);
  return {
    searchPieces: (userId, question, options) => searchPieces(url(), userId, question, options),
    recordUsage: (userId, row) => recordUsage(url(), userId, row),
    tokensUsedToday: (userId) => tokensUsedToday(url(), userId),
    recordActivity: (userId, item) => recordActivity(url(), userId, item),
  };
}

/** The parts of @debo/llm the brain uses. A fake can stand in for it. */
export type BrainLlm = Pick<Llm, "embed" | "streamAnswerFromSources" | "streamReply">;

export type Logger = {
  info(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
};

export type BrainOptions = {
  store: BrainStore;
  llm: BrainLlm;
  /** Tokens per person per day. Defaults to dailyTokenLimit(). */
  dailyLimit?: () => number;
  /** Logs carry ids and numbers only, never text. Defaults to console. */
  log?: Logger;
};

export function createBrain(options: BrainOptions) {
  const { store, llm } = options;
  const log: Logger = options.log ?? {
    info: (message, fields) => console.info(message, fields),
    error: (message, fields) => console.error(message, fields),
  };
  const limit = options.dailyLimit ?? (() => dailyTokenLimit());

  /**
   * Write to the activity record. If that write fails, the person's action
   * still stands; log it so the gap can be found and fixed.
   */
  async function logActivity(userId: string, actor: "you" | "debo", action: ActivityAction, sourceIds: string[] = []) {
    try {
      await store.recordActivity(userId, { actor, action, sourceIds });
    } catch (error) {
      log.error("activity record failed", { userId, action, reason: error instanceof Error ? error.name : "unknown" });
    }
  }

  /**
   * Answer a question from this person's own entries, streaming the answer.
   * Pass `signal` to let the person stop it. Throws only on unexpected failures.
   */
  async function* askStream(
    userId: string,
    question: string,
    opts: { signal?: AbortSignal } = {},
  ): AsyncGenerator<AskEvent, void> {
    // Meaning search needs the question as a vector. If that fails, keyword
    // search alone still answers, so the question never fails because of it.
    let embedding: number[] | undefined;
    try {
      const { vectors, tokens } = await llm.embed([question]);
      embedding = vectors[0];
      await store.recordUsage(userId, { provider: "neon", units: tokens });
    } catch (error) {
      log.error("question embedding failed", { userId, reason: error instanceof Error ? error.name : "unknown" });
    }

    // The daily limit is checked before any model call below.
    if ((await store.tokensUsedToday(userId)) >= limit()) {
      yield { type: "done", outcome: { status: "limit", message: LIMIT_MESSAGE } };
      return;
    }

    const pieces = await store.searchPieces(userId, question, { embedding });
    if (pieces.length === 0) {
      yield* smallTalkOrUnknown(userId, question, opts.signal);
      return;
    }

    // Chips come from the pieces search found, which are already this
    // person's own (searchPieces filters by userId), and the model can only
    // name ids from those pieces. So no second read is needed.
    const days = new Map(pieces.map((p) => [p.sourceId, p.happenedAt]));
    const kinds = new Map(pieces.map((p) => [p.sourceId, p.kind]));
    const chipsFor = (ids: string[]): SourceChip[] =>
      ids.flatMap((id) => {
        const day = days.get(id);
        return day ? [{ id, label: `${chipName(kinds.get(id))}, ${formatDay(day)}` }] : [];
      });

    const stream = llm.streamAnswerFromSources(
      question,
      pieces.map((p) => ({ id: p.sourceId, title: p.title, date: p.happenedAt.toISOString().slice(0, 10), text: p.text })),
      { signal: opts.signal },
    );
    for await (const event of stream) {
      if (event.type === "sources") {
        yield { type: "sources", sources: chipsFor(event.sourceIds) };
      } else if (event.type === "text") {
        yield { type: "text", delta: event.delta };
      } else {
        await store.recordUsage(userId, { provider: event.provider, units: event.tokens });
        const sources = chipsFor(event.sourceIds);
        const shown = event.found && sources.length > 0;
        if (shown) await logActivity(userId, "debo", "answered", sources.map((s) => s.id));
        log.info("asked", { userId, sources: sources.length, provider: event.provider, tokens: event.tokens, stopped: event.stopped });

        if (event.stopped) {
          yield { type: "done", outcome: { status: "stopped", answer: shown ? event.answer : "", sources: shown ? sources : [] } };
        } else if (shown) {
          yield { type: "done", outcome: { status: "answered", answer: event.answer, sources } };
        } else {
          // Nothing shown yet: the entries found don't answer it. It may be small talk.
          yield* smallTalkOrUnknown(userId, question, opts.signal);
        }
        return;
      }
    }
    throw new Error("The answer stream ended without a result.");
  }

  /**
   * The person's entries don't answer this message. Small talk ("hi",
   * "thanks", "what can you do?") gets a short reply with no sources; it
   * never states a fact about the person. Anything else is "unknown".
   */
  async function* smallTalkOrUnknown(
    userId: string,
    message: string,
    signal: AbortSignal | undefined,
  ): AsyncGenerator<AskEvent, void> {
    let opened = false;
    for await (const event of llm.streamReply(message, { signal })) {
      if (event.type === "text") {
        if (!opened) {
          opened = true;
          yield { type: "sources", sources: [] };
        }
        yield { type: "text", delta: event.delta };
        continue;
      }
      await store.recordUsage(userId, { provider: event.provider, units: event.tokens });
      log.info("small talk", { userId, talk: event.talk, provider: event.provider, tokens: event.tokens, stopped: event.stopped });
      if (event.stopped) {
        yield { type: "done", outcome: { status: "stopped", answer: event.reply, sources: [] } };
      } else if (event.talk) {
        await logActivity(userId, "debo", "answered");
        yield { type: "done", outcome: { status: "answered", answer: event.reply, sources: [] } };
      } else {
        await logActivity(userId, "debo", "did-not-know");
        yield { type: "done", outcome: { status: "unknown" } };
      }
      return;
    }
    throw new Error("The reply stream ended without a result.");
  }

  /** Answer a question from this person's own entries, all at once. Throws only on unexpected failures. */
  async function answerQuestion(userId: string, question: string): Promise<AskResult> {
    for await (const event of askStream(userId, question)) {
      if (event.type !== "done") continue;
      // Without a signal nothing can stop the answer, so `stopped` cannot happen.
      if (event.outcome.status === "stopped") throw new Error("An answer stopped without being asked to.");
      return event.outcome;
    }
    throw new Error("The answer stream ended without a result.");
  }

  return { askStream, answerQuestion, logActivity };
}

export type Brain = ReturnType<typeof createBrain>;

/** What a source chip calls where the words came from. Pieces from before kinds existed are journal entries. */
function chipName(kind?: string) {
  return kind === "voice" ? "Voice note" : kind === "video" ? "Video" : "Journal";
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
