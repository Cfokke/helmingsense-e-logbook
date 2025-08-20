cat > docs/BACKLOG.md <<'EOF'
# HelmingSense E-Logbook — Backlog

This backlog tracks open questions, next tasks, and future work. It complements GitHub issues but remains the authoritative ordered list in-repo.

---

## 1. Open Questions (to resolve before implementation)
- [ ] Confirm Signal K endpoint (URL/port) and whether token is required.
- [ ] Finalize autolog CSV headers (add/remove RPM, Depth, Battery?).
- [ ] Decide snapshot retention: rolling 24h file vs daily-rotated files.
- [ ] Confirm timestamp format in CSV exports (currently `YYYY-MM-DDTHH:mm:ssZ` in UTC).
- [ ] Define enum values for crew, autopilot, propulsion, visibility, sea_state.
- [ ] Confirm preferred local viewer URL/port on OTUS (e.g., http://otus:8080).

## 2. Near-Term Tasks
- [ ] Add `docs/INDEX.md` (Compass index) — **in progress**.
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
