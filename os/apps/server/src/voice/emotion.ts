import { VOICE_EMOTIONS } from "../engine/personality.ts";

const OPEN = "[[feel:";
const CLOSE = "]]";

/**
 * Takes the reply text piece by piece. The model starts each spoken reply with a
 * tag like `[[feel:happy]]`. This removes the tag, so it is never spoken, and
 * reports the feeling. A tag with an unknown word is removed but gives no
 * feeling. Text that does not start with the tag passes through untouched.
 */
export class EmotionFilter {
  private buffer = "";
  private decided = false;

  /** Call at the start of each new reply. */
  reset() {
    this.buffer = "";
    this.decided = false;
  }

  push(delta: string): { text: string; emotion?: string } {
    if (this.decided) return { text: delta };
    this.buffer += delta;
    const probe = this.buffer.trimStart();
    // Not (or no longer) a possible tag: let it through.
    if (probe.length > 0 && !OPEN.startsWith(probe.slice(0, OPEN.length)) && !probe.startsWith(OPEN))
      return this.release();
    if (probe.startsWith(OPEN)) {
      const end = probe.indexOf(CLOSE);
      if (end < 0) {
        // A real tag is short. If it runs on, it was not a tag.
        return probe.length > 40 ? this.release() : { text: "" };
      }
      const word = probe.slice(OPEN.length, end).trim().toLowerCase();
      const rest = probe.slice(end + CLOSE.length).replace(/^\s+/, "");
      this.decided = true;
      this.buffer = "";
      const known = (VOICE_EMOTIONS as readonly string[]).includes(word);
      return { text: rest, ...(known ? { emotion: word } : {}) };
    }
    return { text: "" };
  }

  /** The reply ended while still undecided: give back what was held. */
  flush(): string {
    const held = this.buffer;
    this.buffer = "";
    this.decided = true;
    return held;
  }

  private release() {
    const text = this.buffer;
    this.buffer = "";
    this.decided = true;
    return { text };
  }
}
