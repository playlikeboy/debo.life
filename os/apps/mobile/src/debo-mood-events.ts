// Pure helpers that turn app activity into mood events (see debo-mood.ts).
import type { TaskStatus } from "../../../packages/domain/src/agent";
import type { MoodInput } from "./debo-mood";

/** Tools whose answers come with source chips. */
const sourceTools = ["ask_my_life", "search_my_journal", "search_web", "web_search", "search_mail", "search_files"];

export interface ChatMessageLike {
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
