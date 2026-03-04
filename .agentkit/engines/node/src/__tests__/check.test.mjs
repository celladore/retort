import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  runCheck,
  resolveFormatter,
  resolveLinter,
  isAllowedFormatter,
  isAllowedLinter,
  ALLOWED_FORMATTER_BASES,
  ALLOWED_NPX_PACKAGES,
  ALLOWED_LINTER_BASES,
} from '../check.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

function createCheckFixture({ withBuild = true, formatter = null, withPrettierBin = false } = {}) {
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
  const teamsYaml = `techStacks:
  - name: test-stack
    detect:
      - package.json
${formatterLine}    
    typecheck: "node -e \\\"\\\""
    testCommand: "node -e \\\"\\\""
${buildLine}`;

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
