#!/usr/bin/env bash
# scripts/create-doc.sh
# Creates a new history document from the appropriate template.
#
# Usage:
#   ./scripts/create-doc.sh <type> "<title>" [pr-number]
#
# Arguments:
#   type        Document type: implementation | bugfix | feature | migration
#   title       Human-readable title for the document
#   pr-number   Optional PR number to include in the document
#
# Examples:
#   ./scripts/create-doc.sh implementation "TreatWarningsAsErrors" 42
#   ./scripts/create-doc.sh bugfix "Null Reference in Auth" 43
#   ./scripts/create-doc.sh feature "User Authentication" 44
#   ./scripts/create-doc.sh migration "Upgrade to Node 22" 45

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HISTORY_DIR="$REPO_ROOT/docs/history"
INDEX_FILE="$HISTORY_DIR/.index.json"

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------

usage() {
  echo "Usage: $0 <type> \"<title>\" [pr-number]"
  echo "  type: implementation | bugfix | feature | migration"
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
fi

TYPE="$1"
TITLE="$2"
PR_NUMBER="${3:-}"

case "$TYPE" in
  implementation|bugfix|feature|migration) ;;
  *) echo "Error: unknown type '$TYPE'. Must be one of: implementation, bugfix, feature, migration"; exit 1 ;;
esac

# ---------------------------------------------------------------------------
# Determine subdirectory from type
# ---------------------------------------------------------------------------

case "$TYPE" in
  implementation) SUBDIR="implementations" ;;
  bugfix)         SUBDIR="bug-fixes" ;;
  feature)        SUBDIR="features" ;;
  migration)      SUBDIR="migrations" ;;
esac

# ---------------------------------------------------------------------------
# Read and update the sequential index
# ---------------------------------------------------------------------------

if [[ ! -f "$INDEX_FILE" ]]; then
  echo '{"nextNumber":1,"sequences":{"implementation":1,"bugfix":1,"feature":1,"migration":1},"entries":[]}' > "$INDEX_FILE"
fi

# Use node to read the current sequence number safely (no user input interpolated)
SEQ_NUM=$(node - "$INDEX_FILE" "$TYPE" << 'NODEEOF'
  const [,, indexFile, type] = process.argv;
  const fs = require('fs');
  const idx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  process.stdout.write(String(idx.sequences[type] || 1));
NODEEOF
)

PADDED=$(printf "%04d" "$SEQ_NUM")
DATE=$(date +%Y-%m-%d)

# Sanitize title: lowercase, spaces to hyphens, remove non-alphanumeric except hyphens
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')

FILENAME="${PADDED}-${DATE}-${SLUG}-${TYPE}.md"
DEST_DIR="$HISTORY_DIR/$SUBDIR"
DEST_FILE="$DEST_DIR/$FILENAME"

mkdir -p "$DEST_DIR"

# ---------------------------------------------------------------------------
# Copy template and substitute placeholders
# ---------------------------------------------------------------------------

TEMPLATE_SRC="$REPO_ROOT/.agentkit/templates/docs/history/$SUBDIR/TEMPLATE-${TYPE}.md"

if [[ ! -f "$TEMPLATE_SRC" ]]; then
  echo "Error: template not found at $TEMPLATE_SRC"
  exit 1
fi

PR_REF="${PR_NUMBER:+#${PR_NUMBER}}"

sed \
  -e "s/\[Feature\/Change Name\]/$TITLE/g" \
  -e "s/\[Bug Description\]/$TITLE/g" \
  -e "s/\[Feature Name\]/$TITLE/g" \
  -e "s/\[Migration Name\]/$TITLE/g" \
  -e "s/\[YYYY-MM-DD\]/$DATE/g" \
  -e "s/\[#PR-Number\]/${PR_REF:-[#PR-Number]}/g" \
  "$TEMPLATE_SRC" > "$DEST_FILE"

# ---------------------------------------------------------------------------
# Update index
# ---------------------------------------------------------------------------

node - "$INDEX_FILE" "$TYPE" "$SEQ_NUM" "$TITLE" "$DATE" "${PR_NUMBER:-}" "$SUBDIR/$FILENAME" << 'NODEEOF'
  const [,, indexFile, type, seqNum, title, date, pr, file] = process.argv;
  const fs = require('fs');
  const idx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  idx.sequences[type] = (idx.sequences[type] || 1) + 1;
  idx.entries = idx.entries || [];
  idx.entries.push({ number: Number(seqNum), type, title, date, pr, file });
  fs.writeFileSync(indexFile, JSON.stringify(idx, null, 2) + '\n');
NODEEOF

echo "Created: $DEST_FILE"
