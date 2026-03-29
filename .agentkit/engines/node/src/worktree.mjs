/**
 * Retort — Worktree Command
 * Wraps `git worktree add` and ensures the new worktree directory has an
 * `.agentkit-repo` marker so the sync engine picks the correct overlay.
 *
 * Without the marker, `runSync` falls back to `__TEMPLATE__` (or infers from
 * the directory name), causing an "overlay miss" that generates incorrect output.
 * See: PRs #478 and #479 (required manual `.agentkit-repo` intervention).
 *
 * Usage:
 *   retort worktree create <path> [branch] [--base <branch>] [--no-setup]
 *
 * Flags:
 *   --base <branch>   Branch to create the new worktree branch from (default: HEAD)
 *   --no-setup        Skip automatic pnpm install in the new worktree
 *   --dry-run         Show what would happen without making changes
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { REPO_NAME_PATTERN } from './repo-name.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the repo name from the `.agentkit-repo` marker in the given directory.
 * Returns null if the marker is absent or contains an invalid repo name.
 *
 * @param {string} dir
 * @returns {string|null}
 */
function readMarker(dir) {
  const markerPath = resolve(dir, '.agentkit-repo');
  if (!existsSync(markerPath)) return null;
  const raw = readFileSync(markerPath, 'utf-8').trim();
  if (!raw || !REPO_NAME_PATTERN.test(raw)) return null;
  return raw;
}

/**
 * Write `.agentkit-repo` to `worktreePath` with `repoName` as content.
 *
 * @param {string} worktreePath
 * @param {string} repoName
 */
function writeMarker(worktreePath, repoName) {
  const markerPath = resolve(worktreePath, '.agentkit-repo');
  writeFileSync(markerPath, repoName + '\n', 'utf-8');
}

/**
 * Run a git command from `cwd` and return its trimmed stdout.
 * Throws with a clear message on non-zero exit.
 *
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

// ---------------------------------------------------------------------------
// Main command handler
// ---------------------------------------------------------------------------

/**
 * Run `retort worktree create`.
 *
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 */
export async function runWorktreeCreate({ agentkitRoot, projectRoot, flags }) {
  const dryRun = flags['dry-run'] || false;
  const noSetup = flags['no-setup'] || false;
  const base = typeof flags.base === 'string' ? flags.base : null;

  // Positional args: [path, branchName?]
  const positionals = Array.isArray(flags._args) ? flags._args : [];
  const worktreeRelPath = positionals[0];
  const branchArg = positionals[1] || null;

  if (!worktreeRelPath) {
    throw new Error(
      'Usage: retort worktree create <path> [branch] [--base <branch>] [--no-setup] [--dry-run]'
    );
  }

  const worktreePath = resolve(projectRoot, worktreeRelPath);

  // Resolve repo name from the project root marker — this is what gets written
  // into the new worktree so the sync engine uses the same overlay.
  const repoName = readMarker(projectRoot);
  if (!repoName) {
    throw new Error(
      'No valid .agentkit-repo marker found in project root. ' +
        'Run "retort init" first to initialise the overlay.'
    );
  }

  // Determine the branch name:
  //   1. Explicit second positional arg
  //   2. Last path segment of the worktree path
  const branchName = branchArg || basename(worktreePath);

  // Build the git worktree add command
  const gitArgs = ['worktree', 'add', worktreePath, '-b', branchName];
  if (base) {
    gitArgs.push(base);
  }

  if (dryRun) {
    console.log('[retort:worktree] DRY-RUN — no files will be created');
    console.log(`  Would run: git ${gitArgs.join(' ')}`);
    console.log(`  Would write: ${resolve(worktreePath, '.agentkit-repo')} → "${repoName}"`);
    if (!noSetup && existsSync(resolve(projectRoot, 'package.json'))) {
      console.log(`  Would run: pnpm install (in ${worktreePath})`);
    }
    return;
  }

  // Create the worktree
  console.log(`[retort:worktree] Creating worktree at ${worktreePath} on branch "${branchName}"…`);
  try {
    git(gitArgs, projectRoot);
  } catch (err) {
    throw new Error(`git worktree add failed: ${err.message}`);
  }

  // Write the .agentkit-repo marker — this is the core fix.
  // Without it the sync engine would fall back to __TEMPLATE__ or infer
  // incorrectly from the directory name, producing the wrong overlay output.
  writeMarker(worktreePath, repoName);
  console.log(`[retort:worktree] Created .agentkit-repo marker (overlay: "${repoName}")`);

  // Optional dependency install
  if (!noSetup && existsSync(resolve(worktreePath, 'package.json'))) {
    console.log(`[retort:worktree] Running pnpm install…`);
    try {
      execFileSync('pnpm', ['install'], {
        cwd: worktreePath,
        stdio: 'inherit',
        windowsHide: true,
      });
    } catch {
      console.warn(
        '[retort:worktree] pnpm install failed (non-fatal). Run it manually before using the worktree.'
      );
    }
  }

  console.log(`[retort:worktree] Done. Worktree ready at ${worktreePath}`);
  console.log(`  Branch:  ${branchName}`);
  console.log(`  Overlay: ${repoName}`);
  console.log(`  Tip: cd ${worktreePath} and run "retort sync" to generate configs.`);
}

/**
 * Top-level worktree dispatcher. Routes sub-actions (create, list, remove).
 *
 * @param {object} opts
 */
export async function runWorktree({ agentkitRoot, projectRoot, flags }) {
  const subAction = Array.isArray(flags._args) ? flags._args[0] : undefined;

  if (!subAction || subAction === 'create') {
    // Strip the sub-action token from positionals so runWorktreeCreate sees
    // [path, branch?] as positionals[0] and positionals[1].
    const adjustedFlags =
      subAction === 'create'
        ? { ...flags, _args: (flags._args || []).slice(1) }
        : flags;
    return runWorktreeCreate({ agentkitRoot, projectRoot, flags: adjustedFlags });
  }

  throw new Error(
    `Unknown worktree sub-action: "${subAction}". Available: create`
  );
}
