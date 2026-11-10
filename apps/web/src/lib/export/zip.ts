import { strToU8, zipSync, type Zippable } from "fflate";

/** One file in the export, by its path inside the zip. */
export type ExportFile = { path: string; content: string | Uint8Array };

/**
 * One part of the export: its files, and a line for the README that says
 * what they are. Entries and the activity record are sections today; files
 * and memories become one more section each when they exist.
 */
export type ExportSection = { readme: string; files: ExportFile[] };

/**
 * Build the zip. Files are stored, not compressed: text is small, and
 * compressing costs CPU that a Worker request does not have to spare.
 */
export function buildExportZip(sections: ExportSection[], exportedAt: Date): Uint8Array {
  const zippable: Zippable = { "README.md": strToU8(readme(sections, exportedAt)) };
  for (const section of sections) {
    for (const file of section.files) {
      zippable[file.path] = typeof file.content === "string" ? strToU8(file.content) : file.content;
    }
  }
  return zipSync(zippable, { level: 0, mtime: exportedAt });
}

function readme(sections: ExportSection[], exportedAt: Date): string {
  return [
    "# Your Debo export",
    "",
    `This is a copy of everything you saved in Debo, made on ${exportedAt.toISOString().slice(0, 10)} (UTC).`,
    "It is yours to keep. Every file opens without Debo, in any text editor or spreadsheet.",
    "",
    "## What is inside",
    "",
    ...sections.map((section) => `- ${section.readme}`),
    "- `README.md`: this note.",
    "",
    "Times are in UTC. Ids are the names Debo uses inside for each entry and record, so you can match them up.",
    "",
  ].join("\n");
}
