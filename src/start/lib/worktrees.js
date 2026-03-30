/**
 * Worktree discovery module.
 *
 * Parses `git worktree list --porcelain` output and returns structured
 * objects for each worktree. Used by WorktreesPanel to display active
 * agent worktrees without importing child_process directly in components.
 */

import { execSync } from 'node:child_process';

/**
 * @typedef {Object} WorktreeInfo
 * @property {string}       path      Absolute path to the worktree root
 * @property {string}       branch    Branch name (e.g. 'feat/agent-frontend/my-task')
 *                                    or empty string for detached HEAD
 * @property {string}       head      Commit SHA (short)
 * @property {boolean}      isMain    True if this is the primary worktree (first entry)
 * @property {boolean}      isAgent   True if branch matches the agent branch pattern
 */

/** Regex for branches created by the agent worktree convention. */
const AGENT_BRANCH_RE = /^(feat|fix|chore|refactor|test|perf|ci|build|docs)\/agent-[^/]+\//;

/**
 * Parse the porcelain output of `git worktree list --porcelain`.
 *
 * Each entry is separated by a blank line and has the form:
 *   worktree <path>
 *   HEAD <sha>
 *   branch refs/heads/<name>   — or —
 *   detached
 *
 * @param {string} raw - Raw stdout from `git worktree list --porcelain`
 * @returns {WorktreeInfo[]}
 */
export function parseWorktreeOutput(raw) {
  const entries = raw.trim().split(/\n\n+/);
  const worktrees = [];

  for (const entry of entries) {
    if (!entry.trim()) continue;

    const lines = entry.split('\n');
    let path = '';
    let head = '';
    let branch = '';
    let isMain = false;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length).trim();
      } else if (line.startsWith('HEAD ')) {
        head = line.slice('HEAD '.length, 'HEAD '.length + 7).trim();
      } else if (line.startsWith('branch ')) {
        const ref = line.slice('branch '.length).trim();
        // Strip refs/heads/ prefix
        branch = ref.replace(/^refs\/heads\//, '');
      } else if (line === 'bare') {
        isMain = true;
      }
    }

    if (!path) continue;

    worktrees.push({
      path,
      branch,
      head,
      isMain: isMain || worktrees.length === 0,
      isAgent: AGENT_BRANCH_RE.test(branch),
    });
  }

  return worktrees;
}

/**
 * Retrieve all git worktrees for the given repository root.
 *
 * Returns an empty array if the command fails (e.g. not a git repo,
 * or `git` is not available in PATH).
 *
 * @param {string} [cwd=process.cwd()] - Repository root
 * @returns {WorktreeInfo[]}
 */
export function getAgentWorktrees(cwd = process.cwd()) {
  try {
    const raw = execSync('git worktree list --porcelain', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseWorktreeOutput(raw);
  } catch {
    return [];
  }
}
