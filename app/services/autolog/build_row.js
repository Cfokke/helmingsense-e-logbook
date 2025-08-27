// app/services/autolog/build_row.js
// Build one autolog row OBJECT (CSV headers for export) and include DB numeric fields.

export const AUTOLOG_HEADERS = [
  "Timestamp","Crew","Autopilot","Propulsion","Visibility","Sea_state","Observations",
  "Lat","Lon","COG (°T)","HdgMag (°)","HdgTrue (°)","SOG (kt)",
  "AWS (kt)","TWS (kt)","TWD (°T)","Temp (°C)","Pres (mbar)","Dew (°C)","Hum (%)",
  "Pitch (°)","Roll (°)"
];

// Keep existing stale defaults EXACTLY (used only when live+raw missing)
const STALE = {
  lat_deg: 50.24178,
  lon_deg: -3.7564,
  cog_true_deg: 60.1,
  hdg_mag_deg: 161.0,
  hdg_true_deg: 193.6,
  sog_kt: 0.1,
  aws_kt: 10.7,
  tws_kt: 40.9,
  twd_true_deg: 154.0,
  temp_c: 22.62,
  pres_mbar: 1017,
  dew_c: 10.024,
  hum_pct: 45,
  pitch_deg: 0,
  roll_deg: 0
};

const asNum = (x) => (typeof x === "number" ? x : undefined);
const radToDeg = (rad) => (typeof rad === "number" ? (rad * 180) / Math.PI : undefined);
const mpsToKt = (ms) => (typeof ms === "number" ? ms * 1.94384449 : undefined);

function pick(a, b) {
  return a !== undefined && a !== null && a !== "" ? a : b;
}

