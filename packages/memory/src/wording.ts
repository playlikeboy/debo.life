// Older memories read like a file about someone: "User went for a long walk".
// Debo speaks to the person as "you" (docs/WRITING.md, rule 4). New memories
// are written that way by Mem0 (see INSTRUCTIONS in index.ts). For older
// ones, this turns the common third-person openings into "you" when the page
// shows them. Display only: nothing stored in Mem0 changes.
//
// It is careful on purpose. It changes only:
// - "User" or "The user" at the very start, and fixes the verb after it
//   ("User plans" -> "You plan", "User is" -> "You are");
// - "user's" anywhere ("the user's brother" -> "your brother").
// Anything else stays as Mem0 wrote it.

/** Verbs that do not follow the usual "-s" rule. */
const IRREGULAR: Record<string, string> = {
  is: "are",
  was: "were",
  has: "have",
  does: "do",
  "isn't": "aren't",
  "wasn't": "weren't",
  "hasn't": "haven't",
  "doesn't": "don't",
};

/** Words that may sit between "User" and the verb: "User often visits". */
const ADVERBS = new Set(["also", "always", "often", "usually", "sometimes", "never", "still", "really", "now", "rarely", "regularly"]);

/** "plans" -> "plan", "watches" -> "watch", "tries" -> "try". Words that are not "-s" verbs stay as they are. */
function baseForm(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  if (!/^[a-z]+s$/.test(lower) || lower.endsWith("ss") || lower.endsWith("us") || lower.endsWith("is")) return word;
  if (/[^aeiou]ies$/.test(lower)) return `${lower.slice(0, -3)}y`;
  if (/(sh|ch|x|z|o|ss)es$/.test(lower)) return lower.slice(0, -2);
  return lower.slice(0, -1);
}

/** The memory as Debo should say it to the person. */
export function speakToPerson(text: string): string {
  let out = text.replace(/\b(?:the )?user's\b/gi, (_match, offset: number) => (offset === 0 ? "Your" : "your"));

  const lead = /^(?:the user|user)\s+(.*)$/is.exec(out);
  if (!lead?.[1]) return out;
  const words = lead[1].split(" ");
  let i = 0;
  while (i < words.length - 1 && ADVERBS.has((words[i] ?? "").toLowerCase())) i += 1;
  const verb = words[i];
  if (verb) words[i] = baseForm(verb);
  return `You ${words.join(" ")}`;
}
