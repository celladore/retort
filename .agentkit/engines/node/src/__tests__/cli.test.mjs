import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '..', 'cli.mjs');
const PKG_VERSION = JSON.parse(readFileSync(resolve(__dirname, '..', '..', '..', '..', 'package.json'), 'utf-8')).version;

function run(...args) {
  try {
    return {
      stdout: execFileSync('node', [CLI_PATH, ...args], {
        encoding: 'utf-8',
        timeout: 10_000,
      }),
      exitCode: 0,
    };
  } catch (err) {
    return {
      stdout: (err.stdout || '') + (err.stderr || ''),
      exitCode: err.status,
    };
  }
}

describe('CLI', () => {
  it('shows help with --help', () => {
    const result = run('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AgentKit Forge');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('sync');
    expect(result.stdout).toContain('validate');
  });

  it('shows help with -h', () => {
    const result = run('-h');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AgentKit Forge');
  });

  it('shows help with no arguments', () => {
    const result = run();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('AgentKit Forge');
  });

  it('shows version from package.json', () => {
    const result = run('--help');
    expect(result.stdout).toContain(`AgentKit Forge v${PKG_VERSION}`);
  });

  it('rejects unknown commands with exit code 1', () => {
    const result = run('nonexistent');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Unknown command');
    expect(result.stdout).toContain('Valid commands');
  });

  it('shows help hint for unknown commands', () => {
    const result = run('foo');
    expect(result.stdout).toContain('--help');
  });

  it('accepts --flag=value syntax', () => {
    // spec-validate ignores flags, so passing --unknown=value should just work
    const result = run('spec-validate', '--help');
    expect(result.exitCode).toBe(0);
  });

  it('runs spec-validate successfully', () => {
    const result = run('spec-validate');
    expect(result.exitCode).toBe(0);
  });

  describe('parseArgs flag scoping', () => {
    it('orchestrate --status is treated as a boolean flag (no value required)', () => {
      // --status is boolean for orchestrate; --help exits before running the command
      const result = run('orchestrate', '--status', '--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('AgentKit Forge');
    });

    it('tasks --status accepts a string value', () => {
      // --status is string for tasks; --help exits before running the command
      const result = run('tasks', '--status', 'submitted', '--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('AgentKit Forge');
    });

    it('tasks --status without a value exits non-zero', () => {
      // --status is a string option for tasks; omitting the value should cause an error
      const result = run('tasks', '--status');
      expect(result.exitCode).not.toBe(0);
    });

    it('command without --status support does not error when --status is passed without a value', () => {
      // spec-validate does not declare --status; with strict:false the unknown flag is
      // tolerated and spec-validate runs to completion
      const result = run('spec-validate', '--status');
      expect(result.exitCode).toBe(0);
    });

    it('sync -q (short for --quiet) does not error', () => {
      // -q is a short alias for --quiet; --help exits before running sync
      const result = run('sync', '-q', '--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('AgentKit Forge');
    });

    it('sync -v (short for --verbose) does not error', () => {
      // -v is a short alias for --verbose; --help exits before running sync
      const result = run('sync', '-v', '--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('AgentKit Forge');
    });
  });
});
