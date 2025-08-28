// app/web/ui/server.js
// Tiny local viewer: serves UI from app/web/ui/public and CSVs from config.exports.dir.
// Now with a generic static route for ANY file under /public, plus explicit CSV routes.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";

function send(res, code, headers, body) {
  res.writeHead(code, headers);
  res.end(body);
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    send(res, 200, { "content-type": contentType }, data);
  } catch (e) {
    if (e.code === "ENOENT") {
      send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
    } else {
      send(res, 500, { "content-type": "text/plain; charset=utf-8" }, "Server error");
    }
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js")   return "text/javascript; charset=utf-8";
  if (ext === ".css")  return "text/css; charset=utf-8";
  if (ext === ".csv")  return "text/csv; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg")  return "image/svg+xml";
  if (ext === ".png")  return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function serveCsv(res, filePath) {
  try {
    const data = fs.readFileSync(filePath);
    send(res, 200, { "content-type": "text/csv; charset=utf-8" }, data);
  } catch (e) {
    if (e.code === "ENOENT") {
      // Return empty CSV for graceful UX
      send(res, 200, { "content-type": "text/csv; charset=utf-8" }, "");
    } else {
      send(res, 500, { "content-type": "text/plain; charset=utf-8" }, "Server error");
    }
  }
}

function safeJoin(baseDir, reqPath) {
  const cleaned = reqPath.replace(/^\/+/, ""); // drop leading slashes
  const p = path.normalize(path.join(baseDir, cleaned));
  if (!p.startsWith(baseDir)) return null;     // prevent path escape
  return p;
}

function start() {
  const { config } = loadConfig();
  const { ok, errors } = validateConfig(config);
  if (!ok) {
    console.error("Invalid config:", errors);
    process.exit(1);
  }

  const uiPort = (() => {
    try {
      const u = new URL(config.viewer.local_base_url);
      return Number(u.port || 8081);
    } catch {
      return 8081;
    }
  })();

  const staticDir = path.join(path.dirname(new URL(import.meta.url).pathname), "public");
  const dataDir = config.exports.dir;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;

    // CSV routes (explicit)
    if (req.method === "GET" && p === "/auto.csv") {
      return serveCsv(res, path.join(dataDir, "auto_log.csv"));
    }
    if (req.method === "GET" && p === "/manual.csv") {
      return serveCsv(res, path.join(dataDir, "manual_log.csv"));
    }
    if (req.method === "GET" && p === "/data/merged_log.csv") {
      return serveCsv(res, path.join(dataDir, "merged_log.csv"));
    }
    if (req.method === "GET" && p === "/data/merged_log_with_type.csv") {
      return serveCsv(res, path.join(dataDir, "merged_log_with_type.csv"));
    }

    // Root → index.html
    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      return serveFile(res, path.join(staticDir, "index.html"), "text/html; charset=utf-8");
    }

    // Generic static: serve ANY file under app/web/ui/public
    if (req.method === "GET") {
      const candidate = safeJoin(staticDir, p);
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return serveFile(res, candidate, contentTypeFor(candidate));
      }
    }

    return send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
  });

  server.on("listening", () => {
    console.log(`[viewer] http://localhost:${uiPort}/  (serving /public and CSVs from ${dataDir})`);
    console.log(`[viewer] auto refresh interval (sec): ${config.viewer.auto_refresh_sec}`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(`[viewer] Port ${uiPort} already in use. Stop the other process and retry.`);
      process.exit(1);
    }
    console.error("[viewer] Server error:", err);
    process.exit(1);
  });

  server.listen(uiPort);
}

start();
