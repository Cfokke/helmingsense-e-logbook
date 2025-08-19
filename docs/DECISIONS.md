# HelmingSense E‑Logbook — Decisions (ADRs)

This document records key decisions for the MVP. Each entry includes status, context, decision, and consequences. Changes require a new ADR entry with status "Supersedes".

References
- Signal K data snapshots and deltas: see the images attached to the PR for raw paths/units and update patterns.
- System charter, context, and directory tree: see SYSTEM-CHARTER.md, CONTEXT.md, and DIRECTORY-TREE.md.

---

ADR-0001 — Source of Truth and Exports
- Status: Accepted
- Context: We persist minute snapshots and generate hourly autologs and manual logs; CSVs are convenient for review/export but can drift if edited.
- Decision: SQLite is the canonical store. CSVs (auto_log.csv, manual_log.csv) are derived from DB and regenerated on demand.
- Consequences: Any edits must happen via the app/API and be persisted to DB; CSVs are read-only artifacts.

ADR-0002 — Timekeeping and Timestamps
- Status: Accepted
- Context: Signal K and sensors provide timestamps; consistent storage/display is critical across devices/timezones.
- Decision: Store all times in UTC. External representation in CSV uses ISO 8601 extended with trailing Z (e.g., 2025-06-26T14:44:25Z). UI may display local time.
- Consequences: No local-time in storage; conversions happen at display/export layers only.

ADR-0003 — Units and Conversions
- Status: Accepted
- Context: Signal K commonly reports angles in radians, speeds in m/s, temperature in Kelvin; logs are friendlier in deg/kt/°C.
- Decision:
  - Angles: store/export in degrees. Convert using deg = rad × 180/π. Round to 1 decimal for display, 3 decimals in CSV when sourced from radians.
  - Speeds: store/export in knots. Convert using kt = m/s × 1.943844. Round to 2 decimals.
  - Temperature: store/export in °C. Convert using °C = K − 273.15. Round to 1 decimal.
  - Pressure: store/export in millibar (hPa). If Pa provided, mbar = Pa / 100. Round to 1 decimal.
  - Humidity: store/export as percentage 0–100. If ratio 0–1 provided, pct = ratio × 100. Round to 0 decimals.
- Consequences: A shared units utility is required; CSV headers indicate units explicitly (e.g., sog_kt, hdg_true_deg).

ADR-0004 — Signal K Connectivity and Auth
- Status: Accepted
- Context: MVP runs on a trusted LAN at home and on board; admin UI is at /admin, data at /signalk.
- Decision: Base URL http://localhost:3000 for MVP; no token by default. Config supports an optional token for later hardening.
- Consequences: Config file includes signalk.base_url and optional signalk.token; network policy must secure access when deployed.

ADR-0005 — MVP Autolog Columns and Signal K Path Mapping
- Status: Accepted
- Context: We want a stable hourly log that is meaningful without GPS/AIS at home, and richer when fully connected. Screenshots confirm available fields/units.
- Decision: Lock the following CSV columns and map them to Signal K paths with conversions as needed.
  - timestamp: ISO 8601 UTC. Prefer navigation.datetime; else system clock at autolog tick.
  - crew: enum (see ADR-0006).
  - autopilot: enum (see ADR-0006).
  - propulsion: enum (see ADR-0006).
  - visibility: enum (see ADR-0006).
  - sea_state: enum (see ADR-0006).
  - observations: free text.
  - lat: navigation.position.latitude (flatten JSON).
  - lon: navigation.position.longitude (flatten JSON).
  - cog_true_deg: navigation.courseOverGroundTrue (rad→deg) if present.
  - hdg_mag_deg: navigation.headingMagnetic (rad→deg) if present.
  - hdg_true_deg: navigation.headingTrue (rad→deg) if present.
  - sog_kt: navigation.speedOverGround (m/s→kt) if present.
  - environment.inside.temperature_C: environment.self.inside.*.temperature (K→°C) choosing the primary cabin sensor.
  - environment.inside.pressure_mbar: environment.self.inside.*.pressure (Pa→mbar if needed).
  - environment.inside.dewPointTemperature_C: environment.self.inside.*.dewPointTemperature (K→°C).
  - environment.inside.humidity_pct: environment.self.inside.*.humidity (ratio→%).
  - navigation.pitch_deg: navigation.pitch (rad→deg) if present.
  - navigation.roll_deg: navigation.roll (rad→deg) if present.
- Consequences: CSV remains compact and comparable across sessions; fields gracefully empty if not available.

ADR-0006 — Enumerations for Manual and Derived Fields
- Status: Accepted (defaults editable via config)
- Context: Manual log uses dropdowns; consistency helps analysis while allowing later customization.
- Decision (default sets):
  - crew: integers 0–8 (count of persons on board).
  - autopilot: [engaged, standby, off].
  - propulsion: [Sailing, Motor-sailing, Under Engine, Drift, At Anchor].
  - visibility: [Good, Fair, Poor, Fog].
  - sea_state: [Calm, Smooth, Slight, Moderate, Rough, Very Rough, High].
- Consequences: Config will expose these lists; CSV stores the literal values.

ADR-0007 — Optional Fields (default: disabled)
- Status: Accepted
- Context: Additional sensors (RPM, Depth, Battery, Wind TWS/TWD) are available but not critical to the first autolog cut.
- Decision: Provide optional columns, disabled by default, that can be enabled via config:
  - engine_rpm (path e.g., propulsion.engine.revolutions)
  - depth_m (path e.g., environment.depth.belowTransducer)
  - battery_voltage_V, battery_soc_pct (electrical.*)
  - tws_kt, twd_true_deg, aws_kt (environment.wind.* with conversions)
- Consequences: Enabling adds columns to CSV and corresponding snapshot fields; defaults keep MVP focused.

ADR-0008 — Snapshot Files and Retention
- Status: Accepted
- Context: Snapshots aid debugging and offline review; files can grow large.
- Decision: Write minute snapshots to /opt/helmingsense/data/snapshots/YYYY-MM-DD.json (UTC date). Rotate daily and keep the last 14 days by default.
- Consequences: Simple cleanup policy; DB remains the durable store.

ADR-0009 — Missing Data and Rounding Policy
- Status: Accepted
- Decision: Missing Signal K values render as empty CSV cells (no zeros). Rounding: see ADR-0003. Position prints 5 decimals (≈1.1 m).
- Consequences: Avoids misleading zeros; stable human-friendly precision.

ADR-0010 — Autolog Tick Behavior
- Status: Accepted
- Decision: Autolog runs at top of the hour using UTC. For each column, use the latest snapshot at or before the tick within a 2‑minute look‑back window; else leave blank.
- Consequences: Robust to small delays while preventing stale data.

ADR-0011 — CSV Column Naming and Ordering
- Status: Accepted
- Decision: Use snake_case with unit suffixes where applicable; fixed order as listed in ADR‑0005. Header row always present.
- Consequences: Stable schema for downstream tools.

ADR-0012 — Configuration Surface (documentation-only for now)
- Status: Accepted
- Decision: Expose in config.yaml: signalk.base_url, signalk.token, snapshot_interval_sec, autolog_on_the_hour, fields[], optional_fields[], csv_timestamp_format, snapshot_retention_days, preferred_inside_sensor.
- Consequences: Behavior can be tuned without code changes in later PRs.

---

Change Control
- Any change to a decision creates a new ADR entry with Status: Accepted and a "Supersedes: ADR-XXXX" note.
- Keep this file under 600 lines; split into ADR files if it grows too large.