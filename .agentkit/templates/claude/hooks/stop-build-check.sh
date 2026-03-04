#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Hook: Stop
# Purpose: Best-effort build / lint / test validation before Claude stops.
#          If the build fails the hook returns a "block" decision so Claude
#          can attempt to fix the problem before finishing.
# Stdin:   JSON with session_id, cwd, hook_event_name, stop_hook_active, ...
# Stdout:  JSON with decision "block" + reason on failure, empty on success
# ---------------------------------------------------------------------------
set -euo pipefail

# -- Require jq for JSON parsing ------------------------------------------
if ! command -v jq &>/dev/null; then
    # jq is required to parse stdin JSON; allow stop without checks
    cat > /dev/null  # drain stdin
    exit 0
fi

# -- Read JSON payload from stdin ------------------------------------------
INPUT=$(cat)

CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CWD="${CWD:-$PWD}"

# Guard against infinite loops: if stop_hook_active is already true the hook
# was re-invoked after a previous block -- let it through this time.
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // "false"')
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
    exit 0
fi

# -- Helper: run a command and capture failure -----------------------------
run_check() {
    local label="$1"
    shift
    local output
    if output=$(cd "$CWD" && "$@" 2>&1); then
        return 0
    else
        FAILURE_REASON="${label} failed:\n${output}"
        return 1
    fi
}

FAILURE_REASON=""

# -- Auto-detect stack and run checks --------------------------------------
ran_check=false

# Node.js / JavaScript / TypeScript
if [[ -f "${CWD}/package.json" ]]; then
    ran_check=true

    # Determine the package manager.
    pm="npm"
    if [[ -f "${CWD}/pnpm-lock.yaml" ]] && command -v pnpm &>/dev/null; then
        pm="pnpm"
    elif [[ -f "${CWD}/yarn.lock" ]] && command -v yarn &>/dev/null; then
        pm="yarn"
    fi

    # Try lint, then test, then build -- stop at first failure.
    has_script() { jq -e --arg s "$1" '.scripts[$s] // empty' "${CWD}/package.json" &>/dev/null; }

    if has_script "lint"; then
        if ! run_check "${pm} lint" "$pm" run lint; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi

    if has_script "test"; then
        if ! run_check "${pm} test" "$pm" run test; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi

    if has_script "build"; then
        if ! run_check "${pm} build" "$pm" run build; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi
fi

# .NET
SLN_FILE=$(find "$CWD" -maxdepth 2 -name '*.sln' -o -name '*.csproj' 2>/dev/null | head -n1 || true)
if [[ -n "$SLN_FILE" ]] && command -v dotnet &>/dev/null; then
    ran_check=true
    if ! run_check "dotnet build" dotnet build "$SLN_FILE" --nologo --verbosity quiet; then
        jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
        exit 0
    fi
    if ! run_check "dotnet test" dotnet test "$SLN_FILE" --nologo --verbosity quiet --no-build; then
        jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
        exit 0
    fi
fi

# Rust / Cargo
if [[ -f "${CWD}/Cargo.toml" ]] && command -v cargo &>/dev/null; then
    ran_check=true
    if ! run_check "cargo check" cargo check --manifest-path "${CWD}/Cargo.toml" --quiet; then
        jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
        exit 0
    fi
    if ! run_check "cargo test" cargo test --manifest-path "${CWD}/Cargo.toml" --quiet; then
        jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
        exit 0
    fi
fi

# Python
if [[ -f "${CWD}/pyproject.toml" ]]; then
    ran_check=true

    # Try pytest first, fall back to unittest.
    if command -v pytest &>/dev/null; then
        if ! run_check "pytest" pytest --rootdir "$CWD" -q; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    elif command -v python3 &>/dev/null; then
        if ! run_check "python -m pytest" python3 -m pytest --rootdir "$CWD" -q 2>/dev/null; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi
fi

# -- Session cost tracking: log session end --------------------------------
AGENTKIT_ROOT=""
if [[ -d "${CWD}/.agentkit" ]]; then
    AGENTKIT_ROOT="${CWD}/.agentkit"
elif [[ -d "${CWD}/../.agentkit" ]]; then
    AGENTKIT_ROOT="${CWD}/../.agentkit"
fi

if [[ -n "$AGENTKIT_ROOT" ]] && command -v jq &>/dev/null; then
    LOG_DIR="${AGENTKIT_ROOT}/logs"
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    DATE_STR=$(date -u +"%Y-%m-%d")
    LOG_FILE="${LOG_DIR}/usage-${DATE_STR}.jsonl"
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
    files_changed=0
    if command -v git &>/dev/null && git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null; then
        tracked=$(git -C "$CWD" diff --name-only HEAD 2>/dev/null | wc -l | tr -d ' ' || echo "0")
        untracked=$(git -C "$CWD" ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ' || echo "0")
        files_changed=$(( tracked + untracked ))
    fi

    jq -n --arg ts "$TIMESTAMP" --arg sid "$SESSION_ID" --arg files "$files_changed" \
        '{timestamp: $ts, event: "session_end", sessionId: $sid, filesModified: ($files | tonumber)}' \
        >> "$LOG_FILE" 2>/dev/null || true
fi

# If no build tools were found, or all checks passed -- allow stop.
exit 0
