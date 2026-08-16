# ---------------------------------------------------------------------------
# reset-state.ps1 — Clean stale tasks, archive completed/rejected, validate
#                   orchestrator state. (Windows PowerShell version)
#
# Usage:
#   ./scripts/reset-state.ps1 [-DryRun]
# ---------------------------------------------------------------------------
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'

$RepoRoot = & git rev-parse --show-toplevel 2>$null
if (-not $RepoRoot) { $RepoRoot = $PWD.Path }

$StateDir   = Join-Path $RepoRoot '.claude\state'
$TasksDir   = Join-Path $StateDir 'tasks'
$ArchiveDir = Join-Path $TasksDir 'archive'
$OrchFile   = Join-Path $StateDir 'orchestrator.json'

Write-Host "=== Retort State Reset ===" -ForegroundColor Cyan
Write-Host "State dir: $StateDir"
if ($DryRun) { Write-Host "(dry-run mode — no changes will be made)" -ForegroundColor Yellow }
Write-Host ""

# ── 1. Ensure directories exist ──────────────────────────────────────────
function Ensure-Dir([string]$Dir) {
  if (-not (Test-Path $Dir)) {
    if ($DryRun) {
      Write-Host "[create] Directory: $Dir" -ForegroundColor Yellow
    } else {
      New-Item -ItemType Directory -Path $Dir -Force | Out-Null
      Write-Host "[ok] Created: $Dir" -ForegroundColor Green
    }
  }
}

Ensure-Dir $StateDir
Ensure-Dir $TasksDir
Ensure-Dir $ArchiveDir

# ── 2. Archive completed and rejected task files ──────────────────────────
$Archived = 0
$Kept     = 0

Get-ChildItem -Path $TasksDir -Filter '*.json' -File | ForEach-Object {
  $file = $_
  try {
    $task   = Get-Content $file.FullName -Raw | ConvertFrom-Json
    $status = $task.status
  } catch {
    $status = $null
  }

  if ($status -eq 'completed' -or $status -eq 'rejected') {
    if ($DryRun) {
      Write-Host "[archive] $($file.Name) (status: $status)" -ForegroundColor Yellow
    } else {
      Move-Item -Path $file.FullName -Destination (Join-Path $ArchiveDir $file.Name)
      Write-Host "[ok] Archived: $($file.Name) ($status)" -ForegroundColor Green
    }
    $Archived++
  } else {
    $Kept++
  }
}

Write-Host ""
Write-Host "Tasks: $Archived archived, $Kept active remaining"

# ── 3. Validate orchestrator.json ─────────────────────────────────────────
Write-Host ""
Write-Host "=== Orchestrator Validation ===" -ForegroundColor Cyan

if (-not (Test-Path $OrchFile)) {
  Write-Host "[warn] orchestrator.json not found — nothing to validate" -ForegroundColor Yellow
  Write-Host "       Run /orchestrate to initialise state."
} else {
  $Issues = 0
  $orch = Get-Content $OrchFile -Raw | ConvertFrom-Json

  # Branch check
  $currentBranch = & git branch --show-current 2>$null
  $orchBranch    = $orch.branch
  if ($orchBranch -and $orchBranch -ne $currentBranch) {
    Write-Host "[warn] Branch mismatch: orchestrator.json has '$orchBranch', current is '$currentBranch'" -ForegroundColor Yellow
    Write-Host "       State may be stale. Run /orchestrate --assess-only to refresh."
    $Issues++
  } else {
    Write-Host "[ok] Branch: $currentBranch" -ForegroundColor Green
  }

  # Health status
  $healthStatus = if ($orch.healthStatus) { $orch.healthStatus } else { $orch.health_status }
  if ($healthStatus -in @('unhealthy', 'UNHEALTHY')) {
    Write-Host "[warn] Last healthcheck reported UNHEALTHY — run /check to verify" -ForegroundColor Yellow
    $Issues++
  } elseif ($healthStatus) {
    Write-Host "[ok] Health: $healthStatus" -ForegroundColor Green
  }

  # Staleness
  $lastCheck = if ($orch.lastHealthcheck) { $orch.lastHealthcheck } else { $orch.last_healthcheck }
  if ($lastCheck) {
    try {
      $checkDate = [datetime]::Parse($lastCheck)
      $ageDays   = ([datetime]::UtcNow - $checkDate).Days
      if ($ageDays -gt 7) {
        Write-Host "[warn] Healthcheck is $ageDays day(s) old — run /check to refresh" -ForegroundColor Yellow
        $Issues++
      } else {
        Write-Host "[ok] Healthcheck age: $ageDays day(s)" -ForegroundColor Green
      }
    } catch {}
  }

  $phase = $orch.phase_name
  Write-Host "[ok] Phase: $(if ($phase) { $phase } else { 'unknown' })" -ForegroundColor Green

  Write-Host ""
  if ($Issues -eq 0) {
    Write-Host "Orchestrator state looks clean." -ForegroundColor Green
  } else {
    Write-Host "$Issues issue(s) found — see warnings above." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Done."
