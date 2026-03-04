param(
    [string]$Repo,
    [switch]$DryRun,
    [switch]$SkipDefaultBranch,
    [switch]$SkipProtection
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "gh CLI is not installed. Install from https://cli.github.com/"
}

gh auth status 1>$null
if ($LASTEXITCODE -ne 0) {
    throw "gh CLI is not authenticated. Run 'gh auth login' first."
}

if (-not $Repo) {
    $Repo = gh repo view --json nameWithOwner -q '.nameWithOwner'
}

if (-not $Repo) {
    throw "Could not determine repository. Pass -Repo <owner/name>."
}

Write-Host "=== AgentKit Branch Governance Setup ==="
Write-Host "Repository: $Repo"
Write-Host "DryRun:     $DryRun"
Write-Host ""

if (-not $SkipDefaultBranch) {
    if ($DryRun) {
        Write-Host "[dry-run] Would set default branch to 'dev' for $Repo"
    }
    else {
        $defaultBranchResult = & gh api --method PATCH "/repos/$Repo" -f default_branch='dev' 2>&1
        $defaultBranchCode = $LASTEXITCODE
        if ($defaultBranchCode -ne 0) {
            Write-Error "Failed to set default branch to 'dev' for $Repo: $defaultBranchResult"
            exit $defaultBranchCode
        }
        Write-Host "Default branch set to 'dev'."
    }
}

$payload = @{
    required_status_checks = @{
        strict   = $true
        contexts = @(
            "CI / test (ubuntu-latest, 24)",
            "CI / validate",
            "Branch Protection / branch-rules",
            "block-agentkit-changes / check_agentkit_changes"
        )
    }
    enforce_admins = $false
    required_pull_request_reviews = @{
        required_approving_review_count = 1
        dismiss_stale_reviews           = $true
        require_code_owner_reviews      = $true
        require_last_push_approval      = $false
    }
    restrictions                     = $null
    required_linear_history          = $true
    allow_force_pushes               = $false
    allow_deletions                  = $false
    block_creations                  = $false
    required_conversation_resolution = $true
} | ConvertTo-Json -Depth 5

if (-not $SkipProtection) {
    foreach ($branch in @('dev', 'main')) {
        if ($DryRun) {
            Write-Host "[dry-run] Would apply branch protection to $Repo/$branch"
            continue
        }

        $result = $payload | & gh api --method PUT "/repos/$Repo/branches/$branch/protection" --input - 2>&1
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            Write-Error "Failed to apply branch protection to $Repo/$branch: $result"
            exit $code
        }
        Write-Host "Branch protection applied to $branch."
    }
}

Write-Host ""
Write-Host "Done."
Write-Host "Verify with: gh api /repos/$Repo/branches/dev/protection"
Write-Host "             gh api /repos/$Repo/branches/main/protection"
