<# agentkit: scaffold: managed #>
[CmdletBinding()]
param(
  [string]$Base,
  [string]$Branch,
  [string]$CommitMessage = 'chore(sync): regenerate generated outputs',
  [string]$PrTitle = 'chore(sync): regenerate generated outputs',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
# Ensure native command failures (git, pnpm, gh) are treated as terminating errors.
$PSNativeCommandUseErrorActionPreference = $true

# Preflight: verify gh CLI is available and authenticated
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "gh CLI is not installed or not in PATH. Install from https://cli.github.com/"
    exit 1
}
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "gh CLI is not authenticated. Run 'gh auth login' first."
    exit 1
}

function Write-UsageLog {
  param([hashtable]$Payload)
  $logDir = Join-Path $PWD '.agentkit/logs'
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $json = $Payload | ConvertTo-Json -Compress
  Add-Content -Path (Join-Path $logDir 'tool-usage.jsonl') -Value $json
}

$porcelain = git status --porcelain
if ($porcelain) {
  Write-Error "Working tree is not clean. Commit/stash/discard changes before running sync split."
  exit 1
}

$currentBranch = git branch --show-current
if (-not $Base) { $Base = $currentBranch }
if (-not $Branch) {
  $ts = (Get-Date -Format 'yyyyMMdd-HHmmss')
  $Branch = "chore/sync-generated-$ts"
}

Write-Host "Running sync..."
pnpm -C .agentkit agentkit:sync

$changed = git status --porcelain
if (-not $changed) {
  Write-Host "No sync-generated changes detected."
  Write-UsageLog @{
    timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
    tool      = 'sync-split-pr'
    outcome   = 'no_changes'
    base      = $Base
    branch    = $currentBranch
  }
  exit 0
}

$filesCount = ($changed | Measure-Object).Count
Write-Host "Detected $filesCount changed file(s) from sync."

if ($DryRun) {
  Write-Host "Dry run enabled; not creating branch/commit/PR."
  git status --short
  Write-UsageLog @{
    timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
    tool      = 'sync-split-pr'
    outcome   = 'dry_run'
    files     = $filesCount
    base      = $Base
    branch    = $currentBranch
  }
  exit 0
}

git checkout -b $Branch
git add -A
git commit -m $CommitMessage
git push -u origin $Branch

$prBody = @"
Automated sync-only PR.

- Source branch: $currentBranch
- Sync command: pnpm -C .agentkit agentkit:sync
- Changed files: $filesCount
"@

$prUrl = gh pr create --base $Base --head $Branch --title $PrTitle --body $prBody
Write-Host "Created PR: $prUrl"

Write-UsageLog @{
  timestamp  = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
  tool       = 'sync-split-pr'
  outcome    = 'pr_created'
  files      = $filesCount
  base       = $Base
  source     = $currentBranch
  syncBranch = $Branch
  prUrl      = $prUrl
}
