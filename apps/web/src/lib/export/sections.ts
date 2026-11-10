import type { ActivityItem, ExportEntry } from "@debo/db";
import type { ExportSection } from "./zip";

/** Each journal entry as a Markdown file, e.g. `entries/2026-11-10-riya-moved-to-pune.md`. */
export function entriesSection(entries: ExportEntry[]): ExportSection {
  const used = new Set<string>();
  const files = entries.map((entry) => {
    const base = `entries/${entry.happenedAt.toISOString().slice(0, 10)}-${slugify(entry.title)}`;
    let path = `${base}.md`;
    for (let n = 2; used.has(path); n++) path = `${base}-${n}.md`;
    used.add(path);
    return { path, content: entryMarkdown(entry) };
  });
  const count = entries.length === 1 ? "1 journal entry" : `${entries.length} journal entries`;
  return {
    readme: `\`entries/\`: your ${count}, one Markdown file each. The lines at the top hold the title, dates and id. Your words follow, exactly as you saved them.`,
    files,
  };
}

/** The activity record as a spreadsheet. Ids and times only, like the page. */
export function activitySection(items: ActivityItem[]): ExportSection {
  const rows = [
    ["id", "actor", "action", "source_ids", "created_at"],
    ...items.map((item) => [item.id, item.actor, item.action, item.sourceIds.join(" "), item.createdAt.toISOString()]),
  ];
  return {
    readme:
      "`activity.csv`: the record of what Debo saved, changed, deleted and answered for you, oldest first. It keeps ids and times, never your words. `source_ids` lists the entries each row touched, split by spaces.",
    files: [{ path: "activity.csv", content: `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n` }],
  };
}

function entryMarkdown(entry: ExportEntry): string {
  // A JSON string is valid YAML, so the title is safe whatever it holds.
  return [
    "---",
    `title: ${JSON.stringify(entry.title)}`,
    `date: ${entry.happenedAt.toISOString()}`,
    `saved: ${entry.createdAt.toISOString()}`,
    `changed: ${entry.updatedAt.toISOString()}`,
    `id: ${entry.id}`,
    "---",
    "",
    entry.text,
    "",
  ].join("\n");
}

/** A short, safe file name part: lowercase ASCII letters, digits and dashes. */
function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || "entry";
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
