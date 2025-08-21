// app/services/autolog/build_row.js
// Builds an autolog row object. Uses live snapshot values where available.
// Uses config.defaults.stale_values for everything else (no nulls in CSV).

import { loadConfig } from "../../utils/config/load.js";

const NO_ENTRY = "No entry";

export function buildAutologRow(latestSnapshot, nowUtcTopOfHour) {
  const ts = formatUtcNoSeconds(nowUtcTopOfHour);
  const { config } = loadConfig();
  const stale = (config?.defaults?.stale_values) || {};

  const live = latestSnapshot?.live || {};

  // prefer live value if it's a finite number; else stale default; else null (viewer will render as red "—")
  const n = (liveVal, staleVal) =>
    Number.isFinite(liveVal) ? round3(liveVal)
    : (staleVal != null ? staleVal : null);

  return {
    "Timestamp": ts,
    "Crew": NO_ENTRY,
    "Autopilot": NO_ENTRY,
    "Propulsion": NO_ENTRY,
    "Visibility": NO_ENTRY,
    "Sea_state": NO_ENTRY,
    "Observations": "",

    "Lat": n(undefined, stale.lat),
    "Lon": n(undefined, stale.lon),
    "COG (°T)": n(undefined, stale.cog_true_deg),
    "HdgMag (°)": n(undefined, stale.hdg_mag_deg),
    "HdgTrue (°)": n(undefined, stale.hdg_true_deg),
    "SOG (kt)": n(undefined, stale.sog_kt),

    // live environment / attitude
    "AWS (kt)": n(undefined, stale.aws_kt),
    "TWS (kt)": n(undefined, stale.tws_kt),
    "TWD (°T)": n(undefined, stale.twd_true_deg),

    "Temp (°C)": n(live.temp_c, stale.temp_c),
    "Pres (mbar)": n(live.pres_mbar, stale.pres_mbar),
    "Dew (°C)": n(live.dew_c, stale.dew_c),
    "Hum (%)": n(live.hum_pct, stale.hum_pct),
    "Pitch (°)": n(live.pitch_deg, stale.pitch_deg),
    "Roll (°)": n(live.roll_deg, stale.roll_deg),

    "_snapshot_ts": latestSnapshot?.timestamp_utc ?? null
  };
}

function formatUtcNoSeconds(dateOrMs) {
  const d = (dateOrMs instanceof Date) ? dateOrMs : new Date(dateOrMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours() + 0).padStart(2, "0"); // already UTC
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
}

function round3(x) { return Math.round(x * 1000) / 1000; }
