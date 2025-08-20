// Inserts an autolog row using the sqlite3 CLI runner. No deps.

import path from "node:path";
import { runSql, escapeSqlString } from "../../utils/sqlite/run.js";

export async function insertAutolog(dbDir, row) {
  const dbPath = path.join(dbDir, "db.sqlite3");

  const val = (v) => v === null || v === undefined ? "NULL"
    : (typeof v === "number" ? String(v) : `'${escapeSqlString(v)}'`);

  const sql = `
INSERT INTO autolog (
  timestamp_utc, crew, autopilot, propulsion, visibility, sea_state, observations,
  lat, lon, cog_true_deg, hdg_mag_deg, hdg_true_deg,
  sog_kt, aws_kt, tws_kt, twd_true_deg,
  temp_c, pres_mbar, dew_c, hum_pct,
  pitch_deg, roll_deg, voyage_id
) VALUES (
  ${val(row["Timestamp"])},
  ${val(row["Crew"])},
  ${val(row["Autopilot"])},
  ${val(row["Propulsion"])},
  ${val(row["Visibility"])},
  ${val(row["Sea_state"])},
  ${val(row["Observations"])},
  ${val(row["Lat"])}, ${val(row["Lon"])},
  ${val(row["COG (°T)"])}, ${val(row["HdgMag (°)"])}, ${val(row["HdgTrue (°)"])},
  ${val(row["SOG (kt)"])}, ${val(row["AWS (kt)"])}, ${val(row["TWS (kt)"])}, ${val(row["TWD (°T)"])},
  ${val(row["Temp (°C)"])}, ${val(row["Pres (mbar)"])}, ${val(row["Dew (°C)"])}, ${val(row["Hum (%)"])},
  ${val(row["Pitch (°)"])}, ${val(row["Roll (°)"])},
  NULL
);
`;
  try {
    await runSql(dbPath, sql);
    return { ok: true };
  } catch (e) {
    // UNIQUE(timestamp_utc) protection will throw here on duplicates
    return { ok: false, error: e.message || String(e) };
  }
}
