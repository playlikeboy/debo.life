
/** One source Debo used, shown as a chip next to the answer. */
export interface VoiceSource {
  id: string;
  label: string;
}

export interface VoiceTurn {
  role: "user" | "assistant";
  text: string;
}

export interface VoiceQuestion {
  /** The owner id. It comes from the LiveKit identity, which /api/voice/token set. */
  userId: string;
  /** One voice conversation. */
  sessionId: string;
  question: string;
  /** Recent turns before this question, oldest first. */
  history: VoiceTurn[];
}

/**
 * What a brain streams back. The order is: `sources` (optional, before any
 * text), an optional `emotion` hint (how to sound), `text` pieces, then exactly one `done`. `say` is a fixed sentence to
 * speak as is, for example "I don't have anything about that yet".
 */
export type VoiceBrainEvent =
  | { type: "sources"; sources: VoiceSource[] }
  | { type: "text"; delta: string }
  | { type: "say"; text: string }
  | { type: "emotion"; emotion: string }
  | { type: "done"; status: "answered" | "unknown" | "limit" | "stopped" | "error" };

/**
 * The one thing the voice route needs from Debo's brain. Swap the
 * implementation in `createApp` (the `voiceBrain` line in app.ts); the route
 * and the voice agent do not change.
 */
export interface VoiceBrain {
  answer(question: VoiceQuestion, signal: AbortSignal): AsyncGenerator<VoiceBrainEvent>;
}

export const VOICE_ERROR_MESSAGE =
  "Sorry, I couldn't reach my memory just now. Please try again in a moment.";

/** Said out loud whenever a turn prepared something for the person to approve on screen. */
export const APPROVAL_MESSAGE = " I've put that on your screen to approve.";
