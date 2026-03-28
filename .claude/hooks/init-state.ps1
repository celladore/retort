# ---------------------------------------------------------------------------
# Hook: SessionStart (supplementary) — Windows PowerShell version
# Purpose: Ensure .claude/state/tasks/ directories exist and warn when
#          orchestrator state is stale or from a different branch.
# Stdin:   JSON with session_id, cwd, hook_event_name, etc.
# Stdout:  JSON with hookSpecificOutput.additionalContext (warnings only)
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$input_json = [Console]::In.ReadToEnd()
$payload = $null
try { $payload = $input_json | ConvertFrom-Json } catch {}

$Cwd = if ($payload -and $payload.cwd) { $payload.cwd } else { $PWD.Path }

$StateDir   = Join-Path $Cwd '.claude\state'
$TasksDir   = Join-Path $StateDir 'tasks'
$ArchiveDir = Join-Path $TasksDir 'archive'
$OrchFile   = Join-Path $StateDir 'orchestrator.json'

# ── Ensure directories exist ──────────────────────────────────────────────
New-Item -ItemType Directory -Path $ArchiveDir -Force -ErrorAction SilentlyContinue | Out-Null

# ── Check orchestrator state ──────────────────────────────────────────────
$warnings = @()

if (Test-Path $OrchFile) {
  try {
    $orch = Get-Content $OrchFile -Raw | ConvertFrom-Json
    $orchBranch    = $orch.branch
    $orchHealth    = if ($orch.healthStatus) { $orch.healthStatus } else { $orch.health_status }
    $currentBranch = & git branch --show-current 2>$null

    if ($orchBranch -and $currentBranch -and $orchBranch -ne $currentBranch) {
      $warnings += "⚠ Orchestrator state is from branch '$orchBranch' — current branch is '$currentBranch'. Run /orchestrate --assess-only to refresh."
    }

    if ($orchHealth -in @('unhealthy', 'UNHEALTHY')) {
      $warnings += "⚠ Last healthcheck reported UNHEALTHY. Run /check before starting new work."
    }
  } catch {}
}

# ── Output ────────────────────────────────────────────────────────────────
$ctx = if ($warnings.Count -gt 0) { $warnings -join "`n" } else { "" }
@{ hookSpecificOutput = @{ additionalContext = $ctx } } | ConvertTo-Json -Compress
