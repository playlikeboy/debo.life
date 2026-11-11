// Shared by the chat agent (server) and the chat page (browser).
// No server-only imports here.

/** The CopilotKit agent id, in the route and the browser. */
export const AGENT_ID = "debo";

/** Tool call the agent sends with an answer's sources; the page draws them as chips. */
export const SOURCES_TOOL = "show_sources";

/** Tool call the agent sends when its reply is not an answer, so the page can say what to do next. */
export const NOTICE_TOOL = "show_notice";

/** Longest question the chat accepts, in characters. */
export const MAX_QUESTION = 500;

/** One source chip: the entry id and a short label such as "Journal, 14 March". */
export type Chip = { id: string; label: string };

/**
 * What kind of reply Debo gave. `answer` has sources. The rest are not
 * answers: `unknown` (nothing in the entries), `limit` (daily limit),
 * `error` (could not answer), `stopped` (the person stopped it) and
 * `invalid` (the question was too short or too long).
 */
export type ReplyKind = "answer" | "unknown" | "limit" | "error" | "stopped" | "invalid";

export type Reply = {
  kind: ReplyKind;
  text: string;
  sources: Chip[];
  /** How many entries this answer used that have since been deleted. */
  missingSources: number;
};

/** One question and Debo's reply, or null while Debo is still answering. */
export type Turn = { id: string; question: string; reply: Reply | null };

/** A chat in the list of past chats. */
export type ChatListItem = { id: string; title: string; updatedAt: string };
