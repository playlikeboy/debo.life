import { randomUUID } from "node:crypto";
import type { BaseEvent, Message } from "@ag-ui/client";
import { compactEvents } from "@ag-ui/client";
import type { Store } from "./db.ts";
import { AppError } from "./errors.ts";

/**
 * Debo-owned conversation storage. Everything lives in the `records` table, scoped by owner:
 *   threads         one row per conversation (name, archived, timestamps)
 *   thread-history  one row per conversation (replayable AG-UI events and the message list)
 *   conversation-settings/main  which thread is the person's main chat
 * Nothing here talks to the network.
 */
export interface ThreadRecord {
  id: string;
  name: string | null;
  agentId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ThreadHistory {
  id: string;
  events: BaseEvent[];
  messages: Message[];
}
export interface ThreadPage {
  threads: ThreadRecord[];
  nextCursor: string | null;
}

const THREADS = "threads";
const HISTORY = "thread-history";
const MAX_NAME = 120;
export const threadIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

export function assertThreadId(id: string): string {
  if (!threadIdPattern.test(id)) throw new AppError("Conversation id is not valid", 400);
  return id;
}

/** Keep earlier messages, replace ones that changed, append new ones. Order is preserved. */
function mergeMessages(previous: Message[], latest: Message[]): Message[] {
  const merged = [...previous];
  for (const message of latest) {
    const at = merged.findIndex((m) => m.id === message.id);
    if (at >= 0) merged[at] = message;
    else merged.push(message);
  }
  return merged;
}

export class ThreadStore {
  constructor(private readonly db: Store) {}

  /** The person's main chat id. Created once, then stable across restarts. */
  async mainThreadId(owner: string): Promise<string> {
    await this.db.insertIfAbsent(owner, "conversation-settings", {
      id: "main",
      threadId: randomUUID(),
      existing: false,
    });
    const main = await this.db.get<{ threadId: string }>(owner, "conversation-settings", "main");
    if (!main) throw new AppError("Main conversation could not be loaded", 503);
    return main.threadId;
  }

  async get(owner: string, id: string): Promise<ThreadRecord | null> {
    return this.db.get<ThreadRecord>(owner, THREADS, id);
  }

  /** Create the thread if it is new. `title` only names a thread that has no name yet. */
  async ensure(owner: string, id: string, agentId: string, title?: string): Promise<ThreadRecord> {
    const now = new Date().toISOString();
    await this.db.insertIfAbsent<ThreadRecord>(owner, THREADS, {
      id,
      name: null,
      agentId,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    const existing = await this.get(owner, id);
    if (!existing) throw new AppError("Conversation could not be saved", 503);
    const patch: Record<string, unknown> = { updatedAt: now };
    if (!existing.name && title) patch.name = title.slice(0, MAX_NAME);
    return (
      (await this.db.compareAndSwap<ThreadRecord>(owner, THREADS, id, {}, patch)) ?? {
        ...existing,
        ...patch,
      }
    );
  }

  /** Newest first. The cursor is the number of rows already returned. */
  async list(
    owner: string,
    options: { includeArchived?: boolean; limit?: number; cursor?: string | null } = {},
  ): Promise<ThreadPage> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(Number(options.cursor ?? 0) || 0, 0);
    const all = (await this.db.list<ThreadRecord>(owner, THREADS))
      .filter((t) => options.includeArchived || !t.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    const threads = all.slice(offset, offset + limit);
    return { threads, nextCursor: offset + limit < all.length ? String(offset + limit) : null };
  }

  private async patch(owner: string, id: string, patch: Record<string, unknown>) {
    const updated = await this.db.compareAndSwap<ThreadRecord>(owner, THREADS, id, {}, patch);
    if (!updated) throw new AppError("Conversation not found", 404);
    return updated;
  }
  rename(owner: string, id: string, name: string) {
    const trimmed = name.trim().slice(0, MAX_NAME);
    if (!trimmed) throw new AppError("Give the conversation a name", 422);
    return this.patch(owner, id, { name: trimmed });
  }
  archive(owner: string, id: string) {
    return this.patch(owner, id, { archived: true });
  }
  restore(owner: string, id: string) {
    return this.patch(owner, id, { archived: false });
  }
  /** Deletes the conversation and everything stored for it. */
  async remove(owner: string, id: string): Promise<void> {
    await this.db.remove(owner, THREADS, id);
    await this.db.remove(owner, HISTORY, id);
  }

  async history(owner: string, id: string): Promise<ThreadHistory> {
    return (
      (await this.db.get<ThreadHistory>(owner, HISTORY, id)) ?? { id, events: [], messages: [] }
    );
  }

  /** Add one finished run. Events are compacted so replay stays small. */
  async appendRun(owner: string, id: string, events: BaseEvent[], messages: Message[]) {
    const previous = await this.history(owner, id);
    await this.db.put<ThreadHistory>(owner, HISTORY, {
      id,
      events: compactEvents([...previous.events, ...events]),
      messages: mergeMessages(previous.messages, messages),
    });
  }
}
