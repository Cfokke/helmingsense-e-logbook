#!/usr/bin/env node
// bin/export-merged-csv.js
// Build a merged ship's log CSV from autologs + manual_logs.
// Outputs:
//   data/merged_log.csv                 (exact columns)
//   data/merged_log_with_type.csv       (same + leading "Type" column)

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../app/utils/config/load.js";
import { validateConfig } from "../app/utils/config/validate.js";
import { runSql, ensureDir } from "../app/utils/sqlite/run.js";

function exitWith(msg, code=1){ console.error(msg); process.exit(code); }

const HEADERS_EXACT = [
  "Time","Position","COG/SOG","HdgMag/HdgTrue","AWS/TWS/TWD","Temp/Pres/Hum","Pitch/Roll",
  "Crew","APilot","Prop","Vis","Sea","Observations"
];
const HEADERS_WITH_TYPE = ["Type", ...HEADERS_EXACT];

const SELECT_TSV = `
.headers off
.mode tabs

WITH A AS (
  SELECT
    'Auto' AS kind,
    timestamp_utc,
    lat, lon,
    cog_true_deg, sog_kt,
    hdg_mag_deg, hdg_true_deg,
    aws_kt, tws_kt, twd_true_deg,
    temp_c, pres_mbar, dew_c, hum_pct,
    pitch_deg, roll_deg,
    COALESCE(crew,'') AS crew,
    COALESCE(autopilot,'') AS apilot,
    COALESCE(propulsion,'') AS prop,
    COALESCE(visibility,'') AS vis,
    COALESCE(sea_state,'') AS sea,
    REPLACE(REPLACE(COALESCE(observations,''), char(9), ' '), char(10), ' ') AS obs
  FROM autologs
),
M AS (
  SELECT
    'Manual' AS kind,
    timestamp_utc,
    lat, lon,
    cog_true_deg, sog_kt,
    hdg_mag_deg, hdg_true_deg,
    aws_kt, tws_kt, twd_true_deg,
    temp_c, pres_mbar, dew_c, hum_pct,
    pitch_deg, roll_deg,
    COALESCE(crew,'') AS crew,
    COALESCE(autopilot,'') AS apilot,
    COALESCE(propulsion,'') AS prop,
    COALESCE(visibility,'') AS vis,
    COALESCE(sea_state,'') AS sea,
    REPLACE(REPLACE(COALESCE(observations,''), char(9), ' '), char(10), ' ') AS obs
  FROM manual_logs
)

SELECT
  kind,            -- 1
  timestamp_utc,   -- 2
  lat, lon,        -- 3,4
  cog_true_deg, sog_kt,                  -- 5,6
  hdg_mag_deg, hdg_true_deg,             -- 7,8
  aws_kt, tws_kt, twd_true_deg,          -- 9,10,11
  temp_c, pres_mbar, dew_c, hum_pct,     -- 12,13,14,15
  pitch_deg, roll_deg,                   -- 16,17
  crew, apilot, prop, vis, sea, obs      -- 18..23
FROM (
  SELECT * FROM A
  UNION ALL
  SELECT * FROM M
)
ORDER BY timestamp_utc DESC;
`;

const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const norm360 = (deg) => {
  if (!isNum(deg)) return deg;
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
};
const fmt1   = (v) => (isNum(v) ? (Math.round(v*10)/10).toFixed(1) : "");
const fmtInt = (v) => (isNum(v) ? String(Math.round(v)) : "");

// DMS helpers
function toDms(latOrLon, isLat) {
  if (!isNum(latOrLon)) return "";
  const hemi = isLat ? (latOrLon >= 0 ? "N" : "S") : (latOrLon >= 0 ? "E" : "W");
  const abs = Math.abs(latOrLon);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = String(deg).padStart(2, "0");
  const minStr = (min < 10 ? "0" : "") + min.toFixed(3);
  return `${hemi} ${degStr}° ${minStr}'`;
}
const toDmsLat = (lat) => toDms(lat, true);
const toDmsLon = (lon) => toDms(lon, false);

