// app/services/autolog/build_row.js
// Builds an autolog row object. Uses live snapshot values where available.
// Uses temporary in-code stale defaults for everything else (no nulls in CSV).

const NO_ENTRY = "No entry";

// Temporary anchor defaults (until we extend the config schema on purpose)
const STALE_DEFAULTS = {
  lat: 50.24178,
  lon: -3.7564,
  cog_true_deg: 60.1,
  hdg_mag_deg: 161,
  hdg_true_deg: 193.6,
  sog_kt: 0.1,
  aws_kt: 10.7,
  tws_kt: 40.9,
  twd_true_deg: 154,
  // optional stale env defaults if you want them as fallback:
  temp_c: undefined,
  pres_mbar: undefined,
  dew_c: undefined,
  hum_pct: undefined,
  pitch_deg: undefined,
  roll_deg: undefined
};

export function buildAutologRow(latestSnapshot, nowUtcTopOfHour) {
  const ts = formatUtcNoSeconds(nowUtcTopOfHour);
  const live = latestSnapshot?.live || {};

  const n = (liveVal, staleKey) =>
    Number.isFinite(liveVal) ? round3(liveVal)
    : (STALE_DEFAULTS[staleKey] != null ? STALE_DEFAULTS[staleKey] : null);

  return {
    "Timestamp": ts,
    "Crew": NO_ENTRY,
    "Autopilot": NO_ENTRY,
    "Propulsion": NO_ENTRY,
    "Visibility": NO_ENTRY,
    "Sea_state": NO_ENTRY,
    "Observations": "",

    "Lat": n(undefined, "lat"),
    "Lon": n(undefined, "lon"),
    "COG (°T)": n(undefined, "cog_true_deg"),
    "HdgMag (°)": n(undefined, "hdg_mag_deg"),
    "HdgTrue (°)": n(undefined, "hdg_true_deg"),
    "SOG (kt)": n(undefined, "sog_kt"),

    "AWS (kt)": n(undefined, "aws_kt"),
    "TWS (kt)": n(undefined, "tws_kt"),
    "TWD (°T)": n(undefined, "twd_true_deg"),

    "Temp (°C)": n(live.temp_c, "temp_c"),
    "Pres (mbar)": n(live.pres_mbar, "pres_mbar"),
    "Dew (°C)": n(live.dew_c, "dew_c"),
    "Hum (%)": n(live.hum_pct, "hum_pct"),
    "Pitch (°)": n(live.pitch_deg, "pitch_deg"),
    "Roll (°)": n(live.roll_deg, "roll_deg"),

    "_snapshot_ts": latestSnapshot?.timestamp_utc ?? null
  };
}

function formatUtcNoSeconds(dateOrMs) {
  const d = (dateOrMs instanceof Date) ? dateOrMs : new Date(dateOrMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
}

function round3(x) { return Math.round(x * 1000) / 1000; }
