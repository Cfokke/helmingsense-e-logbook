// app/services/snapshot/index.js
// Polls Signal K "self" endpoint every snapshot_interval_sec,
// builds a normalized snapshot (raw + live) and appends to signalk_snapshot.json,
// pruning to rolling 24h. No external deps.

import http from "node:http";
import https from "node:https";
import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import * as store from "./file_store.js";            // uses append(...) + prune inside
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
    await store.append(outDir, snap); // file_store.js handles pruning & corrupt recovery
  } catch (e) {
    console.error("[snapshot] fetch/append failed:", e.message || e);
  }
}

main().catch((e) => exitWith(e?.message || String(e)));
