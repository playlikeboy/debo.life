"use client";

import { useEffect, useState, type ComponentType } from "react";
import { ChatShell, type ChatProps } from "@/components/chat-shell";

type LoadedChat = ComponentType<ChatProps & { initialDraft?: string }>;

/** Once loaded, kept for moves between chats, so the shell does not flash again. Never set on the server. */
let cachedChat: LoadedChat | null = null;

/**
 * The chat page. The server and the first browser render draw ChatShell,
 * which is light. CopilotKit is large and draws nothing useful on the server,
 * so it loads only in the browser, then takes over. Anything typed in the
 * question box meanwhile is kept.
 */
export function ChatLoader(props: ChatProps) {
  const [loaded, setLoaded] = useState<{ Chat: LoadedChat; draft: string; focused: boolean } | null>(() =>
    cachedChat ? { Chat: cachedChat, draft: "", focused: false } : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cachedChat) return;
    let live = true;
    import("@/components/debo-chat").then(
      ({ DeboChat }) => {
        cachedChat = DeboChat;
        if (!live) return;
        const box = document.getElementById("chat-question");
        const draft = box instanceof HTMLTextAreaElement ? box.value : "";
        setLoaded({ Chat: DeboChat, draft, focused: box !== null && document.activeElement === box });
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded?.focused) return;
    const box = document.getElementById("chat-question");
    if (box instanceof HTMLTextAreaElement) {
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    }
  }, [loaded]);

  if (loaded) return <loaded.Chat {...props} initialDraft={loaded.draft} />;
  return (
    <>
      <ChatShell {...props} />
      {failed && (
        <p role="alert" className="mt-4 font-semibold">
          I couldn&rsquo;t load the chat just now. Check your internet connection, then reload the page.
        </p>
      )}
    </>
  );
}
