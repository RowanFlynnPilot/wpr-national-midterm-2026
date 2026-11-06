// Screenshot every view of the built site at phone, tablet, laptop and desktop widths.
// Usage: node scripts/screenshots.mjs <outDir> [view ...]     (run `npm run build` first)
// Also prints any console error or failed request, so it doubles as the zero-console-errors gate.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { serveDist } from "./serve.mjs";

const WIDTHS = [390, 768, 1280, 1600];

const VIEWS = {
  senate: { hash: "#senate" },
  "senate-counties": { hash: "#senate", click: 'button[role="radio"]:has-text("Counties")' },
  "senate-tx": { hash: "#senate-tx" },
  "senate-me": { hash: "#senate-me" },
  house: { hash: "#house" },
  "house-wi": { hash: "#house-wi" },
  "house-wi-03": { hash: "#house-wi-03" },
  governors: { hash: "#governors" },
  "governors-ks": { hash: "#governors-ks" },
  "governors-counties": { hash: "#governors", click: 'button[role="radio"]:has-text("Counties")' },
  "senate-hover": { hash: "#senate", hover: 'path.state.has-race[aria-label^="Texas"]', clip: "map" },
  "house-hover": { hash: "#house", hover: "polygon.hex >> nth=100", clip: "map" },
};

const [outDir = "screens", ...only] = process.argv.slice(2);
const names = only.length ? only : Object.keys(VIEWS);
mkdirSync(outDir, { recursive: true });

const server = serveDist();
const browser = await chromium.launch();
const problems = [];
for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  for (const name of names) {
    const view = VIEWS[name];
    if (!view) throw new Error(`unknown view ${name}`);
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && problems.push(`${name}@${width}: console.error ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`${name}@${width}: pageerror ${e.message}`));
    page.on("requestfailed", (r) => problems.push(`${name}@${width}: request failed ${r.url()}`));
    await page.goto(`http://localhost:${server.port}/${view.hash}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".board");
    await page.evaluate(() => document.fonts.ready);
    if (view.click) await page.click(view.click);
    if (view.hover) {
      await page.locator(view.hover).first().hover();
      await page.waitForSelector(".tooltip");
    }
    await page.waitForTimeout(250);
    const path = join(outDir, `${name}-${width}.png`);
    if (view.clip === "map") await page.locator(".map-frame").screenshot({ path });
    else await page.screenshot({ path, fullPage: true });
    await page.close();
    console.log(path);
  }
  await context.close();
}
await browser.close();
server.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("\nno console errors, page errors or failed requests");
