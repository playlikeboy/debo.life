// Web: recording with MediaRecorder (the browser's own recorder), dictation as
// short clips, picking a file, and sending a file to the upload links.
// The microphone is only ever opened by a call here that a button press made,
// and every path closes it again (stop, cancel, or an error).
import {
  type Capture,
  type CaptureSupport,
  type Dictation,
  type LiveRecording,
  micProblemText,
  type SentRange,
} from "./debo-capture-types";

export type { Capture, CaptureSupport, Dictation, LiveRecording, SentRange };

const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const VIDEO_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

function supportedType(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function recordingSupport(): CaptureSupport {
  const ok =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  return { voice: ok, video: ok && !!supportedType(VIDEO_TYPES), dictation: ok };
}

async function openStream(video: boolean): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video });
  } catch (error) {
    throw new Error(micProblemText(error, video));
  }
}

const closeStream = (stream: MediaStream) => {
  for (const track of stream.getTracks()) track.stop();
};

/** Record until stop() is called. The timer is counted here, because a browser recording has no length written in it. */
export async function startRecording(kind: "voice" | "video", onTick?: (ms: number) => void): Promise<LiveRecording> {
  const stream = await openStream(kind === "video");
  const mimeType = supportedType(kind === "video" ? VIDEO_TYPES : AUDIO_TYPES);
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const parts: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) parts.push(e.data);
  };
  const started = Date.now();
  const timer = setInterval(() => onTick?.(Date.now() - started), 250);
  let settled = false;
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(parts, { type: recorder.mimeType || mimeType || "audio/webm" }));
  });
  // A timeslice, so a long recording is not held back until the end.
  recorder.start(5000);
  const finish = () => {
    settled = true;
    clearInterval(timer);
    closeStream(stream);
  };
  return {
    stream,
    async stop() {
      const durationMs = Date.now() - started;
      if (recorder.state !== "inactive") recorder.stop();
      const blob = await done;
      if (!settled) finish();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      return {
        name: `${kind === "video" ? "Video" : "Voice note"} ${stamp}`,
        mimeType: blob.type,
        sizeBytes: blob.size,
        durationMs,
        origin: "recorded",
        kind,
        previewUri: URL.createObjectURL(blob),
        data: blob,
      };
    },
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      if (!settled) finish();
    },
  };
}

/**
 * Speaking into the text. Every ~8 seconds the recorder is restarted so each
 * clip is a whole, playable file; `onClip` gets each one as it is ready, in
 * order. There is a gap of a few milliseconds between clips.
 */
export async function startDictation(onClip: (clip: Blob) => Promise<void>, segmentMs = 8000): Promise<Dictation> {
  const stream = await openStream(false);
  const mimeType = supportedType(AUDIO_TYPES);
  let listening = true;
  let current: MediaRecorder | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  let lastClip: Promise<void> = Promise.resolve();

  const begin = () => {
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const parts: Blob[] = [];
    current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data);
    };
    recorder.onstop = () => {
      const clip = new Blob(parts, { type: recorder.mimeType || mimeType || "audio/webm" });
      // Under about half a second is a click or a breath, not speech.
      if (clip.size > 2500) queue = lastClip = queue.then(() => onClip(clip)).catch(() => {});
      if (listening) begin();
      else closeStream(stream);
    };
    recorder.start();
    timer = setTimeout(() => recorder.state === "recording" && recorder.stop(), segmentMs);
  };
  begin();

  return {
    async stop() {
      listening = false;
      if (timer) clearTimeout(timer);
      if (current && current.state !== "inactive") current.stop();
      else closeStream(stream);
      // Wait for the last clip to be written out.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await lastClip;
      await queue;
    },
  };
}

/** Open the browser's file picker for one audio or video file. Null when the person closes it. */
export function pickRecording(): Promise<Capture | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/*,.m4a,.mp3,.wav,.webm,.mp4,.mov,.ogg,.aac,.flac,.3gp";
    input.style.display = "none";
    const cleanup = () => input.remove();
    input.onchange = async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return resolve(null);
      const mimeType = file.type || guessType(file.name);
      const video = mimeType.startsWith("video/");
      const previewUri = URL.createObjectURL(file);
      resolve({
        name: file.name,
        mimeType,
        sizeBytes: file.size,
        durationMs: await readDuration(previewUri, video),
        lastModified: file.lastModified,
        origin: "picked",
        kind: video ? "video" : "voice",
        previewUri,
        data: file,
      });
    };
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

const guessType = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const table: Record<string, string> = {
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
    ogg: "audio/ogg",
    aac: "audio/aac",
    flac: "audio/flac",
    mp4: "video/mp4",
    mov: "video/quicktime",
    "3gp": "video/3gpp",
  };
  return table[ext] ?? "";
};

/** Ask the browser how long a file is. Undefined when it cannot say (some recordings carry no length). */
function readDuration(uri: string, video: boolean): Promise<number | undefined> {
  return new Promise((resolve) => {
    const element = document.createElement(video ? "video" : "audio");
    const finish = (value?: number) => {
      element.removeAttribute("src");
      resolve(value);
    };
    const timer = setTimeout(() => finish(undefined), 4000);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined);
    };
    element.onerror = () => {
      clearTimeout(timer);
      finish(undefined);
    };
    element.src = uri;
  });
}

export function releaseCapture(capture: Capture) {
  URL.revokeObjectURL(capture.previewUri);
}

/** Send bytes [from, to) of the file to an upload link. Reports how much of THIS piece has gone. */
export function sendRange(
  capture: Capture,
  url: string,
  headers: Record<string, string>,
  from: number,
  to: number,
  onProgress: (sent: number) => void,
): Promise<SentRange> {
  return new Promise((resolve, reject) => {
    const blob = (capture.data as Blob).slice(from, to);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ etag: xhr.getResponseHeader("ETag") ?? undefined });
      else reject(new Error("The upload was refused. Try again."));
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.ontimeout = xhr.onerror;
    xhr.send(blob);
  });
}
