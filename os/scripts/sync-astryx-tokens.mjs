#!/usr/bin/env node
// Regenerates os/apps/mobile/src/astryx-tokens.ts from the installed Astryx
// packages (@astryxdesign/core and @astryxdesign/theme-neutral), so the app's
// design tokens never drift from Astryx.
//
//   node os/scripts/sync-astryx-tokens.mjs          write the file
//   node os/scripts/sync-astryx-tokens.mjs --check  exit 1 if the file is stale
//
// Sources:
//   - theme-neutral "built" theme: every neutral token (colors, type, radii...).
//   - core dist/astryx.css: defaults the theme does not override (spacing,
//     easing, font weights, border width, focus ring).
// Astryx is MIT licensed (Meta Platforms, Inc.). See THIRD_PARTY_NOTICES.md.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, "../apps/mobile");
const outFile = path.join(mobile, "src/astryx-tokens.ts");

const coreDir = path.join(mobile, "node_modules/@astryxdesign/core");
const neutralDir = path.join(mobile, "node_modules/@astryxdesign/theme-neutral");
const coreVersion = JSON.parse(readFileSync(path.join(coreDir, "package.json"), "utf8")).version;
const neutralVersion = JSON.parse(
  readFileSync(path.join(neutralDir, "package.json"), "utf8"),
).version;

const { neutralTheme } = await import(pathToFileURL(path.join(neutralDir, "dist/neutral.js")).href);
const theme = neutralTheme.tokens;

// Core defaults: first `--name: value;` in the prebuilt stylesheet.
const coreCss = readFileSync(path.join(coreDir, "dist/astryx.css"), "utf8");
function coreDefault(name) {
  const match = coreCss.match(new RegExp(`${name.replace(/[-]/g, "\\-")}\\s*:\\s*([^;}]+)[;}]`));
  if (!match) throw new Error(`Astryx core has no default for ${name}`);
  return match[1].trim();
}
const get = (name) => theme[name] ?? coreDefault(name);

// ---- value helpers ------------------------------------------------------
const PX_PER_REM = 16;
function px(value) {
  const v = String(value).trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return px(get(ref[1]));
  const rem = v.match(/^(-?[\d.]+)rem$/);
  if (rem) return Math.round(Number(rem[1]) * PX_PER_REM * 100) / 100;
  const pixels = v.match(/^(-?[\d.]+)px$/);
  if (pixels) return Number(pixels[1]);
  if (/^-?[\d.]+$/.test(v)) return Number(v);
  throw new Error(`Cannot read "${value}" as a length`);
}
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}
function resolve(value, mode, depth = 0) {
  if (depth > 10) throw new Error(`Token reference loop at ${value}`);
  const v = String(value).trim();
  const lightDark = v.match(/^light-dark\((.*)\)$/s);
  if (lightDark) {
    const [light, dark] = splitTopLevel(lightDark[1]);
    return resolve(mode === "light" ? light : dark, mode, depth + 1);
  }
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return resolve(get(ref[1]), mode, depth + 1);
  return v;
}
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const hex = (v) => {
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) throw new Error(`"${v}" is not a hex colour`);
  return v.toUpperCase();
};

// ---- colours ------------------------------------------------------------
const colorNames = Object.keys(theme).filter(
  (k) => k.startsWith("--color-") && !k.startsWith("--color-syntax-"),
);
function colorsFor(mode) {
  const out = {};
  for (const name of colorNames) out[camel(name.slice("--color-".length))] = hex(resolve(theme[name], mode));
  return out;
}

// ---- scales -------------------------------------------------------------
const spacingNames = [
  "0", "0-5", "1", "1-5", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
];
const spacing = {};
for (const n of spacingNames) spacing[n.replace("-", ".")] = px(get(`--spacing-${n}`));

