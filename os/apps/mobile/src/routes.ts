import type { Section } from "../../../packages/domain/src";

/**
 * Every screen has its own plain address on the web: /chat, /journal, /ideas.
 * This file is pure (no React, no browser) so it can be tested and shared with
 * native deep links such as debo://journal/<entry>.
 */
export type RouteParams = { threadId?: string; entryId?: string };
export type Route = RouteParams & { section: Section };

/** Screens that have an address. "today" and "connections" are old names and are not listed. */
const PATHS: Partial<Record<Section, string>> = {
  chat: "chat",
  talk: "talk",
  journal: "journal",
  knows: "knows",
  activity: "tasks",
  apps: "apps",
  ideas: "ideas",
  goals: "goals",
  mail: "mail",
  calendar: "calendar",
  files: "files",
  browser: "browser",
};
const SECTIONS = new Map<string, Section>(
  Object.entries(PATHS).map(([section, path]) => [path as string, section as Section]),
);
const ID = /^[A-Za-z0-9_-]{1,100}$/;

/** What the page title says for each screen, as in "Journal · Debo". */
const NAMES: Partial<Record<Section, string>> = {
  chat: "Chat",
  talk: "Talk",
  journal: "Journal",
  knows: "What Debo knows",
  activity: "Tasks",
  apps: "Apps",
  ideas: "Ideas",
  goals: "Goals",
  mail: "Mail",
  calendar: "Calendar",
  files: "Files",
  browser: "Browser",
};

/** Old section names that now mean another screen. */
export function canonicalSection(section: Section): Section {
  return section === "today" ? "chat" : section === "connections" ? "apps" : section;
}

export function pathFor(section: Section, params: RouteParams = {}): string {
  const name = PATHS[canonicalSection(section)] ?? "chat";
  const id = name === "chat" ? params.threadId : name === "journal" ? params.entryId : undefined;
  return id && ID.test(id) ? `/${name}/${id}` : `/${name}`;
}

function cleanPath(path: string): string[] {
  const bare = path.split(/[?#]/)[0] ?? "";
  return bare
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

/** Turns an address into a route, or null when no screen lives there. "/" means Chat. */
export function parsePath(path: string): Route | null {
  const parts = cleanPath(path);
  if (parts.length === 0) return { section: "chat" };
  const section = SECTIONS.get((parts[0] ?? "").toLowerCase());
  if (!section || parts.length > 2) return null;
  const id = parts[1];
  if (id === undefined) return { section };
  if (!ID.test(id)) return null;
  if (section === "chat") return { section, threadId: id };
  if (section === "journal") return { section, entryId: id };
  return null;
}

/** Reads a native deep link such as debo://journal/abc or https://my.debo.life/talk. */
export function pathFromUrl(url: string): string {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i.exec(url);
  if (!match) return url;
  const scheme = (match[1] ?? "").toLowerCase();
  const host = match[2] ?? "";
  const rest = match[3] ?? "";
  return scheme === "debo" ? `/${host}${rest}`.replace(/^\/\/+/, "/") : rest || "/";
}

export function titleFor(route: Route | null): string {
  if (!route) return "That page isn't here · Debo";
  return `${NAMES[canonicalSection(route.section)] ?? "Debo"} · Debo`;
}
