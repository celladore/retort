import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveCommandPath, runSync } from '../synchronize.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENTKIT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

function makeTmpProject() {
  const dir = resolve(
    tmpdir(),
    `agentkit-prefix-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeNamedTmpProject(repoName) {
  const parent = makeTmpProject();
  const dir = resolve(parent, repoName);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeTestFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

function makeMinimalAgentkitRootWithPrefix({
  overlayName = 'test-repo',
  defaultBranch = 'main',
  commandPrefix = null,
} = {}) {
  const root = resolve(
    tmpdir(),
    `agentkit-prefix-root-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(root, { recursive: true });

  writeTestFile(
    resolve(root, 'package.json'),
    JSON.stringify({ name: 'agentkit-test-root', version: '0.0.1', type: 'module' }, null, 2)
  );

  writeTestFile(resolve(root, 'spec', 'teams.yaml'), 'teams: []\n');
  writeTestFile(
    resolve(root, 'spec', 'commands.yaml'),
    [
      'commands:',
      '  - name: build',
      '    description: Build the project',
      '  - name: check',
      '    description: Run quality checks',
      '  - name: team-backend',
      '    type: team',
      '    description: Backend team',
    ].join('\n') + '\n'
  );
  writeTestFile(resolve(root, 'spec', 'rules.yaml'), 'rules: []\n');
  writeTestFile(resolve(root, 'spec', 'settings.yaml'), 'permissions: {}\n');
  writeTestFile(resolve(root, 'spec', 'agents.yaml'), 'agents: {}\n');
  writeTestFile(resolve(root, 'spec', 'docs.yaml'), '{}\n');
  writeTestFile(resolve(root, 'spec', 'project.yaml'), `name: ${overlayName}\n`);

  const prefixLine = commandPrefix ? `commandPrefix: ${commandPrefix}\n` : '';

  writeTestFile(
    resolve(root, 'overlays', '__TEMPLATE__', 'settings.yaml'),
    'repoName: __TEMPLATE__\ndefaultBranch: main\nrenderTargets:\n  - claude\n  - copilot\n  - cursor\n  - windsurf\n  - codex\n'
  );
  writeTestFile(
    resolve(root, 'overlays', overlayName, 'settings.yaml'),
    `repoName: ${overlayName}\ndefaultBranch: ${defaultBranch}\n${prefixLine}renderTargets:\n  - claude\n  - copilot\n  - cursor\n  - windsurf\n  - codex\n`
  );

  // Claude command template
  writeTestFile(
    resolve(root, 'templates', 'root', 'AGENTS.md'),
    '# Agents\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'claude', 'CLAUDE.md'),
    '# Claude\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'claude', 'commands', 'build.md'),
    '# Build Command\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'claude', 'commands', 'check.md'),
    '# Check Command\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'claude', 'skills', 'TEMPLATE', 'SKILL.md'),
    '# Skill {{commandName}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'copilot', 'copilot-instructions.md'),
    '# Copilot\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'copilot', 'prompts', 'TEMPLATE.prompt.md'),
    "---\nmode: 'agent'\n---\n# {{commandName}}\n"
  );
  writeTestFile(
    resolve(root, 'templates', 'cursor', 'commands', 'TEMPLATE.md'),
    '# {{commandName}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'windsurf', 'templates', 'command.md'),
    '# {{commandName}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'codex', 'skills', 'TEMPLATE', 'SKILL.md'),
    '# {{commandName}}\n'
  );

  return root;
}

/** Collects all files under a directory recursively (relative paths, forward slashes). */
function collectFiles(dir, base = dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push(full.slice(base.length + 1).replace(/\\/g, '/'));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Unit tests: resolveCommandPath
// ---------------------------------------------------------------------------

describe('resolveCommandPath', () => {
  it('should return original name when prefix is null', () => {
    const result = resolveCommandPath('check', null);
    expect(result).toEqual({ dir: '', stem: 'check' });
  });

  it('should return original name when prefix is undefined', () => {
    const result = resolveCommandPath('check', undefined);
    expect(result).toEqual({ dir: '', stem: 'check' });
  });

  it('should return original name when prefix is empty string', () => {
    const result = resolveCommandPath('check', '');
    expect(result).toEqual({ dir: '', stem: 'check' });
  });

  it('should apply filename strategy by default', () => {
    const result = resolveCommandPath('check', 'kits');
    expect(result).toEqual({ dir: '', stem: 'kits-check' });
  });

  it('should apply filename strategy explicitly', () => {
    const result = resolveCommandPath('build', 'kits', 'filename');
    expect(result).toEqual({ dir: '', stem: 'kits-build' });
  });

  it('should apply subdirectory strategy', () => {
    const result = resolveCommandPath('check', 'kits', 'subdirectory');
    expect(result).toEqual({ dir: 'kits', stem: 'check' });
  });

  it('should handle multi-word command names', () => {
    const result = resolveCommandPath('sync-backlog', 'kits', 'filename');
    expect(result).toEqual({ dir: '', stem: 'kits-sync-backlog' });
  });

  it('should handle multi-word prefix', () => {
    const result = resolveCommandPath('check', 'my-kit', 'filename');
    expect(result).toEqual({ dir: '', stem: 'my-kit-check' });
  });
});

// ---------------------------------------------------------------------------
// Integration tests: sync with commandPrefix
// ---------------------------------------------------------------------------

describe('sync with commandPrefix enabled', () => {
  let agentkitRoot;
  let projectRoot;

  afterEach(() => {
    if (projectRoot) {
      rmSync(resolve(projectRoot, '..'), { recursive: true, force: true });
      projectRoot = null;
    }
    if (agentkitRoot) {
      rmSync(agentkitRoot, { recursive: true, force: true });
      agentkitRoot = null;
    }
  });

  it('should place Claude commands in subdirectory when prefix is set', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: 'kits',
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'claude' } });

    const files = collectFiles(projectRoot);
    // Commands should be in kits/ subdirectory
    expect(files).toContain('.claude/commands/kits/build.md');
    expect(files).toContain('.claude/commands/kits/check.md');
    // Should NOT have unprefixed commands at root
    expect(files).not.toContain('.claude/commands/build.md');
    expect(files).not.toContain('.claude/commands/check.md');
  });

  it('should prefix Claude skills with filename strategy', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: 'kits',
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'claude' } });

    const files = collectFiles(projectRoot);
    expect(files).toContain('.claude/skills/kits-build/SKILL.md');
    expect(files).toContain('.claude/skills/kits-check/SKILL.md');
    expect(files).not.toContain('.claude/skills/build/SKILL.md');
  });

  it('should prefix Copilot prompts with filename strategy', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: 'kits',
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'copilot' } });

    const files = collectFiles(projectRoot);
    expect(files).toContain('.github/prompts/kits-build.prompt.md');
    expect(files).toContain('.github/prompts/kits-check.prompt.md');
    expect(files).not.toContain('.github/prompts/build.prompt.md');
  });

  it('should prefix Cursor commands with filename strategy', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: 'kits',
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'cursor' } });

    const files = collectFiles(projectRoot);
    expect(files).toContain('.cursor/commands/kits-build.md');
    expect(files).toContain('.cursor/commands/kits-check.md');
  });

  it('should prefix Windsurf commands with filename strategy', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: 'kits',
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'windsurf' } });

    const files = collectFiles(projectRoot);
    expect(files).toContain('.windsurf/commands/kits-build.md');
    expect(files).toContain('.windsurf/commands/kits-check.md');
  });

  it('should prefix Codex skills with filename strategy', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: 'kits',
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'codex' } });

    const files = collectFiles(projectRoot);
    expect(files).toContain('.agents/skills/kits-build/SKILL.md');
    expect(files).toContain('.agents/skills/kits-check/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// Integration tests: sync without commandPrefix (backwards compatibility)
// ---------------------------------------------------------------------------

describe('sync without commandPrefix (backwards compat)', () => {
  let agentkitRoot;
  let projectRoot;

  afterEach(() => {
    if (projectRoot) {
      rmSync(resolve(projectRoot, '..'), { recursive: true, force: true });
      projectRoot = null;
    }
    if (agentkitRoot) {
      rmSync(agentkitRoot, { recursive: true, force: true });
      agentkitRoot = null;
    }
  });

  it('should place commands at root without prefix', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: null,
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'claude' } });

    const files = collectFiles(projectRoot);
    expect(files).toContain('.claude/commands/build.md');
    expect(files).toContain('.claude/commands/check.md');
    expect(files).toContain('.claude/skills/build/SKILL.md');
  });

  it('should not prefix Copilot prompts without prefix', { timeout: 15000 }, async () => {
    agentkitRoot = makeMinimalAgentkitRootWithPrefix({
      overlayName: 'test-repo',
      commandPrefix: null,
    });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: { only: 'copilot' } });

    const files = collectFiles(projectRoot);
    expect(files).toContain('.github/prompts/build.prompt.md');
    expect(files).toContain('.github/prompts/check.prompt.md');
  });
});