const sizeSteps = ["4xs", "3xs", "2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
const fontSize = {};
for (const step of sizeSteps) fontSize[step] = px(get(`--font-size-${step}`));
fontSize.supporting = px(get("--text-supporting-size"));

const weights = {};
for (const w of ["normal", "medium", "semibold", "bold"]) weights[w] = String(get(`--font-weight-${w}`));

const radius = {};
for (const r of ["none", "inner", "element", "container", "page", "chat", "full"]) {
  radius[r] = px(get(`--radius-${r}`));
}

const sizeElement = {};
for (const s of ["sm", "md", "lg"]) sizeElement[s] = px(get(`--size-element-${s}`));

// Type styles: size px, weight, line height px (size x leading, rounded).
const textRoles = [
  "heading-1", "heading-2", "heading-3", "heading-4", "heading-5", "heading-6",
  "body", "large", "label", "code", "supporting", "display-1", "display-2", "display-3",
];
const text = {};
for (const role of textRoles) {
  const size = px(resolve(get(`--text-${role}-size`), "light"));
  const leading = Number(get(`--text-${role}-leading`));
  text[camel(role)] = {
    fontSize: size,
    fontWeight: resolve(get(`--text-${role}-weight`), "light"),
    lineHeight: Math.round(size * leading),
  };
}

const shadows = {};
for (const sh of ["low", "med", "high"]) shadows[sh] = resolve(get(`--shadow-${sh}`), "light");

const duration = {};
for (const d of ["fast", "medium", "slow", "exit"]) duration[d] = Number.parseFloat(resolve(get(`--duration-${d}`), "light"));

const easing = {};
for (const e of ["standard", "entrance", "move", "exit"]) {
  const m = get(`--ease-${e}`).match(/cubic-bezier\(([^)]+)\)/);
  easing[e] = m[1].split(",").map((n) => Number(n.trim()));
}

const fonts = {
  body: get("--font-family-body"),
  heading: get("--font-family-heading"),
  code: get("--font-family-code"),
};

const borderWidth = px(get("--border-width"));
const focus = {
  width: px(get("--focus-outline-width")),
  offset: px(get("--focus-outline-offset")),
};

// ---- emit ---------------------------------------------------------------
const json = (v) => JSON.stringify(v, null, 2);
const source = `/**
 * Astryx design tokens for the Debo app (Neutral theme).
 *
 * GENERATED by os/scripts/sync-astryx-tokens.mjs. Do not edit by hand.
 * Run: pnpm --dir apps/mobile sync:tokens   (from os/)
 *
 * Source: @astryxdesign/theme-neutral ${neutralVersion} and @astryxdesign/core ${coreVersion}
 * Astryx is MIT licensed, Copyright (c) Meta Platforms, Inc. and affiliates.
 * https://github.com/meta/astryx (see THIRD_PARTY_NOTICES.md at the repo root)
 *
 * Astryx's React components are DOM + StyleX and cannot run in React Native,
 * so the app uses these tokens only. Lengths are in px (rem x 16).
 */
export const ASTRYX_VERSION = ${json({ core: coreVersion, themeNeutral: neutralVersion })} as const;

/** Colours for the light theme. The app only ships light for now. */
export const colorsLight = ${json(colorsFor("light"))} as const;

/** Colours for the dark theme. Not used by the app yet; kept so the two never drift. */
export const colorsDark = ${json(colorsFor("dark"))} as const;

/** Spacing scale (padding, gap, margin). */
export const spacing = ${json(spacing)} as const;

/** Radius scale. \`full\` is a pill or circle. */
export const radius = ${json(radius)} as const;

/** Font sizes. \`supporting\` is the size for small supporting text. */
export const fontSize = ${json(fontSize)} as const;

export const fontWeight = ${json(weights)} as const;

/** Semantic type styles: size, weight and line height, all in px. */
export const textStyle = ${json(text)} as const;

/** Font stacks. On native, use the first family only (see fontFamily in ui.tsx). */
export const fontStack = ${json(fonts)} as const;

/** Control heights. */
export const sizeElement = ${json(sizeElement)} as const;

/** Elevation as CSS box-shadow strings (React Native 0.81 reads these as boxShadow). */
export const shadow = ${json(shadows)} as const;

/** Motion durations in milliseconds. */
export const duration = ${json(duration)} as const;

/** Easing curves as cubic-bezier control points. */
export const easing = ${json(easing)} as const;

export const borderWidth = ${borderWidth};

export const focusRing = ${json(focus)} as const;

export type ColorToken = keyof typeof colorsLight;
`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(outFile, "utf8");
  } catch {}
  if (current !== source) {
    console.error("astryx-tokens.ts is out of date. Run: pnpm --dir apps/mobile sync:tokens");
    process.exit(1);
  }
  console.log("astryx-tokens.ts is up to date.");
} else {
  writeFileSync(outFile, source);
  console.log(`Wrote ${path.relative(process.cwd(), outFile)} from Astryx core ${coreVersion}, neutral ${neutralVersion}`);
}
