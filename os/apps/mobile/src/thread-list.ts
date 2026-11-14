import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "./workspace";

export interface SavedThread {
  id: string;
  name: string | null;
  archived: boolean;
  updatedAt: string;
}
interface Page {
  threads: SavedThread[];
  nextCursor: string | null;
}

/** The conversation list, read from Debo's own server (`/api/threads`). Nothing leaves Debo. */
export function useSavedThreads(enabled: boolean, limit = 20) {
  const { api } = useWorkspace();
  const [threads, setThreads] = useState<SavedThread[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error>();
  const [fetchMoreError, setFetchMoreError] = useState<Error>();
  const [isFetchingMoreThreads, setFetchingMore] = useState(false);
  const [isMutating, setMutating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const query = `/api/threads?includeArchived=true&limit=${limit}`;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(undefined);
    void api
      .request<Page>(query)
      .then((page) => {
        if (!active) return;
        setThreads(page.threads);
        setCursor(page.nextCursor);
      })
      .catch((e) => active && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // `attempt` re-runs the load when the person taps Retry.
  }, [api, enabled, query, attempt]);

  const fetchMoreThreads = useCallback(async () => {
    if (!cursor) return;
    setFetchingMore(true);
    setFetchMoreError(undefined);
    try {
      const page = await api.request<Page>(`${query}&cursor=${encodeURIComponent(cursor)}`);
      setThreads((items) => [
        ...items,
        ...page.threads.filter((t) => !items.some((i) => i.id === t.id)),
      ]);
      setCursor(page.nextCursor);
    } catch (e) {
      setFetchMoreError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFetchingMore(false);
    }
  }, [api, cursor, query]);

  async function change(path: string, body: unknown, method: string) {
    setMutating(true);
    try {
      const saved = await api.request<SavedThread>(path, body, method);
      setThreads((items) => items.map((t) => (t.id === saved.id ? saved : t)));
    } finally {
      setMutating(false);
    }
  }
  const base = (id: string) => `/api/threads/${encodeURIComponent(id)}`;
  return {
    threads,
    isLoading,
    error,
    refetchThreads: () => setAttempt((n) => n + 1),
    hasMoreThreads: cursor !== null,
    fetchMoreThreads,
    isFetchingMoreThreads,
    fetchMoreError,
    isMutating,
    renameThread: (id: string, name: string) => change(base(id), { name }, "PATCH"),
    archiveThread: (id: string) => change(`${base(id)}/archive`, {}, "POST"),
    unarchiveThread: (id: string) => change(`${base(id)}/restore`, {}, "POST"),
  };
}
