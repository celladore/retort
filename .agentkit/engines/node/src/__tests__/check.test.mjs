import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_FORMATTER_BASES,
  ALLOWED_LINTER_BASES,
  ALLOWED_NPX_PACKAGES,
  auditUnresolvedPlaceholders,
  isAllowedFormatter,
  isAllowedLinter,
  resolveFormatter,
  resolveLinter,
  runCheck,
} from '../check.mjs';
import * as runner from '../runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

function createCheckFixture({
  withBuild = true,
  formatter = null,
  withPrettierBin = false,
  testCommand = null,
} = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'agentkit-check-test-'));
  const agentkitRoot = resolve(root, '.agentkit');
  const projectRoot = resolve(root, 'project');

  mkdirSync(resolve(agentkitRoot, 'spec'), { recursive: true });
  mkdirSync(projectRoot, { recursive: true });

  writeFileSync(resolve(projectRoot, 'package.json'), '{}\n', 'utf-8');

  if (withPrettierBin) {
    const prettierBin = resolve(agentkitRoot, 'node_modules', 'prettier', 'bin');
    mkdirSync(prettierBin, { recursive: true });
    writeFileSync(resolve(prettierBin, 'prettier.cjs'), 'process.exit(0);\n', 'utf-8');
  }

  const buildLine = withBuild ? '    buildCommand: "node -e \\\"\\\""\n' : '';
  const formatterLine = formatter ? `    formatter: "${formatter}"\n` : '';
  // Default to a no-op node one-liner so steps are cheap. Tests that need a
  // recognisable runner (so resolveCoverageCommand returns a command) override it.
  const testLine = testCommand
    ? `    testCommand: ${JSON.stringify(testCommand)}\n`
    : '    testCommand: "node -e \\\"\\\""\n';
  const teamsYaml = `techStacks:
  - name: test-stack
    detect:
      - package.json
${formatterLine}
    typecheck: "node -e \\\"\\\""
${testLine}${buildLine}`;

  writeFileSync(resolve(agentkitRoot, 'spec', 'teams.yaml'), teamsYaml, 'utf-8');
  return { root, agentkitRoot, projectRoot };
}

function cleanupFixture(root) {
  if (existsSync(root)) {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('runCheck()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a structured result object', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture();
    try {
      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: {},
      });

      expect(result).toHaveProperty('stacks');
      expect(result).toHaveProperty('overallStatus');
      expect(result).toHaveProperty('overallPassed');
      expect(Array.isArray(result.stacks)).toBe(true);
      expect(result.stacks.length).toBe(1);
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);

  it('respects --fast flag structure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture({ withBuild: true });
    try {
      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { fast: true },
      });

      for (const stackResult of result.stacks) {
        const buildStep = stackResult.steps.find((s) => s.step === 'build');
        expect(buildStep).toBeUndefined();
      }
      expect(result.stacks[0].steps.some((s) => s.step === 'test')).toBe(true);
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);

  it('handles --stack filter for unknown stacks gracefully', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture();
    try {
      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { stack: 'nonexistent-stack' },
      });

      expect(result.stacks).toEqual([]);
      expect(result.overallStatus).toBe('SKIP');
      expect(result.overallPassed).toBe(true);
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);

  it('resolves prettier path from agentkitRoot when roots are split', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture({
      withBuild: false,
      formatter: 'prettier',
      withPrettierBin: true,
    });
    try {
      const expectedPrettierBin = resolve(
        fixture.agentkitRoot,
        'node_modules',
        'prettier',
        'bin',
        'prettier.cjs'
      ).replace(/\\/g, '/');

      const formatter = resolveFormatter('prettier', fixture.agentkitRoot);
      expect(formatter.cmd).toBe('prettier');
      expect(formatter.check).toBe(`node "${expectedPrettierBin}" --check .`);
      expect(formatter.fix).toBe(`node "${expectedPrettierBin}" --write .`);

      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { fast: true },
      });

      const formatStep = result.stacks[0]?.steps.find((step) => step.step === 'format');
      expect(formatStep?.status).toBe('PASS');
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);
});

describe('resolveFormatter()', () => {
  it('maps known formatters to check/fix commands', () => {
    const expectedPrettierBin = resolve(
      AGENTKIT_ROOT,
      'node_modules',
      'prettier',
      'bin',
      'prettier.cjs'
    ).replace(/\\/g, '/');
    const r = resolveFormatter('prettier', AGENTKIT_ROOT);
    expect(r.check).toBe(`node "${expectedPrettierBin}" --check .`);
    expect(r.fix).toBe(`node "${expectedPrettierBin}" --write .`);
    expect(r.cmd).toBe('prettier');
  });

  it('maps black formatter correctly', () => {
    const r = resolveFormatter('black');
    expect(r.check).toBe('black --check .');
    expect(r.fix).toBe('black .');
  });

  it('returns raw command for unknown formatters', () => {
    const r = resolveFormatter('my-custom-fmt');
    expect(r.check).toBe('my-custom-fmt');
    expect(r.fix).toBe('my-custom-fmt');
    expect(r.cmd).toBe('my-custom-fmt');
  });
});

