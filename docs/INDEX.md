ChatGPT said:

{"name":"INDEX.md","type":"document","content":"# HelmingSense E-Logbook — Compass Index\n\nThis index is a quick entry point. It links to the authoritative docs and provides a re-sync checklist for any working session.\n\n---\n\n## Mission\nRebuild a robust, offline-capable e-logbook with Signal K integration, snapshots, autologs, manual logs, dual viewer, and voyage tracking.\n→ System Charter
\n\n## Current Phase & Task\n- Phase goal: Stand up project skeleton & guardrails (safe dev→prod, rollback).\n- Current task: Draft DIRECTORY-TREE.md (repository & device layout, data flow).\n→ Context
\n\n## Repository & Device Layout\n- Proposed repo tree (services, db, web, docs, tests, etc.).\n- On-device layout under /opt/helmingsense with versioned releases, data, logs, and config.\n→ Directory Tree
\n\n## Guardrails\n- No source file > 600 lines (CI enforced).\n- SQLite is the source of truth; CSVs are derived.\n- Small, reversible, one-file PRs.\n- Dev → prod via tagged releases; rollback by symlink repoint.\n→ System Charter
n\n## Session Re-sync Checklist\nIf chat context is lost, restate:\n1. Goal (phase objective)\n2. Current Task (single next step)\n3. Acceptance Criteria (done-when)\n4. Next File to Touch\n\nIf still unclear → open issue + update CONTEXT.md.\n\n## Other Docs\n- Decisions (ADRs)
— succinct record of design choices\n- Backlog
