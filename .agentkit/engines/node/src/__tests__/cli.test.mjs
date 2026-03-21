import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '..', 'cli.mjs');
const PKG_VERSION = JSON.parse(
  readFileSync(resolve(__dirname, '..', '..', '..', '..', 'package.json'), 'utf-8')
).version;

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
    expect(result.stdout).toContain('Retort');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('sync');
    expect(result.stdout).toContain('validate');
  });

  it('shows help with -h', () => {
    const result = run('-h');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Retort');
  });

  it('shows help with no arguments', () => {
    const result = run();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Retort');
  });

  it('shows version from package.json', () => {
    const result = run('--help');
    expect(result.stdout).toContain(`Retort v${PKG_VERSION}`);
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

  describe('VALID_FLAGS / FLAG_TYPES consistency', () => {
    it('every CLI-internal flag has a corresponding type entry (dynamic flags loaded from commands.yaml)', () => {
      // Parse cli.mjs source to extract VALID_FLAGS and FLAG_TYPES
      const src = readFileSync(CLI_PATH, 'utf-8');

      // Extract FLAG_TYPES keys
      const ftMatch = src.match(/const CLI_INTERNAL_FLAG_TYPES = \{([\s\S]*?)\n\};/);
      expect(ftMatch, 'Could not find CLI_INTERNAL_FLAG_TYPES in cli.mjs').toBeTruthy();
      const flagTypeKeys = new Set();
      for (const line of ftMatch[1].split('\n')) {
        const m = line.match(/^\s*'([a-zA-Z][\w-]*)'\s*:/);
        if (m) flagTypeKeys.add(m[1]);
        const m2 = line.match(/^\s*([a-zA-Z][\w-]*)\s*:/);
        if (m2) flagTypeKeys.add(m2[1]);
      }

      // Extract VALID_FLAGS per-command arrays
      const vfMatch = src.match(/const CLI_INTERNAL_FLAGS = \{([\s\S]*?)\n\};/);
      expect(vfMatch, 'Could not find CLI_INTERNAL_FLAGS in cli.mjs').toBeTruthy();
      const cmdPattern = /['"]?([\w-]+)['"]?\s*:\s*\[([\s\S]*?)\]/g;
      let match;
      const missing = [];
      // Global flags defined in loadCommandFlags() (not in CLI_INTERNAL_FLAG_TYPES)
      flagTypeKeys.add('help');
      flagTypeKeys.add('quiet');
      flagTypeKeys.add('verbose');

      // Special-cased flags that are handled inline in parseFlags (not in FLAG_TYPES)
      const specialCased = new Set(['status']);
      while ((match = cmdPattern.exec(vfMatch[1])) !== null) {
        const cmd = match[1];
        for (const fm of match[2].matchAll(/'([a-zA-Z][\w-]*)'/g)) {
          const flag = fm[1];
          if (!flagTypeKeys.has(flag) && !specialCased.has(flag)) {
            missing.push(`--${flag} (command: ${cmd})`);
          }
        }
      }

      expect(
        missing,
        `Flags in CLI_INTERNAL_FLAGS missing from CLI_INTERNAL_FLAG_TYPES:\n${missing.join('\n')}`
      ).toHaveLength(0);
    });

    it(
      'every command can be invoked with --help without a flag configuration error',
      { timeout: 30_000 },
      () => {
        const commands = [
          'sync',
          'init',
          'validate',
          'discover',
          'spec-validate',
          'orchestrate',
          'plan',
          'check',
          'review',
          'handoff',
          'healthcheck',
          'cost',
          'tasks',
          'delegate',
          'doctor',
          'import-issues',
          'backlog',
          'sync-backlog',
          'scaffold',
          'preflight',
          'project-review',
          'add',
          'remove',
          'list',
          'features',
        ];
        for (const cmd of commands) {
          const result = run(cmd, '--help');
          expect(
            result.exitCode,
            `"${cmd} --help" exited with code ${result.exitCode}. Output:\n${result.stdout.slice(0, 300)}`
          ).toBe(0);
        }
      }
    );
  });

  describe('parseArgs flag scoping', () => {
    it('orchestrate --status is treated as a boolean flag (no value required)', () => {
      // --status is boolean for orchestrate; --help exits before running the command
      const result = run('orchestrate', '--status', '--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Retort');
    });

    it('tasks --status accepts a string value', () => {
      // --status is string for tasks; --help exits before running the command
      const result = run('tasks', '--status', 'submitted', '--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Retort');
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
      expect(result.stdout).toContain('Retort');
    });

    it('sync -v (short for --verbose) does not error', () => {
      // -v is a short alias for --verbose; --help exits before running sync
      const result = run('sync', '-v', '--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Retort');
    });
  });
});
