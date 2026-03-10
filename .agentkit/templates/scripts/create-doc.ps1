<# agentkit: scaffold: managed #>
# scripts/create-doc.ps1
# Creates a new history document from the appropriate template.
#
# Usage:
#   ./scripts/create-doc.ps1 <type> "<title>" [pr-number]
#
# Arguments:
#   type        Document type: implementation | bugfix | feature | migration | issue | lesson
#   title       Human-readable title for the document
#   pr-number   Optional PR number to include in the document
#
# Examples:
#   ./scripts/create-doc.ps1 implementation "TreatWarningsAsErrors" 42
#   ./scripts/create-doc.ps1 bugfix "Null Reference in Auth" 43
#   ./scripts/create-doc.ps1 feature "User Authentication" 44
#   ./scripts/create-doc.ps1 migration "Upgrade to Node 22" 45

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('implementation', 'bugfix', 'feature', 'migration', 'issue', 'lesson')]
  [string]$Type,

  [Parameter(Mandatory = $true)]
  [string]$Title,

  [Parameter(Mandatory = $false)]
  [string]$PrNumber = ''
)

$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$HistoryDir = Join-Path $RepoRoot 'docs' 'history'
$IndexFile  = Join-Path $HistoryDir '.index.json'

# ---------------------------------------------------------------------------
# Determine subdirectory from type
# ---------------------------------------------------------------------------

$SubdirMap = @{
  implementation = 'implementations'
  bugfix         = 'bug-fixes'
  feature        = 'features'
  migration      = 'migrations'
  issue          = 'issues'
  lesson         = 'lessons-learned'
}
$Subdir = $SubdirMap[$Type]

# ---------------------------------------------------------------------------
# Read and update the sequential index
# ---------------------------------------------------------------------------

if (-not (Test-Path $IndexFile)) {
  $InitialIndex = @{
    nextNumber = 1
    sequences  = @{ implementation = 1; bugfix = 1; feature = 1; migration = 1; issue = 1; lesson = 1 }
    entries    = @()
  }
  $InitialIndex | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $IndexFile
}

$Index   = Get-Content $IndexFile -Raw | ConvertFrom-Json
$SeqNum  = if ($Index.sequences.$Type) { $Index.sequences.$Type } else { 1 }
$Padded  = $SeqNum.ToString('0000')
$Date    = (Get-Date -Format 'yyyy-MM-dd')

# Sanitize title
$Slug = $Title.ToLower() -replace '[^a-z0-9]', '-' -replace '-+', '-' -replace '^-|-$', ''

$Filename = "${Padded}-${Date}-${Slug}-${Type}.md"
$DestDir  = Join-Path $HistoryDir $Subdir
$DestFile = Join-Path $DestDir $Filename

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

# ---------------------------------------------------------------------------
# Copy template and substitute placeholders
# ---------------------------------------------------------------------------

$TemplateSrc = Join-Path $RepoRoot '.agentkit' 'templates' 'docs' 'history' $Subdir "TEMPLATE-${Type}.md"

if (-not (Test-Path $TemplateSrc)) {
  Write-Error "Template not found at $TemplateSrc"
  exit 1
}

$PrRef = if ($PrNumber) { "#$PrNumber" } else { '[#PR-Number]' }

(Get-Content $TemplateSrc -Raw).
  Replace('[Feature/Change Name]', $Title).
  Replace('[Bug Description]',      $Title).
  Replace('[Feature Name]',         $Title).
  Replace('[Migration Name]',       $Title).
  Replace('[Issue Title]',          $Title).
  Replace('[Lesson Title]',         $Title).
  Replace('[YYYY-MM-DD]',           $Date).
  Replace('[#PR-Number]',           $PrRef) |
  Set-Content -Encoding UTF8 $DestFile

# ---------------------------------------------------------------------------
# Update index
# ---------------------------------------------------------------------------

if ($Index.sequences.$Type) {
  $Index.sequences.$Type = $SeqNum + 1
} else {
  $Index.sequences | Add-Member -NotePropertyName $Type -NotePropertyValue ($SeqNum + 1) -Force
}

$Entry = [PSCustomObject]@{
  number = $SeqNum
  type   = $Type
  title  = $Title
  date   = $Date
  pr     = $PrNumber
  file   = "$Subdir/$Filename"
}

if ($null -eq $Index.entries) {
  $Index | Add-Member -NotePropertyName 'entries' -NotePropertyValue @($Entry) -Force
} else {
  $Index.entries += $Entry
}

$Index | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $IndexFile

Write-Host "Created: $DestFile"

# ---------------------------------------------------------------------------
# Update CHANGELOG.md
# ---------------------------------------------------------------------------

$ChangelogSectionMap = @{
  feature        = 'Added'
  implementation = 'Added'
  bugfix         = 'Fixed'
  migration      = 'Changed'
  issue          = ''
  lesson         = ''
}
$ChangelogSection = $ChangelogSectionMap[$Type]

$UpdateChangelogScript = Join-Path $ScriptDir 'update-changelog.ps1'
if (-not $ChangelogSection) {
  Write-Host "ℹ️  ${Type} records are not added to CHANGELOG.md — skipping changelog update."
} elseif (Test-Path $UpdateChangelogScript) {
  try {
    & $UpdateChangelogScript -Section $ChangelogSection -Description $Title `
      -PrNumber $PrNumber -HistoryDoc "$Subdir/$Filename"
  } catch {
    Write-Warning "Could not update CHANGELOG.md — please add the entry manually."
  }
} else {
  Write-Host "ℹ️  update-changelog.ps1 not found — skipping changelog update."
}
