#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Hook: SessionStart (supplementary)
# Purpose: Ensure .claude/state/tasks/ directories exist and warn when
#          orchestrator state is stale or from a different branch.
# Stdin:   JSON with session_id, cwd, hook_event_name, etc.
# Stdout:  JSON with hookSpecificOutput.additionalContext (warnings only)
# ---------------------------------------------------------------------------
set -euo pipefail

INPUT=$(cat)

CWD=""
if command -v jq &>/dev/null; then
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
fi
CWD="${CWD:-$PWD}"

STATE_DIR="${CWD}/.claude/state"
TASKS_DIR="${STATE_DIR}/tasks"
ARCHIVE_DIR="${TASKS_DIR}/archive"
ORCH_FILE="${STATE_DIR}/orchestrator.json"

# ── Ensure directories exist ──────────────────────────────────────────────
mkdir -p "$ARCHIVE_DIR" 2>/dev/null || true

# ── Check orchestrator state ──────────────────────────────────────────────
warnings=()

if [[ -f "$ORCH_FILE" ]] && command -v jq &>/dev/null; then
  orch_branch=$(jq -r '.branch // empty' "$ORCH_FILE" 2>/dev/null || true)
  orch_health=$(jq -r '.healthStatus // .health_status // empty' "$ORCH_FILE" 2>/dev/null || true)

  current_branch=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "")

  if [[ -n "$orch_branch" && -n "$current_branch" && "$orch_branch" != "$current_branch" ]]; then
    warnings+=("⚠ Orchestrator state is from branch '${orch_branch}' — current branch is '${current_branch}'. Run /orchestrate --assess-only to refresh.")
  fi

  if [[ "$orch_health" == "unhealthy" || "$orch_health" == "UNHEALTHY" ]]; then
    warnings+=("⚠ Last healthcheck reported UNHEALTHY. Run /check before starting new work.")
  fi
fi

# ── Output ────────────────────────────────────────────────────────────────
if [[ ${#warnings[@]} -gt 0 ]]; then
  warning_text=$(printf '%s\n' "${warnings[@]}")
  if command -v jq &>/dev/null; then
    jq -n --arg ctx "$warning_text" '{hookSpecificOutput: {additionalContext: $ctx}}'
  else
    escaped=$(printf '%s' "$warning_text" | awk '{gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); printf "%s\\n", $0}' | sed '$ s/\\n$//')
    printf '{"hookSpecificOutput":{"additionalContext":"%s"}}\n' "$escaped"
  fi
else
  # No warnings — return empty context so the hook is a no-op
  printf '{"hookSpecificOutput":{"additionalContext":""}}\n'
fi

exit 0
