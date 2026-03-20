#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Hook: PreToolUse (matcher: Bash)
# Purpose: Block destructive shell commands before they execute.
# Stdin:   JSON with session_id, cwd, hook_event_name, tool_name, tool_input
# Stdout:  JSON deny response on match, empty otherwise
# ---------------------------------------------------------------------------
set -euo pipefail

# -- Read JSON payload from stdin ------------------------------------------
INPUT=$(cat)

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# If there is no command we cannot evaluate -- allow by default.
if [[ -z "$COMMAND" ]]; then
    exit 0
fi

# -- Destructive command patterns ------------------------------------------
# Fixed strings checked with grep -F; regex patterns checked with grep -E.
# Using an associative approach: pattern + display label.
DENY_FIXED=(
    "rm -rf /"
    "rm -rf ~"
    "git push --force"
    "git push -f "
    "git reset --hard"
    "terraform destroy"
    "az group delete"
    "gh repo delete"
)

DENY_REGEX=(
    "DROP[[:space:]]+TABLE"
    "DROP[[:space:]]+DATABASE"
)

# Check fixed-string patterns.
for pattern in "${DENY_FIXED[@]}"; do
    if echo "$COMMAND" | grep -qF "$pattern"; then
        jq -n \
            --arg reason "Blocked: command contains destructive pattern '${pattern}'." \
            '{
                hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "deny",
                    permissionDecisionReason: $reason
                }
            }'
        exit 0
    fi
done

# Check regex patterns (case-insensitive).
for pattern in "${DENY_REGEX[@]}"; do
    if echo "$COMMAND" | grep -qiE "$pattern"; then
        jq -n \
            --arg reason "Blocked: command contains destructive pattern '${pattern}'." \
            '{
                hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "deny",
                    permissionDecisionReason: $reason
                }
            }'
        exit 0
    fi
done

# No match -- allow the operation (empty stdout, exit 0).
exit 0
