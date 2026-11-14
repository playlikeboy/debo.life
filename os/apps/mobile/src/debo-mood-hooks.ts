// Hooks that feed app activity into the shared face. They never change what a screen does.
import { useEffect, useRef } from "react";
import type { TaskStatus } from "../../../packages/domain/src/agent";
import { type ChatMessageLike, latestAnswer, taskMoodEvents } from "./debo-mood-events";
import { deboMood } from "./debo-mood-store";

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
