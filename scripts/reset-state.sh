#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# reset-state.sh — Clean stale tasks, archive completed/rejected, validate
#                  orchestrator state.
#
# Usage:
#   ./scripts/reset-state.sh [--dry-run]
#
# Options:
#   --dry-run   Print what would happen without making changes.
# ---------------------------------------------------------------------------
set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_DIR="${REPO_ROOT}/.claude/state"
TASKS_DIR="${STATE_DIR}/tasks"
ARCHIVE_DIR="${TASKS_DIR}/archive"
ORCH_FILE="${STATE_DIR}/orchestrator.json"

echo "=== Retort State Reset ==="
echo "State dir: ${STATE_DIR}"
[[ "$DRY_RUN" == "true" ]] && echo "(dry-run mode — no changes will be made)"
echo ""

# ── 1. Ensure directories exist ──────────────────────────────────────────
ensure_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[create] Directory: ${dir}"
    else
      mkdir -p "$dir"
      echo "[ok] Created: ${dir}"
    fi
  fi
}

ensure_dir "$STATE_DIR"
ensure_dir "$TASKS_DIR"
ensure_dir "$ARCHIVE_DIR"

# ── 2. Archive completed and rejected task files ──────────────────────────
archived=0
kept=0

if ls "${TASKS_DIR}"/*.json &>/dev/null 2>&1; then
  for task_file in "${TASKS_DIR}"/*.json; do
    [[ -f "$task_file" ]] || continue

    status=""
    if command -v jq &>/dev/null; then
      status=$(jq -r '.status // empty' "$task_file" 2>/dev/null || true)
    else
      status=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$task_file" \
               | sed 's/.*: *"//;s/"$//' || true)
    fi

    if [[ "$status" == "completed" || "$status" == "rejected" ]]; then
      filename="$(basename "$task_file")"
      if [[ "$DRY_RUN" == "true" ]]; then
        echo "[archive] ${filename} (status: ${status})"
      else
        mv "$task_file" "${ARCHIVE_DIR}/${filename}"
        echo "[ok] Archived: ${filename} (${status})"
      fi
      (( archived++ )) || true
    else
      kept=$(( kept + 1 ))
    fi
  done
fi

echo ""
echo "Tasks: ${archived} archived, ${kept} active remaining"

# ── 3. Validate orchestrator.json ─────────────────────────────────────────
echo ""
echo "=== Orchestrator Validation ==="

if [[ ! -f "$ORCH_FILE" ]]; then
  echo "[warn] orchestrator.json not found — nothing to validate"
  echo "       Run /orchestrate to initialise state."
else
  issues=0

  if command -v jq &>/dev/null; then
    orch_branch=$(jq -r '.branch // empty' "$ORCH_FILE" 2>/dev/null || true)
    orch_health=$(jq -r '.healthStatus // .health_status // empty' "$ORCH_FILE" 2>/dev/null || true)
    orch_healthcheck=$(jq -r '.lastHealthcheck // .last_healthcheck // empty' "$ORCH_FILE" 2>/dev/null || true)
    orch_phase=$(jq -r '.phase_name // empty' "$ORCH_FILE" 2>/dev/null || true)
  else
    orch_branch=$(grep -o '"branch"[[:space:]]*:[[:space:]]*"[^"]*"' "$ORCH_FILE" \
                  | sed 's/.*: *"//;s/"$//' || true)
    orch_health=""
    orch_healthcheck=""
    orch_phase=""
  fi

  # Check branch matches current
  current_branch=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "unknown")
  if [[ -n "$orch_branch" && "$orch_branch" != "$current_branch" ]]; then
    echo "[warn] Branch mismatch: orchestrator.json has '${orch_branch}', current is '${current_branch}'"
    echo "       State may be stale from a previous branch. Run /orchestrate --assess-only to refresh."
    (( issues++ )) || true
  else
    echo "[ok] Branch: ${current_branch}"
  fi

  # Check health status
  if [[ "$orch_health" == "unhealthy" || "$orch_health" == "UNHEALTHY" ]]; then
    echo "[warn] Last healthcheck reported UNHEALTHY — run /check to verify current status"
    (( issues++ )) || true
  elif [[ -n "$orch_health" ]]; then
    echo "[ok] Health: ${orch_health}"
  fi

  # Check staleness (warn if lastHealthcheck > 7 days ago)
  if [[ -n "$orch_healthcheck" ]] && command -v date &>/dev/null; then
    # Parse ISO date — strip trailing Z, handle both GNU and BSD date
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
        echo "[warn] Healthcheck is ${age_days} days old — run /check to refresh"
        (( issues++ )) || true
      else
        echo "[ok] Healthcheck age: ${age_days} day(s)"
      fi
    fi
  fi

  echo "[ok] Phase: ${orch_phase:-unknown}"

  if (( issues == 0 )); then
    echo ""
    echo "Orchestrator state looks clean."
  else
    echo ""
    echo "${issues} issue(s) found — see warnings above."
  fi
fi

echo ""
echo "Done."
