[CmdletBinding()]
param(
  [string]$Base,
  [string]$Branch,
  [string]$CommitMessage = 'chore(sync): regenerate generated outputs',
  [string]$PrTitle = 'chore(sync): regenerate generated outputs',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-UsageLog {
  param([hashtable]$Payload)
  $logDir = Join-Path $PWD '.agentkit/logs'
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $file = Join-Path $logDir 'tool-usage.jsonl'
  $Payload['timestamp'] = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  Add-Content -Path $file -Value ($Payload | ConvertTo-Json -Compress)
}

function Assert-RequiredCommand {
  param([string]$Name)
  if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not available in PATH. Install it and retry."
  }
}

Assert-RequiredCommand -Name 'git'
Assert-RequiredCommand -Name 'pnpm'
Assert-RequiredCommand -Name 'gh'

$status = git status --porcelain
if ($status) {
  throw 'Working tree is not clean. Commit/stash/discard changes before running sync split.'
}

$currentBranch = (git branch --show-current).Trim()
if (-not $Base) {
  $Base = $currentBranch
}

if (-not $Branch) {
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
  $Branch = "chore/sync-generated-$stamp"
}

Write-Information 'Running sync...' -InformationAction Continue
pnpm -C .agentkit agentkit:sync

$changed = git status --porcelain
if (-not $changed) {
  Write-Information 'No sync-generated changes detected.' -InformationAction Continue
  Write-UsageLog @{ tool = 'sync-split-pr'; outcome = 'no_changes'; base = $Base; branch = $currentBranch }
  exit 0
}

$filesCount = @($changed -split "`n" | Where-Object { $_.Trim() }).Count
Write-Information "Detected $filesCount changed file(s) from sync." -InformationAction Continue

if ($DryRun) {
  Write-Information 'Dry run enabled; not creating branch/commit/PR.' -InformationAction Continue
  git status --short
  Write-UsageLog @{ tool = 'sync-split-pr'; outcome = 'dry_run'; files = $filesCount; base = $Base; branch = $currentBranch }
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
Write-Information "Created PR: $prUrl" -InformationAction Continue

Write-UsageLog @{
  tool = 'sync-split-pr'
  outcome = 'pr_created'
  files = $filesCount
  base = $Base
  source = $currentBranch
  syncBranch = $Branch
  prUrl = $prUrl
}
