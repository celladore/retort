import { describe, it, expect } from 'vitest';
import os from 'os';
import {
  execCommand,
  commandExists,
  formatDuration,
  isValidCommand,
  formatTimestamp,
} from '../runner.mjs';

describe('execCommand()', () => {
  it('returns structured result for successful command', () => {
    const result = execCommand('node -e "console.log(\'hello\')"');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns non-zero exit code for failing command', () => {
    const result = execCommand('false');
    expect(result.exitCode).not.toBe(0);
  });

  it('captures stderr', () => {
    // Avoid nested quotes that break on Windows cmd.exe with shell:true
    const result = execCommand('node -e "process.stderr.write(String(42))"');
    expect(result.stderr).toContain('42');
  });

  it('handles nonexistent command gracefully', () => {
    const result = execCommand('nonexistent_command_xyz_12345');
    expect(result.exitCode).not.toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('respects cwd option', () => {
    // Use node to print cwd — cross-platform (pwd doesn't exist on Windows)
    const tmpDir = os.tmpdir();
    const result = execCommand('node -e "console.log(process.cwd())"', { cwd: tmpDir });
    expect(result.exitCode).toBe(0);
    // Normalize both paths for comparison (resolve symlinks, normalize separators)
    const printed = result.stdout.trim().toLowerCase().replace(/\\/g, '/');
    const expected = tmpDir.toLowerCase().replace(/\\/g, '/');
    expect(printed).toContain(expected);
  });

  it('handles commands with arguments correctly', () => {
    const result = execCommand('node -e "console.log(process.argv[1])" test-arg');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('test-arg');
  });

  it('handles commands with quoted arguments', () => {
    const result = execCommand('node -e "console.log(process.argv[1])" "hello world"');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
  });

  it('does not interpret shell metacharacters as command separators', () => {
    // spawnSync passes args as an array — semicolons are literal, not separators.
    // On Windows (shell:true), Node auto-escapes each arg for cmd.exe.
    const result = execCommand('node -e "console.log(process.argv[1])" "safe; echo injected"');
    expect(result.exitCode).toBe(0);
    const output = result.stdout.trim();
    expect(output).toContain('safe;');
    expect(output).toContain('echo injected');
  });
});

describe('commandExists()', () => {
  it('returns true for existing commands', () => {
    expect(commandExists('node')).toBe(true);
    expect(commandExists('git')).toBe(true);
  });

  it('returns false for nonexistent commands', () => {
    expect(commandExists('nonexistent_command_xyz_12345')).toBe(false);
  });
});

describe('formatDuration()', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(59999)).toBe('59.9s');
  });

  it('formats minutes', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(3600000)).toBe('60m 0s');
  });
});

describe('isValidCommand()', () => {
  it('accepts valid commands', () => {
    expect(isValidCommand('git diff --name-only HEAD')).toBe(true);
    expect(isValidCommand('npx prettier --check .')).toBe(true);
    expect(isValidCommand('cargo fmt')).toBe(true);
    expect(isValidCommand('npm run build')).toBe(true);
    expect(isValidCommand('node --version')).toBe(true);
    expect(isValidCommand('eslint .')).toBe(true);
    expect(isValidCommand('tsc --noEmit')).toBe(true);
  });

  it('rejects commands with shell metacharacters', () => {
    expect(isValidCommand('echo $(whoami)')).toBe(false);
    expect(isValidCommand('cat /etc/passwd | grep root')).toBe(false);
    expect(isValidCommand('rm -rf /; echo done')).toBe(false);
    expect(isValidCommand('echo `id`')).toBe(false);
    expect(isValidCommand('echo ${HOME}')).toBe(false);
    expect(isValidCommand('cmd & background')).toBe(false);
    expect(isValidCommand('echo > /tmp/pwned')).toBe(false);
    expect(isValidCommand('echo < /etc/shadow')).toBe(false);
  });

  it('rejects null/empty/non-string inputs', () => {
    expect(isValidCommand(null)).toBe(false);
    expect(isValidCommand(undefined)).toBe(false);
    expect(isValidCommand('')).toBe(false);
    expect(isValidCommand(42)).toBe(false);
  });
});

describe('formatTimestamp()', () => {
  it('formats ISO timestamps for display', () => {
    expect(formatTimestamp('2026-02-23T17:30:00.123Z')).toBe('2026-02-23 17:30:00');
    expect(formatTimestamp('2026-01-01T00:00:00.000Z')).toBe('2026-01-01 00:00:00');
  });

  it('handles timestamps with varying millisecond precision', () => {
    expect(formatTimestamp('2026-02-23T17:30:00.1Z')).toBe('2026-02-23 17:30:00');
    expect(formatTimestamp('2026-02-23T17:30:00.12345Z')).toBe('2026-02-23 17:30:00');
  });

  it('handles timestamps without milliseconds', () => {
    expect(formatTimestamp('2026-02-23T17:30:00Z')).toBe('2026-02-23 17:30:00');
  });
});
