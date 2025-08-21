// Tiny manual log form server (dev only). No deps.
// GET / -> form; POST /submit -> insert, then export CSV.

import http from "node:http";
import { loadConfig } from "../../utils/config/load.js";
import { validateConfig } from "../../utils/config/validate.js";
import { insertManual } from "./store_db.js";
import { spawn } from "node:child_process";

const enums = {
  crew: ["1","2","3","4","5","6"],
  autopilot: ["off","standby","engaged","wind"],
  propulsion: ["drift","sailing","motor-sailing","under engine","Heave-to"],
  visibility: ["excellent","good","fair","poor","fog"],
  sea_state: ["smooth","slight","moderate","rough","very-rough"]
};

function nowUtcNoSeconds() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,"0");
  const dd = String(d.getUTCDate()).padStart(2,"0");
  const hh = String(d.getUTCHours()).padStart(2,"0");
  const mi = String(d.getUTCMinutes()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}Z`;
}

function formHtml() {
  const opts = (arr)=>arr.map(v=>`<option value="${v}">${v}</option>`).join("");
  return `<!doctype html><html><body>
  <h3>Manual Log Entry</h3>
  <form method="POST" action="/submit">
    <label>Crew</label><select name="Crew">${opts(enums.crew)}</select><br/>
    <label>Autopilot</label><select name="Autopilot">${opts(enums.autopilot)}</select><br/>
    <label>Propulsion</label><select name="Propulsion">${opts(enums.propulsion)}</select><br/>
    <label>Visibility</label><select name="Visibility">${opts(enums.visibility)}</select><br/>
    <label>Sea_state</label><select name="Sea_state">${opts(enums.sea_state)}</select><br/>
    <label>Observations</label><input name="Observations" size="60"/><br/>
    <button type="submit">Save</button>
  </form>
  </body></html>`;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => data += chunk.toString());
    req.on("end", () => {
      const params = new URLSearchParams(data);
      const obj = {};
      for (const [k,v] of params) obj[k] = v;
      resolve(obj);
    });
  });
}

function exportManualCsv() {
  // Call our exporter script through npm or directly
  const child = spawn(process.execPath, ["bin/export-manual-csv.js"], { stdio: "inherit" });
  child.on("close", ()=>{});
}

async function start() {
  const { config, error } = loadConfig();
  const { ok, errors } = validateConfig(config);
  if (!ok) {
    console.error("Invalid config:", errors);
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, {"content-type":"text/html; charset=utf-8"});
      res.end(formHtml());
      return;
    }
    if (req.method === "POST" && req.url === "/submit") {
      const body = await parseBody(req);

      // Validate enums
      const bad = [];
      const chk = (key, set) => { if (!set.includes(body[key])) bad.push(key); };
      chk("Crew", enums.crew);
      chk("Autopilot", enums.autopilot);
      chk("Propulsion", enums.propulsion);
      chk("Visibility", enums.visibility);
      chk("Sea_state", enums.sea_state);

      if (bad.length) {
        res.writeHead(400, {"content-type":"text/plain"});
        res.end("Invalid fields: " + bad.join(", "));
        return;
      }

      // Build DB row (numeric nav fields null for now)
      const row = {
        "Timestamp": nowUtcNoSeconds(),
        "Crew": body.Crew,
        "Autopilot": body.Autopilot,
        "Propulsion": body.Propulsion,
        "Visibility": body.Visibility,
        "Sea_state": body.Sea_state,
        "Observations": body.Observations ?? "",
        "Lat": null, "Lon": null,
        "COG (°T)": null, "HdgMag (°)": null, "HdgTrue (°)": null,
        "SOG (kt)": null, "AWS (kt)": null, "TWS (kt)": null, "TWD (°T)": null,
        "Temp (°C)": null, "Pres (mbar)": null, "Dew (°C)": null, "Hum (%)": null,
        "Pitch (°)": null, "Roll (°)": null
      };

      const ins = await insertManual(config.exports.dir, row);
      if (!ins.ok) {
        res.writeHead(500, {"content-type":"text/plain"});
        res.end("DB insert failed: " + ins.error);
        return;
      }

      exportManualCsv(); // fire-and-forget regeneration
      res.writeHead(302, {"Location": "/"});
      res.end();
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  const PORT = process.env.MANUAL_PORT ? Number(process.env.MANUAL_PORT) : 8090;
  server.listen(PORT, () => {
    console.log(`[manual] form server http://localhost:${PORT}/`);
  });
}

start();
