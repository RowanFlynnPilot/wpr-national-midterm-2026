// Render dist/share.html to dist/share.png (1200×630) for Open Graph and Twitter cards,
// and stamp the og:image URL in dist/index.html with the data timestamp so social
// crawlers fetch a fresh copy after each data run. Runs as the last step of `npm run build`.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveDist } from "./serve.mjs";

const { fetched } = JSON.parse(readFileSync("dist/data/results.json", "utf8"));
const server = serveDist();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${server.port}/share.html`, { waitUntil: "networkidle" });
await page.waitForSelector(".share");
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "dist/share.png" });
await browser.close();
server.close();
if (errors.length) throw new Error(`share.html: ${errors.join("; ")}`);

const index = "dist/index.html";
const html = readFileSync(index, "utf8");
const stamped = html.replaceAll("/share.png", `/share.png?v=${encodeURIComponent(fetched)}`);
if (stamped === html) throw new Error("dist/index.html has no og:image pointing at share.png");
writeFileSync(index, stamped);
console.log(`wrote dist/share.png (data fetched ${fetched})`);
