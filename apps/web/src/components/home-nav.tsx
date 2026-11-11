"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const links = [
  { href: "/home", label: "Home" },
  { href: "/home/journal", label: "Journal" },
  { href: "/home/chat", label: "Chat" },
  { href: "/home/memories", label: "What Debo knows" },
  { href: "/home/activity", label: "What Debo did" },
];

/** The header on every /home page, as wide as the page under it (the chat page is wider, for its list of chats). */
export function HomeHeader() {
  const wide = usePathname() === "/home/chat";
  return (
    <header className={`wrap pt-6 ${wide ? "max-w-[72rem]" : "max-w-[48rem]"}`}>
      <HomeNav />
    </header>
  );
}

/**
 * The same links on every /home page. The current page is filled in and marked for screen readers.
 * On a phone the links sit in one row that scrolls sideways, so they never take three rows of the screen.
 */
function HomeNav() {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the current page's link in view when the row is scrolled.
  useEffect(() => {
    const current = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav aria-label="Your Debo" className="-mx-5 sm:mx-0">
      <ul
        ref={listRef}
        className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {links.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href} className="shrink-0">
              <a
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 border-ink px-3 font-semibold sm:px-4 no-underline ${
                  current ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-sky"
                }`}
              >
                {link.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
