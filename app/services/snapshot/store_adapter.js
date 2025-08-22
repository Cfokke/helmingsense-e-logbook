// app/services/snapshot/store_adapter.js
// Minimal JSON array store for snapshots: append + 24h prune + corrupt recovery.
// File: <dir>/signalk_snapshot.json

import fs from "node:fs";
import path from "node:path";

const FILE_NAME = "signalk_snapshot.json";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const txt = fs.readFileSync(filePath, "utf8");
    if (!txt.trim()) return [];
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt file → start fresh
    return [];
  }
}

function prune24h(arr, nowMs) {
  const cutoff = nowMs - ONE_DAY_MS;
  return arr.filter((s) => {
    const t = Date.parse(s?.timestamp_utc);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** Append a snapshot and prune to last 24h. */
export function append(dir, snapshot) {
  ensureDir(dir);
  const filePath = path.join(dir, FILE_NAME);
  const nowMs = Date.now();

  const arr = loadArray(filePath);
  arr.push(snapshot);
  const pruned = prune24h(arr, nowMs);

  const json = JSON.stringify(pruned) + "\n"; // newline for tail -f friendliness
  fs.writeFileSync(filePath, json, "utf8");
  return { ok: true, file: filePath, count: pruned.length };
}

/** Read latest snapshot (convenience). */
export function loadLatest(dir) {
  const filePath = path.join(dir, FILE_NAME);
  const arr = loadArray(filePath);
  return arr.length ? arr[arr.length - 1] : null;
}
