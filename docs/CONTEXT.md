# HelmingSense E‑Logbook — CONTEXT

Purpose
- This file fixes the current goal, task, acceptance criteria, boundaries, and the very next file to touch, so we can re‑sync quickly even if chat context is lost.

Meta
- Owner: Cfokke
- Repo: Cfokke/helmingsense-e-logbook
- Today: 2025‑08‑19 (UTC)

Phase Goal (current phase)
- Stand up the project skeleton and guardrails to rebuild the e‑logbook MVP (minute snapshots, hourly autologs, manual logs, dual viewer, voyage distances) with safe dev→prod and full rollback.

Outcome for this mini‑iteration
- Agree the complete directory tree and interaction map before writing any app code.

Current Task
- Draft DIRECTORY-TREE.md that documents:
  - The repository structure (folders and key files) and their purposes
  - How data flows end‑to‑end: Signal K → snapshot (minute) → DB → CSV exports → viewer
  - Where dev/prod deploy paths live (/opt/helmingsense structure on device)
  - The 600‑line file rule and refactor policy

Acceptance Criteria
- DIRECTORY-TREE.md is created at repo root, under 600 lines
- Includes an ASCII tree and a compact data‑flow diagram
- Contains short rationales for each top‑level directory
- Adds no executable code or dependencies; documentation only

Boundaries
- Do NOT create directories or code yet; only the documentation file
- Defer CI, systemd units, and templates to later PRs

Next File to Touch
- DIRECTORY-TREE.md (documentation only)

Open Questions (for Cfokke)
- Signal K endpoint (URL/port) and whether a token is required (default often http://localhost:3000)
- Confirm MVP autolog field list (currently: Timestamp, Crew, Autopilot, Propulsion, Visibility, Sea_state, Observations, Lat, Lon, COG (°T), HdgMag (°), HdgTrue (°), SOG (kt), AWS (kt), TWS (kt), TWD (°T), Temp (°C), Pres (mbar), Dew (°C), Hum (%), Name). Add/remove RPM, Depth, Battery?
- CSV timestamp format: DD‑MM‑YYYY HH:MM in 24h; store UTC and display local?
- Snapshot retention: rolling 24h file vs daily‑rotated files
- Preferred local URL/port on OTUS (e.g., http://otus:8080)

Decisions Agreed So Far
- CSV stores angles in degrees (not radians)
- SQLite is source of truth; CSVs are derived/exports
- Store times in UTC; display in local time as needed

Focus/Context Re‑sync Trigger
- If discussion drifts, we pause and restate: Goal → Current Task → Acceptance → Next File to Touch. If still unclear, we open an issue and update CONTEXT.md accordingly.