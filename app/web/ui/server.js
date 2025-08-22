// app/web/ui/server.js
// Serves index.html, viewer modules, CSVs from exports dir,
// and a merged CSV generated live from SQLite (no extra libs).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
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

function serveCsvFile(res, filePath) {
  try {
    const data = fs.readFileSync(filePath);
    send(res, 200, { "content-type": "text/csv; charset=utf-8" }, data);
  } catch (e) {
    if (e.code === "ENOENT") {
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
  const dbPath  = path.join(dataDir, "db.sqlite3");

  // Exact header order for the viewer
  const MERGED_SELECT = `
SELECT
  timestamp_utc   AS "Timestamp",
  crew            AS "Crew",
  autopilot       AS "Autopilot",
  propulsion      AS "Propulsion",
  visibility      AS "Visibility",
  sea_state       AS "Sea_state",
  observations    AS "Observations",
  lat             AS "Lat",
  lon             AS "Lon",
  cog_true_deg    AS "COG (°T)",
  hdg_mag_deg     AS "HdgMag (°)",
  hdg_true_deg    AS "HdgTrue (°)",
  sog_kt          AS "SOG (kt)",
  aws_kt          AS "AWS (kt)",
  tws_kt          AS "TWS (kt)",
  twd_true_deg    AS "TWD (°T)",
  temp_c          AS "Temp (°C)",
  pres_mbar       AS "Pres (mbar)",
  dew_c           AS "Dew (°C)",
  hum_pct         AS "Hum (%)",
  pitch_deg       AS "Pitch (°)",
  roll_deg        AS "Roll (°)"
FROM merged_log
ORDER BY timestamp_utc DESC
`;

  function serveMergedCsv(res) {
    const args = ["-csv", "-header", dbPath, MERGED_SELECT];
    execFile("sqlite3", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error("[viewer] /merged.csv sqlite3 error:", err, stderr);
        send(res, 500, { "content-type": "text/plain; charset=utf-8" }, "DB query error");
        return;
      }
      send(res, 200, { "content-type": "text/csv; charset=utf-8" }, stdout);
    });
  }

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      return serveFile(res, path.join(staticDir, "index.html"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/viewer.js") {
      return serveFile(res, path.join(staticDir, "viewer.js"), "text/javascript; charset=utf-8");
    }
    if (req.method === "GET" && req.url === "/staleness.js") {
      return serveFile(res, path.join(staticDir, "staleness.js"), "text/javascript; charset=utf-8");
    }

    if (req.method === "GET" && req.url === "/auto.csv") {
      return serveCsvFile(res, csvPath(dataDir, "auto_log.csv"));
    }
    if (req.method === "GET" && req.url === "/manual.csv") {
      return serveCsvFile(res, csvPath(dataDir, "manual_log.csv"));
    }

    if (req.method === "GET" && req.url === "/merged.csv") {
      return serveMergedCsv(res);
    }

    send(res, 404, { "content-type": "text/plain; charset=utf-8" }, "Not found");
  });

  server.on("listening", () => {
    console.log(`[viewer] http://localhost:${uiPort}/  (serving CSVs from ${dataDir})`);
    console.log(`[viewer] /merged.csv served from ${dbPath} (merged_log view)`);
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
