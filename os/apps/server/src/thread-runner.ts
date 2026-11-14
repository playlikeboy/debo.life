import { AsyncLocalStorage } from "node:async_hooks";
import { type BaseEvent, EventType, type Message } from "@ag-ui/client";
import {
  AgentRunner,
  type AgentRunnerConnectRequest,
  type AgentRunnerIsRunningRequest,
  type AgentRunnerRunRequest,
  type AgentRunnerStopRequest,
  finalizeRunEvents,
} from "@copilotkit/runtime/v2";
import { Observable, ReplaySubject } from "rxjs";
import { backgroundFailure } from "./log.ts";
import type { ThreadStore } from "./threads.ts";

/** The signed-in owner of the request being served. The app sets it around each CopilotKit call. */
export const threadOwner = new AsyncLocalStorage<string>();

function currentOwner(): string {
  const owner = threadOwner.getStore();
  // Fail closed: a conversation is never stored or read without a known owner.
  if (!owner) throw new Error("Conversation request has no signed-in owner");
  return owner;
}

interface LiveRun {
  runId: string;
  subject: ReplaySubject<BaseEvent>;
  agent: { abortRun: () => void };
  stopRequested: boolean;
}

function firstWords(messages: readonly Message[] | undefined): string | undefined {
  const last = [...(messages ?? [])].reverse().find((m) => m.role === "user");
  const text = typeof last?.content === "string" ? last.content.trim().replace(/\s+/g, " ") : "";
  return text ? (text.length > 60 ? `${text.slice(0, 57)}...` : text) : undefined;
}

/**
 * Runs the agent and saves every finished run to Debo's own database, so a conversation
 * can be replayed after a restart. Live state (a reply still streaming) stays in memory.
 * Keys include the owner, so one person can never replay or stop another person's thread.
 */
export class DatabaseAgentRunner extends AgentRunner {
  private readonly live = new Map<string, LiveRun>();
  constructor(private readonly threads: ThreadStore) {
    super();
  }
  private key(owner: string, threadId: string) {
    return `${owner}\u0000${threadId}`;
  }

  run(request: AgentRunnerRunRequest): Observable<BaseEvent> {
    const owner = currentOwner();
    const key = this.key(owner, request.threadId);
    if (this.live.has(key)) throw new Error("Thread already running");
    const subject = new ReplaySubject<BaseEvent>(Number.POSITIVE_INFINITY);
    const run: LiveRun = {
      runId: request.input.runId,
      subject,
      agent: request.agent,
      stopRequested: false,
    };
    this.live.set(key, run);
    const events: BaseEvent[] = [];
    const finish = async (interruption?: string) => {
      const extra = finalizeRunEvents(events, {
        stopRequested: run.stopRequested,
        ...(interruption !== undefined ? { interruptionMessage: interruption } : {}),
      });
      for (const event of extra) subject.next(event);
      try {
        await this.threads.ensure(
          owner,
          request.threadId,
          request.agent.agentId ?? "default",
          firstWords(request.input.messages),
        );
        if (interruption === undefined || events.length > 0)
          await this.threads.appendRun(
            owner,
            request.threadId,
            events,
            Array.isArray(request.agent.messages) ? [...request.agent.messages] : [],
          );
      } catch (error) {
        backgroundFailure("save conversation", error);
      }
      this.live.delete(key);
      subject.complete();
    };
    // The first event of a run carries the new user messages, so a replay can rebuild them.
    // Messages the thread already holds are left out, so they are not shown twice.
    const known = this.threads.history(owner, request.threadId).then((history) => {
      const ids = new Set<string>();
      for (const event of history.events) {
        const id = (event as { messageId?: unknown }).messageId;
        if (typeof id === "string") ids.add(id);
        if (event.type === EventType.RUN_STARTED)
          for (const message of (event as { input?: { messages?: Message[] } }).input?.messages ??
            [])
            ids.add(message.id);
      }
      return ids;
    });
    void known
      .catch(() => new Set<string>())
      .then((ids) =>
        request.agent.runAgent(request.input, {
          onEvent: ({ event }: { event: BaseEvent }) => {
            if (event.type === EventType.RUN_STARTED) {
              const started = event as { input?: unknown };
              if (!started.input)
                started.input = {
                  ...request.input,
                  messages: (request.input.messages ?? []).filter((m) => !ids.has(m.id)),
                };
            }
            events.push(event);
            subject.next(event);
          },
        }),
      )
      .then(
        () => finish(),
        (error: unknown) => finish(error instanceof Error ? error.message : String(error)),
      );
    return subject.asObservable();
  }

  connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    const owner = currentOwner();
    const key = this.key(owner, request.threadId);
    return new Observable<BaseEvent>((subscriber) => {
      let live: { unsubscribe: () => void } | undefined;
      (async () => {
        const history = await this.threads.history(owner, request.threadId);
        const seen = new Set<string>();
        for (const event of history.events) {
          subscriber.next(event);
          const id = (event as { messageId?: unknown }).messageId;
          if (typeof id === "string") seen.add(id);
        }
        const current = this.live.get(key);
        if (!current) return subscriber.complete();
        live = current.subject.subscribe({
          next: (event) => {
            const id = (event as { messageId?: unknown }).messageId;
            if (typeof id === "string" && seen.has(id)) return;
            subscriber.next(event);
          },
          complete: () => subscriber.complete(),
          error: (error) => subscriber.error(error),
        });
      })().catch((error) => subscriber.error(error));
      return () => live?.unsubscribe();
    });
  }

  async isRunning(request: AgentRunnerIsRunningRequest): Promise<boolean> {
    return this.live.has(this.key(currentOwner(), request.threadId));
  }

  async stop(request: AgentRunnerStopRequest): Promise<boolean> {
    const run = this.live.get(this.key(currentOwner(), request.threadId));
    if (!run || run.stopRequested) return false;
    if (request.runId !== undefined && run.runId !== request.runId) return false;
    run.stopRequested = true;
    try {
      run.agent.abortRun();
      return true;
    } catch {
      run.stopRequested = false;
      return false;
    }
  }
}
