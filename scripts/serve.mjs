// Serve dist/ on an ephemeral port for the Playwright scripts. Returns { port, close }.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const DIST = resolve("dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

export function serveDist() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let file = join(DIST, decodeURIComponent(url.pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  }).listen(0);
  return { port: server.address().port, close: () => server.close() };
}
