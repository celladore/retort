import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import WorktreesPanel from './WorktreesPanel.jsx';

// Mock the lib module so tests never invoke child_process
vi.mock('../lib/worktrees.js', () => ({
  getAgentWorktrees: vi.fn(),
}));

// Import after mock registration so we get the mocked version
import { getAgentWorktrees } from '../lib/worktrees.js';

beforeEach(() => {
  vi.resetAllMocks();
});

/** Convenience factory for WorktreeInfo objects */
function makeWorktree(overrides = {}) {
  return {
    path: '/repo',
    branch: '',
    head: 'abc1234',
    isMain: false,
    isAgent: false,
    ...overrides,
  };
}

describe('WorktreesPanel', () => {
  it('should render nothing when there is only the main worktree', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    // Ink renders an empty string when the component returns null
    expect(lastFrame()).toBe('');
  });

  it('should render nothing when the worktree list is empty', () => {
    getAgentWorktrees.mockReturnValue([]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    expect(lastFrame()).toBe('');
  });

  it('should not show the section heading when only non-agent worktrees exist', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({ path: '/repo/.worktrees/feat', branch: 'feat/something', isAgent: false }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    expect(lastFrame()).not.toContain('Active worktrees');
  });

  it('should show the section heading when at least one agent worktree exists', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({
        path: '/repo/.worktrees/agent-backend',
        branch: 'feat/agent-backend/add-endpoint',
        isAgent: true,
      }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    expect(lastFrame()).toContain('Active worktrees');
  });

  it('should display the branch name for a non-agent worktree', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({ path: '/repo/.worktrees/fix', branch: 'fix/some-bug', isAgent: false }),
      makeWorktree({ path: '/repo/.worktrees/agent', branch: 'feat/agent-x/y', isAgent: true }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    expect(lastFrame()).toContain('fix/some-bug');
  });

  it('should mark agent worktrees with ⚡ and the branch name', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({
        path: '/repo/.worktrees/agent-backend',
        branch: 'feat/agent-backend/add-endpoint',
        isAgent: true,
      }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    const frame = lastFrame();
    expect(frame).toContain('⚡');
    expect(frame).toContain('feat/agent-backend/add-endpoint');
  });

  it('should show the commit SHA for each worktree', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({
        path: '/repo/.worktrees/feat',
        branch: 'feat/agent-x/something',
        head: 'deadbee',
        isAgent: true,
      }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    expect(lastFrame()).toContain('deadbee');
  });

  it('should show (detached) for a worktree with no branch', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({ path: '/repo/.worktrees/detached', branch: '', isAgent: false }),
      makeWorktree({ path: '/repo/.worktrees/agent', branch: 'feat/agent-x/y', isAgent: true }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    expect(lastFrame()).toContain('(detached)');
  });

  it('should show (main) label for the main worktree', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({ path: '/repo/.worktrees/agent', branch: 'feat/agent-x/y', isAgent: true }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    expect(lastFrame()).toContain('(main)');
  });

  it('should pass the cwd prop through to getAgentWorktrees', () => {
    getAgentWorktrees.mockReturnValue([]);

    render(React.createElement(WorktreesPanel, { cwd: '/custom/root' }));
    expect(getAgentWorktrees).toHaveBeenCalledWith('/custom/root');
  });

  it('should handle multiple agent worktrees simultaneously', () => {
    getAgentWorktrees.mockReturnValue([
      makeWorktree({ path: '/repo', isMain: true }),
      makeWorktree({
        path: '/repo/.worktrees/a1',
        branch: 'feat/agent-backend/task-one',
        isAgent: true,
        head: 'aaaaaaa',
      }),
      makeWorktree({
        path: '/repo/.worktrees/a2',
        branch: 'fix/agent-testing/coverage',
        isAgent: true,
        head: 'bbbbbbb',
      }),
    ]);

    const { lastFrame } = render(React.createElement(WorktreesPanel, {}));
    const frame = lastFrame();
    expect(frame).toContain('feat/agent-backend/task-one');
    expect(frame).toContain('fix/agent-testing/coverage');
    expect(frame).toContain('aaaaaaa');
    expect(frame).toContain('bbbbbbb');
  });
});
