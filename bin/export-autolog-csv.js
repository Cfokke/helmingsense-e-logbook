#!/usr/bin/env node
// bin/export-autolog-csv.js
// Regenerate auto_log.csv from autologs with skipper-friendly formatting.
// No external deps; uses sqlite3 CLI via runSql helper.

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../app/utils/config/load.js";
import { validateConfig } from "../app/utils/config/validate.js";
import { runSql, ensureDir } from "../app/utils/sqlite/run.js";

function exitWith(msg, code=1){ console.error(msg); process.exit(code); }

const HEADERS = [
  "Timestamp","Crew","Autopilot","Propulsion","Visibility","Sea_state","Observations",
  "Lat","Lon","COG (°T)","HdgMag (°)","HdgTrue (°)","SOG (kt)",
  "AWS (kt)","TWS (kt)","TWD (°T)","Temp (°C)","Pres (mbar)","Dew (°C)","Hum (%)",
  "Pitch (°)","Roll (°)"
];

// Pull raw values from DB in a stable order (tabs separator to ease parsing)
const SELECT_TSV = `
.headers off
.mode tabs
SELECT
  timestamp_utc,        -- 1
  COALESCE(crew,''),    -- 2
  COALESCE(autopilot,''), -- 3
  COALESCE(propulsion,''), -- 4
  COALESCE(visibility,''), -- 5
  COALESCE(sea_state,''),  -- 6
  REPLACE(REPLACE(COALESCE(observations,''), char(9), ' '), char(10), ' '), -- 7 (strip tabs/newlines)
  lat, lon,             -- 8,9
  cog_true_deg,         -- 10
  hdg_mag_deg,          -- 11
  hdg_true_deg,         -- 12
  sog_kt,               -- 13
  aws_kt,               -- 14
  tws_kt,               -- 15
  twd_true_deg,         -- 16
  temp_c, pres_mbar, dew_c, hum_pct,  -- 17,18,19,20
  pitch_deg, roll_deg   -- 21,22
FROM autologs
ORDER BY timestamp_utc ASC;
`;

// --- Formatting helpers ---
const q = (s) => {
  const str = String(s ?? "");
  // Always quote; escape quotes by doubling them
  return `"${str.replace(/"/g, '""')}"`;
};

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const fmt1 = (v) => (isNum(v) ? v.toFixed(1) : "");
const fmtInt = (v) => (isNum(v) ? String(Math.round(v)) : "");

function toDms(latOrLon, isLat) {
  if (!isNum(latOrLon)) return "";
  const hemi = isLat ? (latOrLon >= 0 ? "N" : "S") : (latOrLon >= 0 ? "E" : "W");
  const abs = Math.abs(latOrLon);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = String(deg).padStart(2, "0"); // 2-digit degrees like sample (e.g., 01°)
  const minStr = (min < 10 ? "0" : "") + min.toFixed(3); // 2-digit minutes, 3 dp
  return `${hemi} ${degStr}° ${minStr}'`;
}
const toDmsLat = (lat) => toDms(lat, true);
const toDmsLon = (lon) => toDms(lon, false);

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);
  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const dir = config.exports.dir;
  ensureDir(dir);
  const dbPath = path.join(dir, "db.sqlite3");
  const outCsv = path.join(dir, "auto_log.csv");

  const { stdout } = await runSql(dbPath, SELECT_TSV);
  const lines = stdout.split("\n").filter(Boolean);

  const rows = lines.map(line => {
    const c = line.split("\t"); // columns 1..22 (strings)
    const ts = c[0];
    const crew = c[1], autopilot = c[2], propulsion = c[3], visibility = c[4], sea_state = c[5], obs = c[6];
    const lat = c[7] === "" ? null : Number(c[7]);
    const lon = c[8] === "" ? null : Number(c[8]);
    const cog = c[9] === "" ? null : Number(c[9]);
    const hdgMag = c[10] === "" ? null : Number(c[10]);
    const hdgTrue = c[11] === "" ? null : Number(c[11]);
    const sog = c[12] === "" ? null : Number(c[12]);
    const aws = c[13] === "" ? null : Number(c[13]);
    const tws = c[14] === "" ? null : Number(c[14]);
    const twd = c[15] === "" ? null : Number(c[15]);
    const temp = c[16] === "" ? null : Number(c[16]);
    const pres = c[17] === "" ? null : Number(c[17]);
    const dew  = c[18] === "" ? null : Number(c[18]);
    const hum  = c[19] === "" ? null : Number(c[19]);
    const pitch = c[20] === "" ? null : Number(c[20]);
    const roll  = c[21] === "" ? null : Number(c[21]);

    return [
      ts, crew, autopilot, propulsion, visibility, sea_state, obs,
      toDmsLat(lat), toDmsLon(lon),
      fmt1(cog), fmt1(hdgMag), fmt1(hdgTrue), fmt1(sog),
      fmt1(aws), fmt1(tws), fmt1(twd),
      fmt1(temp), fmt1(pres), fmt1(dew), fmtInt(hum),
      fmtInt(pitch), fmtInt(roll)
    ];
  });

  // Write CSV
  const out = [HEADERS.map(q).join(","), ...rows.map(r => r.map(q).join(","))].join("\n") + "\n";
  fs.writeFileSync(outCsv, out);
  console.log(`[export] wrote ${outCsv}`);
}

main().catch(e => exitWith(e?.message || String(e)));
