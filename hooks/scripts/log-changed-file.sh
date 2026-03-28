#!/usr/bin/env bash
# Logs modified source files to .claude/state/changed-files.log
# Called by PostToolUse hook on Write|Edit events.
# Advisory only — coverage-guard reads this log to know what changed.

set -euo pipefail

INPUT=$(cat)

# Extract file_path from tool input JSON
FILE=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | cut -d'"' -f4 2>/dev/null || true)

# Only track source files
if echo "$FILE" | grep -qE '\.(cs|ts|tsx|rs)$'; then
    LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/state"
    mkdir -p "$LOG_DIR"
    echo "$FILE" >> "$LOG_DIR/changed-files.log"
fi

exit 0
