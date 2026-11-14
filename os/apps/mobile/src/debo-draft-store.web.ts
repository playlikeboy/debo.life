// Web: the draft lives in this browser's localStorage (see debo-data.ts).
import { loadDraft, saveDraft } from "./debo-data";

export async function readStoredDraft(): Promise<string> {
  return loadDraft();
}

export async function writeStoredDraft(text: string): Promise<void> {
  saveDraft(text);
}
