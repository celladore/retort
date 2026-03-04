import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as orchestrator from '../orchestrator.mjs';
import { runReview } from '../review-runner.mjs';
import * as runner from '../runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-tmp', 'review');
const STATE_DIR = resolve(TEST_ROOT, '.claude', 'state');
const FAKE_AWS_KEY = `AKIA${'IOSFODNN7EXAMPLE'}`;
const FAKE_PRIVATE_KEY_HEADER = `-----BEGIN ${'RSA '}PRIVATE KEY-----`;

function setupTestRepo() {
  if (existsSync(TEST_ROOT))
    rmSync(TEST_ROOT, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');
  mkdirSync(resolve(TEST_ROOT, '.git'), { recursive: true });
}

function teardownTestRepo() {
  if (existsSync(TEST_ROOT))
    rmSync(TEST_ROOT, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

describe('review-runner', () => {
  afterEach(() => {
    teardownTestRepo();
    vi.restoreAllMocks();
  });

  // Mock git commands globally to avoid spawning real processes.
  // Individual tests override via flags.file so getChangedFiles() returns
  // the specific file without needing a real git repo.
  function mockGitAndEvents() {
    vi.spyOn(runner, 'execCommand').mockImplementation((cmd) => {
      if (cmd.includes('git diff')) return { exitCode: 0, stdout: '', stderr: '', durationMs: 5 };
      return { exitCode: 1, stdout: '', stderr: '', durationMs: 0 };
    });
    vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});
  }

  describe('secret scanning', () => {
    it('detects AWS access keys', async () => {
      setupTestRepo();
      // Create file with fake AWS key
      writeFileSync(resolve(TEST_ROOT, 'config.js'), `const key = "${FAKE_AWS_KEY}";`, 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'config.js' },
      });

      expect(result.secrets).toBeGreaterThan(0);
      expect(result.findings.some((f) => f.type === 'secret' && f.pattern === 'AWS Key')).toBe(
        true
      );
    });

    it('detects private keys', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'key.pem'), `${FAKE_PRIVATE_KEY_HEADER}\nfake`, 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'key.pem' },
      });

      expect(result.secrets).toBeGreaterThan(0);
      expect(result.findings.some((f) => f.pattern === 'Private Key')).toBe(true);
    });

    it('passes clean files', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'clean.js'), 'const x = 42;', 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'clean.js' },
      });

      expect(result.secrets).toBe(0);
    });
  });

  describe('secret scan skip logic', () => {
    it('skips files inside node_modules/', async () => {
      setupTestRepo();
      // Place a fake AWS key inside a node_modules path
      mkdirSync(resolve(TEST_ROOT, 'node_modules', 'some-pkg'), { recursive: true });
      writeFileSync(
        resolve(TEST_ROOT, 'node_modules', 'some-pkg', 'index.js'),
        `const key = "${FAKE_AWS_KEY}";`,
        'utf-8'
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'node_modules/some-pkg/index.js' },
      });

      // File should be skipped — no secret findings
      expect(result.secrets).toBe(0);
    });

    it('skips .lock files', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'yarn.lock'), `const key = "${FAKE_AWS_KEY}";`, 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'yarn.lock' },
      });

      expect(result.secrets).toBe(0);
    });

    it('skips .snap files', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'test.snap'), `const key = "${FAKE_AWS_KEY}";`, 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'test.snap' },
      });

      expect(result.secrets).toBe(0);
    });

    it('skips .sum files', async () => {
      setupTestRepo();
      writeFileSync(resolve(TEST_ROOT, 'go.sum'), `const key = "${FAKE_AWS_KEY}";`, 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'go.sum' },
      });

      expect(result.secrets).toBe(0);
    });

    it('skips files inside vendor/', async () => {
      setupTestRepo();
      mkdirSync(resolve(TEST_ROOT, 'vendor', 'lib'), { recursive: true });
      writeFileSync(
        resolve(TEST_ROOT, 'vendor', 'lib', 'util.go'),
        `const key = "${FAKE_AWS_KEY}";`,
        'utf-8'
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'vendor/lib/util.go' },
      });

      expect(result.secrets).toBe(0);
    });
  });

  describe('path traversal protection', () => {
    it('rejects --file paths outside project root', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { file: '../../etc/passwd' },
        })
      ).rejects.toThrow('must be within the project root');
    });

    it('rejects --file symlinks that point outside project root', async () => {
      setupTestRepo();
      const externalDir = resolve(TEST_ROOT, '..', 'external-target');
      const secretFile = resolve(externalDir, 'secret.txt');
      mkdirSync(externalDir, { recursive: true });
      writeFileSync(secretFile, 'secret-data', 'utf-8');

      try {
        const linkDirPath = resolve(TEST_ROOT, 'linked-out');
        if (existsSync(linkDirPath)) rmSync(linkDirPath, { recursive: true, force: true });

        if (process.platform === 'win32') {
          symlinkSync(externalDir, linkDirPath, 'junction');
        } else {
          symlinkSync(externalDir, linkDirPath);
        }

        vi.spyOn(console, 'log').mockImplementation(() => {});

        await expect(
          runReview({
            agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
            projectRoot: TEST_ROOT,
            flags: { file: 'linked-out/secret.txt' },
          })
        ).rejects.toThrow('symlinks traversing outside are not allowed');
      } finally {
        if (existsSync(externalDir)) rmSync(externalDir, { recursive: true, force: true });
      }
    });

    it('rejects git-diff symlinks that point outside project root', async () => {
      setupTestRepo();
      const externalDir = resolve(TEST_ROOT, '..', 'external-target-diff');
      const secretFile = resolve(externalDir, 'secret.txt');
      mkdirSync(externalDir, { recursive: true });
      writeFileSync(secretFile, 'secret-data', 'utf-8');

      try {
        const linkDirPath = resolve(TEST_ROOT, 'linked-out-diff');
        if (existsSync(linkDirPath)) rmSync(linkDirPath, { recursive: true, force: true });

        if (process.platform === 'win32') {
          symlinkSync(externalDir, linkDirPath, 'junction');
        } else {
          symlinkSync(externalDir, linkDirPath);
        }

        // Mock git diff to return the symlink filename (simulating --range / default diff path)
        vi.spyOn(runner, 'execCommand').mockImplementation((cmd) => {
          if (cmd.includes('git diff'))
            return {
              exitCode: 0,
              stdout: 'linked-out-diff/secret.txt\n',
              stderr: '',
              durationMs: 5,
            };
          return { exitCode: 1, stdout: '', stderr: '', durationMs: 0 };
        });
        vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});

        await expect(
          runReview({
            agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
            projectRoot: TEST_ROOT,
            flags: {}, // No --file: uses git diff output
          })
        ).rejects.toThrow('symlinks traversing outside are not allowed');
      } finally {
        if (existsSync(externalDir)) rmSync(externalDir, { recursive: true, force: true });
      }
    });
  });

  describe('range validation', () => {
    it('rejects invalid --range values', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { range: 'HEAD; rm -rf /' },
        })
      ).rejects.toThrow('Invalid --range value');
    });

    it('rejects excessively long --range values', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const longRange = 'a'.repeat(257) + '..HEAD';
      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { range: longRange },
        })
      ).rejects.toThrow('Invalid --range value');
    });

    it('rejects --range with reflog @{} syntax', async () => {
      setupTestRepo();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        runReview({
          agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
          projectRoot: TEST_ROOT,
          flags: { range: 'HEAD@{1}..HEAD' },
        })
      ).rejects.toThrow('Invalid --range value');
    });

    it('accepts valid range notation', async () => {
      setupTestRepo();
      mockGitAndEvents();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock returns no files so the result is SKIP — the important thing
      // is that it doesn't throw "Invalid --range"
      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { range: 'HEAD~3..HEAD' },
      });

      // Should not have thrown range validation error
      expect(result).toBeDefined();
    });
  });

  describe('large file detection', () => {
    it('flags files over threshold', async () => {
      setupTestRepo();
      // Create a 600KB file (over 500KB threshold)
      writeFileSync(resolve(TEST_ROOT, 'big.bin'), Buffer.alloc(600_000, 'x'), 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'big.bin' },
      });

      expect(result.largeFiles).toBe(1);
    });
  });

  describe('TODO scanning', () => {
    it('detects TODO comments', async () => {
      setupTestRepo();
      writeFileSync(
        resolve(TEST_ROOT, 'code.js'),
        '// TODO: fix this\n// FIXME: broken\nconst x = 1;',
        'utf-8'
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: { file: 'code.js' },
      });

      expect(result.todos).toBe(2);
    });
  });

  describe('result structure', () => {
    it('returns SKIP when no files found', async () => {
      setupTestRepo();
      mockGitAndEvents();

      vi.spyOn(console, 'log').mockImplementation(() => {});

      // No changed files — mock returns empty diff
      const result = await runReview({
        agentkitRoot: resolve(__dirname, '..', '..', '..', '..'),
        projectRoot: TEST_ROOT,
        flags: {},
      });

      expect(result.status).toBe('SKIP');
      expect(result.files).toBe(0);
    });
  });
});
