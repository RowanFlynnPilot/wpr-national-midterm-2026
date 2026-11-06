// Serve dist/ the way GitHub Pages does (gzip for text), for the Playwright and Lighthouse runs.
//   import { serveDist } from "./serve.mjs"   -> { port, close } on an ephemeral port
//   node scripts/serve.mjs 4173              -> keeps serving on that port
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = resolve("dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const GZIP = new Set([".html", ".js", ".css", ".json", ".svg"]);

export function serveDist(port = 0) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let file = join(DIST, decodeURIComponent(url.pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    const ext = extname(file);
    const headers = { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "max-age=600" };
    let body = readFileSync(file);
    if (GZIP.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      body = gzipSync(body);
      headers["content-encoding"] = "gzip";
    }
    res.writeHead(200, headers);
    res.end(body);
  }).listen(port);
  return { port: server.address().port, close: () => server.close() };
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replaceAll("/", "\\")) {
  const { port } = serveDist(Number(process.argv[2] ?? 4173));
  console.log(`serving dist/ at http://localhost:${port}/`);
}
