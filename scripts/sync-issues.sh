#!/usr/bin/env bash
# scripts/sync-issues.sh
# Syncs local issue docs (docs/history/issues/) to GitHub Issues.
#
# Local issue markdown files that have "gh_synced: false" are candidates for
# sync.  In dry-run mode (default) the script prints what would be created.
# With --apply it creates GitHub Issues via `gh` and stamps the file with the
# resulting issue number.
#
# Usage:
#   ./scripts/sync-issues.sh                  # Dry-run — preview only
#   ./scripts/sync-issues.sh --apply          # Create GitHub Issues
#   ./scripts/sync-issues.sh --apply --label "from-local"  # Add extra label
#
# Requirements:
#   - gh CLI installed and authenticated
#   - Current directory inside the git repository

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ISSUES_DIR="$REPO_ROOT/docs/history/issues"

APPLY=false
EXTRA_LABEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=true; shift ;;
    --label)  EXTRA_LABEL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--apply] [--label <label>]"
      echo "  --apply   Create GitHub Issues (default is dry-run)"
      echo "  --label   Extra label to add to created issues"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is not installed. Install it from https://cli.github.com/"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Error: gh is not authenticated. Run 'gh auth login' first."
  exit 1
fi

# ---------------------------------------------------------------------------
# Discover unsynced issue files
# ---------------------------------------------------------------------------

SYNCED=0
SKIPPED=0
FAILED=0

for issue_file in "$ISSUES_DIR"/*-issue.md; do
  [[ -f "$issue_file" ]] || continue

  basename_file="$(basename "$issue_file")"

  # Skip templates
  if [[ "$basename_file" == TEMPLATE-* ]]; then
    continue
  fi

  # Check sync status
  if ! grep -q 'gh_synced.*false' "$issue_file" 2>/dev/null; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Extract title from first H1
  TITLE="$(grep -m1 '^# ' "$issue_file" | sed 's/^# //' | sed 's/ - Issue Record$//')"
  if [[ -z "$TITLE" ]]; then
    TITLE="$basename_file"
  fi

  # Extract severity for labeling
  SEVERITY="$(grep -m1 '^\*\*Severity\*\*:' "$issue_file" | sed 's/.*: *//' | tr '[:upper:]' '[:lower:]')" || true

  # Extract summary section as the issue body
  BODY="$(sed -n '/^## Summary$/,/^## /{/^## Summary$/d;/^## /d;p}' "$issue_file" | sed '/^$/N;/^\n$/d')"
  if [[ -z "$BODY" ]]; then
    BODY="Synced from local issue doc: $basename_file"
  fi

  # Append a link back to the local file
  BODY="$BODY

---
_Synced from \`docs/history/issues/$basename_file\`_"

  # Build labels
  LABELS="synced-from-local"
  if [[ -n "$SEVERITY" && "$SEVERITY" != *"["* ]]; then
    LABELS="$LABELS,severity:$SEVERITY"
  fi
  if [[ -n "$EXTRA_LABEL" ]]; then
    LABELS="$LABELS,$EXTRA_LABEL"
  fi

  if [[ "$APPLY" == false ]]; then
    echo "[dry-run] Would create issue: \"$TITLE\""
    echo "          Labels: $LABELS"
    echo "          Source: $basename_file"
    echo ""
    SYNCED=$((SYNCED + 1))
    continue
  fi

  # Create the GitHub Issue
  echo "Creating issue: \"$TITLE\" ..."
  ISSUE_URL="$(gh issue create \
    --title "$TITLE" \
    --body "$BODY" \
    --label "$LABELS" 2>&1)" || {
    echo "  FAILED: $ISSUE_URL"
    FAILED=$((FAILED + 1))
    continue
  }

  # Extract issue number from URL (https://github.com/owner/repo/issues/123)
  ISSUE_NUMBER="$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')"

  echo "  Created: $ISSUE_URL (#$ISSUE_NUMBER)"

  # Stamp the local file with sync metadata
  SYNC_DATE="$(date +%Y-%m-%d)"
  sed -i "s/^\(- \*\*gh_synced\*\*:\) .*/\1 true/" "$issue_file"
  sed -i "s/^\(- \*\*gh_issue_number\*\*:\) .*/\1 #$ISSUE_NUMBER/" "$issue_file"
  sed -i "s/^\(- \*\*gh_synced_at\*\*:\) .*/\1 $SYNC_DATE/" "$issue_file"

  # Also update the Issue tracker field if it's still a placeholder
  sed -i "s|\(- \*\*Issue tracker\*\*:\) \[GitHub Issue.*\]|\1 $ISSUE_URL|" "$issue_file"

  SYNCED=$((SYNCED + 1))
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo "---"
if [[ "$APPLY" == false ]]; then
  echo "Dry-run complete. $SYNCED issue(s) would be created, $SKIPPED already synced."
  echo "Run with --apply to create GitHub Issues."
else
  echo "Sync complete. $SYNCED created, $SKIPPED already synced, $FAILED failed."
fi
