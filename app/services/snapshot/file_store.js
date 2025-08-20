// app/services/snapshot/file_store.js
// JSON-array file storage for snapshots with 24h pruning. No external libs.

import fs from "fs";
import path from "path";

/**
 * Creates a file-backed store for snapshots.
 * @param {string} dir - directory for the snapshot file
 * @param {number} retentionHours - hours to retain (e.g., 24)
 */
export function createFileStore(dir, retentionHours = 24) {
  const file = path.join(dir, "signalk_snapshot.json");

  return {
    filepath: file,
    async appendAndPrune(snapshotUtcObj) {
      const list = readJsonArray(file);
      list.push(snapshotUtcObj);
      const pruned = pruneByUtc(list, retentionHours);
      writeJsonArray(file, pruned);
      return { count: pruned.length };
    }
  };
}

// --- helpers (small & testable) ---

function readJsonArray(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8");
    if (raw.trim() === "") return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or partial file: rename a backup and start fresh
    try { fs.renameSync(file, file + ".corrupt"); } catch {}
    return [];
  }
}

function writeJsonArray(file, arr) {
  const tmp = file + ".tmp";
  const data = JSON.stringify(arr);
  // atomic-ish write
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

/**
 * Keep only entries within retentionHours of "now" (UTC).
 */
function pruneByUtc(list, retentionHours) {
  const nowMs = Date.now();
  const cutoffMs = nowMs - retentionHours * 60 * 60 * 1000;
  return list.filter((it) => {
    const t = parseUtcNoSeconds(it?.timestamp_utc);
    return Number.isFinite(t) && t >= cutoffMs;
  });
}

// Accepts YYYY-MM-DDTHH:mmZ
function parseUtcNoSeconds(s) {
  if (typeof s !== "string") return NaN;
  // Add :00 seconds so Date can parse reliably
  const withSeconds = s.replace(/Z$/, ":00Z");
  const ms = Date.parse(withSeconds);
  return ms;
}
