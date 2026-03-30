/**
 * Worktree discovery module.
 *
 * Parses `git worktree list --porcelain` output and returns structured
 * objects for each worktree. Used by WorktreesPanel to display active
 * agent worktrees without importing child_process directly in components.
 */

import { execSync } from 'node:child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
  isAgent: boolean;
}

/** Regex for branches created by the agent worktree convention. */
const AGENT_BRANCH_RE = /^(feat|fix|chore|refactor|test|perf|ci|build|docs)\/agent-[^/]+\//;

/**
 * Parse the porcelain output of `git worktree list --porcelain`.
 */
export function parseWorktreeOutput(raw: string): WorktreeInfo[] {
  const entries = raw.trim().split(/\n\n+/);
  const worktrees: WorktreeInfo[] = [];

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
 */
export function getAgentWorktrees(cwd = process.cwd()): WorktreeInfo[] {
  try {
    const raw = execSync('git worktree list --porcelain', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseWorktreeOutput(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[worktrees] git worktree list failed: ${message}\n`);
    return [];
  }
}
