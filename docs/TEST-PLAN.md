# HelmingSense E‑Logbook — Test Plan (MVP, docs-only)

Purpose: a concise checklist to validate contracts & behaviours before runtime code.

---

## A. Config Validation (static)
- [ ] `config.example.yaml` conforms to `docs/SCHEMAS.md` JSON Schema.
- [ ] `signalk.base_url` is a valid URI and points to `/signalk/v1/api/vessels/self`.
- [ ] `sampling.snapshot_interval_sec >= 10` and is `60` for MVP.
- [ ] `exports.csv_timestamp_format` is exactly `YYYY-MM-DDTHH:mmZ`.
- [ ] `viewer.local_base_url` is `http://localhost:8080`.

## B. CSV Contract Validation (static)
- [ ] `auto_log.csv` and `manual_log.csv` headers exactly match `SCHEMAS.md` (order + names).
- [ ] Manual enums allowed values:
      crew: 1,2,3,4,5,6
      autopilot: off,standby,engaged,wind
      propulsion: drift,sailing,motor-sailing,under engine, Heave-to
      visibility: excellent,good,fair,poor,fog
      sea_state: smooth,slight,moderate,rough,very-rough
- [ ] Timestamp strings match `YYYY-MM-DDTHH:mmZ` and are UTC.

## C. Snapshot Retention Behaviour (design expectation)
- [ ] Snapshot store retains only last 24h (rolling window).
- [ ] DB/CSV persist indefinitely (no auto-prune).

## D. Unit-Level Expectations (to inform future tests)
- Snapshot service:
  - [ ] Converts pitch/roll to degrees if needed.
  - [ ] Handles missing sensors (leaves blanks) without failing.
- Autolog service:
  - [ ] Emits exactly one row per top-of-hour tick (idempotent via UNIQUE timestamp).
  - [ ] Uses enums exactly as specified (reject otherwise).
- Manual service:
  - [ ] Accepts dropdown values + free text observations.
  - [ ] Optionally associates latest autolog for context (no effect on voyage calc).
- Voyage calc:
  - [ ] Computes Leg_NM only between hourly autologs (Haversine).
  - [ ] Ignores manual-associated autologs for distance.

## E. Pre-Deploy Smoke (on-device, later)
- [ ] `/opt/helmingsense` exists with `releases/`, `current` symlink, `data/`, `logs/`.
- [ ] `config.yaml` present (or symlinked from `/etc/helmingsense/config.yaml`).
- [ ] Service starts, writes DB, regenerates CSV, prunes snapshots (24h).

---

**Working rule:** update this file when behaviours or contracts change. Keep it <600 lines.
