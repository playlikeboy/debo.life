// Calls to the server's /api/debo routes. Errors keep the server's plain words.
import type { FuseApi } from "./api";
import {
  type ActivityView,
  activityReply,
  type DeboStatus,
  deboStatus,
  type EntryView,
  entriesReply,
  type MemoryView,
  memoriesReply,
} from "./debo-data";

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
  async addEntry(text: string) {
    await api.request("/api/debo/entries", { text });
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
