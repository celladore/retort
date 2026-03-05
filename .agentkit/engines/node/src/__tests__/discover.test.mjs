import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
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

  it('respects explicit none — returns none without running detection', async () => {
    // Even with a commitlint config present, explicit 'none' should be respected
    writeFile(join(tmpDir, '.commitlintrc.json'), '{}');
    const result = await detectCommitConvention(tmpDir, { currentConvention: 'none' });
    expect(result).toBe('none');
  });

  it('does not skip detection when currentConvention is a non-none value', async () => {
    writeFile(join(tmpDir, '.commitlintrc.json'), '{}');
    const result = await detectCommitConvention(tmpDir, { currentConvention: 'conventional' });
    expect(result).toBe('conventional');
  });
});

// ---------------------------------------------------------------------------
// Git-log heuristic tests
// ---------------------------------------------------------------------------

/**
 * Helper: initialise a git repo and create commits with the given subjects.
 */
function initGitRepo(dir, subjects) {
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
  for (const subject of subjects) {
    // Create a unique file per commit so git has something to commit
    const filename = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
    writeFileSync(join(dir, filename), subject, 'utf-8');
    execSync('git add .', { cwd: dir, stdio: 'ignore' });
    execSync(`git commit -m "${subject.replace(/"/g, '\\"')}"`, { cwd: dir, stdio: 'ignore' });
  }
}

describe('detectCommitConvention() — git-log heuristic', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects conventional from git log when ≥60% of commits match', async () => {
    // 15 out of 20 = 75% conventional
    const subjects = [
      'feat(auth): add login flow',
      'fix(api): handle null response',
      'docs: update readme',
      'chore(deps): update vitest',
      'refactor(sync): extract helpers',
      'test(discover): add unit tests',
      'ci(workflows): add coverage',
      'perf(render): optimize loop',
      'build: update webpack config',
      'revert: undo last change',
      'feat!: breaking change',
      'fix(ui): correct alignment',
      'feat(auth): add OAuth2 support',
      'Update something randomly',
      'Another random commit',
      'fix: quick patch',
      'docs(api): add examples',
      'chore: cleanup scripts',
      'random message here',
      'yet another plain commit',
    ];
    initGitRepo(tmpDir, subjects);

    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects semantic from git log when ≥60% match semantic pattern', async () => {
    // Semantic-style commits: "type: description" (lowercase, no scope requirement)
    const subjects = [
      'feat: add new feature',
      'fix: correct bug',
      'docs: update docs',
      'style: format code',
      'refactor: clean up',
      'test: add tests',
      'chore: update deps',
      'perf: speed up query',
      'build: update config',
      'ci: fix pipeline',
      'release: v1.2.0',
      'bump: version update',
      'merge: branch sync',
      'Random commit message',
      'Another plain message',
      'WIP on feature',
      'misc: cleanup',
      'update: add logging',
      'deploy: production push',
      'config: change settings',
    ];
    initGitRepo(tmpDir, subjects);

    const result = await detectCommitConvention(tmpDir);
    // Most of these match "type: description" → semantic
    expect(result).toBe('semantic');
  });

  it('returns null when commits do not meet 60% threshold', async () => {
    // Only 2 out of 10 = 20% conventional
    const subjects = [
      'feat(auth): add login',
      'fix: quick patch',
      'Updated the readme',
      'Fixed some stuff',
      'WIP',
      'Added more tests',
      'Cleaned up code',
      'Merged branch',
      'Minor tweak',
      'Initial commit',
    ];
    initGitRepo(tmpDir, subjects);

    const result = await detectCommitConvention(tmpDir);
    expect(result).toBeNull();
  });

  it('handles breaking change marker (!) in conventional commits', async () => {
    // All commits are conventional with some having breaking change markers
    const subjects = [
      'feat!: major breaking change',
      'fix(api)!: breaking fix',
      'feat(auth): add login flow',
      'fix: small bug',
      'docs: update readme',
      'chore(deps): update packages',
      'refactor(sync): cleanup',
      'test: add coverage',
      'ci: fix workflows',
      'perf: optimize query',
      'build: update deps',
      'feat(ui): new component',
    ];
    initGitRepo(tmpDir, subjects);

    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('returns null for empty git repos (no commits)', async () => {
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });

    const result = await detectCommitConvention(tmpDir);
    expect(result).toBeNull();
  });

  it('file-based detection takes priority over git-log heuristic', async () => {
    // Git log has semantic commits, but commitlint config is present
    const subjects = [
      'feat: add feature',
      'fix: correct bug',
      'docs: update docs',
      'chore: cleanup',
      'test: add tests',
    ];
    initGitRepo(tmpDir, subjects);
    writeFile(join(tmpDir, '.commitlintrc.json'), '{}');

    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional'); // file-based wins over git-log
  });
});
