// app/services/autolog/latest.js
// Loads the latest snapshot from signalk_snapshot.json (JSON array).

import fs from "fs";
import path from "path";

export function loadLatestSnapshot(dir) {
  const file = path.join(dir, "signalk_snapshot.json");
  if (!fs.existsSync(file)) return null;

  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[arr.length - 1]; // newest is last (we append)
  } catch {
    return null; // corrupt/partial is treated as no snapshot
  }
}
