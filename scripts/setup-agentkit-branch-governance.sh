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

echo "=== AgentKit Branch Governance Setup ==="
echo "Repository: $REPO"
echo "DryRun:     $DRY_RUN"
echo

if [[ "$SKIP_DEFAULT_BRANCH" == false ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] Would set default branch to 'dev' for $REPO"
  else
    gh api --method PATCH "/repos/$REPO" -f default_branch='dev' >/dev/null
    echo "Default branch set to 'dev'."
  fi
fi

PAYLOAD=$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / test (ubuntu-latest, 24)",
      "CI / validate",
      "Branch Protection / branch-rules",
      "block-agentkit-changes / check_agentkit_changes"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
JSON
)

if [[ "$SKIP_PROTECTION" == false ]]; then
  for BRANCH in dev main; do
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
echo "Verify with: gh api /repos/$REPO/branches/dev/protection"
echo "             gh api /repos/$REPO/branches/main/protection"
