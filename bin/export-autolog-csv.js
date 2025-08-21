#!/usr/bin/env node
// Regenerate auto_log.csv from autologs table with exact header names/order.

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../app/utils/config/load.js";
import { validateConfig } from "../app/utils/config/validate.js";
import { runSql, ensureDir } from "../app/utils/sqlite/run.js";

function exitWith(msg, code=1){ console.error(msg); process.exit(code); }

const SELECT = `
SELECT
  timestamp_utc AS "Timestamp",
  crew AS "Crew",
  autopilot AS "Autopilot",
  propulsion AS "Propulsion",
  visibility AS "Visibility",
  sea_state AS "Sea_state",
  COALESCE(observations,'') AS "Observations",
  lat AS "Lat",
  lon AS "Lon",
  cog_true_deg AS "COG (°T)",
  hdg_mag_deg AS "HdgMag (°)",
  hdg_true_deg AS "HdgTrue (°)",
  sog_kt AS "SOG (kt)",
  aws_kt AS "AWS (kt)",
  tws_kt AS "TWS (kt)",
  twd_true_deg AS "TWD (°T)",
  temp_c AS "Temp (°C)",
  pres_mbar AS "Pres (mbar)",
  dew_c AS "Dew (°C)",
  hum_pct AS "Hum (%)",
  pitch_deg AS "Pitch (°)",
  roll_deg AS "Roll (°)"
FROM autologs
ORDER BY timestamp_utc ASC;
`;

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);
  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const dir = config.exports.dir;
  ensureDir(dir);
  const dbPath = path.join(dir, "db.sqlite3");
  const outCsv = path.join(dir, "auto_log.csv");

  // We use sqlite3 dot-commands via stdin; runSql handles piping.
  const sql = [
    ".headers on",
    ".mode csv",
    `.once ${outCsv}`,
    SELECT
  ].join("\n");

  await runSql(dbPath, sql);
  console.log(`[export] wrote ${outCsv}`);
}

main().catch(e => exitWith(e?.message || String(e)));
