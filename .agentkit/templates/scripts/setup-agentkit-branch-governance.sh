---
agentkit:
  scaffold: managed
---
#!/usr/bin/env bash
set -euo pipefail

REPO=""
DRY_RUN=false
SKIP_DEFAULT_BRANCH=false
SKIP_PROTECTION=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      if [[ $# -lt 2 || -z "${2:-}" || "${2:-}" == -* ]]; then
        echo "Error: --repo requires a value in the form owner/name"
        exit 1
      fi
      REPO="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-default-branch)
      SKIP_DEFAULT_BRANCH=true
      shift
      ;;
    --skip-protection)
      SKIP_PROTECTION=true
      shift
      ;;
    --help|-h)
      echo "Usage: $(basename "$0") [--repo owner/name] [--dry-run] [--skip-default-branch] [--skip-protection]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is not installed. Install from https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh CLI is not authenticated. Run 'gh auth login' first."
  exit 1
fi

if [[ -z "$REPO" ]]; then
  REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || true)
fi

if [[ -z "$REPO" ]]; then
  echo "Could not determine repository. Pass --repo <owner/name>."
  exit 1
fi

echo "=== Retort Branch Governance Setup ==="
echo "Repository: $REPO"
echo "DryRun:     $DRY_RUN"
echo

if [[ "$SKIP_DEFAULT_BRANCH" == false ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] Would set default branch to '{{defaultBranch}}' for $REPO"
  else
    gh api --method PATCH "/repos/$REPO" -f default_branch='{{defaultBranch}}' >/dev/null
    echo "Default branch set to '{{defaultBranch}}'."
  fi
fi

PAYLOAD=$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": {{bpStrictStatusChecks}},
    "contexts": [
      "Test",
      "Validate",
      "Branch Protection / branch-rules"
    ]
  },
  "enforce_admins": {{bpEnforceAdmins}},
  "required_pull_request_reviews": {
    "required_approving_review_count": {{bpRequiredReviewCount}},
    "dismiss_stale_reviews": {{bpDismissStaleReviews}},
    "require_code_owner_reviews": {{bpRequireCodeOwnerReviews}},
    "require_last_push_approval": {{bpRequireLastPushApproval}}
  },
  "restrictions": null,
  "required_linear_history": {{bpRequiredLinearHistory}},
  "allow_force_pushes": {{bpAllowForcePushes}},
  "allow_deletions": {{bpAllowDeletions}},
  "block_creations": {{bpBlockCreations}},
  "required_conversation_resolution": true
}
JSON
)

if [[ "$SKIP_PROTECTION" == false ]]; then
  # Deduplicate: if defaultBranch is 'main', don't apply twice
  for BRANCH in $(echo "{{defaultBranch}} main" | tr ' ' '\n' | awk '!seen[$0]++'); do
    # Skip if the branch does not exist on the remote
    if ! gh api "/repos/$REPO/branches/$BRANCH" --silent 2>/dev/null; then
      echo "[skip] Branch '$BRANCH' does not exist on $REPO — skipping protection."
      continue
    fi

    if [[ "$DRY_RUN" == true ]]; then
      echo "[dry-run] Would apply branch protection to $REPO/$BRANCH"
      continue
    fi

    gh api --method PUT "/repos/$REPO/branches/$BRANCH/protection" --input - <<< "$PAYLOAD" >/dev/null
    echo "Branch protection applied to $BRANCH."
  done
fi

echo
echo "Done."
for BRANCH in $(echo "{{defaultBranch}} main" | tr ' ' '\n' | awk '!seen[$0]++'); do
  echo "Verify with: gh api /repos/$REPO/branches/$BRANCH/protection"
done
