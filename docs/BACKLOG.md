cat > docs/BACKLOG.md <<'EOF'
# HelmingSense E-Logbook — Backlog

This backlog tracks open questions, next tasks, and future work. It complements GitHub issues but remains the authoritative ordered list in-repo.

---

## 1. Open Questions (to resolve before implementation)
- [x] Confirm Signal K endpoint and token: http://localhost:3000/signalk/v1/api/vessels/self (no token for MVP).
- [x] Finalize autolog CSV headers & enums (see decisions).
- [x] Snapshot retention: last 24h only (snapshots). DB/CSV are permanent.
- [x] Timestamp format: UTC ISO 8601 without seconds (YYYY-MM-DDTHH:mmZ). UI shows local time.
- [x] Define enum values (see decisions).
- [x] Viewer port: 8080.


## 2. Near-Term Tasks
- [x] Add `docs/INDEX.md` (Compass index) — **in progress**.
- [ ] Write `DECISIONS.md` skeleton (log ADRs succinctly).
- [ ] Finalize `DIRECTORY-TREE.md` acceptance (repo layout + data flow locked).

## 3. Future Enhancements
- [ ] CI: file-length guard (>600 lines), lint, tests.
- [ ] Add smoke-test.sh for on-device validation.
- [ ] Define schema migrations in `app/db/migrations/`.
- [ ] Optional auth (token or basic user/pass) for trusted LAN.
- [ ] Daily/rolling rotation for snapshots (policy TBD).
- [ ] Yearly totals aggregation and servicing cues.

---

📌 **Working rules:** Each backlog item is resolved by a PR that updates this file (checked or removed). Decisions with lasting effect are logged separately in `DECISIONS.md`. 
EOF
