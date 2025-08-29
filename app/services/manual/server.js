// app/services/manual/server.js
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import { insertManual } from "./store_db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PUBLIC_ROOT = path.resolve(__dirname, "public");

const CT = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".svg":  "image/svg+xml",
  ".txt":  "text/plain; charset=utf-8",
};

const enums = {
  crew:       ["1","2","3","4","5","6"],
  autopilot:  ["off","standby","engaged","wind"],
  propulsion: ["drift","sailing","motor-sailing","under engine","Heave-to"],
  visibility: ["excellent","good","fair","poor","fog"],
  sea_state:  ["smooth","slight","moderate","rough","very-rough"],
};

function nowUtcNoSeconds() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}Z`;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c.toString()));
    req.on("end", () => {
      const params = new URLSearchParams(data);
      const obj = {};
      for (const [k, v] of params) obj[k] = v;
      resolve(obj);
    });
  });
}

function exportManualCsv() {
  spawn(process.execPath, ["bin/export-manual-csv.js"], { stdio: "inherit" });
}

function serveStatic(reqPath, res) {
  const rel = reqPath === "/" ? "/index.html" : reqPath;
  const safeRel = path.posix.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const abs = path.join(PUBLIC_ROOT, safeRel);
  if (!abs.startsWith(PUBLIC_ROOT)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return true;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return false;
  const ext = path.extname(abs).toLowerCase();
  res.writeHead(200, { "content-type": CT[ext] || "application/octet-stream" });
  fs.createReadStream(abs).pipe(res);
  return true;
}

// NEW: normalize form keys to the expected title-case keys.
function normalizeKeys(body) {
  const map = {
    crew: "Crew",
    Crew: "Crew",
    autopilot: "Autopilot",
    Autopilot: "Autopilot",
    propulsion: "Propulsion",
    Propulsion: "Propulsion",
    visibility: "Visibility",
    Visibility: "Visibility",
    sea_state: "Sea_state",
    Sea_state: "Sea_state",
    observations: "Observations",
    Observations: "Observations",
  };
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    const key = map[k] || k;
    out[key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

async function start() {
  const { config, error } = loadConfig();
  const { ok, errors } = validateConfig(config);
  if (!ok) {
    console.error("Invalid config:", errors, error || "");
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/submit") {
      const raw = await parseBody(req);
      const body = normalizeKeys(raw);

      const bad = [];
      const chk = (key, set) => { if (!set.includes(body[key])) bad.push(key); };
      chk("Crew", enums.crew);
      chk("Autopilot", enums.autopilot);
      chk("Propulsion", enums.propulsion);
      chk("Visibility", enums.visibility);
      chk("Sea_state", enums.sea_state);

      if (bad.length) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("Invalid fields: " + bad.join(", "));
        return;
      }

      const row = {
        "Timestamp": nowUtcNoSeconds(),
        "Crew": body.Crew,
        "Autopilot": body.Autopilot,
        "Propulsion": body.Propulsion,
        "Visibility": body.Visibility,
        "Sea_state": body.Sea_state,
        "Observations": body.Observations ?? "",
        "Lat": null, "Lon": null,
        "COG (°T)": null, "HdgMag (°)": null, "HdgTrue (°)": null,
        "SOG (kt)": null, "AWS (kt)": null, "TWS (kt)": null, "TWD (°T)": null,
        "Temp (°C)": null, "Pres (mbar)": null, "Dew (°C)": null, "Hum (%)": null,
        "Pitch (°)": null, "Roll (°)": null,
      };

      const ins = await insertManual(config.exports.dir, row);
      if (!ins.ok) {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("DB insert failed: " + ins.error);
        return;
      }

      exportManualCsv();
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    if (serveStatic(req.url, res)) return;

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  const PORT = process.env.MANUAL_PORT ? Number(process.env.MANUAL_PORT) : 8090;
  server.listen(PORT, () => {
    console.log(`[manual] public = ${PUBLIC_ROOT}`);
    console.log(`[manual] http://localhost:${PORT}/`);
  });
}

start();
