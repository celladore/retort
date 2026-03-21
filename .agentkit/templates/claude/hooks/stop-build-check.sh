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
        # Truncate to last 3000 chars to avoid "Argument list too long" when
        # output is large (e.g. a failing test run with hundreds of results).
        local truncated
        truncated=$(printf '%s' "$output" | tail -c 3000)
        FAILURE_REASON="${label} failed:\n${truncated}"
        return 1
    fi
}

FAILURE_REASON=""

# -- Check for spec-modified-without-sync (lightweight git check only) ------
# Never re-runs agentkit sync here — that can take 30s+ and is too slow for a
# stop hook. Instead, warn non-blockingly if spec files look dirty.
if [[ -d "${CWD}/.agentkit/spec" ]] && command -v git &>/dev/null && git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null; then
    spec_dirty=$(git -C "$CWD" diff --name-only HEAD 2>/dev/null | { grep -c '^\.agentkit/spec/' || true; })
    if [[ "$spec_dirty" -gt 0 ]]; then
        echo "⚠️  .agentkit/spec/ has uncommitted changes — remember to run '{{packageManager}} -C .agentkit agentkit:sync' before pushing." >&2
    fi
fi

# -- Resolve branch names (shared by commit-check and history-doc-check) ----
BRANCH=""
DEFAULT_BRANCH=""
if command -v git &>/dev/null && git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null; then
    BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "")
    # Prefer the live remote HEAD; fall back to common names if the local ref is stale.
    # Run 'git remote set-head origin --auto' to fix a stale ref.
    DEFAULT_BRANCH=$(git -C "$CWD" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
    if [[ -z "$DEFAULT_BRANCH" ]]; then
        # Stale or missing ref — probe common default branch names
        for _candidate in main master dev trunk; do
            if git -C "$CWD" rev-parse --verify "origin/${_candidate}" &>/dev/null; then
                DEFAULT_BRANCH="$_candidate"
                break
            fi
        done
        DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
    fi
fi

# -- Check for non-conventional commit messages on current branch ----------
if [[ -n "$BRANCH" ]] && [[ "$BRANCH" != "$DEFAULT_BRANCH" ]]; then
    CC_PATTERN='^(feat|fix|docs|style|refactor|test|chore|ci|perf|build|revert)(\(.+\))?!?:.+'
    BAD_COMMITS=""
    if git -C "$CWD" rev-parse "origin/${DEFAULT_BRANCH}" &>/dev/null; then
        while IFS= read -r line; do
            MSG=$(echo "$line" | cut -d' ' -f2-)
            if [[ -n "$MSG" ]] && [[ ! "$MSG" =~ $CC_PATTERN ]]; then
                BAD_COMMITS="${BAD_COMMITS}  ${line}\n"
            fi
        done < <(git -C "$CWD" log --oneline "origin/${DEFAULT_BRANCH}..HEAD" 2>/dev/null || true)
    fi

    if [[ -n "$BAD_COMMITS" ]]; then
        FAILURE_REASON="Commits with non-conventional messages detected. PR titles must follow 'type(scope): description'.\nBad commits:\n${BAD_COMMITS}\nFix with: git rebase -i and reword, or ensure the PR title follows the format."
        jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
        exit 0
    fi
fi

# -- Auto-detect stack and run checks --------------------------------------
ran_check=false

# -- Compute changed files once (used for all per-language gates below) ------
# Only inspect files changed since HEAD (staged + unstaged). If nothing
# relevant changed for a language, skip its check entirely — this makes the
# hook essentially free (<0.1s) when only docs or config were touched.
_changed_files=""
if command -v git &>/dev/null && git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null; then
    _tracked=$(git -C "$CWD" diff --name-only HEAD 2>/dev/null || true)
    _untracked=$(git -C "$CWD" ls-files --others --exclude-standard 2>/dev/null || true)
    _changed_files=$(printf '%s\n%s\n' "$_tracked" "$_untracked" | sed '/^$/d' | sort -u)
fi
_has_changed() { printf '%s\n' "$_changed_files" | grep -qE "$1"; }

{{#if hasLanguageJsLikeEffective}}
# Node.js / JavaScript / TypeScript — lint only, and only when JS/TS files changed
if [[ -f "${CWD}/package.json" ]] && _has_changed '\.(ts|tsx|js|jsx|mjs|cjs)$'; then
    ran_check=true

    pm="npm"
    if [[ -f "${CWD}/pnpm-lock.yaml" ]] && command -v pnpm &>/dev/null; then
        pm="pnpm"
    elif [[ -f "${CWD}/yarn.lock" ]] && command -v yarn &>/dev/null; then
        pm="yarn"
    fi

    has_script() { jq -e --arg s "$1" '.scripts[$s] // empty' "${CWD}/package.json" &>/dev/null; }

    if has_script "lint"; then
        if ! run_check "${pm} lint" "$pm" run lint; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi
fi
{{/if}}

{{#if hasLanguageDotnetEffective}}
# .NET — incremental build only when C#/project files changed
if _has_changed '\.(cs|csproj|fsproj|vbproj|sln)$'; then
    SLN_FILE=$(find "$CWD" -maxdepth 2 -name '*.sln' -o -name '*.csproj' 2>/dev/null | head -n1 || true)
    if [[ -n "$SLN_FILE" ]] && command -v dotnet &>/dev/null; then
        ran_check=true
        if ! run_check "dotnet build" dotnet build "$SLN_FILE" --nologo --verbosity quiet; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi
fi
{{/if}}

{{#if hasLanguageRustEffective}}
# Rust — cargo check only when .rs or Cargo files changed
if _has_changed '\.(rs)$|Cargo\.(toml|lock)$'; then
    if [[ -f "${CWD}/Cargo.toml" ]] && command -v cargo &>/dev/null; then
        ran_check=true
        if ! run_check "cargo check" cargo check --manifest-path "${CWD}/Cargo.toml" --quiet; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi
fi
{{/if}}

{{#if hasLanguagePythonEffective}}
# Python — ruff lint only when .py files changed (ruff is very fast)
if _has_changed '\.py$'; then
    ran_check=true
    if command -v ruff &>/dev/null; then
        if ! run_check "ruff check" ruff check "$CWD" --quiet; then
            jq -n --arg reason "$FAILURE_REASON" '{ decision: "block", reason: $reason }'
            exit 0
        fi
    fi
fi
{{/if}}

# -- Check for missing history documentation --------------------------------
if [[ -n "$BRANCH" ]] && [[ "$BRANCH" != "$DEFAULT_BRANCH" ]]; then
    # Count non-trivial changed files (source files, not config/docs)
    changed_src_files=0
    if git -C "$CWD" rev-parse "origin/${DEFAULT_BRANCH}" &>/dev/null; then
        changed_src_files=$(git -C "$CWD" diff --name-only "origin/${DEFAULT_BRANCH}..HEAD" 2>/dev/null \
            | { grep -cE '\.(ts|tsx|js|jsx|py|rs|go|cs|java|rb|swift|kt)$' || true; })
    fi

    # Check if any history doc was created in this branch
    history_docs_created=0
    if git -C "$CWD" rev-parse "origin/${DEFAULT_BRANCH}" &>/dev/null; then
        history_docs_created=$(git -C "$CWD" diff --name-only "origin/${DEFAULT_BRANCH}..HEAD" 2>/dev/null \
            | { grep -c '^docs/history/' || true; })
    fi

    # If significant source changes but no history doc, warn (non-blocking)
    if [[ "$changed_src_files" -ge 3 ]] && [[ "$history_docs_created" -eq 0 ]]; then
        echo "⚠️  This session changed ${changed_src_files} source files but no history document was created." >&2
        echo "   Consider running: /document-history  (or ./scripts/create-doc.sh <type> \"<title>\")" >&2
        echo "   History docs capture institutional memory for future sessions." >&2
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
