import assert from "node:assert/strict";
import test from "node:test";
import { colorsLight } from "../src/astryx-tokens.ts";
import { colors } from "../src/palette.ts";

// WCAG 2.2 contrast ratio: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function channel(value: number) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  assert.match(hex, /^#[0-9A-Fa-f]{6}$/, `${hex} must be an opaque 6-digit colour`);
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = [foreground: keyof typeof colors, background: keyof typeof colors];

// Text on its background: WCAG 1.4.3 needs 4.5:1 (AA, normal text).
// Every text colour the app sets, on every surface it is drawn on.
const textPairs: Pair[] = [
  ["text", "canvas"],
  ["text", "card"],
  ["text", "subtle"],
  ["text", "blue"],
  ["text", "green"],
  ["text", "lavender"],
  ["text", "orange"],
  ["text", "yellow"],
  ["text", "pink"],
  ["text", "dangerBg"],
  ["muted", "canvas"],
  ["muted", "card"],
  ["muted", "subtle"],
  ["muted", "blue"],
  ["muted", "green"],
  ["muted", "lavender"],
  ["muted", "orange"],
  ["blueDark", "canvas"],
  ["blueDark", "card"],
  ["blueDark", "subtle"],
  ["blueText", "blue"],
  ["blueText", "card"],
  ["success", "canvas"],
  ["success", "card"],
  ["success", "subtle"],
  ["success", "green"],
  ["danger", "canvas"],
  ["danger", "card"],
  ["danger", "subtle"],
  ["danger", "dangerBg"],
  ["onAccent", "accent"],
  ["onInk", "ink"],
  ["blue", "ink"],
];

// Icons and component edges: WCAG 1.4.11 needs 3:1.
const nonTextPairs: Pair[] = [
  ["muted", "canvas"],
  ["muted", "card"],
  ["muted", "subtle"],
  ["blueDark", "card"],
  ["blueDark", "canvas"],
  ["success", "subtle"],
  ["danger", "dangerBg"],
  ["onAccent", "accent"],
  ["accent", "card"],
  ["accent", "canvas"],
  ["inputBorder", "card"],
  ["inputBorder", "canvas"],
];

for (const [fg, bg] of textPairs) {
  test(`text ${fg} on ${bg} passes WCAG 2.2 AA (4.5:1)`, () => {
    const ratio = contrast(colors[fg], colors[bg]);
    assert.ok(ratio >= 4.5, `${fg} ${colors[fg]} on ${bg} ${colors[bg]} is ${ratio.toFixed(2)}:1`);
  });
}

for (const [fg, bg] of nonTextPairs) {
  test(`${fg} on ${bg} passes WCAG 2.2 non-text contrast (3:1)`, () => {
    const ratio = contrast(colors[fg], colors[bg]);
    assert.ok(ratio >= 3, `${fg} ${colors[fg]} on ${bg} ${colors[bg]} is ${ratio.toFixed(2)}:1`);
  });
}

test("the app palette only uses Astryx Neutral light values", () => {
  const allowed = new Set(Object.values(colorsLight).map((v) => v.toUpperCase()));
  for (const [name, value] of Object.entries(colors)) {
    assert.ok(allowed.has(value.toUpperCase()), `${name} ${value} is not an Astryx token`);
  }
});

test("contrast helper matches known WCAG values", () => {
  assert.equal(contrast("#000000", "#FFFFFF").toFixed(1), "21.0");
  assert.equal(contrast("#777777", "#FFFFFF").toFixed(2), "4.48");
});
