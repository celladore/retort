#!/usr/bin/env node
/**
 * Test-run reconciliation guard (ADR-12 decision 5).
 *
 * A Vitest run can drop tests and still print a passing summary. When a worker
 * dies mid-file, the tests it had already collected stay in the reported total
 * but never land in the pass/fail/skip buckets, producing output like:
 *
 *     Test Files  75 passed | 1 skipped (77)
 *     Tests       2273 passed | 1 skipped (2327)
 *
 * 2273 + 1 is not 2327. Fifty-three tests and one whole file were silently
 * dropped, and Vitest's own warning is that this "might cause false positive
 * tests". Nothing downstream notices, because every number that *is* printed
 * looks healthy.
 *
 * This guard closes that gap: it fails when the reported outcomes do not add up
 * to the reported total. **A run that does not reconcile is void, not green** —
 * it carries no information about whether the code is correct, so it must not
 * be allowed to satisfy a required check.
 *
 * Inputs (all resolved relative to the working directory, normally `.agentkit`):
 *
 * - `--results`    Vitest's own `json` reporter output. The primary source: it
 *                  is written by Vitest, not by this repo, so the reconciliation
 *                  is grounded in numbers this tooling did not produce.
 * - `--integrity`  `vitest-run-integrity-reporter.mjs` output, adding the two
 *                  things the JSON report omits — unhandled worker errors, and
 *                  tests that passed only on retry. Optional; a missing file is
 *                  a warning, never a pass.
 * - `--quarantine` Quarantine registry, checked for tracking issues and stale
 *                  entries so a quarantine cannot quietly become permanent.
 *
 * Usage:
 *   node scripts/reconcile-test-results.mjs
 *   node scripts/reconcile-test-results.mjs --results test-results/results.json
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { loadQuarantineRegistry, validateQuarantineRegistry } from './test-quarantine.mjs';

/** Statuses a test may carry once it has actually reported an outcome. */
export const TERMINAL_STATUSES = new Set(['passed', 'failed', 'skipped', 'todo']);

/** How many dropped tests to name before truncating the report. */
const MAX_LISTED = 20;

const DEFAULTS = {
  results: 'test-results/results.json',
  integrity: 'test-results/run-integrity.json',
  quarantine: 'test-quarantine.json',
};

/**
 * Reconcile a Vitest JSON report against itself.
 *
 * @param {unknown} report Parsed Vitest `json` reporter output.
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {{
 *   ok: boolean,
 *   problems: Array<{ code: string, message: string }>,
 *   totals: object | null,
 *   unreportedTests: Array<{ file: string, name: string, status: string }>,
 * }}
 */
