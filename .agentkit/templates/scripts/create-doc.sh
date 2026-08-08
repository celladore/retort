---
agentkit:
  scaffold: managed
---
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
  echo "  type: implementation | bugfix | feature | migration | issue | lesson"
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
fi

TYPE="$1"
TITLE="$2"
PR_NUMBER="${3:-}"

case "$TYPE" in
  implementation|bugfix|feature|migration|issue|lesson) ;;
  *) echo "Error: unknown type '$TYPE'. Must be one of: implementation, bugfix, feature, migration, issue, lesson"; exit 1 ;;
esac

# ---------------------------------------------------------------------------
# Determine subdirectory from type
# ---------------------------------------------------------------------------

case "$TYPE" in
  implementation) SUBDIR="implementations" ;;
  bugfix)         SUBDIR="bug-fixes" ;;
  feature)        SUBDIR="features" ;;
  migration)      SUBDIR="migrations" ;;
  issue)          SUBDIR="issues" ;;
  lesson)         SUBDIR="lessons-learned" ;;
esac

# ---------------------------------------------------------------------------
# Determine the next sequence number
#
# The .index.json counter alone is not trustworthy: documents created before
# the index existed were never registered, so the counter under-reports and
# hands out a number that is already taken on disk. Scan the destination
# directory for the highest existing NNNN- prefix and use whichever is larger.
# The index is still updated below so it remains a usable audit trail.
# ---------------------------------------------------------------------------

DEST_DIR="$HISTORY_DIR/$SUBDIR"
mkdir -p "$DEST_DIR"

if [[ ! -f "$INDEX_FILE" ]]; then
  echo '{"sequences":{"implementation":1,"bugfix":1,"feature":1,"migration":1,"issue":1,"lesson":1},"entries":[]}' > "$INDEX_FILE"
fi

