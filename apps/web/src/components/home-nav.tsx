"use client";

import { usePathname } from "next/navigation";

const links = [
  { href: "/home", label: "Home" },
  { href: "/home/journal", label: "Journal" },
  { href: "/home/chat", label: "Chat" },
  { href: "/home/memories", label: "What Debo knows" },
  { href: "/home/activity", label: "What Debo did" },
];

/** The same links on every /home page. The current page is filled in and marked for screen readers. */
export function HomeNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Your Debo">
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => {
          const current = pathname === link.href;
          return (
            <li key={link.href}>
              <a
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border-2 border-ink px-4 font-semibold no-underline ${
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
