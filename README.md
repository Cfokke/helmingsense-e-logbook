# HelmingSense E-Logbook

A lightweight electronic ship’s logbook with auto-logging from SignalK and manual enrichment via web forms.  
Designed for yacht use: offline-first, simple CSV/SQLite storage, and a clean viewer optimized for cockpit/iPad.

---

## Features (v0.4.6)

- **Autologs (hourly)**  
  - Top-of-the-hour autologging from SignalK snapshot.  
  - Full mapping of navigation, wind, environment sensors.  
  - Stale fallback values highlighted.  

- **Manual logs (skipper input)**  
  - Entry form served at `http://localhost:8090/`  
  - Mobile-friendly design (iPhone/iPad tested).  
  - Nautical styled UI with consistent widths + wrapping text.  
  - Immediate enrichment of manual entries with latest autolog data.  

- **Merged log viewer**  
  - Unified table view served at `http://localhost:8081/merged.html`.  
  - Chronological rows: autologs (green tint) and manual logs (red tint).  
  - Column grouping for readability: Time | Position | COG/SOG | HdgMag/HdgTrue | AWS/TWS/TWD | Temp/Pres/Hum | Pitch/Roll | Crew | APilot | Prop | Vis | Sea | Observations.  
  - Toggles to filter Autologs/Manuals instantly.  
  - CSV export + Print-ready output for legal logbook copies.  
  - Soft-edge nautical theme (new in v0.4.4).  

- **Data export & persistence**  
  - SQLite database (`data/db.sqlite3`) as ground truth.  
  - CSV exports for autolog, manual log, and merged log.  
  - Automatic regeneration on each new entry.  

- **Automation**  
  - Systemd services for autolog, viewer, and manual servers.  
  - On-change triggers ensure merged CSVs are always up to date.  

---


---

## Quickstart

```bash
# Run viewer (merged logs at :8081)
npm run serve:viewer

# Run manual entry form (at :8090)
npm run serve:manual

# Trigger an autolog manually
node bin/autolog-once.js

_______________UPDATE 30-08-2025_____________________

# HelmingSense E-Logbook

An electronic logbook system designed for yachts.  
Features both **autologs** (automatic hourly entries from instruments via SignalK) and **manual logs** (crew-entered).  
Supports merged viewing, CSV export, and print-friendly output.

---

## Features

- Autolog entries written hourly with live navigation, wind, BME, and IMU data (with stale fallbacks).
- Manual entries enriched automatically with the latest navigation/environmental data.
- Viewer web UI (on :8081) shows autologs, manuals, and merged log:
  - Table grid with row tinting (green = autolog, red = manual).
  - Observations shown in a clean sub-row (grey text).
  - Top and bottom scrollbars for wide tables.
  - CSV download and print/export buttons.
  - Auto-refresh every 60 seconds (as of v0.4.6).
- Manual entry page (on :8090) styled for nautical use, works well on iPhone/iPad.
- SQLite database backend with CSV exporters (`auto_log.csv`, `manual_log.csv`, `merged_log.csv`).
- Systemd services for autolog loop, manual entry server, viewer server, and merged export trigger.

---

## Running

From project root:

```bash
# Kill any stale processes
./bin/kill-ports.sh || true

# Start services (via systemd)
sudo systemctl restart elog-autolog.service \
                      elog-manual.service \
                      elog-viewer.service \
                      elog-merged-export.path
Versions

v0.4.6 — merged viewer now auto-refreshes every 60s in Edge and mobile (no third-party needed).

v0.4.5 — merged viewer polished: obs-row (grey), top scrollbar, full-width layout, sea column fixed.

v0.4.4 — styled manual entry (nautical UI), favicon/icons unified across viewers.

v0.4.3 — manual log auto-enrichment from latest autolog row.

v0.4.2 — systemd path unit for merged CSV auto-export.

v0.4.1 — systemd automation: services for autolog, snapshot, viewer.

v0.4.0 — first full functioning e-logbook (manual + autolog + merged viewer).

v0.3.0 — stable autolog + manual with CSV export.

v0.2.1 — viewer with stale/live font rendering.

v0.2.0 — initial release with autolog only.

License

MIT (c) 2025 Chris Fokke
