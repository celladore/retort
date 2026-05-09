import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @clack/prompts so we can drive promptDirtyFileAction / promptApplyMode /
// promptSingleFile deterministically. The sync-guard module dynamically
// imports @clack/prompts, so we mock at the module boundary.
// ---------------------------------------------------------------------------

const clackState = {
  selectImpl: () => 'abort',
  isCancelImpl: (val) => val === Symbol.for('clack:cancel'),
  noteCalls: [],
  successCalls: [],
  errorCalls: [],
};

vi.mock('@clack/prompts', () => ({
  note: (msg, title) => {
    clackState.noteCalls.push({ msg, title });
  },
  select: vi.fn(async (opts) => clackState.selectImpl(opts)),
  isCancel: (val) => clackState.isCancelImpl(val),
  log: {
    success: (msg) => {
      clackState.successCalls.push(msg);
    },
    error: (msg) => {
      clackState.errorCalls.push(msg);
    },
  },
}));

// Replace the git stash invocation with a controllable spy
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

// Import after mocks are registered
const { execFileSync: execFileSyncMock } = await import('child_process');
const { promptDirtyFileAction, promptApplyMode, promptSingleFile } =
  await import('../sync-guard.mjs');

beforeEach(() => {
  clackState.selectImpl = () => 'abort';
  clackState.isCancelImpl = (val) => val === Symbol.for('clack:cancel');
  clackState.noteCalls = [];
  clackState.successCalls = [];
  clackState.errorCalls = [];
  execFileSyncMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// promptDirtyFileAction
// ---------------------------------------------------------------------------

describe('promptDirtyFileAction', () => {
  it("returns 'abort' when the user picks abort", async () => {
    clackState.selectImpl = () => 'abort';
    const result = await promptDirtyFileAction(['a.txt', 'b.txt']);
    expect(result).toBe('abort');
    // The note should have been emitted with the dirty files
    expect(clackState.noteCalls).toHaveLength(1);
    expect(clackState.noteCalls[0].msg).toContain('a.txt');
    expect(clackState.noteCalls[0].msg).toContain('b.txt');
    expect(clackState.noteCalls[0].title).toMatch(/Uncommitted/i);
  });

  it("returns 'continue' when the user picks continue", async () => {
    clackState.selectImpl = () => 'continue';
    const result = await promptDirtyFileAction(['x']);
    expect(result).toBe('continue');
  });

  it("returns 'stash' when the user picks stash and stash succeeds", async () => {
    clackState.selectImpl = () => 'stash';
    execFileSyncMock.mockReturnValue(''); // git stash push succeeds

    const result = await promptDirtyFileAction(['file1.txt']);
    expect(result).toBe('stash');
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    const [cmd, args] = execFileSyncMock.mock.calls[0];
    expect(cmd).toBe('git');
    expect(args[0]).toBe('stash');
    expect(args[1]).toBe('push');
    expect(args).toContain('agentkit-sync-guard');
    expect(args).toContain('file1.txt');
    expect(clackState.successCalls).toHaveLength(1);
    expect(clackState.successCalls[0]).toMatch(/stashed/i);
  });

  it("returns 'abort' when stash fails", async () => {
    clackState.selectImpl = () => 'stash';
    execFileSyncMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = await promptDirtyFileAction(['file1.txt']);
    expect(result).toBe('abort');
    expect(clackState.errorCalls).toHaveLength(1);
    expect(clackState.errorCalls[0]).toMatch(/Stash failed/);
    expect(clackState.errorCalls[0]).toMatch(/boom/);
  });

  it("returns 'abort' when stash throws a non-Error value", async () => {
    clackState.selectImpl = () => 'stash';
    execFileSyncMock.mockImplementation(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'string-failure';
    });

    const result = await promptDirtyFileAction(['file1.txt']);
    expect(result).toBe('abort');
    expect(clackState.errorCalls[0]).toMatch(/string-failure/);
  });

  it("returns 'abort' when the user cancels (Ctrl+C)", async () => {
    const cancelSym = Symbol.for('clack:cancel');
    clackState.selectImpl = () => cancelSym;
    clackState.isCancelImpl = (val) => val === cancelSym;

    const result = await promptDirtyFileAction(['x']);
    expect(result).toBe('abort');
  });

  it('renders dirty files line-by-line in the note message', async () => {
    clackState.selectImpl = () => 'continue';
    await promptDirtyFileAction(['one', 'two', 'three']);
    expect(clackState.noteCalls[0].msg).toMatch(/  one\n  two\n  three/);
  });
});

// ---------------------------------------------------------------------------
// promptApplyMode
// ---------------------------------------------------------------------------

describe('promptApplyMode', () => {
  it("returns 'all' when the user picks Apply all", async () => {
    clackState.selectImpl = () => 'all';
    const result = await promptApplyMode({ creates: 2, updates: 3 });
    expect(result).toBe('all');
  });

  it("returns 'none' when the user picks Skip all", async () => {
    clackState.selectImpl = () => 'none';
    const result = await promptApplyMode({ creates: 0, updates: 0 });
    expect(result).toBe('none');
  });

  it("returns 'each' when the user picks Prompt each", async () => {
    clackState.selectImpl = () => 'each';
    const result = await promptApplyMode({ creates: 5, updates: 0 });
    expect(result).toBe('each');
  });

  it("returns 'none' when the user cancels", async () => {
    const cancelSym = Symbol.for('clack:cancel');
    clackState.selectImpl = () => cancelSym;
    clackState.isCancelImpl = (val) => val === cancelSym;
    const result = await promptApplyMode({ creates: 1, updates: 1 });
    expect(result).toBe('none');
  });

  it('shows the total count and breakdown in the prompt message', async () => {
    let captured;
    clackState.selectImpl = (opts) => {
      captured = opts;
      return 'all';
    };
    await promptApplyMode({ creates: 4, updates: 7 });
    expect(captured.message).toContain('11 file');
    expect(captured.message).toContain('4 new');
    expect(captured.message).toContain('7 updated');
  });
});

// ---------------------------------------------------------------------------
// promptSingleFile
// ---------------------------------------------------------------------------

describe('promptSingleFile', () => {
  it("returns 'apply' when user picks Apply", async () => {
    clackState.selectImpl = () => 'apply';
    const result = await promptSingleFile(
      { relPath: 'a.md', action: 'create' },
      null,
      null,
      'new content'
    );
    expect(result).toBe('apply');
  });

  it("returns 'skip' when user picks Skip", async () => {
    clackState.selectImpl = () => 'skip';
    const result = await promptSingleFile(
      { relPath: 'a.md', action: 'create' },
      null,
      null,
      'new content'
    );
    expect(result).toBe('skip');
  });

  it("returns 'apply-rest' when user picks Apply all remaining", async () => {
    clackState.selectImpl = () => 'apply-rest';
    const result = await promptSingleFile(
      { relPath: 'a.md', action: 'update' },
      () => '',
      'old',
      'new'
    );
    expect(result).toBe('apply-rest');
  });

  it("returns 'skip' when user cancels", async () => {
    const cancelSym = Symbol.for('clack:cancel');
    clackState.selectImpl = () => cancelSym;
    clackState.isCancelImpl = (val) => val === cancelSym;
    const result = await promptSingleFile({ relPath: 'a.md', action: 'create' }, null, null, 'new');
    expect(result).toBe('skip');
  });

  it("does NOT include 'Show diff' option for create actions", async () => {
    let capturedOptions;
    clackState.selectImpl = (opts) => {
      capturedOptions = opts;
      return 'apply';
    };
    await promptSingleFile({ relPath: 'a.md', action: 'create' }, () => 'diff', null, 'new');
    const values = capturedOptions.options.map((o) => o.value);
    expect(values).not.toContain('diff');
    expect(values).toContain('apply');
    expect(values).toContain('skip');
    expect(values).toContain('apply-rest');
  });

  it("includes 'Show diff' option for update actions when diffFn is provided", async () => {
    let capturedOptions;
    clackState.selectImpl = (opts) => {
      capturedOptions = opts;
      return 'apply';
    };
    await promptSingleFile({ relPath: 'a.md', action: 'update' }, () => 'diff', 'old', 'new');
    const values = capturedOptions.options.map((o) => o.value);
    expect(values).toContain('diff');
  });

  it("does NOT include 'Show diff' for update actions when diffFn is missing", async () => {
    let capturedOptions;
    clackState.selectImpl = (opts) => {
      capturedOptions = opts;
      return 'apply';
    };
    await promptSingleFile({ relPath: 'a.md', action: 'update' }, null, 'old', 'new');
    const values = capturedOptions.options.map((o) => o.value);
    expect(values).not.toContain('diff');
  });

  it('shows the diff and re-prompts when user picks Show diff', async () => {
    const diffFn = vi.fn(() => 'line1\nline2');
    let callCount = 0;
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    clackState.selectImpl = () => {
      callCount += 1;
      if (callCount === 1) return 'diff';
      return 'apply';
    };

    const result = await promptSingleFile(
      { relPath: 'a.md', action: 'update' },
      diffFn,
      'old',
      'new'
    );

    expect(result).toBe('apply');
    expect(diffFn).toHaveBeenCalledWith('old', 'new');
    expect(callCount).toBe(2);
    // diff lines indented with 4 spaces
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('    line1'));
    consoleLogSpy.mockRestore();
  });

  it('logs (no differences) when diffFn returns empty/null', async () => {
    const diffFn = vi.fn(() => null);
    let callCount = 0;
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    clackState.selectImpl = () => {
      callCount += 1;
      if (callCount === 1) return 'diff';
      return 'skip';
    };

    const result = await promptSingleFile(
      { relPath: 'a.md', action: 'update' },
      diffFn,
      'same',
      'same'
    );

    expect(result).toBe('skip');
    expect(consoleLogSpy).toHaveBeenCalledWith('    (no differences)');
    consoleLogSpy.mockRestore();
  });

  it('uses the change action and relPath in the prompt message', async () => {
    let capturedMsg;
    clackState.selectImpl = (opts) => {
      capturedMsg = opts.message;
      return 'apply';
    };
    await promptSingleFile({ relPath: 'docs/file.md', action: 'create' }, null, null, 'content');
    expect(capturedMsg).toContain('create');
    expect(capturedMsg).toContain('docs/file.md');
  });
});
