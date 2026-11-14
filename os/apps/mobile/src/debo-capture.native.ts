// Phone (iOS and Android): pick a voice or video file, and send it to the
// upload links. Recording inside the app and dictation are NOT built here yet:
// they need a native audio module (expo-audio) and a new development build.
// The steps are in os/docs/JOURNAL-MEDIA.md. Until then the phone's own voice
// recorder plus "Add a recording" works, and the keyboard's microphone
// dictates into the text.
//
// Not run on a device yet: the web version is the one that has been exercised.
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import {
  type Capture,
  type CaptureSupport,
  type Dictation,
  type LiveRecording,
  type SentRange,
} from "./debo-capture-types";

export type { Capture, CaptureSupport, Dictation, LiveRecording, SentRange };

export function recordingSupport(): CaptureSupport {
  return { voice: false, video: false, dictation: false };
}

const NOT_YET = "Recording inside the app is not on the phone yet. Record with your phone's voice recorder, then pick the file with “Add a recording”.";

export async function startRecording(_kind: "voice" | "video", _onTick?: (ms: number) => void): Promise<LiveRecording> {
  throw new Error(NOT_YET);
}

export async function startDictation(_onClip: (clip: Blob) => Promise<void>): Promise<Dictation> {
  throw new Error("Use the microphone on your keyboard to speak into the text.");
}

export async function pickRecording(): Promise<Capture | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["audio/*", "video/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const mimeType = asset.mimeType ?? "";
  return {
    name: asset.name,
    mimeType,
    sizeBytes: asset.size ?? new File(asset.uri).size ?? 0,
    lastModified: asset.lastModified,
    origin: "picked",
    kind: mimeType.startsWith("video/") ? "video" : "voice",
    previewUri: asset.uri,
    data: asset.uri,
  };
}

export function releaseCapture(_capture: Capture) {}

/** Send bytes [from, to) of the picked file to an upload link. */
export async function sendRange(
  capture: Capture,
  url: string,
  headers: Record<string, string>,
  from: number,
  to: number,
  onProgress: (sent: number) => void,
): Promise<SentRange> {
  const uri = capture.data as string;
  if (from === 0 && to >= capture.sizeBytes) {
    const task = LegacyFileSystem.createUploadTask(
      url,
      uri,
      { httpMethod: "PUT", uploadType: LegacyFileSystem.FileSystemUploadType.BINARY_CONTENT, headers },
      (p) => onProgress(p.totalBytesSent),
    );
    const response = await task.uploadAsync();
    if (!response || response.status < 200 || response.status >= 300) throw new Error("The upload was refused. Try again.");
    return { etag: response.headers.ETag ?? response.headers.Etag ?? response.headers.etag };
  }
  // One part of a big file: read just that piece.
  const handle = new File(uri).open();
  try {
    handle.offset = from;
    const bytes = handle.readBytes(to - from);
    const response = await fetch(url, { method: "PUT", headers, body: bytes as unknown as BodyInit });
    if (!response.ok) throw new Error("The upload was refused. Try again.");
    onProgress(to - from);
    return { etag: response.headers.get("ETag") ?? undefined };
  } finally {
    handle.close();
  }
}