# Use node to resolve the sequence number safely (no user input interpolated)
SEQ_NUM=$(node - "$INDEX_FILE" "$TYPE" "$DEST_DIR" << 'NODEEOF'
  const [,, indexFile, type, destDir] = process.argv;
  const fs = require('fs');

  let counter = 1;
  try {
    const idx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    counter = Number(idx.sequences && idx.sequences[type]) || 1;
  } catch (err) {
    // Unreadable or malformed index — rely on the on-disk scan alone.
  }

  let highest = 0;
  try {
    for (const name of fs.readdirSync(destDir)) {
      const match = /^(\d{4})-/.exec(name);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
  } catch (err) {
    // Directory does not exist yet — nothing on disk to collide with.
  }

  process.stdout.write(String(Math.max(counter, highest + 1)));
NODEEOF
)

PADDED=$(printf "%04d" "$SEQ_NUM")
DATE=$(date +%Y-%m-%d)

# Sanitize title: lowercase, spaces to hyphens, remove non-alphanumeric except hyphens
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')

FILENAME="${PADDED}-${DATE}-${SLUG}-${TYPE}.md"
DEST_FILE="$DEST_DIR/$FILENAME"

# ---------------------------------------------------------------------------
# Copy template and substitute placeholders
# ---------------------------------------------------------------------------

TEMPLATE_SRC="$REPO_ROOT/.agentkit/templates/docs/history/$SUBDIR/TEMPLATE-${TYPE}.md"

if [[ ! -f "$TEMPLATE_SRC" ]]; then
  echo "Error: template not found at $TEMPLATE_SRC"
  exit 1
fi

# Render the PR reference as a clickable link when the GitHub slug is known,
# matching the "[#123](https://github.com/org/repo/pull/123)" convention used
# across existing history docs. Falls back to a bare "#123" otherwise.
GITHUB_SLUG="{{githubSlug}}"

if [[ -z "$PR_NUMBER" ]]; then
  PR_REF="[#PR-Number]"
elif [[ -n "$GITHUB_SLUG" && "$GITHUB_SLUG" != *"{{"* ]]; then
  PR_REF="[#${PR_NUMBER}](https://github.com/${GITHUB_SLUG}/pull/${PR_NUMBER})"
else
  PR_REF="#${PR_NUMBER}"
fi

# Perform literal replacements using Node.js to avoid sed injection
TITLE_VAL="$TITLE" DATE_VAL="$DATE" PR_REF_VAL="$PR_REF" \
node - "$TEMPLATE_SRC" "$DEST_FILE" << 'NODEEOF'
  const fs = require('fs');
  const [,, src, dest] = process.argv;
  let content = fs.readFileSync(src, 'utf8');

  const replacements = {
    '[Feature/Change Name]': process.env.TITLE_VAL,
    '[Bug Description]':      process.env.TITLE_VAL,
    '[Feature Name]':         process.env.TITLE_VAL,
    '[Migration Name]':       process.env.TITLE_VAL,
    '[Issue Title]':          process.env.TITLE_VAL,
    '[Lesson Title]':         process.env.TITLE_VAL,
    '[YYYY-MM-DD]':           process.env.DATE_VAL,
    '[#PR-Number]':           process.env.PR_REF_VAL
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.split(placeholder).join(value);
  }

  fs.writeFileSync(dest, content, 'utf8');
NODEEOF

# ---------------------------------------------------------------------------
# Update index
# ---------------------------------------------------------------------------

node - "$INDEX_FILE" "$TYPE" "$SEQ_NUM" "$TITLE" "$DATE" "${PR_NUMBER:-}" "$SUBDIR/$FILENAME" << 'NODEEOF'
  const [,, indexFile, type, seqNum, title, date, pr, file] = process.argv;
  const fs = require('fs');

  let idx;
  try {
    idx = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  } catch (err) {
    // Corrupted index — rebuild it rather than aborting. The document has
    // already been written at this point, so failing here would leave the
    // run half-finished with no changelog entry.
    process.stderr.write(`Warning: could not parse ${indexFile} — rebuilding it.\n`);
    idx = {};
  }

  idx.sequences = idx.sequences || {};
  // Advance past the number actually used, not past the (possibly stale) counter.
  idx.sequences[type] = Number(seqNum) + 1;
  idx.entries = idx.entries || [];
  idx.entries.push({ number: Number(seqNum), type, title, date, pr, file });
  fs.writeFileSync(indexFile, JSON.stringify(idx, null, 2) + '\n');
NODEEOF

echo "Created: $DEST_FILE"

# ---------------------------------------------------------------------------
# Update CHANGELOG.md
# ---------------------------------------------------------------------------

# Map history doc type to changelog section
case "$TYPE" in
  feature)        CHANGELOG_SECTION="Added" ;;
  implementation) CHANGELOG_SECTION="Added" ;;
  bugfix)         CHANGELOG_SECTION="Fixed" ;;
  migration)      CHANGELOG_SECTION="Changed" ;;
  issue)          CHANGELOG_SECTION="" ;;  # Issues don't go in changelog
  lesson)         CHANGELOG_SECTION="" ;;  # Lessons don't go in changelog
esac

# CHANGELOG.md lives at the repository root, so the link must be repo-relative
# ("docs/history/<subdir>/<file>") — not relative to docs/history/.
CHANGELOG_DOC_PATH="docs/history/$SUBDIR/$FILENAME"

UPDATE_CHANGELOG="$SCRIPT_DIR/update-changelog.sh"
if [[ -z "$CHANGELOG_SECTION" ]]; then
  echo "ℹ️  ${TYPE} records are not added to CHANGELOG.md — skipping changelog update."
elif [[ -f "$UPDATE_CHANGELOG" ]]; then
  bash "$UPDATE_CHANGELOG" "$CHANGELOG_SECTION" "$TITLE" "${PR_NUMBER:-}" "$CHANGELOG_DOC_PATH" || \
    echo "⚠️  Could not update CHANGELOG.md — please add the entry manually."
else
  echo "ℹ️  update-changelog.sh not found — skipping changelog update."
fi