export function reconcileTestResults(report, options = {}) {
  const problems = [];
  const unreportedTests = [];

  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    return {
      ok: false,
      problems: [{ code: 'report-unparseable', message: 'Test report is not a JSON object' }],
      totals: null,
      unreportedTests,
    };
  }

  const num = (key) => (typeof report[key] === 'number' ? report[key] : Number.NaN);
  const total = num('numTotalTests');
  const passed = num('numPassedTests');
  const failed = num('numFailedTests');
  const pending = num('numPendingTests');
  const todo = num('numTodoTests');
  const testResults = Array.isArray(report.testResults) ? report.testResults : null;

  if ([total, passed, failed, pending, todo].some(Number.isNaN) || testResults === null) {
    return {
      ok: false,
      problems: [
        {
          code: 'report-unparseable',
          message:
            'Test report is missing the expected Vitest json reporter fields (numTotalTests, numPassedTests, numFailedTests, numPendingTests, numTodoTests, testResults)',
        },
      ],
      totals: null,
      unreportedTests,
    };
  }

  const accounted = passed + failed + pending + todo;
  const tally = { passed: 0, failed: 0, skipped: 0, todo: 0 };
  let detailCount = 0;

  for (const file of testResults) {
    const assertions = Array.isArray(file?.assertionResults) ? file.assertionResults : [];
    for (const assertion of assertions) {
      detailCount += 1;
      const status = assertion?.status;
      if (TERMINAL_STATUSES.has(status)) {
        tally[status] += 1;
      } else {
        unreportedTests.push({
          file: file?.name ?? '<unknown file>',
          name: assertion?.fullName ?? assertion?.title ?? '<unnamed test>',
          status: status ?? '<missing>',
        });
      }
    }
  }

  const totals = {
    total,
    passed,
    failed,
    pending,
    todo,
    accounted,
    detailCount,
    files: testResults.length,
    tally,
  };

  if (total === 0 && options.allowEmpty !== true) {
    problems.push({
      code: 'report-empty',
      message:
        'Test report contains zero tests — the run collected nothing and proves nothing. Pass --allow-empty only if an empty run is genuinely expected.',
    });
  }

  // The headline guard. In the motivating incident this was 2274 vs 2327.
  if (accounted !== total) {
    const missing = total - accounted;
    problems.push({
      code: 'count-mismatch',
      message: `Outcomes do not reconcile: ${passed} passed + ${failed} failed + ${pending} skipped/pending + ${todo} todo = ${accounted}, but the run reported ${total} tests (${missing > 0 ? `${missing} unaccounted for` : `${-missing} counted twice`})`,
    });
  }

  if (detailCount !== total) {
    problems.push({
      code: 'detail-mismatch',
      message: `Summary and detail disagree: the summary reports ${total} tests but the per-file results contain ${detailCount}`,
    });
  }

  if (unreportedTests.length > 0) {
    problems.push({
      code: 'unreported-tests',
      message: `${unreportedTests.length} test(s) never reported an outcome — they were collected but their result never arrived, which is the signature of a worker that died mid-run`,
    });
  }

  const bucketNames = [
    ['passed', passed],
    ['failed', failed],
    ['skipped', pending],
    ['todo', todo],
  ];
  for (const [status, expected] of bucketNames) {
    if (tally[status] !== expected) {
      problems.push({
        code: 'tally-mismatch',
        message: `Summary reports ${expected} ${status} test(s) but the per-file results contain ${tally[status]}`,
      });
    }
  }

  if (report.success === true && problems.length > 0) {
    problems.push({
      code: 'success-inconsistent',
      message:
        'Vitest reported success but the run does not reconcile — treat it as void, not green, and re-run',
    });
  }

  return { ok: problems.length === 0, problems, totals, unreportedTests };
}

/**
 * Fold the integrity record into a reconciliation result.
 *
 * Unhandled errors are fatal: "Worker exited unexpectedly" means part of the
 * suite did not run, whatever the summary says. Flaky tests are warnings — a
 * test rescued by a retry is not a failure, but it must never pass unnoticed.
 *
 * @param {object} result Result from `reconcileTestResults`.
 * @param {unknown} integrity Parsed integrity record, or null when unavailable.
 * @returns {object} Result with `warnings` and `flakyTests` populated.
 */
export function applyRunIntegrity(result, integrity) {
  const problems = [...result.problems];
  const warnings = [];
  let flakyTests = [];

  if (integrity === null || typeof integrity !== 'object') {
    warnings.push({
      code: 'integrity-unavailable',
      message:
        'No run-integrity record found — unhandled worker errors and flaky tests could not be checked. Is RunIntegrityReporter still wired into vitest.config.mjs?',
    });
    return { ...result, ok: problems.length === 0, problems, warnings, flakyTests };
  }

  const unhandled = Array.isArray(integrity.unhandledErrors) ? integrity.unhandledErrors : [];
  if (unhandled.length > 0) {
    problems.push({
      code: 'unhandled-errors',
      message: `${unhandled.length} unhandled error(s) escaped the test run (first: ${unhandled[0]?.message ?? 'unknown'}) — part of the suite did not run`,
    });
  }

  const unreported = Array.isArray(integrity.unreportedTests) ? integrity.unreportedTests : [];
  if (unreported.length > 0 && result.unreportedTests.length === 0) {
    problems.push({
      code: 'unreported-tests',
      message: `${unreported.length} test(s) never reported an outcome according to the run-integrity record`,
    });
  }

  flakyTests = Array.isArray(integrity.flakyTests) ? integrity.flakyTests : [];
  if (flakyTests.length > 0) {
    warnings.push({
      code: 'flaky-tests',
      message: `${flakyTests.length} test(s) passed only after a retry. Quarantine them in test-quarantine.json with a tracking issue rather than letting the retry hide them.`,
    });
  }

  return { ...result, ok: problems.length === 0, problems, warnings, flakyTests };
}

