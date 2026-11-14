// How risky is one tool call? The answer comes from the provider's hints on the tool,
// never from the model. When the hints are missing or unclear the answer is "write",
// so the person is asked.
import type { Risk, ToolMeta } from "./types.ts";

/** Words in a tool's name that mean it changes something, even if a hint says it only reads. */
const CHANGING_WORDS = new Set([
  "SEND",
  "REPLY",
  "FORWARD",
  "POST",
  "PUBLISH",
  "CREATE",
  "ADD",
  "UPDATE",
  "EDIT",
  "MODIFY",
  "PATCH",
  "WRITE",
  "UPLOAD",
  "INSERT",
  "APPEND",
  "MOVE",
  "RENAME",
  "COPY",
  "SHARE",
  "INVITE",
  "ASSIGN",
  "COMMENT",
  "PAY",
  "TRANSFER",
  "CHARGE",
  "REFUND",
  "SUBSCRIBE",
  "UNSUBSCRIBE",
  "FOLLOW",
  "UNFOLLOW",
  "LIKE",
  "CANCEL",
  "ARCHIVE",
  "RESTORE",
  "TRIGGER",
  "RUN",
  "EXECUTE",
  "SET",
  "MERGE",
  "CLOSE",
  "REOPEN",
  "MARK",
  "LABEL",
  "STAR",
]);
const DELETING_WORDS = new Set(["DELETE", "REMOVE", "TRASH", "DESTROY", "REVOKE", "PURGE", "ERASE"]);

export function classifyRisk(tool: Pick<ToolMeta, "slug" | "tags">): Risk {
  const tags = new Set(tool.tags);
  const words = tool.slug.toUpperCase().split("_");
  if (tags.has("destructiveHint") || words.some((word) => DELETING_WORDS.has(word)))
    return "destructive";
  if (tags.has("createHint") || tags.has("updateHint")) return "write";
  // Only a plain read hint, with nothing in the name that says otherwise, runs without asking.
  if (tags.has("readOnlyHint") && !words.some((word) => CHANGING_WORDS.has(word))) return "read";
  return "write";
}

/** Meta tools of the provider (code runners, shells) are never reachable from Debo. */
export function isMetaTool(slug: string) {
  return slug.toUpperCase().startsWith("COMPOSIO_");
}
