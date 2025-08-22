#!/usr/bin/env node
import { loadConfig } from "../app/utils/config/load.js";
import { insertAutolog } from "../app/services/autolog/store_db.js";

const { config } = loadConfig();

function nowNoSecondsUtc() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,"0");
  const dd = String(d.getUTCDate()).padStart(2,"0");
  const hh = String(d.getUTCHours()).padStart(2,"0");
  const mi = String(d.getUTCMinutes()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}Z`;
}

const row = {
  "Timestamp": nowNoSecondsUtc(),
  "Crew": "No entry",
  "Autopilot": "No entry",
  "Propulsion": "sailing",
  "Visibility": "good",
  "Sea_state": "slight",
  "Observations": "demo insert (plural tables)",
  "Lat": null, "Lon": null, "COG (°T)": null, "HdgMag (°)": null, "HdgTrue (°)": null,
  "SOG (kt)": null, "AWS (kt)": null, "TWS (kt)": null, "TWD (°T)": null,
  "Temp (°C)": null, "Pres (mbar)": null, "Dew (°C)": null, "Hum (%)": null,
  "Pitch (°)": null, "Roll (°)": null
};

const res = await insertAutolog(config.exports.dir, row);
console.log(res);
