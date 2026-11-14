// Small helpers that turn app activity into mood events (see debo-mood.ts).
// Screens call these; they never change what a screen does.
import { useEffect, useRef } from "react";
import type { TaskStatus } from "../../../packages/domain/src/agent";
import type { MoodInput } from "./debo-mood";
import { deboMood } from "./debo-mood-store";

/** Tools whose answers come with source chips. */
const sourceTools = ["ask_my_life", "search_my_journal", "search_web", "web_search", "search_mail", "search_files"];

interface ChatMessageLike {
  role: string;
  content?: unknown;
  toolCalls?: { function: { name: string } }[];
}

/** The latest answer: its text, and whether it used a tool that shows sources. */
export function latestAnswer(messages: ChatMessageLike[]): { text: string; hasSources: boolean } | undefined {
  const lastUser = messages.map((m) => m.role).lastIndexOf("user");
  const turn = messages.slice(lastUser + 1).filter((m) => m.role === "assistant" || m.role === "tool");
  const answer = [...turn].reverse().find((m) => m.role === "assistant" && typeof m.content === "string" && m.content.trim());
  if (!answer) return undefined;
  const hasSources = turn.some((m) => m.toolCalls?.some((call) => sourceTools.includes(call.function.name)));
  return { text: String(answer.content), hasSources };
}

/**
 * Compares task statuses with the last time we looked, and says what Debo's face should do.
 * A finished task makes her proud. A task waiting for a yes makes her curious and attentive.
 */
export function taskMoodEvents(
  before: Map<string, TaskStatus> | undefined,
  tasks: { id: string; status: TaskStatus }[],
): { events: MoodInput[]; next: Map<string, TaskStatus> } {
  const next = new Map(tasks.map((task) => [task.id, task.status]));
  const events: MoodInput[] = [];
  if (!before) return { events, next }; // the first look only learns the starting point
  for (const task of tasks) {
    const was = before.get(task.id);
    if (was === task.status) continue;
    if (task.status === "succeeded") events.push({ type: "task_done" });
    else if (task.status === "failed") events.push({ type: "error", actionable: false });
  }
  const waiting = (map: Map<string, TaskStatus>) =>
    [...map.values()].some((status) => status === "waiting_approval");
  if (waiting(next) && !waiting(before)) events.push({ type: "approval_waiting" });
  if (!waiting(next) && waiting(before)) events.push({ type: "approval_cleared" });
  return { events, next };
}

export function useTaskMood(tasks: { id: string; status: TaskStatus }[] | undefined) {
  const seen = useRef<Map<string, TaskStatus> | undefined>(undefined);
  useEffect(() => {
    if (!tasks) return;
    const { events, next } = taskMoodEvents(seen.current, tasks);
    seen.current = next;
    for (const event of events) deboMood.emit(event);
  }, [tasks]);
}

/**
 * Follows a chat turn: waiting for the answer, streaming it, then the answer itself
 * (happy with sources, curious when she has nothing yet). Pass `active` so only the
 * chat the person is looking at moves the face.
 */
export function useChatMood({
  active,
  running,
  messages,
  error,
}: {
  active: boolean;
  running: boolean;
  messages: ChatMessageLike[];
  error: string;
}) {
  const was = useRef(false);
  const streamed = useRef(false);
  const lastError = useRef("");
  const length = messages.length;
  const tail = messages[length - 1];
  const tailText = typeof tail?.content === "string" ? tail.content : "";
  useEffect(() => {
    if (!active) return;
    if (running && !was.current) {
      streamed.current = false;
      deboMood.emit({ type: "waiting" });
    }
    if (running && tail?.role === "assistant" && tailText && !streamed.current) {
      streamed.current = true;
      deboMood.emit({ type: "streaming" });
    }
    if (!running && was.current) {
      const answer = latestAnswer(messages);
      if (answer) deboMood.emit({ type: "answer", ...answer });
      else deboMood.emit({ type: "voice", state: "idle" });
    }
    was.current = running;
  }, [active, running, tail?.role, tailText, messages]);
  useEffect(() => {
    if (active && error && error !== lastError.current) deboMood.emit({ type: "error", actionable: false });
    lastError.current = error;
  }, [active, error]);
}
