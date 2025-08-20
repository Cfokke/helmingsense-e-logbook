// app/utils/config/validate.js
// Validates a config object against our schema. No external libs.

import { schema } from "./schema.js";

export function validateConfig(cfg) {
  const errors = [];

  // root
  if (typeof cfg !== "object" || cfg === null) errors.push("Config must be an object.");
  for (const k of schema.requiredTop) {
    if (!(k in cfg)) errors.push(`Missing top-level key: ${k}`);
  }
  rejectExtras(cfg, schema.requiredTop, errors, "top-level");

  // signalk
  const sk = cfg.signalk || {};
  mustHave(sk, schema.signalk.required, "signalk", errors);
  if (typeof sk.base_url !== "string" || !sk.base_url.startsWith("http"))
    errors.push("signalk.base_url must be a URI starting with http/https.");
  if (!isInt(sk.timeout_sec) || sk.timeout_sec < 1)
    errors.push("signalk.timeout_sec must be integer >= 1.");
  rejectExtras(sk, schema.signalk.required.concat(["token"]), errors, "signalk");

  // sampling
  const sp = cfg.sampling || {};
  mustHave(sp, schema.sampling.required, "sampling", errors);
  if (!isInt(sp.snapshot_interval_sec) || sp.snapshot_interval_sec < schema.sampling.minSnapshotSec)
    errors.push(`sampling.snapshot_interval_sec must be integer >= ${schema.sampling.minSnapshotSec}.`);
  if (typeof sp.autolog_on_the_hour !== "boolean")
    errors.push("sampling.autolog_on_the_hour must be boolean.");
  if (!Array.isArray(sp.fields) || sp.fields.length < 1 || !sp.fields.every(x => typeof x === "string"))
    errors.push("sampling.fields must be a non-empty string array.");
  rejectExtras(sp, schema.sampling.required, errors, "sampling");

  // exports
  const ex = cfg.exports || {};
  mustHave(ex, schema.exports.required, "exports", errors);
  if (typeof ex.dir !== "string" || ex.dir.length === 0)
    errors.push("exports.dir must be a non-empty string.");
  if (ex.csv_timestamp_format !== schema.exports.timestampConst)
    errors.push(`exports.csv_timestamp_format must be exactly "${schema.exports.timestampConst}".`);
  rejectExtras(ex, schema.exports.required, errors, "exports");

  // viewer
  const vw = cfg.viewer || {};
  mustHave(vw, schema.viewer.required, "viewer", errors);
  if (!isInt(vw.auto_refresh_sec) || vw.auto_refresh_sec < schema.viewer.minAutoRefreshSec)
    errors.push(`viewer.auto_refresh_sec must be integer >= ${schema.viewer.minAutoRefreshSec}.`);
  if (typeof vw.local_base_url !== "string" || !vw.local_base_url.startsWith("http"))
    errors.push("viewer.local_base_url must be a URI starting with http/https.");
  rejectExtras(vw, schema.viewer.required, errors, "viewer");

  return { ok: errors.length === 0, errors };
}

// Helpers (small, testable)
function mustHave(obj, required, prefix, errs) {
  for (const k of required) {
    if (!(k in obj)) errs.push(`Missing ${prefix}.${k}`);
  }
}
function rejectExtras(obj, allowedKeys, errs, where) {
  const extras = Object.keys(obj).filter(k => !allowedKeys.includes(k));
  if (extras.length) errs.push(`Unknown key(s) in ${where}: ${extras.join(", ")}`);
}
function isInt(v) { return Number.isInteger(v); }
