// app/services/autolog/index.js
// Entry: wait until next UTC top-of-hour, then emit an autolog row (console-only).

import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import { nextTopOfHourMs, msUntil, sleep } from "./schedule.js";
import { loadLatestSnapshot } from "./latest.js";
import { buildAutologRow } from "./build_row.js";
import { insertAutolog } from "./store_db.js";

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
    const waitMs = msUntil(targetMs);
    await sleep(waitMs);

    try {
      const snap = loadLatestSnapshot(storeDir);
      const row = buildAutologRow(snap, targetMs);
      const res = await insertAutolog(config.exports.dir, row);
  if (!res.ok) {
  console.error("[autolog] insert failed:", res.error);
  } else {
  console.log("[autolog] inserted:", row.Timestamp);
}


    // loop continues to the next hour
  }
}

main().catch((e) => exitWith(e?.message || String(e)));
