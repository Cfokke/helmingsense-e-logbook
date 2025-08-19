# HelmingSense E‑Logbook – System Charter

Mission
- Rebuild a robust, offline-capable e-logbook that integrates with Signal K, supports minute snapshots, hourly autologs, manual logs, a dual viewer, and voyage distance tracking, with safe dev→prod flow and full rollback.

Scope (MVP)
- Minute‑by‑minute Signal K snapshot to JSON
- Hourly autolog entries (selected fields) persisted and exported to auto_log.csv
- Manual log entries persisted and exported to manual_log.csv
- Dual viewer (table + card views) showing both streams chronologically, color‑coded
- Voyage tracking: Leg_NM between hourly autologs only; Voyage_NM sum; year totals
- Auto‑refresh dualviewer hourly and on manual submission
- Print/export‑friendly card view
- No internet dependency; runs on on‑board Ubuntu mini PC

Roles
- Skipper (Cfokke): domain authority, product owner, final approver for prod
- Primary coder (Copilot): implements changes, proposes structure, guards scope
- Change protocol: one change (one file or small atomic step) at a time; proceed only after confirmation

Working Rules
- File length cap: no source file exceeds 600 lines (CI guard enforces)
- Small, reversible steps; documented intent before implementation
- Every session syncs CONTEXT.md (Goal, Current Task, Success Criteria, Next File to Touch)
- If focus drifts: explicit "Re‑sync requested" with restated scope and acceptance criteria
- Decisions logged in DECISIONS.md (succinct ADRs)

Repository Strategy (Cfokke/helmingsense-e-logbook)
- Branches:
  - main = prod (protected, no direct pushes, requires review by Cfokke)
  - develop = dev (feature branches branch off here; more flexible)
- PR flow:
  - Feature branch → PR to develop (tests + file-length guard must pass)
  - Release PR: develop → main only after a tagged release candidate passes acceptance
- Versioning: semantic (v0.x.y); v0 for pre‑1.0
- Tags: every prod release is a Git tag; rollback by redeploying a previous tag

CI/CD Guardrails
- Checks on PRs: lint (Python), tests, build, file‑length guard (>600 lines fails)
- PR template requires: scope, acceptance criteria, affected files, validation notes
- CODEOWNERS: require Cfokke review for main merges
- Artifact build: release bundles with versioned tar.gz and checksums

Deployment & Rollback (On‑device)
- Install root: /opt/helmingsense
- Releases: /opt/helmingsense/releases/vX.Y.Z/
- Current symlink: /opt/helmingsense/current → releases/vX.Y.Z
- Data dir: /opt/helmingsense/data (SQLite db, CSV exports, snapshots)
- Service: systemd unit helmingsense.service runs /opt/helmingsense/current/bin/start
- Promote: replace "current" symlink atomically; restart service
- Rollback: repoint symlink to prior release; restart service
- Config: /etc/helmingsense/config.yaml (Signal K URL/port/token, field selection, intervals)

Data Model & Files
- Source of truth: SQLite database (robust, atomic)
- CSV exports:
  - data/auto_log.csv
  - data/manual_log.csv
- Snapshots:
  - data/signalk_snapshot.json (minute updates; optionally rotate daily)
- Exports are regenerated from DB to keep CSVs consistent with history

Initial Autolog CSV Headers (MVP)
- Timestamp, Crew, Autopilot, Propulsion, Visibility, Sea_state, Observations, Lat, Lon, COG (°T), HdgMag (°), HdgTrue (°), SOG (kt), AWS (kt), TWS (kt), TWD (°T), Temp (°C), Pres (mbar), Dew (°C), Hum (%), Name

E‑Logbook Semantics (MVP)
- Snapshot: every minute, capture configured Signal K paths to signalk_snapshot.json
- Autolog: every hour at hh:00, persist fields + computed values; export row to auto_log.csv
- Manual log: form submission persists and exports row to manual_log.csv (with free text)
- Dual viewer:
  - Table view: full chronological stream; autolog rows pastel green; manual rows pastel red
  - Card view: print/export friendly; same chronological order and coloring
  - Auto‑refresh: hourly tick and after manual submission
- Manual‑associated autolog:
  - Show latest autolog alongside a manual entry without interfering with the hourly schedule
  - Voyage distance calculations ignore any manual‑associated autologs (only top‑of‑hour autologs count)
- Voyages:
  - Start/Stop sets voyage_id and status
  - Leg_NM = distance between successive hourly autolog positions (Haversine)
  - Voyage_NM = sum of Leg_NM within voyage_id
  - Year totals aggregated for maintenance/servicing cues
- Time: store UTC; display local as needed

Focus & Context Management
- CONTEXT.md updated each working session:
  - Goal, Current Task, Acceptance Criteria, Next File to Touch, Boundaries
- If chat context is stale, re‑sync by reading SYSTEM-CHARTER.md, CONTEXT.md, DECISIONS.md, BACKLOG.md
- Start new chat threads as needed; repo docs remain the single source of truth

Security & Access
- Runs on isolated onboard network (OTUS)
- Optional local auth (basic user/pass) can be added later; MVP assumes trusted LAN
- No third‑party calls required at runtime

Testing
- Unit tests for services (snapshot, autolog, voyage calc)
- Minimal integration test hitting key routes
- Smoke test script for on‑device validation post‑deploy

Open Questions (to be resolved before implementing)
- Signal K endpoint and auth (URL/port/token)
- Any additions/removals to the autolog headers above
- Snapshot retention (rolling 24h vs daily files)
- Time zone display rules
- Repository name and initialization (new vs existing)

Approval
- Changes to this charter require a PR and approval by Cfokke.