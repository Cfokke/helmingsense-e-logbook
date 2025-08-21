// app/services/snapshot/process.js
// Normalizes one snapshot. For now we don't extract individual paths (to avoid
// guessing Signal K JSON shape). We:
//  - stamp a UTC timestamp with no seconds (YYYY-MM-DDTHH:mmZ),
//  - echo the requested "fields" list from config (for traceability),
//  - include the raw "self" payload (so downstream can map later).
// In a later PR we will map config.sampling.fields into flat columns per SCHEMAS.md.

export function buildSnapshot(selfPayload, fields) {
  return {
    timestamp_utc: nowUtcNoSeconds(),
    requested_fields: Array.isArray(fields) ? fields.slice() : [],
    raw: selfPayload
  };
}

function nowUtcNoSeconds() {
  const d = new Date();
  // build YYYY-MM-DDTHH:mmZ in UTC (no seconds)
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
}