describe('resolveLinter()', () => {
  it('maps eslint to check/fix commands', () => {
    const r = resolveLinter('eslint');
    expect(r.check).toBe('eslint .');
    expect(r.fix).toBe('eslint --fix .');
  });

  it('maps pylint with null fix', () => {
    const r = resolveLinter('pylint');
    expect(r.check).toBe('pylint .');
    expect(r.fix).toBeNull();
  });

  it('returns raw command for unknown linters', () => {
    const r = resolveLinter('my-custom-linter');
    expect(r.check).toBe('my-custom-linter');
    expect(r.fix).toBeNull();
    expect(r.cmd).toBe('my-custom-linter');
  });
});

describe('isAllowedFormatter()', () => {
  it('allows known formatter bases', () => {
    expect(isAllowedFormatter({ cmd: 'black', check: 'black --check .', fix: 'black .' })).toBe(
      true
    );
    expect(isAllowedFormatter({ cmd: 'gofmt', check: 'gofmt -l .', fix: 'gofmt -w .' })).toBe(true);
  });

  it('allows npx with an allowed package', () => {
    expect(
      isAllowedFormatter({
        cmd: 'npx prettier',
        check: 'npx prettier --check .',
        fix: 'npx prettier --write .',
      })
    ).toBe(true);
  });

  it('blocks npx with an unknown package', () => {
    expect(
      isAllowedFormatter({ cmd: 'npx malicious-pkg', check: 'npx malicious-pkg .', fix: null })
    ).toBe(false);
  });

  it('blocks unknown formatter bases', () => {
    expect(isAllowedFormatter({ cmd: 'arbitrary-bin', check: 'arbitrary-bin .', fix: null })).toBe(
      false
    );
  });

  it('exports ALLOWED_FORMATTER_BASES and ALLOWED_NPX_PACKAGES sets', () => {
    expect(ALLOWED_FORMATTER_BASES.has('prettier')).toBe(true);
    expect(ALLOWED_NPX_PACKAGES.has('prettier')).toBe(true);
  });
});

describe('isAllowedLinter()', () => {
  it('allows known linter bases', () => {
    expect(isAllowedLinter({ cmd: 'eslint', check: 'eslint .', fix: 'eslint --fix .' })).toBe(true);
    expect(isAllowedLinter({ cmd: 'pylint', check: 'pylint .', fix: null })).toBe(true);
    expect(isAllowedLinter({ cmd: 'cargo clippy', check: 'cargo clippy', fix: null })).toBe(true);
  });

  it('blocks unknown linter bases', () => {
    expect(
      isAllowedLinter({ cmd: 'arbitrary-linter', check: 'arbitrary-linter .', fix: null })
    ).toBe(false);
    expect(
      isAllowedLinter({ cmd: 'npx malicious-linter', check: 'npx malicious-linter .', fix: null })
    ).toBe(false);
  });

  it('exports ALLOWED_LINTER_BASES set', () => {
    expect(ALLOWED_LINTER_BASES.has('eslint')).toBe(true);
    expect(ALLOWED_LINTER_BASES.has('pylint')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// auditUnresolvedPlaceholders
// ---------------------------------------------------------------------------

describe('auditUnresolvedPlaceholders()', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns empty array when no output dirs exist', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-no-dirs-'));
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude', '.cursor']);
    expect(findings).toEqual([]);
  });

  it('finds unresolved {{variable}} placeholders in markdown files', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-find-'));
    mkdirSync(resolve(tempDir, '.claude'), { recursive: true });
    writeFileSync(
      resolve(tempDir, '.claude', 'README.md'),
      'Hello {{userName}} — welcome to {{projectName}}!'
    );
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude']);
    expect(findings.length).toBe(1);
    expect(findings[0].variables).toEqual(expect.arrayContaining(['userName', 'projectName']));
  });

  it('skips block helpers and else markers', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-helpers-'));
    mkdirSync(resolve(tempDir, '.claude'), { recursive: true });
    writeFileSync(
      resolve(tempDir, '.claude', 'a.md'),
      '{{#if foo}}yes{{else}}no{{/if}} — but {{realVar}} should be flagged'
    );
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude']);
    expect(findings.length).toBe(1);
    expect(findings[0].variables).toEqual(['realVar']);
  });

  it('returns no findings when files have no placeholders', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-clean-'));
    mkdirSync(resolve(tempDir, '.claude'), { recursive: true });
    writeFileSync(resolve(tempDir, '.claude', 'a.md'), 'plain text — no placeholders here');
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude']);
    expect(findings).toEqual([]);
  });

  it('skips node_modules and .git directories', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-skip-'));
    mkdirSync(resolve(tempDir, '.claude', 'node_modules'), { recursive: true });
    mkdirSync(resolve(tempDir, '.claude', '.git'), { recursive: true });
    writeFileSync(
      resolve(tempDir, '.claude', 'node_modules', 'leak.md'),
      'Has {{shouldBeIgnored}} placeholder'
    );
    writeFileSync(
      resolve(tempDir, '.claude', '.git', 'leak.md'),
      'Has {{alsoIgnored}} placeholder'
    );
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude']);
    expect(findings).toEqual([]);
  });

  it('recurses into subdirectories', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-recurse-'));
    mkdirSync(resolve(tempDir, '.claude', 'sub', 'deep'), { recursive: true });
    writeFileSync(resolve(tempDir, '.claude', 'sub', 'deep', 'a.md'), 'Has {{deepVar}} marker');
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude']);
    expect(findings.length).toBe(1);
    expect(findings[0].variables).toEqual(['deepVar']);
  });

  it('only scans markdown/yaml/json/mjs/js/ts files', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-ext-'));
    mkdirSync(resolve(tempDir, '.claude'), { recursive: true });
    writeFileSync(resolve(tempDir, '.claude', 'a.md'), '{{mdVar}}');
    writeFileSync(resolve(tempDir, '.claude', 'b.txt'), '{{txtVar}}'); // ignored
    writeFileSync(resolve(tempDir, '.claude', 'c.json'), '{"k": "{{jsonVar}}"}');
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude']);
    const allVars = findings.flatMap((f) => f.variables);
    expect(allVars).toContain('mdVar');
    expect(allVars).toContain('jsonVar');
    expect(allVars).not.toContain('txtVar');
  });

  it('deduplicates the variables list per file', async () => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'audit-dedup-'));
    mkdirSync(resolve(tempDir, '.claude'), { recursive: true });
    writeFileSync(
      resolve(tempDir, '.claude', 'a.md'),
      '{{repeated}} {{repeated}} {{unique}} {{repeated}}'
    );
    const findings = await auditUnresolvedPlaceholders(tempDir, ['.claude']);
    expect(findings).toHaveLength(1);
    // Each variable appears only once in the variables array
    expect(findings[0].variables.sort()).toEqual(['repeated', 'unique']);
  });
});

