import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import {
  applyRunIntegrity,
  formatMarkdown,
  formatText,
  main,
  parseArgs,
  reconcileTestResults,
  TERMINAL_STATUSES,
} from '../reconcile-test-results.mjs';

/**
 * Build a Vitest json-reporter-shaped report from a list of per-file statuses.
 *
 * Summary counters default to whatever the detail implies, so a test only has
 * to state the discrepancy it is exercising.
 */
function makeReport(files, overrides = {}) {
  const testResults = files.map((statuses, index) => ({
    name: `/repo/file-${index}.test.mjs`,
    status: statuses.includes('failed') ? 'failed' : 'passed',
    assertionResults: statuses.map((status, i) => ({
      status,
      title: `test ${i}`,
      fullName: `file ${index} > test ${i}`,
    })),
  }));

  const all = files.flat();
  const count = (status) => all.filter((s) => s === status).length;

  return {
    numTotalTests: all.length,
    numPassedTests: count('passed'),
    numFailedTests: count('failed'),
    numPendingTests: count('skipped'),
    numTodoTests: count('todo'),
    numTotalTestSuites: files.length,
    numFailedTestSuites: 0,
    success: count('failed') === 0,
    testResults,
    ...overrides,
  };
}

describe('reconcileTestResults', () => {
  it('should accept a run where every collected test reported an outcome', () => {
    // Arrange
    const report = makeReport([
      ['passed', 'passed', 'skipped'],
      ['passed', 'todo'],
    ]);

    // Act
    const result = reconcileTestResults(report);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.totals.accounted).toBe(result.totals.total);
  });

  it('should accept a run with genuine failures', () => {
    // Arrange
    const report = makeReport([['passed', 'failed']]);

    // Act
    const result = reconcileTestResults(report);

    // Assert — a failing suite is informative; only a non-reconciling one is void.
    expect(result.ok).toBe(true);
    expect(result.totals.failed).toBe(1);
  });

  it('should fail when the outcome buckets do not add up to the reported total', () => {
    // Arrange — the motivating incident in miniature: 2273 + 1 != 2327.
    const report = makeReport([['passed']], {
      numTotalTests: 3,
      numPassedTests: 1,
      numPendingTests: 0,
    });

    // Act
    const result = reconcileTestResults(report);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('count-mismatch');
    expect(result.problems.find((p) => p.code === 'count-mismatch').message).toContain(
      '2 unaccounted for'
    );
  });

  it('should name the tests that never reported an outcome', () => {
    // Arrange — a worker died after the first test, leaving three "pending".
    const report = makeReport([['passed', 'pending', 'pending', 'pending']], {
      numTotalTests: 4,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      success: true,
    });

    // Act
    const result = reconcileTestResults(report);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('unreported-tests');
    expect(result.unreportedTests).toHaveLength(3);
    expect(result.unreportedTests[0]).toMatchObject({
      name: 'file 0 > test 1',
      file: '/repo/file-0.test.mjs',
      status: 'pending',
    });
  });

  it('should call out a report that claims success while failing to reconcile', () => {
    // Arrange
    const report = makeReport([['passed', 'pending']], {
      numTotalTests: 2,
      numPassedTests: 1,
      numPendingTests: 0,
      success: true,
    });

    // Act
    const result = reconcileTestResults(report);

    // Assert
    expect(result.problems.map((p) => p.code)).toContain('success-inconsistent');
  });

  it('should fail when the summary and the per-file detail disagree on the count', () => {
    // Arrange
    const report = makeReport([['passed', 'passed']], {
      numTotalTests: 5,
      numPassedTests: 5,
    });

    // Act
    const result = reconcileTestResults(report);

    // Assert
    expect(result.problems.map((p) => p.code)).toContain('detail-mismatch');
  });

  it('should fail when a summary bucket disagrees with the per-file tally', () => {
    // Arrange — totals still add up, but the detail says otherwise.
    const report = makeReport([['passed', 'skipped']], {
      numPassedTests: 2,
      numPendingTests: 0,
    });

    // Act
    const result = reconcileTestResults(report);

    // Assert
    const codes = result.problems.map((p) => p.code);
    expect(codes).toContain('tally-mismatch');
  });

  it('should treat a report with zero tests as void unless explicitly allowed', () => {
    // Arrange
    const report = makeReport([]);

    // Act
    const strict = reconcileTestResults(report);
    const permissive = reconcileTestResults(report, { allowEmpty: true });

    // Assert
    expect(strict.problems.map((p) => p.code)).toContain('report-empty');
    expect(permissive.ok).toBe(true);
  });

  it('should reject a report that is not a Vitest json report', () => {
    // Arrange / Act
    const notAnObject = reconcileTestResults([1, 2, 3]);
    const missingFields = reconcileTestResults({ numTotalTests: 4 });

    // Assert
    expect(notAnObject.problems[0].code).toBe('report-unparseable');
    expect(missingFields.problems[0].code).toBe('report-unparseable');
    expect(missingFields.totals).toBeNull();
  });

  it('should treat exactly the four reported outcomes as terminal', () => {
    // Assert — anything else means a test never finished reporting.
    expect([...TERMINAL_STATUSES].sort()).toEqual(['failed', 'passed', 'skipped', 'todo']);
  });
});

