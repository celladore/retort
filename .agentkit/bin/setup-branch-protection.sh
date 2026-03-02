#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-branch-protection.sh
# Configures GitHub branch protection rules for the default branch using
# the GitHub CLI (gh). Run this once after adopting AgentKit Forge.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth status)
#   - Admin access to the repository
#
# Usage:
#   .agentkit/bin/setup-branch-protection.sh [--branch main] [--dry-run]
# ---------------------------------------------------------------------------
set -euo pipefail

# -- Defaults ---------------------------------------------------------------
BRANCH="main"
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# -- Parse arguments --------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --branch)  BRANCH="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --help|-h)
            echo "Usage: $(basename "$0") [--branch main] [--dry-run]"
            echo ""
            echo "Configures GitHub branch protection for the specified branch."
            echo ""
            echo "Options:"
            echo "  --branch NAME   Branch to protect (default: main)"
            echo "  --dry-run       Print the API payload without applying"
            echo "  --help          Show this help"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# -- Verify prerequisites ---------------------------------------------------
if ! command -v gh &>/dev/null; then
    echo "Error: gh CLI is not installed. Install from https://cli.github.com/"
    exit 1
fi

if ! gh auth status &>/dev/null; then
    echo "Error: gh CLI is not authenticated. Run 'gh auth login' first."
    exit 1
fi

# -- Detect repository -------------------------------------------------------
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)
if [[ -z "$REPO" ]]; then
    echo "Error: Could not detect repository. Run this from within a git repo."
    exit 1
fi

echo "Repository: $REPO"
echo "Branch:     $BRANCH"
echo ""

# -- Build the branch protection payload ------------------------------------
# Uses the GitHub REST API for branch protection:
# https://docs.github.com/en/rest/branches/branch-protection
PAYLOAD=$(cat <<'ENDJSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "test (ubuntu-latest, 24)",
      "validate",
      "branch-rules"
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
ENDJSON
)

# -- Apply or preview -------------------------------------------------------
if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] Would apply the following branch protection to $REPO/$BRANCH:"
    echo ""
    echo "$PAYLOAD" | python3 -m json.tool 2>/dev/null || echo "$PAYLOAD"
    echo ""
    echo "[dry-run] Run without --dry-run to apply."
    exit 0
fi

echo "Applying branch protection rules..."
echo ""

# Apply branch protection
gh api \
    --method PUT \
    "/repos/$REPO/branches/$BRANCH/protection" \
    --input - <<< "$PAYLOAD"

echo ""
echo "Branch protection applied successfully to $REPO/$BRANCH"
echo ""
echo "Configured:"
echo "  - Required status checks: test, validate, branch-rules (strict: up-to-date)"
echo "  - Required PR reviews: 1 approval, dismiss stale, require CODEOWNERS"
echo "  - Required conversation resolution: enabled"
echo "  - Required linear history: enabled (squash-merge)"
echo "  - Force pushes: blocked"
echo "  - Branch deletion: blocked"
echo ""

# -- Optional: Create labels if they don't exist ----------------------------
echo "Ensuring labels exist..."

create_label_if_missing() {
    local name="$1" color="$2" description="$3"
    if ! gh label view "$name" --repo "$REPO" &>/dev/null 2>&1; then
        gh label create "$name" --color "$color" --description "$description" --repo "$REPO"
        echo "  Created label: $name"
    else
        echo "  Label exists: $name"
    fi
}

create_label_if_missing "forge-source-change"      "d93f0b" "PR modifies AgentKit Forge source files"
create_label_if_missing "needs-maintainer-review"   "e4e669" "Requires maintainer review before merge"
create_label_if_missing "dependencies"              "0075ca" "Dependency updates"
create_label_if_missing "breaking-change"           "b60205" "Contains breaking changes"
create_label_if_missing "security"                  "d93f0b" "Security-related changes"

echo ""
echo "Done. Branch protection and labels are configured."
echo ""
echo "To verify: gh api /repos/$REPO/branches/$BRANCH/protection | python3 -m json.tool"
