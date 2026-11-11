"use client";

import { useState, useTransition } from "react";
import { deleteChat } from "@/app/home/chat/actions";
import type { ChatListItem } from "@/lib/chat";

// UTC, like the source chips, so the server and the browser show the same day.
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

/** The person's past chats, most recent first. Each one opens with a link and can be deleted after a clear yes. */
export function ChatHistory({
  chats,
  activeId,
  onDeleted,
}: {
  chats: ChatListItem[];
  activeId: string;
  onDeleted: (id: string, message: string, ok: boolean) => void;
}) {
  return (
    <section aria-labelledby="past-chats-heading">
      <h2 id="past-chats-heading" className="text-[1.375rem]">
        Your chats
      </h2>
      {chats.length === 0 ? (
        <p className="mt-2 text-ink-soft">Your chats will show here, so you can come back to them.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} active={chat.id === activeId} onDeleted={onDeleted} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChatRow({
  chat,
  active,
  onDeleted,
}: {
  chat: ChatListItem;
  active: boolean;
  onDeleted: (id: string, message: string, ok: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteChat(chat.id);
      setConfirming(false);
      onDeleted(chat.id, result.message, result.ok);
    });
  }

  return (
    <li className={`rounded-[12px] bg-paper p-3 ${active ? "border-2 border-ink" : "border border-line"}`}>
      <a
        href={`/home/chat?c=${chat.id}`}
        aria-current={active ? "page" : undefined}
        className="block min-h-11 font-semibold no-underline hover:underline"
      >
        <span className="line-clamp-2 break-words">{chat.title}</span>
        <span className="block font-normal text-ink-soft">
          {active ? "Open now · " : ""}
          {dayFormat.format(new Date(chat.updatedAt))}
        </span>
      </a>
      {confirming ? (
        <div className="mt-2" role="group" aria-labelledby={`delete-${chat.id}`}>
          <p id={`delete-${chat.id}`}>Delete this chat for good? Your entries stay.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-quiet min-h-11 px-4 py-1" onClick={remove} disabled={pending}>
              {pending ? "Deleting…" : "Yes, delete it"}
            </button>
            <button
              type="button"
              className="btn btn-quiet min-h-11 px-4 py-1"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-1 min-h-11 font-semibold underline underline-offset-4"
          onClick={() => setConfirming(true)}
        >
          Delete this chat<span className="sr-only">: {chat.title}</span>
        </button>
      )}
    </li>
  );
}