function minuteIsoUTC(ms) {
  const d = new Date(ms ?? Date.now());
  const yyyy = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${DD}T${hh}:${mm}Z`;
}

// --- Signal K readers (exact paths + safe fallbacks) ---

// 1) Position: prefer .value, else .values.*.value.{latitude,longitude}
function readLatLon(snapshot) {
  try {
    const p = snapshot?.raw?.navigation?.position;
    const v = p?.value;
    if (v && asNum(v.latitude) !== undefined && asNum(v.longitude) !== undefined) {
      return { lat: v.latitude, lon: v.longitude };
    }
    const vals = p?.values && typeof p.values === "object" ? Object.values(p.values) : [];
    for (const entry of vals) {
      const vv = entry?.value;
      if (vv && asNum(vv.latitude) !== undefined && asNum(vv.longitude) !== undefined) {
        return { lat: vv.latitude, lon: vv.longitude };
      }
    }
  } catch {}
  return { lat: undefined, lon: undefined };
}

// 2) COG true (deg): prefer derived-data (radians), else any numeric radians at .value/.values.*
function readCogTrueDeg(snapshot) {
  try {
    const c = snapshot?.raw?.navigation?.courseOverGroundTrue;
    const fromDerived = c?.values?.["derived-data"]?.value;
    if (asNum(fromDerived) !== undefined) return radToDeg(fromDerived);
    if (asNum(c?.value) !== undefined) return radToDeg(c.value);
    const vals = c?.values && typeof c.values === "object" ? Object.values(c.values) : [];
    for (const entry of vals) {
      if (asNum(entry?.value) !== undefined) return radToDeg(entry.value);
    }
  } catch {}
  return undefined;
}

// 3) SOG (kt): prefer .value (m/s), else AISGPS.*.value (m/s)
function readSogKt(snapshot) {
  try {
    const s = snapshot?.raw?.navigation?.speedOverGround;
    const ms =
      s?.value ??
      s?.values?.AISGPS?.value ??
      s?.values?.["AISGPS.AI"]?.value ??
      s?.values?.["AISGPS.GP"]?.value;
    if (asNum(ms) !== undefined) return mpsToKt(ms);
  } catch {}
  return undefined;
}

// 4) Headings
function readHdgMagDeg(snapshot) {
  return snapshot?.raw?.navigation?.headingMagnetic?.value;
}
function readHdgTrueDeg(snapshot) {
  const rad = snapshot?.raw?.navigation?.headingTrue?.value;
  return radToDeg(rad);
}

// 5) Wind
function readAwsKt(snapshot) {
  return mpsToKt(snapshot?.raw?.environment?.wind?.speedApparent?.value);
}
function readTwsKt(snapshot) {
  return mpsToKt(snapshot?.raw?.environment?.wind?.speedOverGround?.value);
}
function readTwdDeg(snapshot) {
  return radToDeg(snapshot?.raw?.environment?.wind?.directionTrue?.value);
}

// 6) Env (BME) from live block
function readEnvLive(snapshot) {
  const l = snapshot?.live ?? {};
  return {
    temp_c: asNum(l.temp_c),
    pres_mbar: asNum(l.pres_mbar),
    dew_c: asNum(l.dew_c),
    hum_pct: asNum(l.hum_pct)
  };
}

// 7) IMU pitch/roll (radians → degrees)
function readPitchDeg(snapshot) {
  return radToDeg(snapshot?.raw?.navigation?.pitch?.value);
}
function readRollDeg(snapshot) {
  return radToDeg(snapshot?.raw?.navigation?.roll?.value);
}

// --- Main builder ---

export function buildAutologRow(snapshot, nowMs) {
  const ts = minuteIsoUTC(nowMs);
  const live = snapshot?.live ?? {};

  const { lat: rawLat, lon: rawLon } = readLatLon(snapshot);

  const lat_deg       = pick(live.lat_deg, pick(rawLat, STALE.lat_deg));
  const lon_deg       = pick(live.lon_deg, pick(rawLon, STALE.lon_deg));
  const cog_true_deg  = pick(live.cog_true_deg,  pick(readCogTrueDeg(snapshot), STALE.cog_true_deg));
  const hdg_mag_deg   = pick(live.hdg_mag_deg,   pick(readHdgMagDeg(snapshot),  STALE.hdg_mag_deg));
  const hdg_true_deg  = pick(live.hdg_true_deg,  pick(readHdgTrueDeg(snapshot), STALE.hdg_true_deg));
  const sog_kt        = pick(live.sog_kt,        pick(readSogKt(snapshot),      STALE.sog_kt));
  const aws_kt        = pick(live.aws_kt,        pick(readAwsKt(snapshot),      STALE.aws_kt));
  const tws_kt        = pick(live.tws_kt,        pick(readTwsKt(snapshot),      STALE.tws_kt));
  const twd_true_deg  = pick(live.twd_true_deg,  pick(readTwdDeg(snapshot),     STALE.twd_true_deg));

  const env           = readEnvLive(snapshot);
  const temp_c        = pick(env.temp_c,   STALE.temp_c);
  const pres_mbar     = pick(env.pres_mbar,STALE.pres_mbar);
  const dew_c         = pick(env.dew_c,    STALE.dew_c);
  const hum_pct       = pick(env.hum_pct,  STALE.hum_pct);

  const pitch_deg     = pick(live.pitch_deg, pick(readPitchDeg(snapshot), STALE.pitch_deg));
  const roll_deg      = pick(live.roll_deg,  pick(readRollDeg(snapshot),  STALE.roll_deg));

  // Display fields (used by some views) — leave as simple pass-throughs;
  // CSV formatting (DMS, fixed decimals) will be handled by the exporters.
  const row = {
    "Timestamp": ts,
    "Crew": "No entry",
    "Autopilot": "No entry",
    "Propulsion": "sailing",
    "Visibility": "good",
    "Sea_state": "slight",
    "Observations": "",

    "Lat": lat_deg,
    "Lon": lon_deg,
    "COG (°T)":    cog_true_deg,
    "HdgMag (°)":  hdg_mag_deg,
    "HdgTrue (°)": hdg_true_deg,
    "SOG (kt)":    sog_kt,

    "AWS (kt)":    aws_kt,
    "TWS (kt)":    tws_kt,
    "TWD (°T)":    twd_true_deg,

    "Temp (°C)":   temp_c,
    "Pres (mbar)": pres_mbar,
    "Dew (°C)":    dew_c,
    "Hum (%)":     hum_pct,

    "Pitch (°)":   pitch_deg,
    "Roll (°)":    roll_deg,

    // DB numeric fields (authoritative)
    timestamp_utc: ts,
    lat:           lat_deg,
    lon:           lon_deg,
    cog_true_deg,
    hdg_mag_deg,
    hdg_true_deg,
    sog_kt,
    aws_kt,
    tws_kt,
    twd_true_deg,
    temp_c,
    pres_mbar,
    dew_c,
    hum_pct,
    pitch_deg,
    roll_deg
  };

  return row;
}

export default buildAutologRow;
