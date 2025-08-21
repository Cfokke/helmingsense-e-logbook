// app/services/snapshot/process.js
// Normalizes one Signal K "self" payload snapshot.
// Keeps the raw payload and adds a derived "live" object with converted units.

export function buildSnapshot(selfPayload) {
  return {
    timestamp_utc: nowUtcNoSeconds(),
    raw: selfPayload || {},
    live: deriveLive(selfPayload || {})
  };
}

function deriveLive(raw) {
  const get = (path) => safeGet(raw, path);

  // Conversions (defensive for non-numbers)
  const K_to_C = (k) => (typeof k === "number" ? k - 273.15 : undefined);
  const ratio_to_pct = (r) => (typeof r === "number" ? r * 100 : undefined);
  const Pa_to_mbar = (pa) => (typeof pa === "number" ? pa / 100 : undefined);
  const rad_to_deg = (rad) => (typeof rad === "number" ? (rad * 180) / Math.PI : undefined);

  const tempK = get("environment.inside.temperature");
  const dewK = get("environment.inside.dewPointTemperature");
  const humRatio = get("environment.inside.humidity");
  const presPa = get("environment.inside.pressure");
  const pitchRad = get("navigation.pitch");
  const rollRad = get("navigation.roll");

  return {
    temp_c: K_to_C(numOrVal(tempK)),
    dew_c: K_to_C(numOrVal(dewK)),
    hum_pct: ratio_to_pct(numOrVal(humRatio)),
    pres_mbar: Pa_to_mbar(numOrVal(presPa)),
    pitch_deg: rad_to_deg(numOrVal(pitchRad)),
    roll_deg: rad_to_deg(numOrVal(rollRad))
  };
}

// Pulls nested path like "environment.inside.temperature" from raw
function safeGet(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

// Accept { value: 123 } shapes or bare numbers
function numOrVal(x) {
  if (typeof x === "number") return x;
  if (x && typeof x === "object" && "value" in x && typeof x.value === "number") return x.value;
  return undefined;
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
