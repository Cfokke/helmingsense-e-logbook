// app/services/autolog/build_row.js
// Builds an autolog row. Uses live values from the latest snapshot for
// Temp/Dew/Hum/Pres/Pitch/Roll. For nav/wind fields we use your anchor defaults
// (in-code) so we never emit blanks until those streams go live.

const NO_ENTRY = "No entry";

// Anchor defaults you provided (stale constants shown in viewer as 'stale')
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
};

export function buildAutologRow(latestSnapshot, nowUtcTopOfHour) {
  const ts = formatUtcNoSeconds(nowUtcTopOfHour);
  const live = latestSnapshot?.live || {};

  const liveNum = (x) => (Number.isFinite(x) ? round3(x) : null);
  const stale = (k) => STALE_DEFAULTS[k];

  return {
    "Timestamp": ts,
    "Crew": NO_ENTRY,
    "Autopilot": NO_ENTRY,
    "Propulsion": NO_ENTRY,
    "Visibility": NO_ENTRY,
    "Sea_state": NO_ENTRY,
    "Observations": "",

    // Stale (until we wire GPS/heading/wind deltas)
    "Lat": stale("lat"),
    "Lon": stale("lon"),
    "COG (°T)": stale("cog_true_deg"),
    "HdgMag (°)": stale("hdg_mag_deg"),
    "HdgTrue (°)": stale("hdg_true_deg"),
    "SOG (kt)": stale("sog_kt"),
    "AWS (kt)": stale("aws_kt"),
    "TWS (kt)": stale("tws_kt"),
    "TWD (°T)": stale("twd_true_deg"),

    // Live from snapshot.live
    "Temp (°C)":   liveNum(live.temp_c),
    "Pres (mbar)": liveNum(live.pres_mbar),
    "Dew (°C)":    liveNum(live.dew_c),
    "Hum (%)":     liveNum(live.hum_pct),
    "Pitch (°)":   liveNum(live.pitch_deg),
    "Roll (°)":    liveNum(live.roll_deg),

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
