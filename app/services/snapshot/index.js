// app/services/snapshot/index.js
// Polls Signal K "self" endpoint every snapshot_interval_sec,
// builds a normalized snapshot (raw + live) and appends to signalk_snapshot.json,
// pruning to rolling 24h. No external deps.

import http from "node:http";
import https from "node:https";
import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import * as store from "./file_store.js";            // we’ll adapt to its actual export
import { buildSnapshot } from "./process.js";

function exitWith(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function agentFor(url) {
  return url.startsWith("https:") ? https : http;
}

async function fetchJson(url, timeoutMs) {
  const agent = agentFor(url);
  return new Promise((resolve, reject) => {
    const req = agent.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    req.on("error", reject);
  });
}

// ---- adapter: find the right 'append' style function once
function getAppendFn(mod) {
  if (typeof mod.append === "function") return mod.append;
  if (typeof mod.appendSnapshot === "function") return mod.appendSnapshot;
  if (typeof mod.write === "function") return mod.write;
  if (typeof mod.default === "function") return mod.default;
  throw new Error("file_store.js does not export an append-like function (append/appendSnapshot/write/default)");
}
// cache it:
const appendToStore = getAppendFn(store);
// ----

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);
  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const base = config.signalk.base_url.replace(/\/+$/, "");
  const endpoint = `${base}/signalk/v1/api/vessels/self`;
  const intervalMs = (config.sampling.snapshot_interval_sec || 60) * 1000;
  const outDir = config.exports.dir;
  const timeoutMs = (config.signalk.timeout_sec || 5) * 1000;

  console.log(`[snapshot] Using config from: ${source}`);
  console.log(`[snapshot] Interval: ${Math.round(intervalMs / 1000)}s`);
  console.log(`[snapshot] Endpoint: ${endpoint}`);
  console.log(`[snapshot] Store dir: ${outDir}`);

  // tick immediately, then every interval
  await tick(endpoint, timeoutMs, outDir);
  setInterval(() => {
    tick(endpoint, timeoutMs, outDir).catch((e) =>
      console.error("[snapshot] tick error:", e.message || e)
    );
  }, intervalMs);
}

async function tick(endpoint, timeoutMs, outDir) {
  try {
    const selfJson = await fetchJson(endpoint, timeoutMs);
    const snap = buildSnapshot(selfJson);
    await appendToStore(outDir, snap); // adapter handles actual export name
  } catch (e) {
    console.error("[snapshot] fetch/append failed:", e.message || e);
  }
}

main().catch((e) => exitWith(e?.message || String(e)));
