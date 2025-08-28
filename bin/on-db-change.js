#!/usr/bin/env node
/**
 * on-db-change.js
 * v0.4.3: If the latest manual row is newer than the latest autolog row,
 * create a "micro-autolog" (using bin/autolog-once.js), then export merged CSV.
 *
 * No external deps. Uses sqlite3 CLI and Node child_process.
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd(); // must run with WorkingDirectory set to repo root
const DB   = join(REPO, "data", "db.sqlite3");
const LOCK = join(REPO, ".onchange.lock");

function sh(cmd) {
  return execSync(cmd, { cwd: REPO, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}
function sqlite(sql) {
  const cmd = `sqlite3 ${DB} "${sql.replaceAll('"','""')}"`;
  return sh(cmd);
}

function isoParse(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function nowUtcISO() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const MM = String(d.getUTCMonth()+1).padStart(2,"0");
  const DD = String(d.getUTCDate()).padStart(2,"0");
  const hh = String(d.getUTCHours()).padStart(2,"0");
  const mm = String(d.getUTCMinutes()).padStart(2,"0");
  const ss = String(d.getUTCSeconds()).padStart(2,"0");
  return `${yyyy}-${MM}-${DD}T${hh}:${mm}:${ss}Z`;
}

// --- lock: prevent re-entrancy loops when our own autolog write retriggers the path
try {
  if (existsSync(LOCK)) {
    const ageMs = Date.now() - statSync(LOCK).mtimeMs;
    if (ageMs < 10_000) {
      // recent run; skip to avoid loop
      process.exit(0);
    }
  }
  writeFileSync(LOCK, nowUtcISO());
} catch { /* ignore */ }

try {
  // 1) Read latest timestamps
  const lastAuto  = sqlite("SELECT timestamp_utc FROM autologs ORDER BY id DESC LIMIT 1;");
  const lastMan   = sqlite("SELECT timestamp_utc FROM manual_logs ORDER BY id DESC LIMIT 1;");

  const tAuto = isoParse(lastAuto);
  const tMan  = isoParse(lastMan);

  // If we have a manual newer than the most recent autolog, capture a micro-autolog now.
  let captured = false;
  if (tMan && (!tAuto || tMan > tAuto)) {
    try {
      execFileSync("node", ["bin/autolog-once.js"], { cwd: REPO, stdio: "inherit" });
      captured = true;
    } catch (e) {
      // capture failed; continue to export anyway
    }
  }

  // Always export merged CSV after any DB change (so the viewer stays current)
  try {
    execFileSync("node", ["bin/export-merged-csv.js"], { cwd: REPO, stdio: "inherit" });
  } catch (e) { /* ignore */ }

  // Optional: write a tiny audit line (visible in journalctl)
  console.log(`[onchange] lastManual=${lastMan || "-"} lastAutolog=${lastAuto || "-"} captured=${captured}`);
} finally {
  try { unlinkSync(LOCK); } catch {}
}
