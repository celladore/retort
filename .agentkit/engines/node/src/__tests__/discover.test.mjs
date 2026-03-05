import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runDiscover, detectCommitConvention } from '../discover.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = join(
    tmpdir(),
    `agentkit-discover-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(filePath, content = '') {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

describe('runDiscover()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a discovery report for the current repo', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const report = await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { output: 'json' },
    });

    // Report should have expected structure
    expect(report).toHaveProperty('techStacks');
    expect(report).toHaveProperty('infrastructure');
    expect(report).toHaveProperty('cicd');
    expect(report).toHaveProperty('monorepo');
    expect(report).toHaveProperty('structure');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('repository');
    expect(report).toHaveProperty('commitConvention');

    // Should detect this repo is a git repo
    expect(report.repository.isGit).toBe(true);

    // techStacks should be an array (may or may not detect Node depending on project layout)
    expect(Array.isArray(report.techStacks)).toBe(true);

    // structure should include top-level dirs array
    // (may be empty in template repo since .agentkit/ is a dotfile)
    expect(Array.isArray(report.structure.topLevelDirs)).toBe(true);
  });

  it('detects GitHub Actions CI', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const report = await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { output: 'json' },
    });

    // Should detect our CI workflow
    expect(report.cicd).toContain('github-actions');
  });
});

describe('detectCommitConvention()', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no signals are present', async () => {
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBeNull();
  });

  it('detects conventional from .commitlintrc', async () => {
    writeFile(join(tmpDir, '.commitlintrc'), JSON.stringify({ extends: ['@commitlint/config-conventional'] }));
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects conventional from commitlint.config.js', async () => {
    writeFile(join(tmpDir, 'commitlint.config.js'), 'module.exports = { extends: ["@commitlint/config-conventional"] };');
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects conventional from .commitlintrc.json', async () => {
    writeFile(join(tmpDir, '.commitlintrc.json'), '{}');
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects conventional from .commitlintrc.yaml', async () => {
    writeFile(join(tmpDir, '.commitlintrc.yaml'), 'extends:\n  - "@commitlint/config-conventional"\n');
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects semantic from .releaserc', async () => {
    writeFile(join(tmpDir, '.releaserc'), JSON.stringify({ branches: ['main'] }));
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('semantic');
  });

  it('detects semantic from .releaserc.json', async () => {
    writeFile(join(tmpDir, '.releaserc.json'), '{}');
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('semantic');
  });

  it('detects semantic from release.config.js', async () => {
    writeFile(join(tmpDir, 'release.config.js'), 'module.exports = {};');
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('semantic');
  });

  it('detects conventional from package.json commitlint key', async () => {
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', commitlint: { extends: ['@commitlint/config-conventional'] } })
    );
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects semantic from package.json standard-version key', async () => {
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', 'standard-version': {} })
    );
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('semantic');
  });

  it('detects semantic from package.json release key', async () => {
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', release: { branches: ['main'] } })
    );
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('semantic');
  });

  it('commitlint config takes priority over .releaserc', async () => {
    writeFile(join(tmpDir, '.commitlintrc.json'), '{}');
    writeFile(join(tmpDir, '.releaserc.json'), '{}');
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });
});
