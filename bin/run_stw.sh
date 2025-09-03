#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/chris/helmingsense-e-logbook"
cd "$ROOT"

# Paths and defaults
WGRIB2="${WGRIB2:-$HOME/miniforge3/envs/gribtools/bin/wgrib2}"
CFG="$ROOT/config/stw.json"

# Lock & log
LOCK="$ROOT/logs/stw.lock"
LOG="$ROOT/logs/stw.log"
mkdir -p "$(dirname "$LOG")" "$ROOT/data/derived/stw" "$ROOT/config"

# Read config (route + optional start)
ROUTE="$ROOT/data/current_route.csv"
START=""

if [[ -f "$CFG" ]]; then
  ROUTE=$(jq -r '.route // empty' "$CFG" || true)
  START=$(jq -r '.start // empty' "$CFG" || true)
fi

# Fallbacks
[[ -z "${ROUTE:-}" ]] && ROUTE="$ROOT/data/current_route.csv"
if [[ ! -f "$ROUTE" ]]; then
  echo "[$(date -u +%FT%TZ)] [ERR] route CSV missing: $ROUTE" | tee -a "$LOG"
  exit 1
fi

export WGRIB2

# Acquire non-blocking lock
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$(date -u +%FT%TZ)] STW run skipped: already running" | tee -a "$LOG"
  exit 0
fi

echo "[$(date -u +%FT%TZ)] STW run: ROUTE=$ROUTE START=${START:-<none>}" | tee -a "$LOG"

CMD=( "$ROOT/bin/stw_from_csv.cjs" --csv "$ROUTE" --slices )
[[ -n "${START:-}" ]] && CMD+=( --start "$START" )

set +e
"${CMD[@]}" 2>&1 | tee -a "$LOG"
RC=${PIPESTATUS[0]}
set -e

echo "[$(date -u +%FT%TZ)] STW exit code: $RC" | tee -a "$LOG"
exit $RC
