import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as child_process from 'child_process';
import { initSession, endSession } from '../cost-tracker.mjs';

// Mock child_process
vi.mock('child_process', () => {
  return {
    execSync: vi.fn(),
    execFileSync: vi.fn(),
  };
});

describe('cost-tracker security', () => {
  const TEST_ROOT = resolve('.test-cost-security');
  const PROJECT_ROOT = resolve(TEST_ROOT, 'project');

  beforeEach(() => {
    vi.resetAllMocks();
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(PROJECT_ROOT, { recursive: true });

    // Default mock implementation
    child_process.execSync.mockReturnValue('mock-output');
    child_process.execFileSync.mockReturnValue('mock-output');
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('initSession should use execFileSync and NOT execSync', () => {
    initSession({ agentkitRoot: TEST_ROOT, projectRoot: PROJECT_ROOT });

    // Should NOT use shell execution
    expect(child_process.execSync).not.toHaveBeenCalled();

    // Should use execFileSync for git commands
    expect(child_process.execFileSync).toHaveBeenCalledTimes(2); // branch + user

    // Verify arguments for branch
    expect(child_process.execFileSync).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      expect.objectContaining({ cwd: PROJECT_ROOT })
    );

    // Verify arguments for user
    expect(child_process.execFileSync).toHaveBeenCalledWith(
      'git',
      ['config', 'user.email'],
      expect.objectContaining({ cwd: PROJECT_ROOT })
    );
  });

  it('endSession should use execFileSync and NOT execSync', () => {
    // Setup a session first
    const session = initSession({ agentkitRoot: TEST_ROOT, projectRoot: PROJECT_ROOT });
    vi.clearAllMocks(); // Clear calls from initSession

    endSession({ agentkitRoot: TEST_ROOT, projectRoot: PROJECT_ROOT, sessionId: session.sessionId });

    // Should NOT use shell execution
    expect(child_process.execSync).not.toHaveBeenCalled();

    // Should use execFileSync for git diff
    expect(child_process.execFileSync).toHaveBeenCalledTimes(1);
    expect(child_process.execFileSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', 'HEAD'],
      expect.objectContaining({ cwd: PROJECT_ROOT })
    );
  });

  it('initSession should handle git failures gracefully', () => {
    // Simulate git command failure (e.g. git not installed or not a git repo)
    child_process.execFileSync.mockImplementation(() => {
      throw new Error('git not found');
    });

    const session = initSession({ agentkitRoot: TEST_ROOT, projectRoot: PROJECT_ROOT });

    // Should fall back to 'unknown'
    expect(session.branch).toBe('unknown');
    expect(session.user).toBe('unknown');
  });

  it('endSession should handle git failures gracefully', () => {
    // Setup session first (successfully)
    child_process.execFileSync.mockReturnValue('mock-output');
    const session = initSession({ agentkitRoot: TEST_ROOT, projectRoot: PROJECT_ROOT });

    // Simulate failure for endSession
    child_process.execFileSync.mockImplementation(() => {
      throw new Error('git not found');
    });

    const endedSession = endSession({ agentkitRoot: TEST_ROOT, projectRoot: PROJECT_ROOT, sessionId: session.sessionId });

    // Should default to 0 files modified
    expect(endedSession.filesModified).toBe(0);
  });
});
