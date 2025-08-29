// Static server for the viewer:
// - Serves / (and files) from app/web/ui/public
// - Also exposes /data/* from the project's ./data directory

import http from "http";
import { existsSync, readFileSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, normalize, extname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// paths
const publicDir = normalize(join(__dirname, "public"));
// project root is two levels up from app/web/ui/
const projectRoot = normalize(resolve(__dirname, "..", "..", ".."));
const dataDir = normalize(join(projectRoot, "data"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv":  "text/csv; charset=utf-8",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".svg":  "image/svg+xml",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt":  "text/plain; charset=utf-8",
};

function safeJoin(root, reqPath) {
  const cleaned = reqPath.replace(/^\/+/, "");
  const full = normalize(join(root, cleaned));
  if (!full.startsWith(root)) throw new Error("Path traversal");
  return full;
}

function serveFile(res, fsPath) {
  const type = MIME[extname(fsPath).toLowerCase()] || "application/octet-stream";
  const data = readFileSync(fsPath);
  res.writeHead(200, { "content-type": type });
  res.end(data);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = url.pathname;

    // Mount /data/* from project data directory
    if (pathname.startsWith("/data/")) {
      const fsPath = safeJoin(dataDir, pathname.replace(/^\/data\//, ""));
      if (existsSync(fsPath) && statSync(fsPath).isFile()) {
        return serveFile(res, fsPath);
      }
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("Not Found");
    }

    // Otherwise serve from /public
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const fsPath = safeJoin(publicDir, pathname);
    if (existsSync(fsPath) && statSync(fsPath).isFile()) {
      return serveFile(res, fsPath);
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
});

const PORT = 8081;
server.listen(PORT, () => {
  console.log(`[viewer] http://localhost:${PORT}/`);
  console.log(`[viewer] public = ${publicDir}`);
  console.log(`[viewer] data   = ${dataDir}`);
});
