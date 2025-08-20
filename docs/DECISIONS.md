# HelmingSense E‑Logbook — DECISIONS (ADRs)

> Succinct record of decisions. Each item: context → decision → impact.  
> Status: Accepted unless noted. Dates UTC.

---

## ADR-0001 — Source of Truth & CSVs
- **Date:** 2025‑08‑20
- **Context:** We need durable storage and easy exports.
- **Decision:** SQLite is the **source of truth**. CSVs (`auto_log.csv`, `manual_log.csv`) are **derived** and can be regenerated.
- **Impact:** Services write to DB; exporters regenerate CSVs; no manual edits to CSV.

---

## ADR-0002 — Snapshot Retention
- **Date:** 2025‑08‑20
- **Context:** Minute snapshots can grow quickly.
- **Decision:** Keep **last 24h only** of `signalk_snapshot.json` (rolling window). DB/CSV remain indefinitely.
- **Impact:** Snapshot service prunes; no daily rotation needed for MVP.

---

## ADR-0003 — Timestamps & Timezone
- **Date:** 2025‑08‑20
- **Context:** Consistent time across pipeline and UI.
- **Decision:** Store timestamps in **UTC**, **no seconds** → `YYYY-MM-DDTHH:mmZ` (ISO 8601). UI displays **local time**; fallback to UTC if needed.
- **Impact:** CSV/DB schemas use this format; UI converts for display.

---

## ADR-0004 — Manual Enums (Authoritative)
- **Date:** 2025‑08‑20
- **Context:** Manual log form needs constrained values.
- **Decision (exact strings):**
  - `crew`: `1, 2, 3, 4, 5, 6`
  - `autopilot`: `off, standby, engaged, wind`
  - `propulsion`: `drift, sailing, motor-sailing, under engine, Heave-to`
  - `visibility`: `excellent, good, fair, poor, fog`
  - `sea_state`: `smooth, slight, moderate, rough, very-rough`
  - `observations`: free text
- **Impact:** Validation rejects values outside these sets (case/spelling‑sensitive).

---

## ADR-0005 — Signal K Endpoint & Viewer Port
- **Date:** 2025‑08‑20
- **Context:** Services and UI need stable endpoints.
- **Decision:** Signal K base resource: `http://localhost:3000/signalk/v1/api/vessels/self` (no token for MVP). Viewer runs on **http://localhost:8080**.
- **Impact:** `config.yaml` reflects endpoint and port; token can be added later.

## ADR-0006 — Plural table names
- **Date:** 2025‑08‑20
- **Decision:** Use plural table names `autologs`, `manual_logs` (was singular).
- **Impact:** Migration 001 updated; helpers write to `autologs`. Docs reflect plural naming.
