import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
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
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    // Set up a controlled project fixture
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' })
    );
    writeFile(
      join(tmpDir, '.github', 'workflows', 'ci.yml'),
      'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n'
    );
    writeFile(join(tmpDir, 'src', 'index.js'), '// entry point\n');
    // Init git repo with conventional commits. Identity and signing are passed
    // inline with -c rather than via `git config` calls: two fewer subprocesses,
    // and the fixture no longer depends on ambient user config (a machine with
    // commit.gpgsign enabled would otherwise fail here).
    execFileSync('git', ['init', '-b', 'main', '--quiet'], { cwd: tmpDir, stdio: 'ignore' });
    execFileSync('git', ['add', '-A'], { cwd: tmpDir, stdio: 'ignore' });
    execFileSync(
      'git',
      [
        '-c',
        'user.email=test@test.com',
        '-c',
        'user.name=Test',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--quiet',
        '-m',
        'feat: initial commit',
      ],
      { cwd: tmpDir, stdio: 'ignore' }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a discovery report with expected structure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const report = await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: tmpDir,
      flags: { output: 'json' },
    });

    expect(report).toHaveProperty('techStacks');
    expect(report).toHaveProperty('infrastructure');
    expect(report).toHaveProperty('cicd');
    expect(report).toHaveProperty('monorepo');
    expect(report).toHaveProperty('structure');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('repository');
    expect(report).toHaveProperty('commitConvention');

    expect(report.repository.isGit).toBe(true);
    expect(Array.isArray(report.techStacks)).toBe(true);
    expect(Array.isArray(report.structure.topLevelDirs)).toBe(true);
  });

  it('renders a markdown report when output=markdown', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: tmpDir,
      flags: { output: 'markdown' },
    });

    const out = logSpy.mock.calls.flat().join('\n');
    expect(out).toContain('# Discovery Report');
    expect(out).toContain('## Tech Stacks');
    expect(out).toContain('## Project Structure');
  });

  it('renders a markdown report including recommendations and frameworks when present', async () => {
    // Add some framework markers and an extra config to populate more sections
    writeFile(join(tmpDir, 'next.config.js'), 'module.exports = {};\n');
    writeFile(join(tmpDir, 'tailwind.config.js'), 'module.exports = {};\n');
    writeFile(join(tmpDir, 'docs', 'README.md'), '# docs\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: tmpDir,
      flags: { output: 'markdown' },
    });

    const out = logSpy.mock.calls.flat().join('\n');
    expect(out).toContain('# Discovery Report');
    // Frameworks/Documentation/CI section headers should appear when populated
    expect(out).toContain('## CI/CD');
  });

  it('passes a userContext through when extra args supplied', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const report = await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: tmpDir,
      flags: { output: 'json', _args: ['investigate', 'auth'] },
    });

    expect(report).toBeDefined();
    expect(logSpy).toHaveBeenCalled();
  });

  it('detects GitHub Actions CI', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const report = await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: tmpDir,
      flags: { output: 'json' },
    });

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
    writeFile(
      join(tmpDir, '.commitlintrc'),
      JSON.stringify({ extends: ['@commitlint/config-conventional'] })
    );
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects conventional from commitlint.config.js', async () => {
    writeFile(
      join(tmpDir, 'commitlint.config.js'),
      'module.exports = { extends: ["@commitlint/config-conventional"] };'
    );
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects conventional from .commitlintrc.json', async () => {
    writeFile(join(tmpDir, '.commitlintrc.json'), '{}');
    const result = await detectCommitConvention(tmpDir);
    expect(result).toBe('conventional');
  });

  it('detects conventional from .commitlintrc.yaml', async () => {
    writeFile(
      join(tmpDir, '.commitlintrc.yaml'),
      'extends:\n  - "@commitlint/config-conventional"\n'
    );
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
/**
 * Build a fast-import stream describing one commit per subject on refs/heads/main.
 *
 * `data <n>` is length-prefixed, so subjects are written verbatim — there is no
 * shell quoting anywhere in this path and no character needs escaping.
 */
function buildFastImportStream(subjects) {
  const EPOCH = 1700000000; // fixed timestamp keeps fixtures byte-identical between runs
  let stream = '';

  for (let i = 0; i < subjects.length; i++) {
    const message = subjects[i];
    stream += 'commit refs/heads/main\n';
    stream += `mark :${i + 1}\n`;
    // The committer comes from the stream, so the fixture does not depend on
    // ambient git identity or on commit.gpgsign being unset.
    stream += `committer Test <test@test.com> ${EPOCH + i} +0000\n`;
    stream += `data ${Buffer.byteLength(message, 'utf-8')}\n${message}\n`;
    if (i === 0) {
      // fast-import needs at least one tree entry to create a root commit.
      stream += 'M 644 inline README\ndata 1\nx\n';
    }
    stream += '\n';
  }

  return `${stream}done\n`;
}

/**
 * Create a throwaway git repository whose log contains exactly `subjects`.
 *
 * Uses `git fast-import` so the cost is two subprocesses regardless of how many
 * commits the fixture needs. The previous implementation spawned 3 + 2N processes
 * — 19 for an eight-commit fixture — which measured **48s on Windows against a
 * 15s test timeout**, making these tests fail whenever the machine was loaded.
 * The same fixture now builds in ~3s.
 */
function initGitRepo(dir, subjects) {
  execFileSync('git', ['init', '-b', 'main', '--quiet'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['fast-import', '--done', '--quiet'], {
    cwd: dir,
    input: buildFastImportStream(subjects),
    stdio: ['pipe', 'ignore', 'pipe'],
  });
}

describe('detectCommitConvention() — git-log heuristic', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it(
    'detects conventional from git log when ≥60% of commits match',
    { timeout: 15_000 },
    async () => {
      // 6 out of 8 = 75% conventional
      const subjects = [
        'feat(auth): add login flow',
        'fix(api): handle null response',
        'docs: update readme',
        'chore(deps): update vitest',
        'refactor(sync): extract helpers',
        'test(discover): add unit tests',
        'Update something randomly',
        'Another random commit',
      ];
      initGitRepo(tmpDir, subjects);

      const result = await detectCommitConvention(tmpDir);
      expect(result).toBe('conventional');
    }
  );

  it(
    'detects semantic from git log when ≥60% match semantic pattern',
    { timeout: 15_000 },
    async () => {
      // 6 out of 8 = 75% semantic
      const subjects = [
        'feat: add new feature',
        'fix: correct bug',
        'docs: update docs',
        'release: v1.2.0',
        'bump: version update',
        'merge: branch sync',
        'Random commit message',
        'Another plain message',
      ];
      initGitRepo(tmpDir, subjects);

      const result = await detectCommitConvention(tmpDir);
      // Most of these match "type: description" → semantic
      expect(result).toBe('semantic');
    }
  );

  it('returns null when commits do not meet 60% threshold', { timeout: 15_000 }, async () => {
    // Only 1 out of 6 ≈ 17% conventional
    const subjects = [
      'feat(auth): add login',
      'Updated the readme',
      'Fixed some stuff',
      'WIP',
      'Cleaned up code',
      'Initial commit',
    ];
    initGitRepo(tmpDir, subjects);

    const result = await detectCommitConvention(tmpDir);
    expect(result).toBeNull();
  });

  it(
    'handles breaking change marker (!) in conventional commits',
    { timeout: 15_000 },
    async () => {
      // 8 out of 8 = 100% conventional, some with breaking change markers
      const subjects = [
        'feat!: major breaking change',
        'fix(api)!: breaking fix',
        'feat(auth): add login flow',
        'fix: small bug',
        'docs: update readme',
        'chore(deps): update packages',
        'refactor(sync): cleanup',
        'test: add coverage',
      ];
      initGitRepo(tmpDir, subjects);

      const result = await detectCommitConvention(tmpDir);
      expect(result).toBe('conventional');
    }
  );

  it('returns null for empty git repos (no commits)', { timeout: 15_000 }, async () => {
    // No commit is made, so identity config is irrelevant here — `git init` alone.
    execFileSync('git', ['init', '-b', 'main', '--quiet'], { cwd: tmpDir, stdio: 'ignore' });

    const result = await detectCommitConvention(tmpDir);
    expect(result).toBeNull();
  });

  it(
    'reads the project repo, not one named by an ambient GIT_DIR',
    { timeout: 15_000 },
    async () => {
      initGitRepo(tmpDir, [
        'Updated the readme',
        'Fixed some stuff',
        'WIP',
        'Cleaned up code',
        'Initial commit',
      ]);

      const otherRepo = makeTmpDir();
      initGitRepo(otherRepo, [
        'feat(auth): add login flow',
        'fix(api): handle null response',
        'docs: update readme',
        'chore(deps): bump vitest',
      ]);

      const originalGitDir = process.env.GIT_DIR;
      process.env.GIT_DIR = join(otherRepo, '.git');
      try {
        // The project's own history is not conventional; the decoy's is.
        expect(await detectCommitConvention(tmpDir)).toBeNull();
      } finally {
        if (originalGitDir === undefined) delete process.env.GIT_DIR;
        else process.env.GIT_DIR = originalGitDir;
        rmSync(otherRepo, { recursive: true, force: true });
      }
    }
  );

  it(
    'file-based detection takes priority over git-log heuristic',
    { timeout: 15_000 },
    async () => {
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
    }
  );
});
