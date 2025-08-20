// app/utils/config/load.js
// Loads a JSON config file from (in order):
// 1) process.env.HELMINGSENSE_CONFIG
// 2) ./config/config.json (repo/dev)
// 3) /etc/helmingsense/config.json (prod)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadConfig(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.HELMINGSENSE_CONFIG,
    path.resolve(process.cwd(), "config/config.json"),
    "/etc/helmingsense/config.json"
  ].filter(Boolean);

  let lastErr = null;
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, "utf8");
      const cfg = JSON.parse(raw);
      return { config: cfg, source: p };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  return { config: null, source: null, error: lastErr || new Error("No config found") };
}
