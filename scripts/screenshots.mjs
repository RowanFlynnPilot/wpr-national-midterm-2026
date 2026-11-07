// Screenshot every view of the built site at phone, tablet, laptop and desktop widths.
// Usage: node scripts/screenshots.mjs <outDir> [view ...]     (run `npm run build` first)
// Also prints any console error or failed request, so it doubles as the zero-console-errors gate.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { serveDist } from "./serve.mjs";

const WIDTHS = [390, 768, 1280, 1600];
// compact.html is its own page; screenshot it at a sidebar, a module and a full-width band
const COMPACT_WIDTHS = [300, 600, 1100];

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
  measures: { hash: "#measures" },
  "measures-wi": { hash: "#measures-wi" },
  "measure-card": { hash: "#measures-wi-179849" },
  "measures-hover": { hash: "#measures", hover: 'path.state.has-race[aria-label^="California"]', clip: "map" },
  "senate-demo": { hash: "?demo#senate" },
  "senate-spotlight": { hash: "#senate", click: '.legend__item:has-text("Seat flipped")', clip: "map" },
  "senate-spotlight-legend": { hash: "#senate", click: '.legend__item:has-text("Democrat leads")', clip: "legend" },
  "senate-replay": { hash: "#senate", click: ".replay-start", fill: [".replay__scrub", "120"], clip: "legend" },
  "house-replay": { hash: "#house", click: ".replay-start", fill: [".replay__scrub", "60"], clip: "legend" },
  "house-margins": { hash: "#house", clip: "panel" },
  "senate-patterns": { hash: "#senate", clip: "panel" },
  "senate-shift": { hash: "#senate", click: 'button[role="radio"]:has-text("Shift since 2024")', clip: "map" },
  "governors-shift-wi": { hash: "#governors-wi", click: 'button[role="radio"]:has-text("Shift since 2024")', beforeHover: 700, hover: "g.counties path:not(.is-out) >> nth=40", clip: "map" },
  "governors-wi": { hash: "#governors-wi", clip: "panel" },
  "senate-since": { hash: "#senate", visitHoursAgo: 5, clip: "since" },
  "senate-table": { hash: "#senate", click: ".races tbody tr:nth-child(2) .expander", clip: "table" },
  "senate-remaining": { hash: "#senate", click: 'button[role="radio"]:has-text("Still counting")' },
  "senate-counties-tx": { hash: "#senate-tx", click: 'button[role="radio"]:has-text("Counties")', settle: 900, clip: "map" },
  "senate-arc-hover": { hash: "#senate", hover: ".seat-arc__seat.is-race >> nth=6", clip: "chambers" },
  "house-arc-hover": { hash: "#house", hover: ".seat-arc__seat.is-race >> nth=300", clip: "chambers" },
  "house-keyboard": { hash: "#house", focus: 'polygon.hex[tabindex="0"]', keys: ["ArrowRight", "ArrowRight", "ArrowDown"], clip: "map" },
};

// A tooltip that moves on before its headshot lands aborts the image request; that is not a broken file.
const aborted = (r) => r.failure()?.errorText === "net::ERR_ABORTED";

// clip: screenshot one region instead of the page. It is scrolled into view before any hover, because an element
// screenshot scrolls to its target, and a pointer left behind by that scroll would leave the hovered element.
const CLIPS = { map: ".map-frame", table: ".table-section", legend: ".board__map", panel: ".board__panel", since: ".since", chambers: ".chambers-frame" };

const [outDir = "screens", ...only] = process.argv.slice(2);
const names = only.length ? only.filter((n) => n !== "compact") : Object.keys(VIEWS);
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
    page.on("requestfailed", (r) => aborted(r) || problems.push(`${name}@${width}: request failed ${r.url()}`));
    if (view.visitHoursAgo) {
      // a browser that last saw the page before any call: the strip lists every call since
      await page.addInitScript((hours) => {
        localStorage.setItem("wpr-midterm-2026-last-visit", JSON.stringify({ at: new Date(Date.now() - hours * 3600e3).toISOString(), called: [] }));
      }, view.visitHoursAgo);
    }
    await page.goto(`http://localhost:${server.port}/${view.hash}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".board");
    await page.evaluate(() => document.fonts.ready);
    if (view.click) {
      await page.click(view.click);
      await page.waitForFunction(() => !document.querySelector(".map-pending"), null, { timeout: 15000 });
    }
    await page.waitForFunction(() => !document.querySelector(".map-pending"), null, { timeout: 15000 });
    if (view.clip) await page.locator(CLIPS[view.clip]).scrollIntoViewIfNeeded();
    if (view.hover) {
      if (view.beforeHover) await page.waitForTimeout(view.beforeHover); // a zoom still moving would slide out from under the pointer
      await page.locator(view.hover).first().hover();
      await page.waitForSelector(".tooltip");
    }
    if (view.fill) await page.locator(view.fill[0]).fill(view.fill[1]);
    if (view.focus) {
      await page.locator(view.focus).first().focus();
      for (const key of view.keys ?? []) await page.keyboard.press(key);
      await page.waitForSelector(".tooltip");
    }
    await page.waitForTimeout(view.settle ?? 1200); // the seat arcs stagger in over about a second
    const path = join(outDir, `${name}-${width}.png`);
    if (view.clip) await page.locator(CLIPS[view.clip]).screenshot({ path });
    else await page.screenshot({ path, fullPage: true });
    await page.close();
    console.log(path);
  }
  await context.close();
}
if (!only.length || only.includes("compact")) {
  for (const width of COMPACT_WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    page.on("console", (m) => m.type() === "error" && problems.push(`compact@${width}: console.error ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`compact@${width}: pageerror ${e.message}`));
    page.on("requestfailed", (r) => aborted(r) || problems.push(`compact@${width}: request failed ${r.url()}`));
    await page.goto(`http://localhost:${server.port}/compact.html`, { waitUntil: "networkidle" });
    await page.waitForSelector(".compact__cards");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const path = join(outDir, `compact-${width}.png`);
    await page.screenshot({ path, fullPage: true });
    await page.close();
    console.log(path);
  }
}
await browser.close();
server.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("\nno console errors, page errors or failed requests");
