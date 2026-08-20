import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  checkDirtyProtectedFiles,
  promptDirtyFileAction,
  promptApplyMode,
  promptSingleFile,
} from '../sync-guard.mjs';

// ---------------------------------------------------------------------------
// checkDirtyProtectedFiles — integration tests using real git operations
// ---------------------------------------------------------------------------

describe('checkDirtyProtectedFiles', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sync-guard-test-'));
    // Init a git repo in the temp directory
    execFileSync('git', ['init'], { cwd: tempDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], {
      cwd: tempDir,
      stdio: 'pipe',
    });
    execFileSync('git', ['config', 'user.name', 'Test'], {
      cwd: tempDir,
      stdio: 'pipe',
    });

    // Create protected directory structure and initial commit
    mkdirSync(join(tempDir, '.agentkit', 'spec'), { recursive: true });
    mkdirSync(join(tempDir, '.agentkit', 'engines'), { recursive: true });
    mkdirSync(join(tempDir, '.agentkit', 'overlays'), { recursive: true });
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, '.agentkit', 'spec', 'project.yaml'), 'name: test\n');
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'sync.mjs'), 'export default {};\n');
    writeFileSync(join(tempDir, 'src', 'app.js'), 'console.log("hello");\n');
    execFileSync('git', ['add', '-A'], { cwd: tempDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: tempDir, stdio: 'pipe' });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows may hold locks briefly
    }
  });

  it('returns dirty:false when working tree is clean', () => {
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(false);
    expect(result.files).toEqual([]);
  });

  it('detects modified files in .agentkit/spec/', () => {
    writeFileSync(join(tempDir, '.agentkit', 'spec', 'project.yaml'), 'name: changed\n');
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(true);
    expect(result.files).toContain('.agentkit/spec/project.yaml');
  });

  it('detects modified files in .agentkit/engines/', () => {
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'sync.mjs'), 'export default { v: 2 };\n');
    const result = checkDirtyProtectedFiles(tempDir, ['.agentkit/engines', '.agentkit/spec']);
    expect(result.dirty).toBe(true);
    expect(result.files).toContain('.agentkit/engines/sync.mjs');
  });

  it('ignores dirty files outside protected directories', () => {
    writeFileSync(join(tempDir, 'src', 'app.js'), 'console.log("changed");\n');
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(false);
    expect(result.files).toEqual([]);
  });

  it('detects untracked files in protected directories', () => {
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'new-file.mjs'), 'new content\n');
    const result = checkDirtyProtectedFiles(tempDir, ['.agentkit/engines', '.agentkit/spec']);
    expect(result.dirty).toBe(true);
    expect(result.files).toContain('.agentkit/engines/new-file.mjs');
  });

  it('degrades gracefully when git is not available', () => {
    // Test with an invalid cwd to simulate git failure
    const result = checkDirtyProtectedFiles('/nonexistent/path/that/does/not/exist', [
      '.agentkit/engines',
    ]);
    expect(result.dirty).toBe(false);
    expect(result.files).toEqual([]);
  });

  it('detects multiple dirty files across protected directories', () => {
    writeFileSync(join(tempDir, '.agentkit', 'spec', 'project.yaml'), 'name: changed\n');
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'sync.mjs'), 'changed\n');
    writeFileSync(join(tempDir, '.agentkit', 'overlays', 'test.yaml'), 'new: true\n');
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(true);
    expect(result.files.length).toBeGreaterThanOrEqual(3);
  });

  it('handles renames by extracting the new path', () => {
    // To exercise the "R old -> new" rename-parsing branch, both endpoints of
    // the rename must be inside the scope passed to `git status --porcelain`.
    // If only the destination is in scope, git collapses the entry to "A new"
    // (an add) and the rename branch is never hit.
    execFileSync('git', ['mv', 'src/app.js', '.agentkit/spec/app.js'], {
      cwd: tempDir,
      stdio: 'pipe',
    });
    const result = checkDirtyProtectedFiles(tempDir, ['src', '.agentkit/spec']);
    expect(result.dirty).toBe(true);
    // git emits "R  src/app.js -> .agentkit/spec/app.js" — we keep the destination.
    expect(result.files).toContain('.agentkit/spec/app.js');
    expect(result.files).not.toContain('src/app.js');
    // Sanity: no entry should still contain the literal arrow.
    expect(result.files.every((f) => !f.includes(' -> '))).toBe(true);
  });

  it('reports a clean tree as not dirty, dropping git’s trailing blank line', () => {
    // A clean tree still yields one empty line from splitting git's output.
    // The length > 3 filter is what keeps that blank out of `files` — asserting
    // the exact result is what makes this test able to fail if the filter goes.
    const result = checkDirtyProtectedFiles(tempDir, ['.agentkit/spec']);
    expect(result).toEqual({ dirty: false, files: [] });
  });
});

// ---------------------------------------------------------------------------
// Interactive prompts — mock @clack/prompts so we can drive each branch.
// ---------------------------------------------------------------------------

// Mutable per-test queues that the mocked clack.select pulls from.
const selectQueue = [];
let lastIsCancelTarget = null;

