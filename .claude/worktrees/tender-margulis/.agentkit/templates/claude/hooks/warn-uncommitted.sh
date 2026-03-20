#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Hook: PostToolUse (matcher: Write|Edit)
# Purpose: Warn when the number of uncommitted changes grows too large.
# Stdin:   JSON with session_id, cwd, hook_event_name, tool_name,
#          tool_input, tool_response
# Stdout:  JSON systemMessage warning when threshold is exceeded
# ---------------------------------------------------------------------------
set -euo pipefail

THRESHOLD=10

# -- Read JSON payload from stdin ------------------------------------------
INPUT=$(cat)

CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CWD="${CWD:-$PWD}"

# -- Count uncommitted changes --------------------------------------------
# If we are not inside a git repo, silently exit.
if ! command -v git &>/dev/null; then
    exit 0
fi

if ! git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null; then
    exit 0
fi

STATUS_OUTPUT=$(git -C "$CWD" status --porcelain 2>/dev/null || true)

if [[ -z "$STATUS_OUTPUT" ]]; then
    exit 0
fi

CHANGE_COUNT=$(echo "$STATUS_OUTPUT" | wc -l | tr -d ' ')

# -- Emit warning when threshold exceeded ----------------------------------
if [[ "$CHANGE_COUNT" -ge "$THRESHOLD" ]]; then
    jq -n --arg count "$CHANGE_COUNT" \
        --arg threshold "$THRESHOLD" \
        '{
            hookSpecificOutput: {
                systemMessage: ("WARNING: There are " + $count + " uncommitted changes (threshold: " + $threshold + "). Consider committing your work to avoid losing changes.")
            }
        }'
fi

exit 0
