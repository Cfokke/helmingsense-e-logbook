// app/utils/sqlite/run.js
// Minimal helper to run SQL via the system `sqlite3` binary.

import { spawn } from "node:child_process";
import fs from "node:fs";

export function runSql(dbPath, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [dbPath], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", d => out += d.toString());
    child.stderr.on("data", d => err += d.toString());
    child.on("close", code => {
      if (code === 0) resolve({ stdout: out, stderr: err });
      else reject(new Error(err || `sqlite3 exited with code ${code}`));
    });
    child.stdin.write(sql);
    child.stdin.end();
  });
}

export function ensureDir(path) {
  try { fs.mkdirSync(path, { recursive: true }); } catch {}
}

export function escapeSqlString(s) {
  // SQLite string literal escape: single quote doubled.
  return String(s).replace(/'/g, "''");
}