// ---------------------------------------------------------------------------
// runCheck — coverage results / unresolved placeholders / event logging error
// ---------------------------------------------------------------------------

describe('runCheck() — additional branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs unresolved placeholder findings without crashing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture();
    try {
      // Seed an output dir with an unresolved placeholder
      mkdirSync(resolve(fixture.projectRoot, '.claude'), { recursive: true });
      writeFileSync(resolve(fixture.projectRoot, '.claude', 'demo.md'), 'Hello {{unresolved_var}}');

      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { fast: true },
      });
      expect(result).toBeDefined();
      const out = logSpy.mock.calls.flat().join('\n');
      expect(out).toContain('Unresolved Placeholders');
      expect(out).toContain('unresolved_var');
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);

  it('runs the coverage step when --coverage is set', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // The coverage step has no command-exists guard: whatever
    // resolveCoverageCommand returns is handed straight to execCommand. Stub the
    // runner so this exercises that branch without spawning a real coverage run,
    // whose 300s default timeout would outlast this test's 20s budget.
    const execCommand = vi.spyOn(runner, 'execCommand').mockReturnValue({
      exitCode: 0,
      stdout: 'All files |   85.5 |',
      stderr: '',
      durationMs: 0,
    });

    // A bare `node -e ""` matches no runner, so resolveCoverageCommand returns
    // a null command and the coverage step never runs — naming a real runner is
    // what makes this test exercise coverage at all.
    const fixture = createCheckFixture({ testCommand: 'npx vitest run' });
    try {
      // project.yaml with coverage threshold
      writeFileSync(
        resolve(fixture.agentkitRoot, 'spec', 'project.yaml'),
        'testing:\n  coverage: 50\n',
        'utf-8'
      );

      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { fast: true, coverage: true },
      });

      const executed = execCommand.mock.calls.map(([command]) => command);
      expect(executed).toContain('npx vitest run --coverage');
      expect(result.coverage).toHaveLength(1);
      expect(result.coverage[0]).toMatchObject({
        stack: 'test-stack',
        percentage: 85.5,
        threshold: 50,
        status: 'PASS',
      });
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);

  it('skips invalid commands and reports SKIP / warning for invalid formatter', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture({ withBuild: false, formatter: '   ' });
    try {
      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { fast: true },
      });
      expect(result).toBeDefined();
      // Empty/whitespace formatter should trigger a warning
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);

  it('skips disallowed formatter (not in ALLOWED list) with a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture({ withBuild: false, formatter: 'untrusted-formatter' });
    try {
      await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { fast: true },
      });
      const warnText = warnSpy.mock.calls.flat().join('\n');
      expect(warnText).toContain('unrecognized formatter');
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);

  it('passes a userContext through when extra args are supplied', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const fixture = createCheckFixture();
    try {
      const result = await runCheck({
        agentkitRoot: fixture.agentkitRoot,
        projectRoot: fixture.projectRoot,
        flags: { fast: true, _args: ['my', 'context'] },
      });
      expect(result.userContext).toBe('my context');
      const out = logSpy.mock.calls.flat().join('\n');
      expect(out).toContain('Context: my context');
    } finally {
      cleanupFixture(fixture.root);
    }
  }, 20_000);
});
