import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_TOOLS, runAdd, runList, runRemove } from '../tool-manager.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = resolve(
    tmpdir(),
    `agentkit-toolmgr-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Sets up a minimal agentkit root + project root for tool-manager tests.
 * Returns { agentkitRoot, projectRoot }.
 */
function setupProject(tmpRoot, repoName = 'test-project', initialTargets = ['claude']) {
  const agentkitRoot = resolve(tmpRoot, 'agentkit');
  const projectRoot = resolve(tmpRoot, 'project');

  // Create agentkit overlay directory with settings
  const overlayDir = resolve(agentkitRoot, 'overlays', repoName);
  mkdirSync(overlayDir, { recursive: true });
  writeFileSync(
    resolve(overlayDir, 'settings.yaml'),
    yaml.dump({ repoName, renderTargets: initialTargets }),
    'utf-8'
  );

  // Create spec directory and minimal files for sync
  const specDir = resolve(agentkitRoot, 'spec');
  mkdirSync(specDir, { recursive: true });
  writeFileSync(resolve(specDir, 'VERSION'), '0.1.0\n', 'utf-8');

  // Minimal package.json
  writeFileSync(
    resolve(agentkitRoot, 'package.json'),
    JSON.stringify({ name: 'test', version: '0.0.1' }),
    'utf-8'
  );

  // Create project root with .agentkit-repo marker
  mkdirSync(projectRoot, { recursive: true });
  writeFileSync(resolve(projectRoot, '.agentkit-repo'), repoName + '\n', 'utf-8');

  return { agentkitRoot, projectRoot };
}

function readSettings(agentkitRoot, repoName) {
  return yaml.load(
    readFileSync(resolve(agentkitRoot, 'overlays', repoName, 'settings.yaml'), 'utf-8')
  );
}

// ---------------------------------------------------------------------------
// Tests: ALL_TOOLS constant
// ---------------------------------------------------------------------------
describe('ALL_TOOLS', () => {
  it('exports a non-empty array of known tool names', () => {
    expect(Array.isArray(ALL_TOOLS)).toBe(true);
    expect(ALL_TOOLS.length).toBeGreaterThan(0);
    expect(ALL_TOOLS).toContain('claude');
    expect(ALL_TOOLS).toContain('cursor');
    expect(ALL_TOOLS).toContain('copilot');
    expect(ALL_TOOLS).toContain('gemini');
    expect(ALL_TOOLS).toContain('warp');
    expect(ALL_TOOLS).toContain('cline');
    expect(ALL_TOOLS).toContain('roo');
    expect(ALL_TOOLS).toContain('mcp');
  });
});

// ---------------------------------------------------------------------------
// Tests: runAdd
// ---------------------------------------------------------------------------
describe('runAdd', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('adds a new tool to renderTargets', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'add-test', ['claude']);

    // Mock sync since we just want to test the settings update
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn().mockResolvedValue(undefined),
    }));

    const { runAdd: addFn } = await import('../tool-manager.mjs');
    await addFn({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['cursor'] },
    });

    const settings = readSettings(agentkitRoot, 'add-test');
    expect(settings.renderTargets).toContain('claude');
    expect(settings.renderTargets).toContain('cursor');
  });

  it('adds multiple tools at once', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'multi-add', ['claude']);

    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn().mockResolvedValue(undefined),
    }));

    const { runAdd: addFn } = await import('../tool-manager.mjs');
    await addFn({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['cursor', 'windsurf', 'copilot'] },
    });

    const settings = readSettings(agentkitRoot, 'multi-add');
    expect(settings.renderTargets).toContain('cursor');
    expect(settings.renderTargets).toContain('windsurf');
    expect(settings.renderTargets).toContain('copilot');
  });

  it('skips tools already enabled', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'dup-add', ['claude', 'cursor']);

    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn().mockResolvedValue(undefined),
    }));

    const { runAdd: addFn } = await import('../tool-manager.mjs');
    await addFn({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['claude', 'windsurf'] },
    });

    const settings = readSettings(agentkitRoot, 'dup-add');
    // Should not duplicate claude
    const claudeCount = settings.renderTargets.filter((t) => t === 'claude').length;
    expect(claudeCount).toBe(1);
    expect(settings.renderTargets).toContain('windsurf');
  });

  it('logs message when all tools already enabled', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'all-dup', ['claude', 'cursor']);

    await runAdd({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['claude'] },
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already enabled'));
  });

  it('throws on unknown tool name', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'bad-tool');

    await expect(
      runAdd({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['invalidtool'] },
      })
    ).rejects.toThrow('Unknown tool(s)');
  });

  it('throws when no tools are specified', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'no-tools');

    await expect(
      runAdd({
        agentkitRoot,
        projectRoot,
        flags: { _args: [] },
      })
    ).rejects.toThrow('Usage');
  });

  it('throws when .agentkit-repo marker is missing', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'no-marker');
    // Remove the marker
    rmSync(resolve(projectRoot, '.agentkit-repo'));

    await expect(
      runAdd({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['cursor'] },
      })
    ).rejects.toThrow('No .agentkit-repo marker found');
  });
});

// ---------------------------------------------------------------------------
// Tests: runRemove
// ---------------------------------------------------------------------------
describe('runRemove', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('removes a tool from renderTargets', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'rm-test', [
      'claude',
      'cursor',
      'windsurf',
    ]);

    await runRemove({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['windsurf'] },
    });

    const settings = readSettings(agentkitRoot, 'rm-test');
    expect(settings.renderTargets).toContain('claude');
    expect(settings.renderTargets).toContain('cursor');
    expect(settings.renderTargets).not.toContain('windsurf');
  });

  it('logs message when removing a tool that is not enabled', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'rm-missing', ['claude']);

    await runRemove({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['windsurf'] },
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('not currently enabled'));
  });

  it('cleans generated files with --clean flag', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'rm-clean', ['claude', 'warp']);

    // Create a manifest and a fake generated file
    const manifestPath = resolve(agentkitRoot, '.manifest.json');
    writeFileSync(
      manifestPath,
      JSON.stringify({
        files: {
          'WARP.md': { hash: 'abc123' },
          'CLAUDE.md': { hash: 'def456' },
        },
      }),
      'utf-8'
    );
    writeFileSync(resolve(projectRoot, 'WARP.md'), '# WARP', 'utf-8');

    await runRemove({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['warp'], clean: true },
    });

    const settings = readSettings(agentkitRoot, 'rm-clean');
    expect(settings.renderTargets).not.toContain('warp');
    // WARP.md should be deleted
    expect(existsSync(resolve(projectRoot, 'WARP.md'))).toBe(false);
  });

  it('does not clean files without --clean flag', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'rm-noclean', ['claude', 'warp']);

    writeFileSync(resolve(projectRoot, 'WARP.md'), '# WARP', 'utf-8');

    await runRemove({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['warp'] },
    });

    // WARP.md should still exist
    expect(existsSync(resolve(projectRoot, 'WARP.md'))).toBe(true);
  });

  it('throws on unknown tool name', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'rm-bad');

    await expect(
      runRemove({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['fakeTool'] },
      })
    ).rejects.toThrow('Unknown tool(s)');
  });

  it('throws when no tools are specified', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'rm-empty');

    await expect(
      runRemove({
        agentkitRoot,
        projectRoot,
        flags: { _args: [] },
      })
    ).rejects.toThrow('Usage');
  });

  it('handles corrupt manifest gracefully with --clean', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'rm-corrupt', ['claude', 'warp']);

    writeFileSync(resolve(agentkitRoot, '.manifest.json'), 'not valid json', 'utf-8');

    // Should not throw, just warn
    await runRemove({
      agentkitRoot,
      projectRoot,
      flags: { _args: ['warp'], clean: true },
    });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Corrupt manifest'));
  });
});

// ---------------------------------------------------------------------------
// Tests: runList
// ---------------------------------------------------------------------------
describe('runList', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('lists enabled and available tools', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'list-test', ['claude', 'cursor']);

    await runList({
      agentkitRoot,
      projectRoot,
      flags: {},
    });

    // Should log enabled tools
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('claude'));
    // Should show available (not-yet-enabled) tools
    const availableCall = vi
      .mocked(console.log)
      .mock.calls.find((c) => typeof c[0] === 'string' && c[0].includes('Available'));
    expect(availableCall).toBeDefined();
  });

  it('shows always-on targets', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'list-always', ['claude']);

    await runList({
      agentkitRoot,
      projectRoot,
      flags: {},
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Always-on'));
  });

  it('shows "(all enabled)" when all tools are enabled', async () => {
    const { agentkitRoot, projectRoot } = setupProject(tmpRoot, 'list-all', [...ALL_TOOLS]);

    await runList({
      agentkitRoot,
      projectRoot,
      flags: {},
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('all enabled'));
  });
});