vi.mock('@clack/prompts', () => {
  const CANCEL = Symbol('clack-cancel');
  return {
    note: vi.fn(),
    log: { success: vi.fn(), error: vi.fn() },
    select: vi.fn(async () => {
      if (selectQueue.length === 0) {
        throw new Error('test bug: select() called with empty selectQueue');
      }
      const next = selectQueue.shift();
      if (next === '__CANCEL__') {
        lastIsCancelTarget = CANCEL;
        return CANCEL;
      }
      return next;
    }),
    isCancel: (v) => v === CANCEL || v === lastIsCancelTarget,
  };
});

describe('promptDirtyFileAction', () => {
  beforeEach(() => {
    selectQueue.length = 0;
    lastIsCancelTarget = null;
  });

  it('returns abort when the user picks Abort', async () => {
    selectQueue.push('abort');
    const result = await promptDirtyFileAction(['.agentkit/spec/foo.yaml']);
    expect(result).toBe('abort');
  });

  it('returns abort when the user cancels (Ctrl-C)', async () => {
    selectQueue.push('__CANCEL__');
    const result = await promptDirtyFileAction(['.agentkit/spec/foo.yaml']);
    expect(result).toBe('abort');
  });

  it('returns continue when the user picks Continue', async () => {
    selectQueue.push('continue');
    const result = await promptDirtyFileAction(['.agentkit/spec/foo.yaml']);
    expect(result).toBe('continue');
  });

  it('returns abort when stash subprocess fails', async () => {
    // Force the stash subprocess to fail by running it from a directory that
    // is NOT a git repository: `git stash push ...` exits non-zero with
    // "fatal: not a git repository", sync-guard catches that and returns 'abort'.
    // We chdir into a fresh temp dir (no .git) for the duration of this test.
    const origCwd = process.cwd();
    const noRepo = mkdtempSync(join(tmpdir(), 'sync-guard-norepo-'));
    process.chdir(noRepo);
    try {
      selectQueue.push('stash');
      const result = await promptDirtyFileAction(['nonexistent-file-for-stash.txt']);
      expect(result).toBe('abort');
    } finally {
      process.chdir(origCwd);
      rmSync(noRepo, { recursive: true, force: true });
    }
  });
});

describe('promptApplyMode', () => {
  beforeEach(() => {
    selectQueue.length = 0;
    lastIsCancelTarget = null;
  });

  it('returns the selected mode for "all"', async () => {
    selectQueue.push('all');
    const result = await promptApplyMode({ creates: 2, updates: 3 });
    expect(result).toBe('all');
  });

  it('returns the selected mode for "each"', async () => {
    selectQueue.push('each');
    const result = await promptApplyMode({ creates: 1, updates: 1 });
    expect(result).toBe('each');
  });

  it('returns "none" when the user cancels', async () => {
    selectQueue.push('__CANCEL__');
    const result = await promptApplyMode({ creates: 0, updates: 0 });
    expect(result).toBe('none');
  });
});

describe('promptSingleFile', () => {
  beforeEach(() => {
    selectQueue.length = 0;
    lastIsCancelTarget = null;
  });

  it('returns "apply" for a create action', async () => {
    selectQueue.push('apply');
    const result = await promptSingleFile(
      { relPath: 'foo.md', action: 'create' },
      null,
      null,
      'new'
    );
    expect(result).toBe('apply');
  });

  it('returns "skip" when the user cancels', async () => {
    selectQueue.push('__CANCEL__');
    const result = await promptSingleFile(
      { relPath: 'foo.md', action: 'create' },
      null,
      null,
      'new'
    );
    expect(result).toBe('skip');
  });

  it('returns "apply-rest" when the user picks it', async () => {
    selectQueue.push('apply-rest');
    const result = await promptSingleFile(
      { relPath: 'foo.md', action: 'update' },
      () => 'diff',
      'old',
      'new'
    );
    expect(result).toBe('apply-rest');
  });

  it('shows the diff and re-prompts on update with diffFn', async () => {
    selectQueue.push('diff', 'apply');
    const diffFn = vi.fn(() => '- old\n+ new');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await promptSingleFile(
        { relPath: 'foo.md', action: 'update' },
        diffFn,
        'old',
        'new'
      );
      expect(result).toBe('apply');
      expect(diffFn).toHaveBeenCalledWith('old', 'new');
      // Indented diff was printed.
      expect(logSpy.mock.calls.some(([msg]) => String(msg).includes('    - old'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('prints "(no differences)" when diffFn returns null', async () => {
    selectQueue.push('diff', 'skip');
    const diffFn = vi.fn(() => null);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await promptSingleFile(
        { relPath: 'foo.md', action: 'update' },
        diffFn,
        'old',
        'new'
      );
      expect(result).toBe('skip');
      expect(logSpy).toHaveBeenCalledWith('    (no differences)');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not offer "diff" when action is "create"', async () => {
    // No diffFn re-prompt path possible — the first selection must terminate.
    selectQueue.push('skip');
    const result = await promptSingleFile(
      { relPath: 'foo.md', action: 'create' },
      () => 'diff',
      null,
      'new'
    );
    expect(result).toBe('skip');
  });
});
