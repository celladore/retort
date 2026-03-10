---
agentkit:
  scaffold: managed
---
# scripts/update-changelog.ps1
# Inserts an entry into the [Unreleased] section of CHANGELOG.md.
#
# Usage:
#   ./scripts/update-changelog.ps1 <section> "<description>" [pr-number] [history-doc-path]
#
# Arguments:
#   section          Changelog section: Added | Fixed | Changed | Removed | Security | Deprecated
#   description      Human-readable description of the change
#   PrNumber         Optional PR number (e.g. 42)
#   HistoryDoc       Optional relative path to the history document
#
# Examples:
#   ./scripts/update-changelog.ps1 Added "New user auth feature" 44
#   ./scripts/update-changelog.ps1 Fixed "Null reference in login" 43 `
#     "docs/history/bug-fixes/0001-2026-03-01-null-reference-bugfix.md"

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Added', 'Fixed', 'Changed', 'Removed', 'Security', 'Deprecated')]
  [string]$Section,

  [Parameter(Mandatory = $true)]
  [string]$Description,

  [Parameter(Mandatory = $false)]
  [string]$PrNumber = '',

  [Parameter(Mandatory = $false)]
  [string]$HistoryDoc = ''
)

$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$Changelog  = Join-Path $RepoRoot 'CHANGELOG.md'

if (-not (Test-Path $Changelog)) {
  Write-Error "CHANGELOG.md not found at $Changelog"
  exit 1
}

# ---------------------------------------------------------------------------
# Build the entry line
# ---------------------------------------------------------------------------

$Entry = "- $Description"

if ($PrNumber -and $HistoryDoc) {
  $Entry += " ([#${PrNumber}](../../pull/${PrNumber}), [history]($HistoryDoc))"
} elseif ($PrNumber) {
  $Entry += " ([#${PrNumber}](../../pull/${PrNumber}))"
} elseif ($HistoryDoc) {
  $Entry += " ([history]($HistoryDoc))"
}

# ---------------------------------------------------------------------------
# Insert entry via Node.js for reliable multiline editing
# ---------------------------------------------------------------------------

$NodeScript = @'
const [,, changelogPath, section, entry] = process.argv;
const fs = require('fs');
const content = fs.readFileSync(changelogPath, 'utf8');
const lines = content.split('\n');

const unreleasedIdx = lines.findIndex(l => /^## \[Unreleased\]/i.test(l));
if (unreleasedIdx === -1) {
  console.error('Error: could not find ## [Unreleased] section in CHANGELOG.md');
  process.exit(1);
}

let blockEnd = lines.findIndex((l, i) => i > unreleasedIdx && /^## /.test(l));
if (blockEnd === -1) blockEnd = lines.length;

const sectionHeader = `### ${section}`;
let sectionIdx = lines.findIndex((l, i) => i > unreleasedIdx && i < blockEnd && l.trim() === sectionHeader);

if (sectionIdx === -1) {
  let insertAt = blockEnd;
  for (let i = blockEnd - 1; i > unreleasedIdx; i--) {
    if (lines[i].trim() === '---') { insertAt = i; break; }
    if (lines[i].trim() !== '') break;
  }
  lines.splice(insertAt, 0, '', sectionHeader, entry);
} else {
  let insertAt = sectionIdx + 1;
  while (
    insertAt < blockEnd &&
    lines[insertAt].trim() !== '' &&
    !lines[insertAt].startsWith('###') &&
    !lines[insertAt].startsWith('##')
  ) {
    insertAt++;
  }
  lines.splice(insertAt, 0, entry);
}

fs.writeFileSync(changelogPath, lines.join('\n'), 'utf8');
console.log(`Updated CHANGELOG.md — ${section}: ${entry}`);
'@

$TmpScript = [System.IO.Path]::GetTempFileName() + '.mjs'
Set-Content -Path $TmpScript -Value $NodeScript -Encoding UTF8
try {
  node $TmpScript $Changelog $Section $Entry
} finally {
  Remove-Item -Force $TmpScript -ErrorAction SilentlyContinue
}
