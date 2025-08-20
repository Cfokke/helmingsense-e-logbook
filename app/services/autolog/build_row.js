// app/services/autolog/build_row.js
// Builds an autolog row object matching SCHEMAS.md headers & formats.
// We DO NOT map Signal K numeric fields yet (no guessing). We output nulls for them.
// The five "manual" fields default to "No entry" for autologs.

const NO_ENTRY = "No entry";

export function buildAutologRow(latestSnapshotUtc, nowUtcTopOfHour) {
  const ts = formatUtcNoSeconds(nowUtcTopOfHour);

  return {
    "Timestamp": ts,
    "Crew": NO_ENTRY,
    "Autopilot": NO_ENTRY,
    "Propulsion": NO_ENTRY,
    "Visibility": NO_ENTRY,
    "Sea_state": NO_ENTRY,
    "Observations": "",

    // Placeholders until we wire exact mapping from Signal K:
    "Lat": null,
    "Lon": null,
    "COG (°T)": null,
    "HdgMag (°)": null,
    "HdgTrue (°)": null,
    "SOG (kt)": null,
    "AWS (kt)": null,
    "TWS (kt)": null,
    "TWD (°T)": null,
    "Temp (°C)": null,
    "Pres (mbar)": null,
    "Dew (°C)": null,
    "Hum (%)": null,
    "Pitch (°)": null,
    "Roll (°)": null,

    // Traceability (keep a pointer to snapshot timestamp we used)
    "_snapshot_ts": latestSnapshotUtc?.timestamp_utc ?? null
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
