/**
 * Overlay resolution — resolve-or-abort (ADR-11 decision 3).
 *
 * The behaviour under test is the absence of a fallback: when nothing names an
 * overlay, sync must fail loudly instead of rendering `__TEMPLATE__` content
 * into a repo that wanted something else. That silent fallback is the root
 * cause recorded for PRs #478 and #479.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, resolve } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOverlaySelection } from '../overlay-resolver.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Temp directories created by a test, removed in afterEach. */
const created = new Set();

function makeTmpDir(label) {
  const dir = resolve(
    tmpdir(),
    `agentkit-overlay-resolver-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  created.add(dir);
  return dir;
}

function writeTestFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

/** An agentkit root whose `overlays/` contains one settings.yaml per name. */
function makeAgentkitRoot(overlayNames = ['__TEMPLATE__', 'demo-repo']) {
  const root = makeTmpDir('root');
  for (const name of overlayNames) {
    writeTestFile(resolve(root, 'overlays', name, 'settings.yaml'), `repoName: ${name}\n`);
  }
  return root;
}

/** A project root named `name`, created under a fresh temp parent. */
function makeProjectRoot(name = 'project') {
  const dir = resolve(makeTmpDir('project'), name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeMarker(dir, repoName) {
  writeFileSync(resolve(dir, '.agentkit-repo'), repoName + '\n', 'utf-8');
}

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  }).trim();
}

/**
 * Initialise a git repo at `dir` with one commit, so linked worktrees can be
 * added to it. Identity is set locally to keep the test independent of the
 * ambient git config.
 */
function initGitRepo(dir) {
  git(['init', '--initial-branch=main'], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'user.name', 'Test'], dir);
  writeTestFile(resolve(dir, 'README.md'), '# test\n');
  git(['add', '.'], dir);
  git(['commit', '-m', 'chore: initial'], dir);
}

afterEach(() => {
  for (const dir of created) {
    rmSync(dir, { recursive: true, force: true });
  }
  created.clear();
});

// ---------------------------------------------------------------------------
// Resolution sources, most explicit first
// ---------------------------------------------------------------------------

describe('resolveOverlaySelection — resolution order', () => {
  it('prefers the --overlay flag over every other source', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('demo-repo');
    writeMarker(projectRoot, 'demo-repo');

    const selection = resolveOverlaySelection(agentkitRoot, projectRoot, {
      overlay: '__TEMPLATE__',
    });

    expect(selection.repoName).toBe('__TEMPLATE__');
    expect(selection.reason).toContain('--overlay flag');
  });

  it('rejects an explicit blank --overlay instead of falling through to a valid marker', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('demo-repo');
    writeMarker(projectRoot, 'demo-repo');

    expect(() => resolveOverlaySelection(agentkitRoot, projectRoot, { overlay: '' })).toThrow(
      'Invalid overlay name "" (from --overlay flag)'
    );
  });

  it('reads the .agentkit-repo marker at the project root', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('unrelated-name');
    writeMarker(projectRoot, 'demo-repo');

    const selection = resolveOverlaySelection(agentkitRoot, projectRoot, {});

    expect(selection.repoName).toBe('demo-repo');
    expect(selection.reason).toContain('.agentkit-repo marker');
  });

  it('ignores a blank marker and falls through to the next source', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('demo-repo');
    writeMarker(projectRoot, '   ');

    const selection = resolveOverlaySelection(agentkitRoot, projectRoot, {});

    expect(selection.repoName).toBe('demo-repo');
    expect(selection.reason).toContain('inferred from project root name');
  });

  it('infers the overlay from the project root directory name', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('demo-repo');

    const selection = resolveOverlaySelection(agentkitRoot, projectRoot, {});

    expect(selection.repoName).toBe('demo-repo');
    expect(selection.reason).toContain('inferred from project root name "demo-repo"');
  });
});

// ---------------------------------------------------------------------------
// Linked git worktrees
// ---------------------------------------------------------------------------

describe('resolveOverlaySelection — linked git worktrees', () => {
  it('resolves the marker from the primary worktree when the worktree has none', () => {
    const agentkitRoot = makeAgentkitRoot();
    const primaryRoot = makeProjectRoot('primary');
    initGitRepo(primaryRoot);
    writeMarker(primaryRoot, 'demo-repo');

    // A worktree directory name that matches no overlay, so a pass would have
    // to have come from the primary marker rather than from inference.
    const worktreeRoot = resolve(primaryRoot, '..', 'wt-feature-branch');
    git(['worktree', 'add', worktreeRoot, '-b', 'feature'], primaryRoot);
    expect(existsSync(resolve(worktreeRoot, '.agentkit-repo'))).toBe(false);

    const selection = resolveOverlaySelection(agentkitRoot, worktreeRoot, {});

    expect(selection.repoName).toBe('demo-repo');
    expect(selection.reason).toContain('primary worktree');
  });

  it('prefers the worktree own marker over the primary worktree marker', () => {
    const agentkitRoot = makeAgentkitRoot(['__TEMPLATE__', 'demo-repo', 'other-repo']);
    const primaryRoot = makeProjectRoot('primary');
    initGitRepo(primaryRoot);
    writeMarker(primaryRoot, 'demo-repo');

    const worktreeRoot = resolve(primaryRoot, '..', 'wt-feature-branch');
    git(['worktree', 'add', worktreeRoot, '-b', 'feature'], primaryRoot);
    writeMarker(worktreeRoot, 'other-repo');

    const selection = resolveOverlaySelection(agentkitRoot, worktreeRoot, {});

    expect(selection.repoName).toBe('other-repo');
    expect(selection.reason).toBe('.agentkit-repo marker');
  });

  it('aborts when neither the worktree nor the primary worktree has a marker', () => {
    const agentkitRoot = makeAgentkitRoot();
    const primaryRoot = makeProjectRoot('primary');
    initGitRepo(primaryRoot);

    const worktreeRoot = resolve(primaryRoot, '..', 'wt-feature-branch');
    git(['worktree', 'add', worktreeRoot, '-b', 'feature'], primaryRoot);

    expect(() => resolveOverlaySelection(agentkitRoot, worktreeRoot, {})).toThrow(
      /No .agentkit-repo marker in the primary worktree either/
    );
  });
});

// ---------------------------------------------------------------------------
// Abort behaviour — the point of the change
// ---------------------------------------------------------------------------

describe('resolveOverlaySelection — abort instead of falling back', () => {
  it('throws rather than defaulting to __TEMPLATE__ when nothing resolves', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('matches-no-overlay');

    expect(() => resolveOverlaySelection(agentkitRoot, projectRoot, {})).toThrow(
      /Cannot determine which overlay to render/
    );
  });

  it('names the available overlays in the abort message', () => {
    const agentkitRoot = makeAgentkitRoot(['__TEMPLATE__', 'alpha', 'beta']);
    const projectRoot = makeProjectRoot('matches-no-overlay');

    expect(() => resolveOverlaySelection(agentkitRoot, projectRoot, {})).toThrow(
      /Available overlays: __TEMPLATE__, alpha, beta/
    );
  });

  it('lists only directories that actually carry a settings.yaml', () => {
    const agentkitRoot = makeAgentkitRoot(['__TEMPLATE__', 'alpha']);
    mkdirSync(resolve(agentkitRoot, 'overlays', 'no-settings'), { recursive: true });
    const projectRoot = makeProjectRoot('matches-no-overlay');

    let message = '';
    try {
      resolveOverlaySelection(agentkitRoot, projectRoot, {});
    } catch (err) {
      message = err.message;
    }

    expect(message).toContain('Available overlays: __TEMPLATE__, alpha');
    expect(message).not.toContain('no-settings');
  });

  it('offers actionable remedies in the abort message', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('matches-no-overlay');

    let message = '';
    try {
      resolveOverlaySelection(agentkitRoot, projectRoot, {});
    } catch (err) {
      message = err.message;
    }

    expect(message).toContain('retort init');
    expect(message).toContain('retort sync --overlay <name>');
    expect(message).toContain('retort worktree create');
  });
});

// ---------------------------------------------------------------------------
// Validation of a resolved name
// ---------------------------------------------------------------------------

describe('resolveOverlaySelection — validates the resolved overlay', () => {
  it('throws when the marker names an overlay that does not exist', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('project');
    writeMarker(projectRoot, 'typo-repo');

    expect(() => resolveOverlaySelection(agentkitRoot, projectRoot, {})).toThrow(
      /Overlay "typo-repo" \(from \.agentkit-repo marker\) does not exist/
    );
  });

  it('throws when --overlay names an overlay that does not exist', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('project');

    expect(() => resolveOverlaySelection(agentkitRoot, projectRoot, { overlay: 'nope' })).toThrow(
      /Overlay "nope" \(from --overlay flag\) does not exist/
    );
  });

  it('rejects a marker that tries to escape the overlays directory', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('project');
    writeMarker(projectRoot, '../../etc');

    expect(() => resolveOverlaySelection(agentkitRoot, projectRoot, {})).toThrow(
      /Invalid overlay name/
    );
  });

  it('accepts __TEMPLATE__ when it is named explicitly', () => {
    const agentkitRoot = makeAgentkitRoot();
    const projectRoot = makeProjectRoot('project');

    const selection = resolveOverlaySelection(agentkitRoot, projectRoot, {
      overlay: '__TEMPLATE__',
    });

    expect(selection.repoName).toBe('__TEMPLATE__');
  });
});
