#!/usr/bin/env node
// bin/validate-config.js
// Usage: node bin/validate-config.js [path/to/config.json]
// Exits non-zero if invalid (CI-friendly).

import { loadConfig } from "../app/utils/config/load.js";
import { validateConfig } from "../app/utils/config/validate.js";

const pathArg = process.argv[2];
const { config, source, error } = loadConfig(pathArg);

if (!config) {
  console.error("Failed to load config:", error?.message || error);
  process.exit(2);
}

const { ok, errors } = validateConfig(config);
if (!ok) {
  console.error(`Config INVALID (${source}):`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log(`Config OK (${source}).`);
process.exit(0);