/**
 * Render the result as plain text for a terminal or CI log.
 *
 * @param {object} result
 * @returns {string}
 */
export function formatText(result) {
  const lines = [];
  const t = result.totals;

  if (t !== null) {
    lines.push(
      `Reconciliation: ${t.passed} passed + ${t.failed} failed + ${t.pending} skipped/pending + ${t.todo} todo = ${t.accounted} of ${t.total} reported (${t.files} files)`
    );
  }

  for (const problem of result.problems) {
    lines.push(`  ERROR [${problem.code}] ${problem.message}`);
  }
  for (const warning of result.warnings ?? []) {
    lines.push(`  WARN  [${warning.code}] ${warning.message}`);
  }

  const dropped = result.unreportedTests ?? [];
  if (dropped.length > 0) {
    lines.push('', 'Tests with no reported outcome:');
    for (const test of dropped.slice(0, MAX_LISTED)) {
      lines.push(`  - ${test.name} (${test.file}) [${test.status}]`);
    }
    if (dropped.length > MAX_LISTED) {
      lines.push(`  ... and ${dropped.length - MAX_LISTED} more`);
    }
  }

  const flaky = result.flakyTests ?? [];
  if (flaky.length > 0) {
    lines.push('', 'Tests that passed only on retry:');
    for (const test of flaky.slice(0, MAX_LISTED)) {
      lines.push(`  - ${test.name} (${test.file}) after ${test.retryCount} retry/retries`);
    }
    if (flaky.length > MAX_LISTED) {
      lines.push(`  ... and ${flaky.length - MAX_LISTED} more`);
    }
  }

  lines.push(
    '',
    result.ok
      ? 'Test run reconciles — every collected test reported an outcome.'
      : 'Test run does NOT reconcile. Treat this run as void, not green.'
  );

  return lines.join('\n');
}

/**
 * Render the result as a GitHub step-summary fragment.
 *
 * @param {object} result
 * @returns {string}
 */