describe('applyRunIntegrity', () => {
  const clean = () => reconcileTestResults(makeReport([['passed', 'passed']]));

  it('should keep a clean run green when the integrity record is clean', () => {
    // Arrange / Act
    const result = applyRunIntegrity(clean(), {
      unhandledErrors: [],
      unreportedTests: [],
      flakyTests: [],
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('should void the run when an unhandled error escaped it', () => {
    // Arrange — "Worker exited unexpectedly" never attaches to a test, so the
    // JSON report alone cannot see it.
    const integrity = {
      unhandledErrors: [{ name: 'Error', message: 'Worker exited unexpectedly' }],
      unreportedTests: [],
      flakyTests: [],
    };

    // Act
    const result = applyRunIntegrity(clean(), integrity);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('unhandled-errors');
    expect(result.problems.at(-1).message).toContain('Worker exited unexpectedly');
  });

  it('should warn rather than fail when a test passed only on retry', () => {
    // Arrange
    const integrity = {
      unhandledErrors: [],
      unreportedTests: [],
      flakyTests: [{ file: 'a.test.mjs', name: 'sometimes', retryCount: 1 }],
    };

    // Act
    const result = applyRunIntegrity(clean(), integrity);

    // Assert — a rescued test is not a failure, but it must not pass unnoticed.
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('flaky-tests');
    expect(result.flakyTests).toHaveLength(1);
  });

  it('should warn when the integrity record is missing entirely', () => {
    // Arrange / Act
    const result = applyRunIntegrity(clean(), null);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('integrity-unavailable');
  });

  it('should report unreported tests seen only by the integrity record', () => {
    // Arrange
    const integrity = {
      unhandledErrors: [],
      unreportedTests: [{ file: 'a.test.mjs', name: 'dropped', state: 'pending' }],
      flakyTests: [],
    };

    // Act
    const result = applyRunIntegrity(clean(), integrity);

    // Assert
    expect(result.problems.map((p) => p.code)).toContain('unreported-tests');
  });
});

describe('formatText', () => {
  it('should state plainly that a non-reconciling run is void', () => {
    // Arrange
    const base = reconcileTestResults(
      makeReport([['passed', 'pending']], { numTotalTests: 2, numPassedTests: 1 })
    );

    // Act
    const text = formatText(applyRunIntegrity(base, null));

    // Assert
    expect(text).toContain('does NOT reconcile');
    expect(text).toContain('void, not green');
    expect(text).toContain('Tests with no reported outcome');
  });

  it('should confirm reconciliation on a healthy run', () => {
    // Arrange / Act
    const text = formatText(
      applyRunIntegrity(reconcileTestResults(makeReport([['passed']])), null)
    );

    // Assert
    expect(text).toContain('Test run reconciles');
  });
});

describe('formatMarkdown', () => {
  it('should render a totals table and the failure explanation', () => {
    // Arrange
    const base = reconcileTestResults(
      makeReport([['passed', 'pending']], { numTotalTests: 2, numPassedTests: 1 })
    );

    // Act
    const markdown = formatMarkdown(applyRunIntegrity(base, null));

    // Assert
    expect(markdown).toContain('## Test Run Reconciliation');
    expect(markdown).toContain('| **Reported total** | **2** |');
    expect(markdown).toContain('void, not green');
  });
});

describe('parseArgs', () => {
  it('should default to the conventional artifact paths', () => {
    // Act
    const options = parseArgs([]);

    // Assert
    expect(options).toEqual({
      results: 'test-results/results.json',
      integrity: 'test-results/run-integrity.json',
      quarantine: 'test-quarantine.json',
      allowEmpty: false,
    });
  });

  it('should accept explicit paths and the empty-run escape hatch', () => {
    // Act
    const options = parseArgs(['--results', 'other.json', '--allow-empty']);

    // Assert
    expect(options.results).toBe('other.json');
    expect(options.allowEmpty).toBe(true);
  });

  it('should reject unknown arguments and missing values', () => {
    // Assert
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown argument/);
    expect(() => parseArgs(['--results'])).toThrow(/requires a path/);
    expect(() => parseArgs(['--results', '--allow-empty'])).toThrow(/requires a path/);
  });
});

describe('main', () => {
  let workspace;
  let stdout;

  beforeEach(() => {
    workspace = mkdtempSync(path.join(tmpdir(), 'reconcile-'));
    mkdirSync(path.join(workspace, 'test-results'));
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdout.mockRestore();
    rmSync(workspace, { recursive: true, force: true, maxRetries: 3 });
  });

  const writeResults = (report) =>
    writeFileSync(
      path.join(workspace, 'test-results', 'results.json'),
      JSON.stringify(report),
      'utf8'
    );

  it('should exit 0 for a run where every collected test reported an outcome', () => {
    // Arrange
    writeResults(makeReport([['passed', 'passed']]));

    // Act
    const code = main([], workspace);

    // Assert
    expect(code).toBe(0);
  });

  it('should exit 1 when the run does not reconcile', () => {
    // Arrange
    writeResults(makeReport([['passed', 'pending']], { numTotalTests: 2, numPassedTests: 1 }));

    // Act
    const code = main([], workspace);

    // Assert — the exit code is the contract CI depends on.
    expect(code).toBe(1);
    expect(stdout.mock.calls.flat().join('')).toContain('void, not green');
  });

  it('should exit 1 when the run produced no report at all', () => {
    // Act — an unverifiable run is not a passing run.
    const code = main([], workspace);

    // Assert
    expect(code).toBe(1);
    expect(stdout.mock.calls.flat().join('')).toContain('report-missing');
  });

  it('should exit 1 when the report is not valid JSON', () => {
    // Arrange
    writeFileSync(path.join(workspace, 'test-results', 'results.json'), '{ truncated', 'utf8');

    // Act
    const code = main([], workspace);

    // Assert
    expect(code).toBe(1);
    expect(stdout.mock.calls.flat().join('')).toContain('report-unparseable');
  });

  it('should exit 2 on a usage error rather than reporting a test failure', () => {
    // Act — a broken invocation must be distinguishable from a broken run.
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const code = main(['--bogus'], workspace);
    stderr.mockRestore();

    // Assert
    expect(code).toBe(2);
  });

  it('should reject a quarantine entry with no tracking issue', () => {
    // Arrange
    writeResults(makeReport([['passed']]));
    writeFileSync(
      path.join(workspace, 'test-quarantine.json'),
      JSON.stringify({
        entries: [{ file: 'a.test.mjs', reason: 'x', quarantinedOn: '2026-01-01' }],
      }),
      'utf8'
    );

    // Act
    const code = main([], workspace);

    // Assert
    expect(code).toBe(1);
    expect(stdout.mock.calls.flat().join('')).toContain('quarantine-untracked');
  });

  it('should append a markdown summary when running under GitHub Actions', () => {
    // Arrange
    const summaryPath = path.join(workspace, 'summary.md');
    writeFileSync(summaryPath, '', 'utf8');
    writeResults(makeReport([['passed']]));
    vi.stubEnv('GITHUB_STEP_SUMMARY', summaryPath);

    // Act
    const code = main([], workspace);
    vi.unstubAllEnvs();

    // Assert
    expect(code).toBe(0);
    expect(readFileSync(summaryPath, 'utf8')).toContain('## Test Run Reconciliation');
  });
});
