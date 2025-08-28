# HelmingSense E-Logbook — Changelog

## v0.4.3 — 2025-08-28
**Manual + Micro-Autolog Pairing**
- Added systemd `.path` trigger that runs `bin/on-db-change.js` whenever `db.sqlite3` changes.
- On manual log insert, if the latest manual is newer than the latest autolog, a **micro-autolog row** is captured using `bin/autolog-once.js`.
- Merged CSV export runs automatically after every DB change.
- Result: manual logs are preserved verbatim (legal record), and an autolog row with identical timestamp records fresh instrument data.

## v0.4.2 — 2025-08-28
**Export on Change**
- Replaced 1-minute polling timer with systemd `.path` trigger on `db.sqlite3`.
- Any DB write (manual or autolog) immediately triggers merged CSV export.

## v0.4.1 — 2025-08-28
**Systemd Automation**
- Added long-running services:
  - `elog-manual.service` → manual entry server (8090).
  - `elog-viewer.service` → viewer (8081).
  - `elog-autolog.service` → hourly autolog loop.
- Added timer to export merged CSV every minute.
- System runs unattended after boot.

## v0.4.0 — 2025-08-28
**Merged Viewer**
- New merged viewer (`merged.html`) shows autolog + manual logs in one table.
- Features:
  - Row tints (green=autolog, red=manual).
  - Show/hide toggles for autolog/manual.
  - CSV download button.
  - Print stylesheet (A4 landscape, repeating header, tints preserved).
- Viewer server extended to serve `/merged.html` and merged CSVs.

