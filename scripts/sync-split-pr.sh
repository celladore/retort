#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH=""
NEW_BRANCH=""
COMMIT_MESSAGE="chore(sync): regenerate generated outputs"
PR_TITLE="chore(sync): regenerate generated outputs"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --branch)
      NEW_BRANCH="${2:-}"
      shift 2
      ;;
    --commit-message)
      COMMIT_MESSAGE="${2:-}"
      shift 2
      ;;
    --pr-title)
      PR_TITLE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/sync-split-pr.sh [options]

Creates a dedicated branch + commit + PR for files produced by `agentkit:sync`.

Options:
  --base <branch>            PR base branch (default: current branch)
  --branch <name>            Branch name for sync commit (default: chore/sync-generated-<utc>)
  --commit-message <msg>     Commit message
  --pr-title <title>         PR title
  --dry-run                  Run sync and report changes without creating branch/commit/PR
  -h, --help                 Show help
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit/stash/discard changes before running sync split." >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$BASE_BRANCH" ]]; then
  BASE_BRANCH="$CURRENT_BRANCH"
fi

if [[ -z "$NEW_BRANCH" ]]; then
  TS="$(date -u +%Y%m%d-%H%M%S)"
  NEW_BRANCH="chore/sync-generated-$TS"
fi

echo "Running sync..."
pnpm -C .agentkit agentkit:sync

CHANGED_FILES="$(git status --porcelain)"
if [[ -z "$CHANGED_FILES" ]]; then
  echo "No sync-generated changes detected."
  mkdir -p .agentkit/logs
  printf '{"timestamp":"%s","tool":"sync-split-pr","outcome":"no_changes","base":"%s","branch":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$BASE_BRANCH" "$CURRENT_BRANCH" >> .agentkit/logs/tool-usage.jsonl
  exit 0
fi

FILES_COUNT="$(git status --porcelain | wc -l | tr -d ' ')"
echo "Detected $FILES_COUNT changed file(s) from sync."

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run enabled; not creating branch/commit/PR."
  git status --short
  mkdir -p .agentkit/logs
  printf '{"timestamp":"%s","tool":"sync-split-pr","outcome":"dry_run","files":%s,"base":"%s","branch":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILES_COUNT" "$BASE_BRANCH" "$CURRENT_BRANCH" >> .agentkit/logs/tool-usage.jsonl
  exit 0
fi

git checkout -b "$NEW_BRANCH"
git add -A
git commit -m "$COMMIT_MESSAGE"
git push -u origin "$NEW_BRANCH"

PR_BODY="Automated sync-only PR.

- Source branch: $CURRENT_BRANCH
- Sync command: pnpm -C .agentkit agentkit:sync
- Changed files: $FILES_COUNT"

PR_URL="$(gh pr create --base "$BASE_BRANCH" --head "$NEW_BRANCH" --title "$PR_TITLE" --body "$PR_BODY")"
echo "Created PR: $PR_URL"

mkdir -p .agentkit/logs
printf '{"timestamp":"%s","tool":"sync-split-pr","outcome":"pr_created","files":%s,"base":"%s","source":"%s","syncBranch":"%s","prUrl":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILES_COUNT" "$BASE_BRANCH" "$CURRENT_BRANCH" "$NEW_BRANCH" "$PR_URL" >> .agentkit/logs/tool-usage.jsonl
