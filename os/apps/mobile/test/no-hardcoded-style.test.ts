import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

const files = [
  ...sourceFiles(path.join(root, "src")),
  path.join(root, "App.tsx"),
  path.join(root, "index.js"),
].filter((file) => path.basename(file) !== "astryx-tokens.ts");

// Short, explicit allowlist. Key is "relative/path:matched text"; value is the reason.
// Keep it empty if you can. Colours belong in astryx-tokens.ts (generated from Astryx).
const allowlist: Record<string, string> = {};

function violations(pattern: RegExp) {
  const found: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        for (const match of line.matchAll(pattern)) {
          if (allowlist[`${rel}:${match[0]}`]) continue;
          found.push(`${rel}:${index + 1}: ${match[0]}`);
        }
      });
  }
  return found;
}

test("no hex colour literals outside astryx-tokens.ts", () => {
  const found = violations(/#[0-9A-Fa-f]{3,8}\b/g);
  assert.deepEqual(found, [], `Use a colour from palette.ts instead:\n${found.join("\n")}`);
});

test("no rgb() or rgba() colour literals outside astryx-tokens.ts", () => {
  assert.deepEqual(violations(/\brgba?\(/g), []);
});

test("no number literals for fontSize or borderRadius", () => {
  const found = violations(/\b(?:fontSize|borderRadius): *\d/g);
  assert.deepEqual(found, [], `Use fontSize.* or radius.* from ui.tsx:\n${found.join("\n")}`);
});

test("the allowlist stays short", () => {
  assert.ok(Object.keys(allowlist).length <= 5);
});
