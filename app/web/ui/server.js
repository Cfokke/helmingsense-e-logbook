// app/web/ui/server.js
// Tiny local viewer: serves index.html + viewer modules, and proxies CSVs from config.exports.dir.
// No dependencies.

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
      // If a public asset is missing, serve 404 to surface the problem clearly.
      send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
    } else {
      send(res, 500, { "content-type": "text/plain; charset=utf-8" }, "Server error");
    }
  }
}

function serveCsv(res, filePath) {
  try {
    const data = fs.readFileSync(filePath);
    send(res, 200, { "content-type": "text/csv; charset=utf-8" }, data);
  } catch (e) {
    if (e.code === "ENOENT") {
      // For CSVs, keep the old behavior: empty body (valid CSV with no rows) rather than 404.
      send(res, 200, { "content-type": "text/csv; charset=utf-8" }, "");
    } else {
      send(res, 500, { "content-type": "text/plain; charset=utf-8" }, "Server error");
    }
  }
}

function csvPath(dir, base) {
  return path.join(dir, base);
}

function start() {
  const { config, error } = loadConfig();
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
    // Public assets
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      return serveFile(res, path.join(staticDir, "index.html"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/viewer.js") {
      return serveFile(res, path.join(staticDir, "viewer.js"), "text/javascript; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/staleness.js") {
      return serveFile(res, path.join(staticDir, "staleness.js"), "text/javascript; charset=utf-8");
    }

    // CSV routes (map to exports dir)
    if (req.method === "GET" && req.url === "/auto.csv") {
      return serveCsv(res, csvPath(dataDir, "auto_log.csv"));
    }
    if (req.method === "GET" && req.url === "/manual.csv") {
      return serveCsv(res, csvPath(dataDir, "manual_log.csv"));
    }

    send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
  });

  server.on("listening", () => {
    console.log(`[viewer] http://localhost:${uiPort}/  (serving CSVs from ${dataDir})`);
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
