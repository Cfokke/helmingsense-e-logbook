// app/services/autolog/index.js
// Schedules a top-of-hour tick, builds an autolog row, inserts into SQLite,
// and regenerates auto_log.csv on success.

import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import { insertAutolog } from "./store_db.js";
import { nextTopOfHourMs, msUntil, sleep } from "./schedule.js";
import { loadLatestSnapshot } from "./latest.js";
import { buildAutologRow } from "./build_row.js";
import { spawn } from "node:child_process";

function exportAutoCsv() {
  const child = spawn(process.execPath, ["bin/export-autolog-csv.js"], { stdio: "inherit" });
  child.on("close", (code) => {
    if (code === 0) console.log("[autolog] auto_log.csv regenerated");
    else console.error("[autolog] CSV export failed with code", code);
  });
}

function exitWith(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);

  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const storeDir = config.exports.dir;
  console.log(`[autolog] Using config from: ${source}`);
  console.log(`[autolog] Snapshot store dir: ${storeDir}`);
  console.log("[autolog] Waiting for next top-of-hour (UTC)...");

  while (true) {
    const targetMs = nextTopOfHourMs(new Date());
    await sleep(msUntil(targetMs));

    try {
      const snap = loadLatestSnapshot(storeDir);
      const row = buildAutologRow(snap, targetMs);
      const res = await insertAutolog(storeDir, row);

      if (!res.ok) {
        console.error("[autolog] insert failed:", res.error);
      } else {
        console.log("[autolog] inserted:", row.Timestamp);
        exportAutoCsv();
      }
    } catch (e) {
      console.error("[autolog] tick error:", e.message || e);
    }
    // loop to next hour
  }
}

main().catch((e) => exitWith(e?.message || String(e)));
