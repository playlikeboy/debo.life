// Phone: the draft is a small file in the app's own folder, so it survives the
// app being closed. It never leaves the device and is removed when the entry is saved.
import * as FileSystem from "expo-file-system/legacy";
import { saveDraft } from "./debo-data";

const file = () => (FileSystem.documentDirectory ? `${FileSystem.documentDirectory}journal-draft.txt` : undefined);

export async function readStoredDraft(): Promise<string> {
  const path = file();
  if (!path) return "";
  try {
    return await FileSystem.readAsStringAsync(path);
  } catch {
    return "";
  }
}

export async function writeStoredDraft(text: string): Promise<void> {
  saveDraft(text);
  const path = file();
  if (!path) return;
  try {
    if (text) await FileSystem.writeAsStringAsync(path, text);
    else await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // The in-memory copy still holds the draft while the app is open.
  }
}
