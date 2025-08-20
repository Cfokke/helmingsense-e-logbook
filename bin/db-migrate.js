#!/usr/bin/env node
// Applies all *.sql files in app/db/migrations to <exports.dir>/db.sqlite3

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../app/utils/config/load.js";
import { validateConfig } from "../app/utils/config/validate.js";
import { runSql, ensureDir } from "../app/utils/sqlite/run.js";

function exitWith(msg, code=1){ console.error(msg); process.exit(code); }

async function main() {
  const { config, source, error } = loadConfig();
  if (!config) exitWith(`Failed to load config: ${error?.message || error}`);
  const { ok, errors } = validateConfig(config);
  if (!ok) exitWith(`Invalid config (${source}):\n - ${errors.join("\n - ")}`);

  const dir = config.exports.dir;
  ensureDir(dir);
  const dbPath = path.join(dir, "db.sqlite3");

  const migDir = path.resolve("app/db/migrations");
  const files = fs.readdirSync(migDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  console.log(`[migrate] DB: ${dbPath}`);
  for (const f of files) {
    const p = path.join(migDir, f);
    const sql = fs.readFileSync(p, "utf8");
    console.log(`[migrate] applying ${f} ...`);
    await runSql(dbPath, sql);
  }
  console.log("[migrate] done.");
}

main().catch(e => exitWith(e?.message || String(e)));
