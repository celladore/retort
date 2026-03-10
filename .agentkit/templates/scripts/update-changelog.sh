---
agentkit:
  scaffold: managed
---
#!/usr/bin/env bash
# scripts/update-changelog.sh
# Inserts an entry into the [Unreleased] section of CHANGELOG.md.
#
# Usage:
#   ./scripts/update-changelog.sh <section> "<description>" [pr-number] [history-doc-path]
#
# Arguments:
#   section          Changelog section: Added | Fixed | Changed | Removed | Security | Deprecated
#   description      Human-readable description of the change
#   pr-number        Optional PR number (e.g. 42)
#   history-doc-path Optional relative path to the history document
#
# Examples:
#   ./scripts/update-changelog.sh Added "New user auth feature" 44
#   ./scripts/update-changelog.sh Fixed "Null reference in login flow" 43 \
#     "docs/history/bug-fixes/0001-2026-03-01-null-reference-bugfix.md"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHANGELOG="$REPO_ROOT/CHANGELOG.md"

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------

usage() {
  echo "Usage: $0 <section> \"<description>\" [pr-number] [history-doc-path]"
  echo "  section: Added | Fixed | Changed | Removed | Security | Deprecated"
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
fi

SECTION="$1"
DESCRIPTION="$2"
PR_NUMBER="${3:-}"
HISTORY_DOC="${4:-}"

case "$SECTION" in
  Added|Fixed|Changed|Removed|Security|Deprecated) ;;
  *) echo "Error: unknown section '$SECTION'. Must be one of: Added, Fixed, Changed, Removed, Security, Deprecated"; exit 1 ;;
esac

if [[ ! -f "$CHANGELOG" ]]; then
  echo "Error: CHANGELOG.md not found at $CHANGELOG"
  exit 1
fi

# ---------------------------------------------------------------------------
# Build the entry line
# ---------------------------------------------------------------------------

ENTRY="- $DESCRIPTION"

if [[ -n "$PR_NUMBER" && -n "$HISTORY_DOC" ]]; then
  ENTRY="$ENTRY ([#${PR_NUMBER}](../../pull/${PR_NUMBER}), [history](${HISTORY_DOC}))"
elif [[ -n "$PR_NUMBER" ]]; then
  ENTRY="$ENTRY ([#${PR_NUMBER}](../../pull/${PR_NUMBER}))"
elif [[ -n "$HISTORY_DOC" ]]; then
  ENTRY="$ENTRY ([history](${HISTORY_DOC}))"
fi

# ---------------------------------------------------------------------------
# Insert entry into CHANGELOG.md using Node.js for reliable multiline editing
# ---------------------------------------------------------------------------

node - "$CHANGELOG" "$SECTION" "$ENTRY" << 'NODEEOF'
const [,, changelogPath, section, entry] = process.argv;
const fs = require('fs');
const content = fs.readFileSync(changelogPath, 'utf8');
const lines = content.split('\n');

// Find the [Unreleased] section
const unreleasedIdx = lines.findIndex(l => /^## \[Unreleased\]/i.test(l));
if (unreleasedIdx === -1) {
  console.error('Error: could not find ## [Unreleased] section in CHANGELOG.md');
  process.exit(1);
}

// Find or create the target ### section within [Unreleased]
// The [Unreleased] block ends at the next ## line
let blockEnd = lines.findIndex((l, i) => i > unreleasedIdx && /^## /.test(l));
if (blockEnd === -1) blockEnd = lines.length;

const sectionHeader = `### ${section}`;
let sectionIdx = lines.findIndex((l, i) => i > unreleasedIdx && i < blockEnd && l.trim() === sectionHeader);

if (sectionIdx === -1) {
  // Section doesn't exist — insert before blockEnd (or before the next ---/## delimiter)
  let insertAt = blockEnd;
  // Look for a trailing --- separator just before blockEnd
  for (let i = blockEnd - 1; i > unreleasedIdx; i--) {
    if (lines[i].trim() === '---') { insertAt = i; break; }
    if (lines[i].trim() !== '') break;
  }
  lines.splice(insertAt, 0, '', sectionHeader, entry);
} else {
  // Section exists — insert after the header line (and any existing entries)
  let insertAt = sectionIdx + 1;
  // Find the end of this section's entries (next ### or ## or blank+##/###)
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
NODEEOF
