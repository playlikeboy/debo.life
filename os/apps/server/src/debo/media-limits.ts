// What a recording may be, in one place. The server enforces all of this;
// the app shows the same numbers (it reads them from /api/debo/status).
// See os/docs/JOURNAL-MEDIA.md.

/** 200 MB. */
export const MAX_BYTES = 200 * 1024 * 1024;
/** One hour. */
export const MAX_MINUTES = 60;
/** Files up to this size go up in one request. Bigger ones go up in parts. */
export const SINGLE_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;
/** Size of each part of a multipart upload (R2 needs at least 5 MiB per part but the last). */
export const PART_BYTES = 16 * 1024 * 1024;
/** How long an upload link works. */
export const UPLOAD_LINK_SECONDS = 2 * 3600;
/** How long a playback link works. */
export const PLAYBACK_LINK_SECONDS = 3600;
/** The most a person can add in one UTC day. */
export const MAX_RECORDINGS_PER_DAY = 40;
export const MAX_MINUTES_PER_DAY = 240;
/** Dictation: short clips sent while someone speaks into the text. */
export const DICTATION_MAX_BYTES = 3 * 1024 * 1024;
export const DICTATION_PER_MINUTE = 30;
export const DICTATION_PER_DAY = 600;

/** Plain-words description of the limits, for the screen. */
export type MediaLimits = {
  maxBytes: number;
  maxMinutes: number;
  maxMinutesPerDay: number;
  maxRecordingsPerDay: number;
};
export const MEDIA_LIMITS: MediaLimits = {
  maxBytes: MAX_BYTES,
  maxMinutes: MAX_MINUTES,
  maxMinutesPerDay: MAX_MINUTES_PER_DAY,
  maxRecordingsPerDay: MAX_RECORDINGS_PER_DAY,
};

/** Allowed file types, with the extension used in the bucket. Parameters like ";codecs=opus" are ignored. */
const TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/3gpp": "3gp",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
  "video/ogg": "ogv",
};

/** "audio/webm;codecs=opus" becomes "audio/webm". Null when the type is not allowed. */
export function cleanMimeType(raw: string): string | null {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return base in TYPES ? base : null;
}

export function extensionFor(mime: string): string {
  return TYPES[mime] ?? "bin";
}

export const BAD_TYPE =
  "I can't use that kind of file. Pick a voice or video file such as .m4a, .mp3, .wav, .webm or .mp4.";
export const TOO_BIG = "That recording is too big. Keep it under 200 MB.";
export const TOO_LONG = "That recording is too long. Keep it under 60 minutes.";
export const DAILY_FULL =
  "You have added a lot of recordings today. You can add more tomorrow (the day changes at midnight UTC). Your entries are safe.";
