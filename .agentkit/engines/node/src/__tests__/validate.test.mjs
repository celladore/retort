import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runValidate } from '../validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');
const PRETTIER_BIN = resolve(AGENTKIT_ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

describe('runValidate()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs all validation phases against the real project', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Prevent process.exit from killing the test
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: {},
    });

    // Should produce output for each phase
    const allOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allOutput).toContain('Spec Validation');
    expect(allOutput).toContain('Output Directories');
    expect(allOutput).toContain('JSON Files');
    expect(allOutput).toContain('Commands');
    expect(allOutput).toContain('Hooks');
    expect(allOutput).toContain('Generated Headers');
    expect(allOutput).toContain('Settings');
    expect(allOutput).toContain('Secret Scan');
  });
});

// ---------------------------------------------------------------------------
// Prettier formatting — verify project files pass prettier check
// ---------------------------------------------------------------------------
describe('prettier check', () => {
  it('all project files pass prettier formatting', { timeout: 90_000 }, () => {
    const prettierResult = spawnSync(process.execPath, [PRETTIER_BIN, '--check', '.'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    });
    const unformatted = (prettierResult.stdout + prettierResult.stderr)
      .split('\n')
      .filter((l) => l.includes('[warn]'))
      .join('\n');
    expect(
      prettierResult.status,
      `Prettier check failed. Files needing formatting:\n${unformatted}`
    ).toBe(0);
  });
});

describe('validate - edge cases', () => {
  const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-validate');

  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    vi.restoreAllMocks();
  });

  it('reports errors for missing directories', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    const errors = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errors).toContain('Missing directory');
    // process.exit(1) should have been called due to errors
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('detects invalid JSON files', async () => {
    // Create the directories and files needed
    mkdirSync(resolve(TEST_ROOT, '.claude'), { recursive: true });
    writeFileSync(resolve(TEST_ROOT, '.claude', 'settings.json'), '{invalid json', 'utf-8');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    const errors = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(errors).toContain('invalid JSON');
  });
});
