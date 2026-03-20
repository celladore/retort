#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Hook: PreToolUse (matcher: Write|Edit)
# Purpose: Block writes to sensitive files such as .env, secrets, keys, etc.
# Stdin:   JSON with session_id, cwd, hook_event_name, tool_name, tool_input
# Stdout:  JSON deny response on match, empty otherwise
# ---------------------------------------------------------------------------
set -euo pipefail

# -- Read JSON payload from stdin ------------------------------------------
INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# If there is no file path we cannot evaluate -- allow by default.
if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# -- Sensitive file patterns -----------------------------------------------
# Each pattern is a POSIX ERE checked against the full file path.
DENY_PATTERNS=(
    '\.env$'
    '\.env\.'
    '\.tfvars$'
    'secrets'
    'credential'
    'private_key'
    'id_rsa'
    '\.pem$'
)

for pattern in "${DENY_PATTERNS[@]}"; do
    if echo "$FILE_PATH" | grep -qiE "$pattern"; then
        jq -n \
            --arg reason "Blocked: file path '${FILE_PATH}' matches sensitive pattern '${pattern}'." \
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
