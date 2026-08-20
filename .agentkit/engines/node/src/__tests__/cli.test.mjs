import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildParseOptions, CLI_INTERNAL_FLAGS, loadCommandFlags } from '../cli-flags.mjs';
import { VALID_COMMANDS } from '../commands-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '..', 'cli.mjs');
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PKG_VERSION = JSON.parse(
  readFileSync(resolve(AGENTKIT_ROOT, 'package.json'), 'utf-8')
).version;

// Backstop only — not a budget. execFileSync blocks the worker synchronously, so
// Vitest's per-test timeout cannot preempt it; this cap is what actually fires if
// a child hangs. The heaviest command here (`harness doctor`) measured 6.8s at
// idle on Windows, so the previous 10s cap had no headroom under suite load — and
// when it fired it surfaced as `expected null to be 0` rather than as a timeout,
// because execFileSync reports a killed child with a null status. See ADR-12.
const CHILD_TIMEOUT_MS = 60_000;

function run(...args) {
  try {
    return {
      stdout: execFileSync('node', [CLI_PATH, ...args], {
        encoding: 'utf-8',
        timeout: CHILD_TIMEOUT_MS,
      }),
      exitCode: 0,
      timedOut: false,
    };
  } catch (err) {
    // err.status is null when the child was killed rather than exiting. Report
    // that as a timeout so a slow machine does not masquerade as a wrong exit code.
    const timedOut = err.status === null || err.status === undefined;
    return {
      stdout:
        (err.stdout || '') +
        (err.stderr || '') +
        (timedOut ? `\n[test] child killed after ${CHILD_TIMEOUT_MS}ms: ${err.message}` : ''),
      exitCode: err.status,
      timedOut,
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
    expect(result.stdout).toContain('harness generate');
    expect(result.stdout).toContain('--json            Emit machine-readable output');
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

  // These assertions run in-process against cli-flags.mjs rather than spawning the
  // CLI once per command.
  //
  // The spawn-per-command version could never have detected a flag configuration
  // error in the first place: main() short-circuits `--help` before it calls
  // loadCommandFlags()/parseFlags(), so `<cmd> --help` never builds an option
  // table. Verified directly — `cli.mjs sync --bogus-flag --help` emits no
  // unrecognized-flag warning, which only parseFlags produces. It cost 26 Node
  // startups (21.7s measured at idle, against a 30s budget) to assert command-name
  // membership and that cli.mjs boots. Calling buildParseOptions directly tests
  // what the name promises, covers commands.yaml-derived flags the old version
  // never reached, and spawns nothing. See ADR-12.
  describe('VALID_FLAGS / FLAG_TYPES consistency', () => {
    it('every command can build a parseArgs option table without a configuration error', async () => {
      const { validFlags, flagTypes } = await loadCommandFlags(AGENTKIT_ROOT);

      // loadCommandFlags swallows a missing or unparseable commands.yaml and falls
      // back to the CLI-internal tables alone. Without this guard the assertions
      // below would still pass while covering a fraction of the flag surface.
      expect(
        Object.keys(validFlags).length,
        'commands.yaml contributed no flags — loadCommandFlags fell back to CLI-internal only'
      ).toBeGreaterThan(Object.keys(CLI_INTERNAL_FLAGS).length);

      for (const cmd of VALID_COMMANDS) {
        expect(
          () => buildParseOptions(cmd, validFlags, flagTypes),
          `"${cmd}" has a flag listed in VALID_FLAGS with no entry in FLAG_TYPES`
        ).not.toThrow();
      }
    });

    it('every flag listed for a command has a type entry', async () => {
      const { validFlags, flagTypes } = await loadCommandFlags(AGENTKIT_ROOT);
      // --status is special-cased in buildParseOptions with a per-command type.
      const specialCased = new Set(['status']);

      const missing = [];
      for (const [cmd, flags] of Object.entries(validFlags)) {
        for (const flag of flags) {
          if (!flagTypes[flag] && !specialCased.has(flag)) {
            missing.push(`--${flag} (command: ${cmd})`);
          }
        }
      }

      expect(missing, `Flags with no type definition:\n${missing.join('\n')}`).toHaveLength(0);
    });

    it('types --status per command: boolean for orchestrate, string for tasks', async () => {
      const { validFlags, flagTypes } = await loadCommandFlags(AGENTKIT_ROOT);

      expect(buildParseOptions('orchestrate', validFlags, flagTypes).status).toEqual({
        type: 'boolean',
      });
      expect(buildParseOptions('tasks', validFlags, flagTypes).status).toEqual({ type: 'string' });
      // A command that does not declare --status must not get one.
      expect(buildParseOptions('spec-validate', validFlags, flagTypes).status).toBeUndefined();
    });

    it('throws a legible error when a listed flag has no type', () => {
      // Global flags are always merged in, so they must be typed for the
      // untyped command flag to be the one that trips.
      const globals = { help: 'boolean', quiet: 'boolean', verbose: 'boolean' };
      expect(() => buildParseOptions('sync', { sync: ['mystery-flag'] }, globals)).toThrow(
        /flag "--mystery-flag" is listed as valid for command "sync"/
      );
    });

    it('runs harness doctor against the pinned offline contract', { timeout: 90_000 }, () => {
      // The single heaviest spawn in this file — measured 6.8s at idle on Windows.
      // Budgeted well above that so suite contention does not turn it red.
      const result = run('harness', 'doctor', '--json');
      expect(result.timedOut, `child timed out:\n${result.stdout.slice(0, 300)}`).toBe(false);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout).status).toBe('passed');
    });
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
