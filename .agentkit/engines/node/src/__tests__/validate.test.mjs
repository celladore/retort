import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { runValidate } from '../validate.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

describe('runValidate()', () => {
  afterEach(() => { vi.restoreAllMocks(); });

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
    const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
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

describe('validate - Phase 9 issue template validation', () => {
  const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-tmp', 'validate-phase9');

  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    mkdirSync(resolve(TEST_ROOT, '.github', 'ISSUE_TEMPLATE'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    vi.restoreAllMocks();
  });

  it('validates valid issue template dropdowns without errors', async () => {
    writeFileSync(
      resolve(TEST_ROOT, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml'),
      [
        'name: Bug Report',
        'description: Report a bug',
        'body:',
        '  - type: dropdown',
        '    id: area',
        '    attributes:',
        '      label: Area',
        '      options:',
        '        - backend',
        '        - frontend',
        '        - security',
        '  - type: dropdown',
        '    id: severity',
        '    attributes:',
        '      label: Severity',
        '      options:',
        '        - "critical \u2014 Complete failure"',
        '        - "high \u2014 Major impact"',
        '        - "medium \u2014 Moderate impact"',
        '        - "low \u2014 Minor issue"',
        '  - type: dropdown',
        '    id: priority',
        '    attributes:',
        '      label: Priority',
        '      options:',
        '        - "P0 \u2014 Critical"',
        '        - "P1 \u2014 High"',
      ].join('\n'),
      'utf-8'
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: TEST_ROOT, flags: {} });

    const logOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(logOutput).toContain('bug_report.yml \u2014 all dropdown values valid');
  });

  it('reports errors for invalid area values', async () => {
    writeFileSync(
      resolve(TEST_ROOT, '.github', 'ISSUE_TEMPLATE', 'bad_area.yml'),
      [
        'name: Bad Area',
        'description: Test',
        'body:',
        '  - type: dropdown',
        '    id: area',
        '    attributes:',
        '      label: Area',
        '      options:',
        '        - backend',
        '        - invalid-area',
      ].join('\n'),
      'utf-8'
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: TEST_ROOT, flags: {} });

    const errors = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(errors).toContain('field "area" has invalid option "invalid-area"');
  });

  it('reports errors for invalid severity values', async () => {
    writeFileSync(
      resolve(TEST_ROOT, '.github', 'ISSUE_TEMPLATE', 'bad_sev.yml'),
      [
        'name: Bad Severity',
        'description: Test',
        'body:',
        '  - type: dropdown',
        '    id: severity',
        '    attributes:',
        '      label: Severity',
        '      options:',
        '        - "CRITICAL \u2014 Bad"',
      ].join('\n'),
      'utf-8'
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: TEST_ROOT, flags: {} });

    const errors = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(errors).toContain('field "severity" has invalid option');
  });

  it('warns on malformed issue template without body array', async () => {
    writeFileSync(
      resolve(TEST_ROOT, '.github', 'ISSUE_TEMPLATE', 'malformed.yml'),
      'name: Malformed\ndescription: No body\n',
      'utf-8'
    );

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: TEST_ROOT, flags: {} });

    const warns = warnSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(warns).toContain('not a valid issue form');
  });

  it('handles area options with description separators', async () => {
    writeFileSync(
      resolve(TEST_ROOT, '.github', 'ISSUE_TEMPLATE', 'area_desc.yml'),
      [
        'name: Area with descriptions',
        'description: Test',
        'body:',
        '  - type: dropdown',
        '    id: area',
        '    attributes:',
        '      label: Area',
        '      options:',
        '        - "backend \u2014 Server-side services"',
        '        - "frontend \u2014 Client-side code"',
      ].join('\n'),
      'utf-8'
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: TEST_ROOT, flags: {} });

    const logOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(logOutput).toContain('area_desc.yml \u2014 all dropdown values valid');
  });
});

describe('validate - edge cases', () => {
  const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-tmp', 'validate');

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

    const errors = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
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

    const errors = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(errors).toContain('invalid JSON');
  });
});