// Group formatters
function fmtPosition(lat, lon) {
  const a = toDmsLat(lat), b = toDmsLon(lon);
  return (a || b) ? `${a} | ${b}` : "";
}
function fmtCogSog(cog, sog) {
  const c = isNum(cog) ? fmt1(norm360(cog)) : "";
  const s = fmt1(sog);
  return (c || s) ? `${c}°T / ${s} kt` : "";
}
function fmtHeadings(hmag, htrue) {
  const m = isNum(hmag) ? fmt1(norm360(hmag)) : "";
  const t = isNum(htrue) ? fmt1(norm360(htrue)) : "";
  return (m || t) ? `${m}° / ${t}°T` : "";
}
function fmtWind(aws, tws, twd) {
  const a = fmt1(aws), t = fmt1(tws);
  const d = isNum(twd) ? fmt1(norm360(twd)) : "";
  return (a || t || d) ? `${a} / ${t} / ${d}°T` : "";
}
function fmtEnv(temp, pres, hum) {
  const t = fmt1(temp);
  const p = fmt1(pres);
  const h = fmtInt(hum);
  return (t || p || h) ? `${t}°C / ${p} mbar / ${h}%` : "";
}
function fmtImu(pitch, roll) {
  const p = fmtInt(pitch), r = fmtInt(roll);
  return (p || r) ? `${p}° / ${r}°` : "";
}

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);
  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const dir = config.exports.dir;
  ensureDir(dir);
  const dbPath = path.join(dir, "db.sqlite3");
  const outCsv = path.join(dir, "merged_log.csv");
  const outCsvWithType = path.join(dir, "merged_log_with_type.csv");

  const { stdout } = await runSql(dbPath, SELECT_TSV);
  const lines = stdout.split("\n").filter(Boolean);

  const rows = lines.map(line => {
    const c = line.split("\t");

    const kind = c[0];
    const ts   = c[1];
    const lat  = c[2] === "" ? null : Number(c[2]);
    const lon  = c[3] === "" ? null : Number(c[3]);
    const cog  = c[4] === "" ? null : Number(c[4]);
    const sog  = c[5] === "" ? null : Number(c[5]);
    const hdgMag  = c[6] === "" ? null : Number(c[6]);
    const hdgTrue = c[7] === "" ? null : Number(c[7]);
    const aws  = c[8] === "" ? null : Number(c[8]);
    const tws  = c[9] === "" ? null : Number(c[9]);
    const twd  = c[10] === "" ? null : Number(c[10]);
    const temp = c[11] === "" ? null : Number(c[11]);
    const pres = c[12] === "" ? null : Number(c[12]);
    const dew  = c[13] === "" ? null : Number(c[13]); // not displayed in merged
    const hum  = c[14] === "" ? null : Number(c[14]);
    const pitch = c[15] === "" ? null : Number(c[15]);
    const roll  = c[16] === "" ? null : Number(c[16]);
    const crew   = c[17];
    const apilot = c[18];
    const prop   = c[19];
    const vis    = c[20];
    const sea    = c[21];
    const obs    = c[22];

    const position   = fmtPosition(lat, lon);
    const cogSog     = fmtCogSog(cog, sog);
    const headings   = fmtHeadings(hdgMag, hdgTrue);
    const wind       = fmtWind(aws, tws, twd);
    const env        = fmtEnv(temp, pres, hum);
    const imu        = fmtImu(pitch, roll);

    const rowExact = [
      ts, position, cogSog, headings, wind, env, imu,
      crew, apilot, prop, vis, sea, obs
    ];
    const rowWithType = [kind, ...rowExact];
    return { rowExact, rowWithType };
  });

  const outExact = [
    HEADERS_EXACT.map(q).join(","),
    ...rows.map(r => r.rowExact.map(q).join(","))
  ].join("\n") + "\n";
  fs.writeFileSync(outCsv, outExact);

  const outTyped = [
    HEADERS_WITH_TYPE.map(q).join(","),
    ...rows.map(r => r.rowWithType.map(q).join(","))
  ].join("\n") + "\n";
  fs.writeFileSync(outCsvWithType, outTyped);

  console.log(`[export] wrote ${outCsv}`);
  console.log(`[export] wrote ${outCsvWithType}`);
}

main().catch(e => exitWith(e?.message || String(e)));
