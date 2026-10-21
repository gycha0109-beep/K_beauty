#!/usr/bin/env node
// Isolated loopback-only runner for public/skin-scan-lab.
// No write requests, external API proxy, photo storage, or production changes.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../public/skin-scan-lab");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]]
]);
const port = 3178;
const host = "127.0.0.1";
const csp = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com",
  "worker-src 'self' blob:",
  "font-src 'self'"
].join("; ") + ";";

createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Allow": "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try {
    pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  } catch {
    response.writeHead(400).end();
    return;
  }
  const selected = assets.get(pathname);
  if (!selected) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  try {
    const bytes = await readFile(resolve(directory, selected[0]));
    response.writeHead(200, {
      "Content-Type": selected[1],
      "Cache-Control": "no-store",
      "Content-Security-Policy": csp,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer"
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Could not read experiment files");
  }
}).listen(port, host, () => {
  process.stdout.write("Skin Scan Lab: http://" + host + ":" + port + "\n");
  process.stdout.write("Models and MediaPipe SDK load from Google/jsDelivr; face photos stay in the browser application code.\n");
});
