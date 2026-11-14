// Calls to the server's /api/debo routes. Errors keep the server's plain words.
import { z } from "zod";
import type { FuseApi } from "./api";
import { readApiPayload } from "./api-response";
import {
  type ActivityView,
  activityReply,
  type DeboStatus,
  deboStatus,
  type EntryView,
  entriesReply,
  entryView,
  type MemoryView,
  memoriesReply,
} from "./debo-data";

const uploadStarted = z.object({
  mediaId: z.string(),
  kind: z.enum(["voice", "video"]),
  upload: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("single"), url: z.string(), headers: z.record(z.string(), z.string()) }),
    z.object({
      mode: z.literal("multipart"),
      uploadId: z.string(),
      partBytes: z.number(),
      parts: z.array(z.object({ number: z.number(), url: z.string(), headers: z.record(z.string(), z.string()) })),
    }),
  ]),
});
export type UploadStarted = z.infer<typeof uploadStarted>;

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again in a moment.";
}

export const deboApi = (api: FuseApi) => ({
  async status(): Promise<DeboStatus> {
    return deboStatus.parse(await api.request("/api/debo/status"));
  },
  async entries(find?: string): Promise<EntryView[]> {
    const query = find?.trim() ? `?find=${encodeURIComponent(find.trim())}&limit=500` : "?limit=500";
    return entriesReply.parse(await api.request(`/api/debo/entries${query}`)).entries;
  },
  async addEntry(text: string, happenedAt?: string) {
    await api.request("/api/debo/entries", { text, ...(happenedAt ? { happenedAt } : {}) });
  },
  /** Step 1 of adding a recording: links to upload to. */
  async startUpload(body: {
    kind: "voice" | "video";
    mimeType: string;
    sizeBytes: number;
    durationMs?: number;
    recordedAt?: string;
    origin: "recorded" | "picked";
    fileName?: string;
    lastModified?: number;
  }): Promise<UploadStarted> {
    return uploadStarted.parse(await api.request("/api/debo/media/uploads", body));
  },
  /** Step 3: the file is up. The entry is saved now and its words come a little later. */
  async completeUpload(mediaId: string, body: { parts?: { number: number; etag: string }[]; happenedAt?: string }) {
    const reply = await api.request(`/api/debo/media/uploads/${encodeURIComponent(mediaId)}/complete`, body);
    return z.object({ entry: entryView }).parse(reply).entry;
  },
  /** A short-lived link that plays the recording of one entry. */
  async playbackUrl(id: string): Promise<string> {
    const reply = await api.request(`/api/debo/entries/${encodeURIComponent(id)}/playback`);
    return z.object({ url: z.string() }).parse(reply).url;
  },
  async retryTranscript(id: string) {
    await api.request(`/api/debo/entries/${encodeURIComponent(id)}/transcript/retry`, {});
  },
  /** Words for a short clip spoken into the text. The clip is not kept. */
  async dictate(clip: Blob): Promise<string> {
    const response = await fetch(api.url("/api/debo/transcribe"), {
      method: "POST",
      headers: { Authorization: `Bearer ${api.token}`, "Content-Type": clip.type || "audio/webm" },
      body: clip,
    });
    const reply = await readApiPayload<unknown>(response, "I couldn't write that out just now. Try again in a moment.");
    return z.object({ text: z.string() }).parse(reply).text;
  },
  async editEntry(id: string, text: string) {
    await api.request(`/api/debo/entries/${encodeURIComponent(id)}`, { text }, "PUT");
  },
  async deleteEntry(id: string) {
    await api.request(`/api/debo/entries/${encodeURIComponent(id)}`, undefined, "DELETE");
  },
  async memories(): Promise<MemoryView[]> {
    return memoriesReply.parse(await api.request("/api/debo/memories")).memories;
  },
  async fixMemory(id: string, text: string) {
    await api.request(`/api/debo/memories/${encodeURIComponent(id)}`, { text }, "PUT");
  },
  async forgetMemory(id: string) {
    await api.request(`/api/debo/memories/${encodeURIComponent(id)}`, undefined, "DELETE");
  },
  async activity(): Promise<ActivityView[]> {
    return activityReply.parse(await api.request("/api/debo/activity")).activity;
  },
});
