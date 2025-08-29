# HelmingSense E-Logbook

A lightweight electronic ship’s logbook with auto-logging from SignalK and manual enrichment via web forms.  
Designed for yacht use: offline-first, simple CSV/SQLite storage, and a clean viewer optimized for cockpit/iPad.

---

## Features (v0.4.4)

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

## Versions

- **v0.4.4** — Stable release with **styled manual entry page** (mobile-ready), nautical UI refinements, soft-edge merged viewer.  
- **v0.4.3** — Stable release with **manual entries enriched** with latest autolog values; auto CSV/print export.  
- **v0.4.2** — Stable release with autolog + manual services automated via systemd.  
- **v0.4.1** — Stable release with services auto-started (viewer, manual, autolog).  
- **v0.4.0** — First stable merged viewer with tinting, filters, and exports.  

Older tags (v0.2.x, v0.3.0) remain for reference.

---

## Quickstart

```bash
# Run viewer (merged logs at :8081)
npm run serve:viewer

# Run manual entry form (at :8090)
npm run serve:manual

# Trigger an autolog manually
node bin/autolog-once.js

