// app/services/snapshot/process.js
// Normalizes one snapshot. Adds derived "live" values (converted units).

export function buildSnapshot(selfPayload, fields) {
  return {
    timestamp_utc: nowUtcNoSeconds(),
    requested_fields: Array.isArray(fields) ? fields.slice() : [],
    raw: selfPayload || {},
    live: deriveLive(selfPayload || {})
  };
}

function deriveLive(raw) {
  // Defensive navigation of nested objects; Signal K "self" payloads often use nested { path: { value, ... } }
  // We only touch the six live paths you confirmed.
  const val = (o) => (o && typeof o === "object" && "value" in o ? o.value : undefined);

  // Try common shapes:
  const get = (path) => {
    // path like "environment.inside.temperature"
    const parts = path.split(".");
    let cur = raw;
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    return val(cur) ?? cur; // accept either {value} or raw number
  };

  // Conversions
  const K_to_C = (k) => (typeof k === "number" ? (k - 273.15) : undefined);
  const ratio_to_pct = (r) => (typeof r === "number" ? (r * 100) : undefined);
  const Pa_to_mbar = (pa) => (typeof pa === "number" ? (pa / 100) : undefined);
  const rad_to_deg = (rad) => (typeof rad === "number" ? (rad * 180 / Math.PI) : undefined);

  const tempK = get("environment.inside.temperature");
  const dewK = get("environment.inside.dewPointTemperature");
  const humRatio = get("environment.inside.humidity");
  const presPa = get("environment.inside.pressure");
  const pitchRad = get("navigation.pitch");
  const rollRad = get("navigation.roll");

  return {
    temp_c: K_to_C(tempK),
    dew_c: K_to_C(dewK),
    hum_pct: ratio_to_pct(humRatio),
    pres_mbar: Pa_to_mbar(presPa),
    pitch_deg: rad_to_deg(pitchRad),
    roll_deg: rad_to_deg(rollRad)
  };
}

function nowUtcNoSeconds() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
}
