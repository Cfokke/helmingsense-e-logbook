// bin/autolog-once.js
// Read latest snapshot from ./data/signalk_snapshot.json, build an autolog row,
// insert into SQLite, then regenerate auto_log.csv.
// ESM script; no external deps.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { buildAutologRow } from "../app/services/autolog/build_row.js";
import { insertAutolog } from "../app/services/autolog/store_db.js";
import { loadConfig } from "../app/utils/config/load.js";
import { validateConfig } from "../app/utils/config/validate.js";

function exitWith(msg, code=1) { console.error(msg); process.exit(code); }

function readLatestSnapshot(dir) {
  const file = path.join(dir, "signalk_snapshot.json");
  if (!fs.existsSync(file)) return null;
  const txt = fs.readFileSync(file, "utf8");
  if (!txt.trim()) return null;
  let arr;
  try { arr = JSON.parse(txt); } catch { return null; }
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
}

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);
  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const dir = config.exports.dir;              // e.g. ./data
  const snap = readLatestSnapshot(dir);
  if (!snap) exitWith("No snapshots found. Is the snapshot service running?");

  const row = buildAutologRow(snap, Date.now());
  const res = await insertAutolog(dir, row);
  if (!res?.ok) exitWith(`Insert failed: ${res?.error || "unknown error"}`);

  console.log("[autolog-once] inserted:", row.Timestamp);

  // Regenerate CSV via the existing exporter script
  const p = spawnSync(process.execPath, ["bin/export-autolog-csv.js"], { stdio: "inherit" });
  if (p.status !== 0) exitWith("CSV export failed");
  console.log("[autolog-once] auto_log.csv regenerated");
}

main().catch(e => exitWith(e?.message || String(e)));
