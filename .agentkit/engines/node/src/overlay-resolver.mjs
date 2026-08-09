/**
 * Retort — Overlay Resolver
 * Determines which overlay to use and collects template files from base + overlay.
 * Extracted from synchronize.mjs (Step 4 of modularization).
 */
import { execFileSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { readdir } from 'fs/promises';
import { basename, dirname, join, relative, resolve } from 'path';
import { readText } from './spec-loader.mjs';

// ---------------------------------------------------------------------------
// Local walkDir (avoids circular import with synchronize.mjs)
// ---------------------------------------------------------------------------

async function* walkDir(dir) {
  if (!existsSync(dir)) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Overlay selection
// ---------------------------------------------------------------------------

function inferOverlayFromProjectRoot(agentkitRoot, projectRoot) {
  const inferredName = basename(resolve(projectRoot));
  if (!inferredName) return null;
  const settingsPath = resolve(agentkitRoot, 'overlays', inferredName, 'settings.yaml');
  return existsSync(settingsPath) ? inferredName : null;
}

/**
 * Read and trim the `.agentkit-repo` marker in `dir`.
 * Returns null when the marker is absent or blank.
 *
 * @param {string} dir
 * @returns {string|null}
 */
function readMarkerName(dir) {
  const markerPath = resolve(dir, '.agentkit-repo');
  if (!existsSync(markerPath)) return null;
  const raw = (readText(markerPath) || '').trim();
  return raw || null;
}

/**
 * Overlay directory names that actually carry a settings.yaml, sorted.
 *
 * @param {string} agentkitRoot
 * @returns {string[]}
 */
function listAvailableOverlays(agentkitRoot) {
  const overlaysDir = resolve(agentkitRoot, 'overlays');
  let entries;
  try {
    entries = readdirSync(overlaysDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(resolve(overlaysDir, name, 'settings.yaml')))
    .sort();
}

/**
 * Root of the primary worktree when `projectRoot` is a linked git worktree.
 *
 * `git rev-parse --git-common-dir` resolves to the shared `.git` directory,
 * which lives in the primary worktree no matter which linked worktree asks —
 * so its parent is the primary worktree root. That root is where `retort init`
 * wrote the marker, which is why it is a trustworthy second source.
 *
 * Returns null outside a git repository, in a bare repo, when git is
 * unavailable, or when the common dir is not a conventional `<root>/.git`.
 *
 * @param {string} projectRoot
 * @returns {string|null}
 */
function findPrimaryWorktreeRoot(projectRoot) {
  let commonDir;
  try {
    commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
  if (!commonDir) return null;

  // Git may answer with a path relative to cwd (".git") or an absolute one.
  const absoluteCommonDir = resolve(projectRoot, commonDir);
  if (basename(absoluteCommonDir) !== '.git') return null;

  const primaryRoot = dirname(absoluteCommonDir);
  return primaryRoot === resolve(projectRoot) ? null : primaryRoot;
}

/**
 * True when `name` addresses a direct child of `overlays/`.
 * Rejects path separators and traversal segments before the name is ever
 * joined onto a filesystem path.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isSafeOverlayName(name) {
  return Boolean(name) && basename(name) === name && name !== '.' && name !== '..';
}

function formatAvailableOverlays(agentkitRoot) {
  const available = listAvailableOverlays(agentkitRoot);
  return available.length ? available.join(', ') : '(none — is .agentkit/overlays/ present?)';
}

const FIX_HINTS = [
  '  How to fix — pick one:',
  '    retort init                       initialise this repo and write the marker',
  '    retort sync --overlay <name>      select an overlay for this run only',
  '    echo "<name>" > .agentkit-repo    pin the overlay for this checkout',
  '    retort worktree create <path>     create worktrees with the marker already written',
].join('\n');

/**
 * Confirm a candidate overlay resolves to a real overlay directory.
 * Throws rather than letting an unknown name fall through to a silent
 * base-templates-only render.
 *
 * @param {{repoName: string, reason: string}} selection
 * @param {string} agentkitRoot
 * @returns {{repoName: string, reason: string}}
 */
function assertOverlayExists(selection, agentkitRoot) {
  const { repoName, reason } = selection;

  if (!isSafeOverlayName(repoName)) {
    throw new Error(
      `Invalid overlay name "${repoName}" (from ${reason}).\n` +
        '  An overlay name must be a single directory name under .agentkit/overlays/,\n' +
        '  with no path separators or ".." segments.\n' +
        `  Available overlays: ${formatAvailableOverlays(agentkitRoot)}\n` +
        FIX_HINTS
    );
  }

  if (!existsSync(resolve(agentkitRoot, 'overlays', repoName, 'settings.yaml'))) {
    throw new Error(
      `Overlay "${repoName}" (from ${reason}) does not exist.\n` +
        `  Expected: ${resolve(agentkitRoot, 'overlays', repoName, 'settings.yaml')}\n` +
        `  Available overlays: ${formatAvailableOverlays(agentkitRoot)}\n` +
        FIX_HINTS
    );
  }

  return selection;
}

/**
 * Decide which overlay this sync renders from — resolve or abort, never guess.
 *
 * Resolution order, most explicit first:
 *   1. `--overlay <name>`
 *   2. `.agentkit-repo` at the sync root
 *   3. `.agentkit-repo` in the primary worktree (for linked git worktrees)
 *   4. an overlay whose name matches the project root directory name
 *   5. abort
 *
 * There is deliberately no `__TEMPLATE__` fallback. That fallback rendered
 * mass wrong-content output whenever a marker was missing — silently, because
 * every file still generated successfully — and is the documented root cause of
 * PRs #478 and #479. `__TEMPLATE__` stays selectable, but only by name.
 *
 * See ADR-11 decision 3.
 *
 * @param {string} agentkitRoot
 * @param {string} projectRoot
 * @param {object} [flags]
 * @returns {{repoName: string, reason: string}}
 * @throws {Error} when no overlay can be resolved, or the resolved one is unknown
 */
export function resolveOverlaySelection(agentkitRoot, projectRoot, flags) {
  if (flags != null && Object.hasOwn(flags, 'overlay')) {
    return assertOverlayExists(
      { repoName: String(flags.overlay).trim(), reason: '--overlay flag' },
      agentkitRoot
    );
  }

  const markerName = readMarkerName(projectRoot);
  if (markerName) {
    return assertOverlayExists(
      { repoName: markerName, reason: '.agentkit-repo marker' },
      agentkitRoot
    );
  }

  const primaryWorktreeRoot = findPrimaryWorktreeRoot(projectRoot);
  const primaryMarkerName = primaryWorktreeRoot ? readMarkerName(primaryWorktreeRoot) : null;
  if (primaryMarkerName) {
    return assertOverlayExists(
      {
        repoName: primaryMarkerName,
        reason: `.agentkit-repo marker in primary worktree (${primaryWorktreeRoot})`,
      },
      agentkitRoot
    );
  }

  const inferredOverlay = inferOverlayFromProjectRoot(agentkitRoot, projectRoot);
  if (inferredOverlay) {
    return {
      repoName: inferredOverlay,
      reason: `inferred from project root name "${basename(resolve(projectRoot))}"`,
    };
  }

  const primaryNote = primaryWorktreeRoot
    ? `  No .agentkit-repo marker in the primary worktree either (${primaryWorktreeRoot}).`
    : '  Not inside a linked git worktree, so there is no primary worktree to fall back to.';

  throw new Error(
    'Cannot determine which overlay to render — refusing to guess.\n' +
      `  No .agentkit-repo marker at ${resolve(projectRoot)}.\n` +
      `${primaryNote}\n` +
      `  No overlay is named "${basename(resolve(projectRoot))}" either.\n` +
      `  Available overlays: ${formatAvailableOverlays(agentkitRoot)}\n` +
      FIX_HINTS
  );
}

// ---------------------------------------------------------------------------
// Template file collection
// ---------------------------------------------------------------------------

export async function collectTemplateFiles(baseDir, overlayDir = null) {
  const filesByRelativePath = new Map();

  for (const dir of [baseDir, overlayDir]) {
    if (!dir || !existsSync(dir)) continue;
    for await (const srcFile of walkDir(dir)) {
      const relPath = relative(dir, srcFile);
      filesByRelativePath.set(relPath, srcFile);
    }
  }

  return filesByRelativePath;
}
