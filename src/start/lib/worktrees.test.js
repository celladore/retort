import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseWorktreeOutput, getAgentWorktrees } from './worktrees.js';

// ---------------------------------------------------------------------------
// parseWorktreeOutput — pure function, no mocking needed
// ---------------------------------------------------------------------------

describe('parseWorktreeOutput', () => {
  it('should parse a single main worktree', () => {
    const raw = `worktree /home/user/repo
HEAD abc1234567890
branch refs/heads/main

`;
    const result = parseWorktreeOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/home/user/repo');
    expect(result[0].branch).toBe('main');
    expect(result[0].head).toBe('abc1234');
    expect(result[0].isMain).toBe(false);
    expect(result[0].isAgent).toBe(false);
  });

  it('should parse a bare (main) worktree', () => {
    const raw = `worktree /home/user/repo
HEAD abc1234567890
bare

`;
    const result = parseWorktreeOutput(raw);
    expect(result[0].isMain).toBe(true);
  });

  it('should handle detached HEAD (no branch line)', () => {
    const raw = `worktree /home/user/repo/.worktrees/detached
HEAD deadbeef1234
detached

`;
    const result = parseWorktreeOutput(raw);
    expect(result[0].branch).toBe('');
    expect(result[0].isAgent).toBe(false);
  });

  it('should strip refs/heads/ prefix from branch names', () => {
    const raw = `worktree /repo/.worktrees/feat
HEAD 1111111
branch refs/heads/feat/agent-backend/add-endpoint

`;
    const result = parseWorktreeOutput(raw);
    expect(result[0].branch).toBe('feat/agent-backend/add-endpoint');
  });

  it('should mark agent branches correctly', () => {
    const agentBranches = [
      'feat/agent-backend/add-endpoint',
      'fix/agent-testing/coverage-auth',
      'chore/agent-infra/update-deps',
    ];

    for (const branch of agentBranches) {
      const raw = `worktree /repo/.worktrees/x\nHEAD 1234567\nbranch refs/heads/${branch}\n\n`;
      const [wt] = parseWorktreeOutput(raw);
      expect(wt.isAgent).toBe(true);
    }
  });

  it('should not mark non-agent branches as agent', () => {
    const nonAgentBranches = ['main', 'dev', 'feat/add-something', 'fix/my-bug'];

    for (const branch of nonAgentBranches) {
      const raw = `worktree /repo\nHEAD 1234567\nbranch refs/heads/${branch}\n\n`;
      const [wt] = parseWorktreeOutput(raw);
      expect(wt.isAgent).toBe(false);
    }
  });

  it('should parse multiple worktrees separated by blank lines', () => {
    const raw = `worktree /repo
HEAD aaa1111
branch refs/heads/main

worktree /repo/.worktrees/feat
HEAD bbb2222
branch refs/heads/feat/agent-frontend/my-task

`;
    const result = parseWorktreeOutput(raw);
    expect(result).toHaveLength(2);
    expect(result[0].branch).toBe('main');
    expect(result[1].branch).toBe('feat/agent-frontend/my-task');
    expect(result[1].isAgent).toBe(true);
  });

  it('should skip entries with no worktree path', () => {
    const raw = `HEAD aaa1111
branch refs/heads/main

worktree /repo/.worktrees/real
HEAD bbb2222
branch refs/heads/dev

`;
    const result = parseWorktreeOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('dev');
  });

  it('should truncate HEAD SHA to 7 characters', () => {
    const raw = `worktree /repo
HEAD abcdef1234567890
branch refs/heads/main

`;
    const [wt] = parseWorktreeOutput(raw);
    expect(wt.head).toBe('abcdef1');
  });

  it('should return an empty array for empty input', () => {
    expect(parseWorktreeOutput('')).toEqual([]);
    expect(parseWorktreeOutput('   ')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAgentWorktrees — wraps execSync, needs mocking
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getAgentWorktrees', () => {
  it('should return parsed worktrees on success', () => {
    execSync.mockReturnValue(`worktree /repo
HEAD abc1234567890
branch refs/heads/main

`);
    const result = getAgentWorktrees('/repo');
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('main');
  });

  it('should pass cwd to execSync', () => {
    execSync.mockReturnValue('');
    getAgentWorktrees('/custom/path');
    expect(execSync).toHaveBeenCalledWith(
      'git worktree list --porcelain',
      expect.objectContaining({ cwd: '/custom/path' })
    );
  });

  it('should return an empty array when execSync throws', () => {
    execSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });
    const result = getAgentWorktrees('/not-a-repo');
    expect(result).toEqual([]);
  });

  it('should default cwd to process.cwd()', () => {
    execSync.mockReturnValue('');
    getAgentWorktrees();
    expect(execSync).toHaveBeenCalledWith(
      'git worktree list --porcelain',
      expect.objectContaining({ cwd: process.cwd() })
    );
  });
});
