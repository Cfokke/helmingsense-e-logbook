// app/services/snapshot/index.js
// Entry point: loads config, sets up the polling loop, and logs snapshots.

import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import { fetchSelf } from "./fetch.js";
import { buildSnapshot } from "./process.js";
import { storeSnapshot } from "./store.js";

function exitWith(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);

  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  console.log(`[snapshot] Using config from: ${source}`);
  console.log(`[snapshot] Interval: ${config.sampling.snapshot_interval_sec}s`);
  console.log(`[snapshot] Endpoint: ${config.signalk.base_url}`);

  let timer = null;
  let running = false;

  const tick = async () => {
    if (running) return; // prevent re-entrancy if a tick runs long
    running = true;
    try {
      const raw = await fetchSelf(config.signalk.base_url, config.signalk.timeout_sec);
      const snap = buildSnapshot(raw, config.sampling.fields);
      await storeSnapshot(snap);
    } catch (e) {
      console.error("[snapshot] Tick error:", e.message || e);
    } finally {
      running = false;
    }
  };

  // immediate tick once, then interval
  await tick();
  timer = setInterval(tick, config.sampling.snapshot_interval_sec * 1000);

  const shutdown = () => {
    if (timer) clearInterval(timer);
    console.log("[snapshot] Stopped.");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => exitWith(e?.message || String(e)));
