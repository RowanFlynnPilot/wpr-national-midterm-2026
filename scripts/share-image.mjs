// Render the share images for Open Graph and Twitter cards, as the last step of `npm run build`:
//   dist/share.png             the balance of power (dist/share.html), 1200×630; its URL in dist/index.html gets ?v=<fetched>
//                              so social crawlers fetch a fresh copy after each data run
//   dist/share/<hash>.jpg      one card per race (dist/share.html#<hash>), JPEG so 639 of them stay around 30 MB a deploy
//   dist/s/<hash>.html         a stub page per race carrying that card in its meta tags; it sends a reader on to the app at
//                              the race's hash, or to the article named by ?to= when that is the publisher's own domain
// The page lists the hashes and the publisher pattern in #card-index and each card's words in #card-meta, so the status
// wording and the route grammar live in one place (the TypeScript) and this script only copies.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveDist } from "./serve.mjs";

const { fetched } = JSON.parse(readFileSync("dist/data/results.json", "utf8"));
const index = readFileSync("dist/index.html", "utf8");
const pagesUrl = /<meta property="og:url" content="([^"]+)"/.exec(index)?.[1];
if (!pagesUrl) throw new Error("dist/index.html has no og:url");

const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const server = serveDist();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const settled = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r)))));

await page.goto(`http://localhost:${server.port}/share.html`, { waitUntil: "networkidle" });
await page.waitForSelector(".share");
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "dist/share.png" });
const { hashes, publisher } = JSON.parse(await page.locator("#card-index").textContent());

mkdirSync("dist/share", { recursive: true });
mkdirSync("dist/s", { recursive: true });
const started = Date.now();
for (const hash of hashes) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await page.waitForSelector(`.share-race[data-hash="${hash}"]`);
  await settled();
  await page.screenshot({ path: `dist/share/${hash}.jpg`, type: "jpeg", quality: 86 });
  const meta = JSON.parse(await page.locator("#card-meta").textContent());
  writeFileSync(`dist/s/${hash}.html`, stub(meta, publisher));
  if (errors.length) break;
}
await browser.close();
server.close();
if (errors.length) throw new Error(`share.html: ${errors.join("; ")}`);

const stamped = index.replaceAll("/share.png", `/share.png?v=${encodeURIComponent(fetched)}`);
if (stamped === index) throw new Error("dist/index.html has no og:image pointing at share.png");
writeFileSync("dist/index.html", stamped);
console.log(`wrote dist/share.png and ${hashes.length} race cards with stub pages in ${Math.round((Date.now() - started) / 1000)} s (data fetched ${fetched})`);

/** The stub page: the card's meta tags for crawlers, and for a reader the way on to the race. */
function stub({ hash, title, description, alt }, publisherPattern) {
  const image = `${pagesUrl}share/${hash}.jpg?v=${encodeURIComponent(fetched)}`;
  const app = `${pagesUrl}#${hash}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${text(title)} — Wausau Pilot &amp; Review</title>
<meta name="description" content="${attr(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wausau Pilot &amp; Review">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:image" content="${attr(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${attr(image)}">
<link rel="icon" type="image/png" href="../favicon.png">
<noscript><meta http-equiv="refresh" content="0; url=${attr(app)}"></noscript>
<script>
(function () {
  var to = new URLSearchParams(location.search).get('to');
  var url = ${JSON.stringify(app)};
  if (to) {
    try {
      var u = new URL(to);
      if (u.protocol === 'https:' && new RegExp(${JSON.stringify(publisherPattern)}).test(u.hostname)) { u.hash = ${JSON.stringify(hash)}; url = u.href; }
    } catch (e) {}
  }
  location.replace(url);
})();
</script>
</head>
<body><p><a href="${attr(app)}">${text(title)}</a></p></body>
</html>
`;
}
