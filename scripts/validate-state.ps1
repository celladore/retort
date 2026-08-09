# ---------------------------------------------------------------------------
# validate-state.ps1 — Validate orchestrator state before beginning work.
#                      (Windows PowerShell version)
#
# Usage:
#   ./scripts/validate-state.ps1
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$RepoRoot   = & git rev-parse --show-toplevel 2>$null
if (-not $RepoRoot) { $RepoRoot = $PWD.Path }

$StateDir   = Join-Path $RepoRoot '.claude\state'
$TasksDir   = Join-Path $StateDir 'tasks'
$ArchiveDir = Join-Path $TasksDir 'archive'
$OrchFile   = Join-Path $StateDir 'orchestrator.json'

$Errors   = 0
$Warnings = 0

Write-Host "=== State Validation ===" -ForegroundColor Cyan

# ── 1. Directory structure ────────────────────────────────────────────────
foreach ($dir in @($StateDir, $TasksDir, $ArchiveDir)) {
  if (-not (Test-Path $dir)) {
    Write-Host "[error] Missing directory: $dir" -ForegroundColor Red
    $Errors++
  }
}
if ($Errors -eq 0) {
  Write-Host "[ok] Directory structure intact" -ForegroundColor Green
}

# ── 2. orchestrator.json presence and schema ──────────────────────────────
if (-not (Test-Path $OrchFile)) {
  Write-Host "[warn] orchestrator.json not found — run /orchestrate to initialise" -ForegroundColor Yellow
  $Warnings++
} else {
  $orch = Get-Content $OrchFile -Raw | ConvertFrom-Json

  # Required fields
  foreach ($field in @('schema_version', 'repo_id', 'current_phase', 'phase_name')) {
    if (-not $orch.$field) {
      Write-Host "[error] orchestrator.json missing required field: $field" -ForegroundColor Red
      $Errors++
    }
  }

  # Branch match
  $currentBranch = & git branch --show-current 2>$null
  $orchBranch    = $orch.branch
  if ($orchBranch -and $currentBranch -and $orchBranch -ne $currentBranch) {
    Write-Host "[warn] Branch mismatch: state='$orchBranch', current='$currentBranch'" -ForegroundColor Yellow
    $Warnings++
  } else {
    Write-Host "[ok] Branch: $currentBranch" -ForegroundColor Green
  }

  $phase = $orch.phase_name
  Write-Host "[ok] Phase: $(if ($phase) { $phase } else { 'unknown' })" -ForegroundColor Green

  # Health status
  $healthStatus = if ($orch.healthStatus) { $orch.healthStatus } else { $orch.health_status }
  if ($healthStatus -in @('unhealthy', 'UNHEALTHY')) {
    Write-Host "[warn] Healthcheck is UNHEALTHY — run /check before proceeding" -ForegroundColor Yellow
    $Warnings++
  } elseif ($healthStatus) {
    Write-Host "[ok] Health: $healthStatus" -ForegroundColor Green
  }

  # Staleness
  $lastCheck = if ($orch.lastHealthcheck) { $orch.lastHealthcheck } else { $orch.last_healthcheck }
  if ($lastCheck) {
    try {
      $ageDays = ([datetime]::UtcNow - [datetime]::Parse($lastCheck)).Days
      if ($ageDays -gt 7) {
        Write-Host "[warn] Healthcheck is $ageDays day(s) old" -ForegroundColor Yellow
        $Warnings++
      }
    } catch {}
  }

  # Task counts
  $active = 0; $completedCount = 0; $rejectedCount = 0
  Get-ChildItem -Path $TasksDir -Filter '*.json' -File -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $t = Get-Content $_.FullName -Raw | ConvertFrom-Json
      switch ($t.status) {
        'completed' { $completedCount++ }
        'rejected'  { $rejectedCount++ }
        default     { $active++ }
      }
    } catch {}
  }

  Write-Host "[ok] Tasks: $active active, $completedCount completed (not yet archived), $rejectedCount rejected" -ForegroundColor Green
  if (($completedCount + $rejectedCount) -gt 0) {
    Write-Host "     Run ./scripts/reset-state.ps1 to archive $completedCount completed and $rejectedCount rejected task(s)" -ForegroundColor Yellow
  }

  # Completed project warning
  if ($orch.completed -eq $true) {
    Write-Host "[warn] orchestrator.json shows completed=true — project may be fully shipped" -ForegroundColor Yellow
    $Warnings++
  }
}

# ── Summary ────────────────────────────────────────────────────────────────
Write-Host ""
if ($Errors -gt 0) {
  Write-Host "FAIL: $Errors error(s), $Warnings warning(s)" -ForegroundColor Red
  exit 1
} elseif ($Warnings -gt 0) {
  Write-Host "WARN: $Warnings warning(s) — review above before proceeding" -ForegroundColor Yellow
} else {
  Write-Host "PASS: State is valid and ready for /orchestrate" -ForegroundColor Green
}
