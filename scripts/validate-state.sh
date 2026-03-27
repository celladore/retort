#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# validate-state.sh — Validate orchestrator state before beginning work.
#
# Called during /orchestrate --assess-only to surface stale state, branch
# mismatches, and missing directories before agent work begins.
#
# Usage:
#   ./scripts/validate-state.sh
#
# Exit codes:
#   0 — state is valid (warnings may still be printed)
#   1 — state is invalid or directories are missing
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_DIR="${REPO_ROOT}/.claude/state"
TASKS_DIR="${STATE_DIR}/tasks"
ARCHIVE_DIR="${TASKS_DIR}/archive"
ORCH_FILE="${STATE_DIR}/orchestrator.json"

EXIT_CODE=0
warnings=0
errors=0

echo "=== State Validation ==="

# ── 1. Directory structure ────────────────────────────────────────────────
for dir in "$STATE_DIR" "$TASKS_DIR" "$ARCHIVE_DIR"; do
  if [[ ! -d "$dir" ]]; then
    echo "[error] Missing directory: ${dir}"
    (( errors++ )) || true
  fi
done

if (( errors == 0 )); then
  echo "[ok] Directory structure intact"
fi

# ── 2. orchestrator.json presence and schema ──────────────────────────────
if [[ ! -f "$ORCH_FILE" ]]; then
  echo "[warn] orchestrator.json not found — run /orchestrate to initialise"
  (( warnings++ )) || true
else
  if command -v jq &>/dev/null; then
    # Required fields
    for field in schema_version repo_id current_phase phase_name; do
      val=$(jq -r ".${field} // empty" "$ORCH_FILE" 2>/dev/null || true)
      if [[ -z "$val" ]]; then
        echo "[error] orchestrator.json missing required field: ${field}"
        (( errors++ )) || true
      fi
    done

    orch_branch=$(jq -r '.branch // empty' "$ORCH_FILE")
    orch_phase=$(jq -r '.phase_name // empty' "$ORCH_FILE")
    orch_health=$(jq -r '.healthStatus // .health_status // empty' "$ORCH_FILE")
    orch_healthcheck=$(jq -r '.lastHealthcheck // .last_healthcheck // empty' "$ORCH_FILE")
    orch_completed=$(jq -r '.completed // false' "$ORCH_FILE")

    # Branch match
    current_branch=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "")
    if [[ -n "$orch_branch" && -n "$current_branch" && "$orch_branch" != "$current_branch" ]]; then
      echo "[warn] Branch mismatch: state='${orch_branch}', current='${current_branch}'"
      (( warnings++ )) || true
    else
      echo "[ok] Branch: ${current_branch:-unknown}"
    fi

    echo "[ok] Phase: ${orch_phase:-unknown}"

    # Health status
    if [[ "$orch_health" == "unhealthy" || "$orch_health" == "UNHEALTHY" ]]; then
      echo "[warn] Healthcheck is UNHEALTHY — run /check before proceeding"
      (( warnings++ )) || true
    elif [[ -n "$orch_health" ]]; then
      echo "[ok] Health: ${orch_health}"
    fi

    # Healthcheck staleness
    if [[ -n "$orch_healthcheck" ]]; then
      check_epoch=""
      if date -d "$orch_healthcheck" +%s &>/dev/null 2>&1; then
        check_epoch=$(date -d "$orch_healthcheck" +%s 2>/dev/null || true)
      elif date -j -f "%Y-%m-%dT%H:%M:%S" "${orch_healthcheck%.*}" +%s &>/dev/null 2>&1; then
        check_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${orch_healthcheck%.*}" +%s 2>/dev/null || true)
      fi

      if [[ -n "$check_epoch" ]]; then
        now_epoch=$(date +%s)
        age_days=$(( (now_epoch - check_epoch) / 86400 ))
        if (( age_days > 7 )); then
          echo "[warn] Healthcheck is ${age_days} days old"
          (( warnings++ )) || true
        fi
      fi
    fi

    # Task counts
    active=0; completed_count=0; rejected_count=0
    if ls "${TASKS_DIR}"/*.json &>/dev/null 2>&1; then
      for f in "${TASKS_DIR}"/*.json; do
        s=$(jq -r '.status // empty' "$f" 2>/dev/null || true)
        case "$s" in
          completed) (( completed_count++ )) || true ;;
          rejected)  (( rejected_count++ )) || true ;;
          *)         (( active++ )) || true ;;
        esac
      done
    fi

    echo "[ok] Tasks: ${active} active, ${completed_count} completed (not yet archived), ${rejected_count} rejected"
    if (( completed_count + rejected_count > 0 )); then
      echo "     Run ./scripts/reset-state.sh to archive ${completed_count} completed and ${rejected_count} rejected task(s)"
    fi

    # Already-completed project warning
    if [[ "$orch_completed" == "true" ]]; then
      echo "[warn] orchestrator.json shows completed=true — this project may be fully shipped"
      (( warnings++ )) || true
    fi

  else
    echo "[warn] jq not available — skipping schema validation"
    (( warnings++ )) || true
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
if (( errors > 0 )); then
  echo "FAIL: ${errors} error(s), ${warnings} warning(s)"
  EXIT_CODE=1
elif (( warnings > 0 )); then
  echo "WARN: ${warnings} warning(s) — review above before proceeding"
else
  echo "PASS: State is valid and ready for /orchestrate"
fi

exit $EXIT_CODE
