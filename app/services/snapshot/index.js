// app/services/snapshot/index.js
// Snapshot loop with BME/IMU live derivation, using our explicit store adapter.

import http from "node:http";
import https from "node:https";
import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import { append as storeAppend } from "./store_adapter.js";

// ---------- helpers ----------
function exitWith(msg, code = 1) { console.error(msg); process.exit(code); }
function agentFor(u) { return u.startsWith("https:") ? https : http; }

async function fetchJson(url, timeoutMs) {
  const agent = agentFor(url);
  return new Promise((resolve, reject) => {
    const req = agent.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON from ${url}: ${e.message}`)); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on("error", reject);
  });
}

function nowUtcNoSeconds() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}Z`;
}

function getPath(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
function numOrVal(x) {
  if (typeof x === "number") return x;
  if (x && typeof x === "object" && typeof x.value === "number") return x.value;
  return undefined;
}
function buildLive(raw) {
  const K_to_C       = (k)  => (typeof k === "number" ? k - 273.15        : undefined);
  const ratio_to_pct = (r)  => (typeof r === "number" ? r * 100           : undefined);
  const Pa_to_mbar   = (pa) => (typeof pa=== "number" ? pa / 100          : undefined);
  const rad_to_deg   = (x)  => (typeof x === "number" ? x * 180 / Math.PI : undefined);

  const tempK   = numOrVal(getPath(raw, "environment.inside.temperature"));
  const dewK    = numOrVal(getPath(raw, "environment.inside.dewPointTemperature"));
  const humR    = numOrVal(getPath(raw, "environment.inside.humidity"));
  const presPa  = numOrVal(getPath(raw, "environment.inside.pressure"));
  const pitchR  = numOrVal(getPath(raw, "navigation.pitch"));
  const rollR   = numOrVal(getPath(raw, "navigation.roll"));

  return {
    temp_c:     K_to_C(tempK),
    dew_c:      K_to_C(dewK),
    hum_pct:    ratio_to_pct(humR),
    pres_mbar:  Pa_to_mbar(presPa),
    pitch_deg:  rad_to_deg(pitchR),
    roll_deg:   rad_to_deg(rollR),
  };
}
function resolveEndpoint(baseUrl) {
  const b = (baseUrl || "").replace(/\/+$/, "");
  if (/\/signalk\/v1\/api\/vessels\/self$/.test(b)) return b;
  return `${b}/signalk/v1/api/vessels/self`;
}
// ----------------------------

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);
  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const endpoint   = resolveEndpoint(config.signalk.base_url);
  const intervalMs = (config.sampling.snapshot_interval_sec || 60) * 1000;
  const outDir     = config.exports.dir;
  const timeoutMs  = (config.signalk.timeout_sec || 5) * 1000;

  console.log(`[snapshot] Using config from: ${source}`);
  console.log(`[snapshot] Interval: ${Math.round(intervalMs / 1000)}s`);
  console.log(`[snapshot] Endpoint: ${endpoint}`);
  console.log(`[snapshot] Store dir: ${outDir}`);

  await tick(endpoint, timeoutMs, outDir);       // once immediately
  setInterval(() => {
    tick(endpoint, timeoutMs, outDir).catch((e) =>
      console.error("[snapshot] Tick error:", e.message || e)
    );
  }, intervalMs);
}

async function tick(endpoint, timeoutMs, outDir) {
  try {
    const selfJson = await fetchJson(endpoint, timeoutMs);
    const snapshot = {
      timestamp_utc: nowUtcNoSeconds(),
      raw:  selfJson || {},
      live: buildLive(selfJson || {}),
    };
    const res = storeAppend(outDir, snapshot);
    if (!res?.ok) console.error("[snapshot] store append failed");
  } catch (e) {
    console.error("[snapshot] Tick error:", e.message || e);
  }
}

main().catch((e) => exitWith(e?.message || String(e)));
