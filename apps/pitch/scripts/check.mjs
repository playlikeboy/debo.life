// Opens every page at phone and desktop width and reports overflow and console errors.
// Run: node scripts/check.mjs http://localhost:3000 outDir
// Playwright is loaded from apps/web, which already depends on it.
import { createRequire } from "node:module";
const require = createRequire(process.env.PW_FROM ?? new URL("../../web/package.json", import.meta.url));
const { chromium } = require("playwright");
const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? ".";
const pages = ["/", "/use-cases", "/go-to-market", "/economics", "/market", "/investors", "/diligence", "/try"];
const browser = await chromium.launch();
let bad = 0;
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const path of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const name = (path === "/" ? "home" : path.slice(1)) + "-" + width;
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    if (over > 0) bad++;
    console.log(width, path, "overflow", over);
  }
  if (errors.length) {
    bad++;
    console.log("console errors", width, errors);
  }
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
