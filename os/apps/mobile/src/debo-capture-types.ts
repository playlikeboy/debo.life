// What the recording code (web and phone versions) hands to the screens.
// The two platform files, debo-capture.web.ts and debo-capture.native.ts, must
// export the same names. No React in here.

/** A recording or file the person has not saved yet. */
export type Capture = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  /** When the file was last changed, for a picked file. */
  lastModified?: number;
  origin: "recorded" | "picked";
  kind: "voice" | "video";
  /** Something a player can play before it is saved. */
  previewUri: string;
  /** Web: a Blob. Phone: a file address. Only the platform file reads it. */
  data: unknown;
};

/** A recording in progress. */
export type LiveRecording = {
  /** Stop and get what was recorded. */
  stop(): Promise<Capture>;
  /** Stop and throw the recording away. */
  cancel(): void;
  /** Web only: the camera picture, to show while recording. */
  stream?: unknown;
};

/** Speaking into the text: clips go out while the mic is on. */
export type Dictation = {
  /** Turn the mic off and send the last clip. */
  stop(): Promise<void>;
};

export type CaptureSupport = { voice: boolean; video: boolean; dictation: boolean };

/** One piece of an upload went up. `etag` is what R2 sent back for a part. */
export type SentRange = { etag?: string };

/** Plain words for why the mic or camera could not be used. */
export function micProblemText(error: unknown, camera = false): string {
  const name = error instanceof Error ? error.name : "";
  const what = camera ? "camera and microphone" : "microphone";
  if (name === "NotAllowedError" || name === "SecurityError")
    return `I can't use your ${what}. Allow it in your browser's address bar, then try again.`;
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return `I can't find a ${what} on this device. You can still add a recording you already have.`;
  if (name === "NotReadableError") return `Something else is using your ${what}. Close it, then try again.`;
  return `I couldn't start the ${what}. Try again, or add a recording you already have.`;
}
