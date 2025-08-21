// app/web/ui/server.js
// Tiny local viewer: serves index.html and proxied CSVs from config.exports.dir.
// No dependencies.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
      // If the CSV is missing, return empty 200 so UI shows “No data.”
      const isCsv = contentType.startsWith("text/csv");
      if (isCsv) return send(res, 200, { "content-type": contentType }, "");
      return send(res, 404, { "content-type": "text/plain" }, "Not found");
    } else {
      return send(res, 500, { "content-type": "text/plain" }, "Server error");
    }
  }
}

function csvPath(dir, base) {
  return path.join(dir, base);
}

function liveColumns() {
  // Columns currently driven by live streams
  return [
    "Temp (°C)",
    "Dew (°C)",
    "Hum (%)",
    "Pres (mbar)",
    "Pitch (°)",
    "Roll (°)"
  ];
}

function start() {
  const { config, error } = loadConfig();
  const { ok, errors } = validateConfig(config);
  if (!ok) {
    console.error("Invalid config:", errors);
    process.exit(1);
  }

  // Resolve port from config.viewer.local_base_url, default 8081
  const uiPort = (() => {
    try {
      const u = new URL(config.viewer.local_base_url);
      return Number(u.port || 8081);
    } catch {
      return 8081;
    }
  })();

  // Robustly resolve ./public next to this file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const staticDir = path.join(__dirname, "public");

  const dataDir = config.exports.dir;

  const server = http.createServer((req, res) => {
    // Normalize and parse the path (ignore querystrings)
    const u = new URL(req.url, "http://localhost");
    const p = u.pathname;

    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      return serveFile(res, path.join(staticDir, "index.html"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && p === "/viewer.js") {
      return serveFile(res, path.join(staticDir, "viewer.js"), "text/javascript; charset=utf-8");
    }
    if (req.method === "GET" && p === "/auto.csv") {
      return serveFile(res, csvPath(dataDir, "auto_log.csv"), "text/csv; charset=utf-8");
    }
    if (req.method === "GET" && p === "/manual.csv") {
      return serveFile(res, csvPath(dataDir, "manual_log.csv"), "text/csv; charset=utf-8");
    }
    if (req.method === "GET" && p === "/liveness.json") {
      const body = JSON.stringify({ live: liveColumns() });
      return send(res, 200, { "content-type": "application/json" }, body);
    }

    return send(res, 404, { "content-type": "text/plain" }, "Not found");
  });

  server.listen(uiPort, () => {
    console.log(`[viewer] http://localhost:${uiPort}/  (serving CSVs from ${dataDir})`);
    console.log(`[viewer] auto refresh interval (sec): ${config.viewer.auto_refresh_sec}`);
    console.log(`[viewer] static dir: ${staticDir}`);
  });
}

start();