export function formatMarkdown(result) {
  const lines = ['## Test Run Reconciliation', ''];
  const t = result.totals;

  if (t !== null) {
    lines.push(
      '| Outcome | Count |',
      '|---------|-------|',
      `| Passed | ${t.passed} |`,
      `| Failed | ${t.failed} |`,
      `| Skipped / pending | ${t.pending} |`,
      `| Todo | ${t.todo} |`,
      `| **Accounted for** | **${t.accounted}** |`,
      `| **Reported total** | **${t.total}** |`,
      ''
    );
  }

  if (result.ok) {
    lines.push('Every collected test reported an outcome.', '');
  } else {
    lines.push(
      '**This run does not reconcile and must be treated as void, not green.**',
      '',
      'Some tests were collected but never reported a result — usually a worker that',
      'died mid-run. The summary above can look healthy while a whole file is missing.',
      ''
    );
    for (const problem of result.problems) {
      lines.push(`- \`${problem.code}\` — ${problem.message}`);
    }
    lines.push('');
  }

  for (const warning of result.warnings ?? []) {
    lines.push(`- :warning: \`${warning.code}\` — ${warning.message}`);
  }
  if ((result.warnings ?? []).length > 0) lines.push('');

  const dropped = result.unreportedTests ?? [];
  if (dropped.length > 0) {
    lines.push('### Tests with no reported outcome', '');
    for (const test of dropped.slice(0, MAX_LISTED)) {
      lines.push(`- \`${test.name}\` — ${test.file}`);
    }
    if (dropped.length > MAX_LISTED) lines.push(`- _… and ${dropped.length - MAX_LISTED} more_`);
    lines.push('');
  }

  const flaky = result.flakyTests ?? [];
  if (flaky.length > 0) {
    lines.push('### Flaky tests (passed only on retry)', '');
    for (const test of flaky.slice(0, MAX_LISTED)) {
      lines.push(`- \`${test.name}\` — ${test.file} (${test.retryCount} retry/retries)`);
    }
    if (flaky.length > MAX_LISTED) lines.push(`- _… and ${flaky.length - MAX_LISTED} more_`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Parse CLI arguments.
 *
 * @param {string[]} argv
 * @returns {{ results: string, integrity: string, quarantine: string, allowEmpty: boolean }}
 */
export function parseArgs(argv) {
  const options = { ...DEFAULTS, allowEmpty: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-empty') {
      options.allowEmpty = true;
    } else if (arg === '--results' || arg === '--integrity' || arg === '--quarantine') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${arg} requires a path`);
      }
      options[arg.slice(2)] = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function readJson(filePath) {
  if (!existsSync(filePath)) return { found: false, value: null };
  try {
    return { found: true, value: JSON.parse(readFileSync(filePath, 'utf8')) };
  } catch (error) {
    return { found: true, value: null, error };
  }
}

function annotate(level, message) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  process.stdout.write(`::${level}::${escaped}\n`);
}

function main(argv, cwd) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  const resultsPath = path.resolve(cwd, options.results);
  const report = readJson(resultsPath);

  let result;
  if (!report.found) {
    result = {
      ok: false,
      problems: [
        {
          code: 'report-missing',
          message: `No test report at ${options.results} — the run produced no machine-readable result, so it cannot be verified`,
        },
      ],
      totals: null,
      unreportedTests: [],
    };
  } else if (report.value === null) {
    result = {
      ok: false,
      problems: [
        {
          code: 'report-unparseable',
          message: `Test report at ${options.results} is not valid JSON: ${report.error?.message ?? 'unknown error'}`,
        },
      ],
      totals: null,
      unreportedTests: [],
    };
  } else {
    result = reconcileTestResults(report.value, { allowEmpty: options.allowEmpty });
  }

  const integrity = readJson(path.resolve(cwd, options.integrity));
  result = applyRunIntegrity(result, integrity.found ? integrity.value : null);

  const quarantinePath = path.resolve(cwd, options.quarantine);
  try {
    const registry = loadQuarantineRegistry(quarantinePath);
    const validation = validateQuarantineRegistry(registry, {
      fileExists: (file) => existsSync(path.resolve(cwd, file)),
      today: new Date().toISOString().slice(0, 10),
    });
    result.problems.push(...validation.problems);
    if (registry.entries.length > 0) {
      result.warnings.push({
        code: 'quarantined-files',
        message: `${registry.entries.length} test file(s) are quarantined and did not run in this suite — see ${options.quarantine}`,
      });
    }
  } catch (error) {
    result.problems.push({ code: 'quarantine-invalid', message: error.message });
  }
  result.ok = result.problems.length === 0;

  process.stdout.write(`${formatText(result)}\n`);

  for (const problem of result.problems) annotate('error', `[${problem.code}] ${problem.message}`);
  for (const warning of result.warnings)
    annotate('warning', `[${warning.code}] ${warning.message}`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${formatMarkdown(result)}\n`, 'utf8');
  }

  return result.ok ? 0 : 1;
}

// Only run when invoked directly, so the module stays importable from tests.
// pathToFileURL rather than string concatenation: on Windows the two forms
// differ (drive letters, backslashes) and the CLI would silently never fire.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2), process.cwd());
}

export { main };
