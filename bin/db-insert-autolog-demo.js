#!/usr/bin/env node
import { loadConfig } from "../app/utils/config/load.js";
import { insertAutolog } from "../app/services/autolog/store_db.js";

const { config } = loadConfig();
const now = new Date();
const ts = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}T${String(now.getUTCHours()).padStart(2,"0")}:${String(now.getUTCMinutes()).padStart(2,"0")}Z`;

const row = {
  "Timestamp": ts,
  "Crew": "No entry",
  "Autopilot": "No entry",
  "Propulsion": "No entry",
  "Visibility": "No entry",
  "Sea_state": "No entry",
  "Observations": "demo insert",
  "Lat": null, "Lon": null, "COG (°T)": null, "HdgMag (°)": null, "HdgTrue (°)": null,
  "SOG (kt)": null, "AWS (kt)": null, "TWS (kt)": null, "TWD (°T)": null,
  "Temp (°C)": null, "Pres (mbar)": null, "Dew (°C)": null, "Hum (%)": null,
  "Pitch (°)": null, "Roll (°)": null
};

const res = await insertAutolog(config.exports.dir, row);
console.log(res);
