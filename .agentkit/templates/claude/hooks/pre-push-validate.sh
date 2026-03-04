#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Hook: PreToolUse (matcher: Bash)
# Purpose: Before a git push, validate:
#   1. No generated-file drift (agentkit sync has been run)
#   2. All commit messages follow Conventional Commits
#   3. Branch name follows type/description pattern
# Stdin:   JSON with tool_input containing the command
# Stdout:  JSON with decision "block" + reason on failure
# ---------------------------------------------------------------------------
set -euo pipefail

# -- Read JSON payload from stdin ------------------------------------------
INPUT=$(cat)

# Only intercept git push commands
if ! command -v jq &>/dev/null; then
    exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CWD="${CWD:-$PWD}"

# Only trigger on git push
if [[ ! "$COMMAND" =~ ^git\ push ]]; then
    exit 0
fi

ERRORS=""

# -- Check 1: Generated file drift ----------------------------------------
# Run agentkit sync and check if it produces changes
if [[ -d "${CWD}/.agentkit" ]] && [[ -f "${CWD}/.agentkit/engines/node/src/cli.mjs" ]]; then
    if command -v node &>/dev/null; then
        # Run sync quietly
        (cd "${CWD}/.agentkit" && node engines/node/src/cli.mjs sync 2>/dev/null) || true

        # Check for drift
        if ! git -C "$CWD" diff --quiet 2>/dev/null; then
            DRIFT_FILES=$(git -C "$CWD" diff --name-only 2>/dev/null | head -20)
            ERRORS="${ERRORS}GENERATED FILE DRIFT DETECTED — Run 'pnpm -C .agentkit agentkit:sync' and commit before pushing.\nOut-of-sync files:\n${DRIFT_FILES}\n\n"
            # Restore the working tree since we're blocking
            git -C "$CWD" checkout -- $DRIFT_FILES 2>/dev/null || true
        fi
    fi
fi

# -- Check 2: Conventional Commits on unpushed commits --------------------
# Get commits that would be pushed
BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "")
DEFAULT_BRANCH=$(git -C "$CWD" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
if [[ -n "$BRANCH" ]]; then
    UPSTREAM=$(git -C "$CWD" rev-parse --abbrev-ref "@{upstream}" 2>/dev/null || echo "")
    if [[ -n "$UPSTREAM" ]]; then
        RANGE="${UPSTREAM}..HEAD"
    else
        # No upstream yet — check last 20 commits against default branch
        if git -C "$CWD" rev-parse "origin/${DEFAULT_BRANCH}" &>/dev/null; then
            RANGE="origin/${DEFAULT_BRANCH}..HEAD"
        else
            RANGE="HEAD~20..HEAD"
        fi
    fi

    CC_PATTERN='^(feat|fix|docs|style|refactor|test|chore|ci|perf|build|revert)(\(.+\))?!?:.+'
    BAD_COMMITS=""
    while IFS= read -r line; do
        HASH=$(echo "$line" | cut -d' ' -f1)
        MSG=$(echo "$line" | cut -d' ' -f2-)
        if [[ ! "$MSG" =~ $CC_PATTERN ]]; then
            BAD_COMMITS="${BAD_COMMITS}  ${HASH} ${MSG}\n"
        fi
    done < <(git -C "$CWD" log --oneline "$RANGE" 2>/dev/null || true)

    if [[ -n "$BAD_COMMITS" ]]; then
        ERRORS="${ERRORS}CONVENTIONAL COMMITS VIOLATION — The following commits do not follow the format 'type(scope): description':\n${BAD_COMMITS}Types: feat, fix, docs, style, refactor, test, chore, ci, perf, build, revert\n\n"
    fi
fi

# -- Check 3: Branch name follows type/description pattern -----------------
# Skip check for default branch and claude/ prefixed branches (agent sessions)
if [[ -n "$BRANCH" ]]; then
    BRANCH_PATTERN='^(feat|fix|docs|style|refactor|test|chore|ci|perf|build|revert|release|hotfix|claude)/[a-z0-9][a-z0-9._-]+$'
    if [[ "$BRANCH" != "$DEFAULT_BRANCH" ]] && [[ "$BRANCH" != "develop" ]] && [[ ! "$BRANCH" =~ ^release/ ]] && [[ ! "$BRANCH" =~ $BRANCH_PATTERN ]]; then
        ERRORS="${ERRORS}BRANCH NAMING VIOLATION — Branch '${BRANCH}' does not follow the pattern type/short-description.\nExpected: feat/*, fix/*, docs/*, chore/*, ci/*, refactor/*, test/*, etc.\nExample: feat/add-user-auth, fix/token-refresh\n\n"
    fi
fi

# -- Emit block decision if errors found ----------------------------------
if [[ -n "$ERRORS" ]]; then
    jq -n --arg reason "$(echo -e "$ERRORS")" \
        '{ decision: "block", reason: $reason }'
    exit 0
fi

exit 0
