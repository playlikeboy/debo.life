// The unsaved journal draft lives only in this browser (localStorage) until
// the person saves it. Storage can be blocked or full, so every call is
// wrapped, and failing quietly is fine: the writing box still works.

const PREFIX = "debo:journal-draft:";

export function readDraft(userId: string): string {
  try {
    return window.localStorage.getItem(PREFIX + userId) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(userId: string, text: string) {
  try {
    if (text.trim()) window.localStorage.setItem(PREFIX + userId, text);
    else window.localStorage.removeItem(PREFIX + userId);
  } catch {
    // Storage is blocked or full. The draft just isn't kept.
  }
}

/** Remove every journal draft in this browser, for sign out and account delete. */
export function clearAllDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear, or storage is blocked.
  }
}
