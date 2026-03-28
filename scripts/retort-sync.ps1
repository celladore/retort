#Requires -Version 5.1
<#
.SYNOPSIS
    Safe wrapper around retort sync for Windows.

.DESCRIPTION
    Runs a dry-run preview before applying sync, optionally backs up
    files that will be overwritten, and shows a post-sync git summary.
    See docs/engineering/sync-safety.md for full guidance.

.PARAMETER DryRun
    Preview what sync would change without writing any files.

.PARAMETER Apply
    Apply sync without a confirmation prompt.

.PARAMETER Backup
    Back up existing generated files to .sync-backup/ before writing.

.EXAMPLE
    .\scripts\retort-sync.ps1              # preview, then confirm
    .\scripts\retort-sync.ps1 -DryRun     # preview only
    .\scripts\retort-sync.ps1 -Apply      # apply without prompt
    .\scripts\retort-sync.ps1 -Apply -Backup  # apply with backup
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Apply,
    [switch]$Backup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$AgentKitDir = Join-Path $ProjectRoot '.agentkit'
$Cli = Join-Path $AgentKitDir 'engines\node\src\cli.mjs'
$BackupDir = Join-Path $ProjectRoot ".sync-backup\$(Get-Date -Format 'yyyyMMddTHHmmss')"

# -- Validate prerequisites --------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'node is required but not found in PATH.'
    exit 1
}

if (-not (Test-Path $Cli)) {
    Write-Error "Sync CLI not found at: $Cli"
    exit 1
}

# -- Verify render target directories ----------------------------------------
Write-Host '[retort-sync] Checking render target directories...'
$targetDirs = @('.claude', '.cursor', '.windsurf', '.clinerules', '.roo', '.github\instructions', '.gemini')
$missingTargets = $targetDirs | Where-Object { -not (Test-Path (Join-Path $ProjectRoot $_)) }

if ($missingTargets) {
    Write-Host '[retort-sync] ⚠️  The following render target directories do not exist:'
    $missingTargets | ForEach-Object { Write-Host "              $_" }
    Write-Host '[retort-sync]    Sync will create them. Run with -DryRun to preview first.'
}

# -- Dry-run preview ---------------------------------------------------------
Write-Host ''
Write-Host '[retort-sync] Running preview (--dry-run)...'
Push-Location $AgentKitDir
try {
    node engines/node/src/cli.mjs sync --dry-run
    if ($LASTEXITCODE -ne 0) {
        Write-Error '[retort-sync] Dry-run failed. Fix errors above before applying sync.'
        exit 1
    }
} finally {
    Pop-Location
}

# -- Early exit if only previewing -------------------------------------------
if ($DryRun) {
    Write-Host ''
    Write-Host '[retort-sync] Dry-run complete. No files were written.'
    Write-Host "              Run '.\scripts\retort-sync.ps1 -Apply' to apply."
    exit 0
}

# -- Prompt for confirmation (unless -Apply was passed) ----------------------
if (-not $Apply) {
    Write-Host ''
    $confirm = Read-Host '[retort-sync] Apply sync? Files listed above will be created/overwritten. [y/N]'
    if ($confirm -notmatch '^[Yy]$') {
        Write-Host '[retort-sync] Aborted. No files were written.'
        exit 0
    }
}

# -- Backup files that will be overwritten -----------------------------------
if ($Backup) {
    Write-Host ''
    Write-Host '[retort-sync] Backing up existing generated files...'
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

    $generatedPaths = @('.claude\rules', '.claude\commands', '.claude\agents', '.claude\hooks',
                        '.cursor\rules', '.github\instructions', '.windsurf\rules')
    foreach ($relPath in $generatedPaths) {
        $src = Join-Path $ProjectRoot $relPath
        if (Test-Path $src) {
            $dest = Join-Path $BackupDir $relPath
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
            Copy-Item -Path "$src\*" -Destination $dest -Recurse -Force
        }
    }
    $relBackup = $BackupDir.Replace("$ProjectRoot\", '')
    Write-Host "[retort-sync] Backup written to: $relBackup"
}

# -- Apply sync --------------------------------------------------------------
Write-Host ''
Write-Host '[retort-sync] Applying sync...'
Push-Location $AgentKitDir
try {
    node engines/node/src/cli.mjs sync
} finally {
    Pop-Location
}

# -- Post-sync git summary ---------------------------------------------------
Write-Host ''
if (Get-Command git -ErrorAction SilentlyContinue) {
    try {
        $changed  = (git -C $ProjectRoot diff --name-only 2>$null | Measure-Object -Line).Lines
        $newFiles = (git -C $ProjectRoot ls-files --others --exclude-standard 2>$null | Measure-Object -Line).Lines
        Write-Host '[retort-sync] Post-sync git summary:'
        Write-Host "              Modified (tracked): $changed file(s)"
        Write-Host "              New (untracked):    $newFiles file(s)"
        if ($changed -gt 0 -or $newFiles -gt 0) {
            Write-Host ''
            Write-Host "              Run 'git diff --stat' to review changes."
        }
    } catch {
        # Not a git repo or git failed — skip summary
    }
}

Write-Host ''
Write-Host '[retort-sync] Done.'
