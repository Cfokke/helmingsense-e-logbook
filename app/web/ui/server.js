// app/web/ui/server.js
// Tiny local viewer: serves index.html and proxied CSVs from config.exports.dir.
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
      send(res, 200, { "content-type": contentType }, ""); // empty if missing
    } else {
      send(res, 500, { "content-type": "text/plain" }, "Server error");
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
      return Number(u.port || 8080);
    } catch {
      return 8080;
    }
  })();

  const staticDir = path.join(path.dirname(new URL(import.meta.url).pathname), "public");
  const dataDir = config.exports.dir;

  const server = http.createServer((req, res) => {
    // Basic routes
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      return serveFile(res, path.join(staticDir, "index.html"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/viewer.js") {
      return serveFile(res, path.join(staticDir, "viewer.js"), "text/javascript; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/auto.csv") {
      return serveFile(res, csvPath(dataDir, "auto_log.csv"), "text/csv; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/manual.csv") {
      return serveFile(res, csvPath(dataDir, "manual_log.csv"), "text/csv; charset=utf-8");
    }

    send(res, 404, { "content-type": "text/plain" }, "Not found");
  });

  server.listen(uiPort, () => {
    console.log(`[viewer] http://localhost:${uiPort}/  (serving CSVs from ${dataDir})`);
    console.log(`[viewer] auto refresh interval (sec): ${config.viewer.auto_refresh_sec}`);
  });
}

start();

