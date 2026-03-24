#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# scripts/retort-sync.sh — safe wrapper around retort sync
#
# Usage:
#   ./scripts/retort-sync.sh              # preview (dry-run), then confirm
#   ./scripts/retort-sync.sh --apply      # apply without preview prompt
#   ./scripts/retort-sync.sh --dry-run    # preview only, never write
#   ./scripts/retort-sync.sh --backup     # backup overwritten files to .sync-backup/
#   ./scripts/retort-sync.sh --help
#
# Why this wrapper exists:
#   The sync engine can modify or delete files that users have hand-edited.
#   This wrapper ensures a preview step before writing and optionally backs up
#   files that will be overwritten.  See docs/engineering/sync-safety.md.
# ---------------------------------------------------------------------------
set -euo pipefail

AGENTKIT_DIR="$(cd "$(dirname "$0")/.." && pwd)/.agentkit"
CLI="${AGENTKIT_DIR}/engines/node/src/cli.mjs"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/.sync-backup/$(date -u +%Y%m%dT%H%M%S)"

DRY_RUN=false
APPLY=false
BACKUP=false

# -- Parse arguments ---------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --apply)   APPLY=true ;;
        --backup)  BACKUP=true ;;
        --help|-h)
            sed -n '2,14p' "$0" | sed 's/^# //'
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            exit 1
            ;;
    esac
done

# -- Validate prerequisites --------------------------------------------------
if ! command -v node &>/dev/null; then
    echo "Error: node is required but not found in PATH." >&2
    exit 1
fi

if [[ ! -f "$CLI" ]]; then
    echo "Error: sync CLI not found at: $CLI" >&2
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# -- Verify render target directories ----------------------------------------
echo "[retort-sync] Checking render target directories..."
missing_targets=()
for dir in ".claude" ".cursor" ".windsurf" ".clinerules" ".roo" ".github/instructions" ".gemini"; do
    if [[ ! -d "${PROJECT_ROOT}/${dir}" ]]; then
        missing_targets+=("$dir")
    fi
done

if [[ ${#missing_targets[@]} -gt 0 ]]; then
    echo "[retort-sync] ⚠️  The following render target directories do not exist:"
    for t in "${missing_targets[@]}"; do
        echo "              $t"
    done
    echo "[retort-sync]    Sync will create them. Run with --dry-run to preview first."
fi

# -- Dry-run preview ---------------------------------------------------------
echo ""
echo "[retort-sync] Running preview (--dry-run)..."
(cd "$AGENTKIT_DIR" && node engines/node/src/cli.mjs sync --dry-run 2>&1) || {
    echo "[retort-sync] ❌ Dry-run failed. Fix the errors above before applying sync." >&2
    exit 1
}

# -- Early exit if only previewing -------------------------------------------
if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    echo "[retort-sync] Dry-run complete. No files were written."
    echo "              Run './scripts/retort-sync.sh --apply' to apply."
    exit 0
fi

# -- Prompt for confirmation (unless --apply was passed) ---------------------
if [[ "$APPLY" != "true" ]]; then
    echo ""
    read -r -p "[retort-sync] Apply sync? Files listed above will be created/overwritten. [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "[retort-sync] Aborted. No files were written."
        exit 0
    fi
fi

# -- Backup files that will be overwritten -----------------------------------
if [[ "$BACKUP" == "true" ]]; then
    echo ""
    echo "[retort-sync] Backing up existing generated files to: .sync-backup/..."
    mkdir -p "$BACKUP_DIR"

    # Backup tracked generated files (those matching common generated output paths)
    find "$PROJECT_ROOT" \
        \( -path "*/.claude/rules/*" \
        -o -path "*/.claude/commands/*" \
        -o -path "*/.claude/agents/*" \
        -o -path "*/.claude/hooks/*" \
        -o -path "*/.cursor/rules/*" \
        -o -path "*/.github/instructions/*" \
        -o -path "*/.windsurf/rules/*" \
        \) \
        -type f 2>/dev/null | while read -r f; do
        rel="${f#${PROJECT_ROOT}/}"
        dest_dir="${BACKUP_DIR}/$(dirname "$rel")"
        mkdir -p "$dest_dir"
        cp "$f" "${dest_dir}/" 2>/dev/null || true
    done

    echo "[retort-sync] Backup written to: ${BACKUP_DIR#${PROJECT_ROOT}/}"
fi

# -- Apply sync --------------------------------------------------------------
echo ""
echo "[retort-sync] Applying sync..."
(cd "$AGENTKIT_DIR" && node engines/node/src/cli.mjs sync 2>&1)

# -- Post-sync git summary ---------------------------------------------------
echo ""
if command -v git &>/dev/null && git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
    changed=$(git -C "$PROJECT_ROOT" diff --name-only 2>/dev/null | wc -l | tr -d ' ')
    untracked=$(git -C "$PROJECT_ROOT" ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
    echo "[retort-sync] Post-sync git summary:"
    echo "              Modified (tracked): ${changed} file(s)"
    echo "              New (untracked):    ${untracked} file(s)"
    if [[ "$changed" -gt 0 ]] || [[ "$untracked" -gt 0 ]]; then
        echo ""
        echo "              Run 'git diff --stat' to review changes."
        echo "              Run 'git add -p' to stage selectively."
    fi
fi

echo ""
echo "[retort-sync] Done."
