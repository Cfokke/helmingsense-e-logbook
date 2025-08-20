# HelmingSense E‑Logbook — Directory Tree and Data Flow

Purpose
- Document the repository layout, on‑device layout, and end‑to‑end data flow before writing app code.
- Keep files small and focused; refactor before any file exceeds 600 lines.

Repo Layout (proposed; documentation only)
```
helmingsense-e-logbook/
├─ app/                      # Application code (later PRs)
│  ├─ services/
│  │  ├─ snapshot/           # Minute-by-minute Signal K snapshotter
│  │  ├─ autolog/            # Top-of-hour autolog generator
│  │  ├─ manual/             # Manual entry handling
│  │  └─ voyage/             # Voyage start/stop, leg and voyage NM
│  ├─ web/
│  │  ├─ api/                # REST endpoints (FastAPI), local-only
│  │  └─ ui/                 # Dual viewer (table + card views)
│  ├─ db/
│  │  ├─ migrations/         # Schema migrations (SQLite)
│  │  └─ seed/               # Dev-only seed data
│  └─ utils/                 # Shared helpers (units, haversine, time)
├─ config/
│  ├─ config.example.yaml    # Example configuration (see snippet below)
│  └─ schemas/               # JSON/YAML schemas for config validation
├─ data/                     # Dev runtime data (gitignored)
│  └─ .gitkeep
├─ docs/
│  ├─ SYSTEM-CHARTER.md
│  ├─ CONTEXT.md
│  ├─ DIRECTORY-TREE.md      # This file
│  ├─ DECISIONS.md           # Succinct ADRs
│  └─ BACKLOG.md             # Ordered backlog and notes
├─ scripts/
│  ├─ smoke-test.sh          # On-device smoke checks (later)
│  ├─ release.sh             # Create versioned release bundle (later)
│  └─ dev-run.sh             # Local run helpers (later)
├─ packaging/
│  ├─ systemd/helmingsense.service   # Service unit (later)
│  └─ install/               # Install/uninstall helpers (later)
├─ tests/
│  ├─ unit/
│  └─ integration/
├─ .github/
│  ├─ CODEOWNERS
│  ├─ pull_request_template.md
│  └─ workflows/ci.yml       # Lint, tests, file-length guard
├─ LICENSE
└─ README.md
```

On‑Device Layout (production)
```
/opt/helmingsense/
├─ releases/
│  ├─ vX.Y.Z/
│  │  ├─ bin/start                  # Entrypoint
│  │  ├─ app/ ...                   # Code for that release
│  │  └─ VERSION
│  └─ vA.B.C/ ...
├─ current -> /opt/helmingsense/releases/vX.Y.Z
├─ data/
│  ├─ db.sqlite3
│  ├─ auto_log.csv
│  ├─ manual_log.csv
│  └─ signalk_snapshot.json         # Minute updates; may rotate daily
├─ logs/
│  └─ helmingsense.log
└─ config.yaml                      # May symlink to /etc/helmingsense/config.yaml

/etc/helmingsense/config.yaml       # Canonical config (root-writable)
/etc/systemd/system/helmingsense.service
```

Signal K and Runtime Assumptions (current)
- Base URL: http://localhost:3000
- Admin UI is at /admin; API and WS live under /signalk
- Auth: none for MVP on trusted LAN (token optional later)
- Time: store UTC; display local as needed
- Snapshots: retain last 24h only (JSON pruned to a rolling 24h window). DB/CSV are permanent.

Autolog MVP Columns (proposal to lock)
- timestamp (UTC, ISO 8601)
- crew (enum)
- autopilot (enum: engaged/standby/off/…)
- propulsion (enum: Sailing/Motor-sailing/Under Engine/Drift/…)
- visibility (enum)
- sea_state (enum)
- observations (free text)
- lat, lon
- cog_true_deg, hdg_mag_deg, hdg_true_deg, sog_kt
- environment.inside.temperature_C
- environment.inside.pressure_mbar
- environment.inside.dewPointTemperature_C
- environment.inside.humidity_pct
- navigation.pitch_deg, navigation.roll_deg
Notes
- CSV uses degrees for angles (convert from Signal K if source is radians).
- When GPS/AIS/Seatalk are offline, lat/lon/cog/hdg/sog may be blank; that's okay.

End‑to‑End Data Flow (MVP)
```
Signal K (WS/HTTP)  -->  snapshot_service (every minute)  -->  DB (SQLite)
                                                │
Top-of-hour tick  -->  autolog_service  --------┘         -->  regenerate auto_log.csv
Manual form (UI)  -->  manual_service  ------------------->  DB  -->  regenerate manual_log.csv

Viewer (UI) reads DB for chronological stream; exports/print from CSV/DB.
Voyage service computes Leg_NM from successive hourly autolog positions; Voyage_NM is the sum.
```

Configuration (example – documentation only, not installed yet)
```yaml
signalk:
  base_url: "http://localhost:3000"
  token: ""          # optional; empty means none on trusted LAN
  timeout_sec: 5

sampling:
  snapshot_interval_sec: 60
  autolog_on_the_hour: true
  fields:             # Signal K paths to snapshot
    - environment.inside.temperature
    - environment.inside.pressure
    - environment.inside.dewPointTemperature
    - environment.inside.humidity
    - navigation.pitch
    - navigation.roll
    # GPS/AIS/Seatalk fields will appear when the bridge is connected

exports:
  dir: "/opt/helmingsense/data"
  csv_timestamp_format: "YYYY-MM-DDTHH:mmZ"   # stored in UTC- no seconds (ISO 8601)

viewer:
  auto_refresh_sec: 3600
  local_base_url: "http://localhost:8080"        # UI port
```

Guardrails
- No source file > 600 lines; CI will fail the PR if exceeded.
- Small, reversible steps; each PR changes one file or one atomic step.
- SQLite is the source of truth; CSVs are regenerated from DB.

Open Items to Confirm (based on current info)
- Keep "no token" for MVP? If token appears later, we'll add it to config.yaml.
- Finalize enum values for crew/autopilot/propulsion/visibility/sea_state.
- Rotate snapshot file daily vs rolling 24h?
