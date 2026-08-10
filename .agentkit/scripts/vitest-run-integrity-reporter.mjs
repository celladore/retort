/**
 * Vitest reporter that records run integrity to disk (ADR-12 decision 5).
 *
 * Vitest's built-in `json` reporter answers "what were the results?". It cannot
 * answer "was this run trustworthy?", because two things it omits are exactly
 * the things that make a run void:
 *
 * - **Unreported tests.** A test that was collected but never produced a result
 *   — because its worker died mid-file — keeps the reporter-API state
 *   `pending`. The console prints it in the collected total but in none of the
 *   pass/fail/skip buckets, which is how a run can print
 *   `Tests 2273 passed | 1 skipped (2327)` and still look green.
 * - **Unhandled errors.** "Worker exited unexpectedly" arrives as an unhandled
 *   error, never attached to any test, and is absent from the JSON report.
 *
 * This reporter also records tests that passed only on retry. `retry` is
 * enabled in CI so an intermittent test is *labelled* rather than silently
 * retried into green: the label is written here, surfaced by
 * `reconcile-test-results.mjs`, and kept in the uploaded artifact.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Result states that mean the test actually reported an outcome. */
const TERMINAL_STATES = new Set(['passed', 'failed', 'skipped']);

/**
 * Reduce a finished run to a serialisable integrity record.
 *
 * Kept pure and separate from the reporter class so it can be unit-tested
 * against synthetic modules without booting Vitest.
 *
 * @param {Iterable<any>} testModules Reporter-API test modules.
 * @param {ReadonlyArray<any>} [unhandledErrors]
 * @param {string} [reason] Vitest's own run-end reason.
 * @returns {object} Integrity record.
 */
export function collectRunIntegrity(testModules, unhandledErrors = [], reason = 'passed') {
  const counts = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, unreported: 0 };
  const unreportedTests = [];
  const flakyTests = [];
  const modules = [];

  for (const testModule of testModules) {
    const moduleId = testModule.moduleId ?? testModule.relativeModuleId ?? '<unknown>';
    const moduleCounts = { total: 0, unreported: 0 };

    for (const test of testModule.children.allTests()) {
      const state = test.result()?.state ?? 'pending';
      counts.total += 1;
      moduleCounts.total += 1;

      if (state === 'skipped') {
        if (test.options?.mode === 'todo') counts.todo += 1;
        else counts.skipped += 1;
      } else if (TERMINAL_STATES.has(state)) {
        counts[state] += 1;
      } else {
        counts.unreported += 1;
        moduleCounts.unreported += 1;
        unreportedTests.push({ file: moduleId, name: test.fullName, state });
      }

      const diagnostic = test.diagnostic?.();
      if (diagnostic?.flaky) {
        flakyTests.push({
          file: moduleId,
          name: test.fullName,
          retryCount: diagnostic.retryCount,
        });
      }
    }

    modules.push({
      file: moduleId,
      state: testModule.state?.() ?? 'unknown',
      ...moduleCounts,
    });
  }

  return {
    reason,
    counts,
    unreportedTests,
    flakyTests,
    unhandledErrors: Array.from(unhandledErrors, (error) => ({
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
      stack: error?.stack,
    })),
    modules,
  };
}

export default class RunIntegrityReporter {
  /**
   * @param {{ outputFile?: string }} [options] `outputFile` is resolved against
   *   the Vitest root, matching how built-in reporters resolve their own.
   */
  constructor(options = {}) {
    this.outputFile = options.outputFile ?? 'test-results/run-integrity.json';
    this.root = process.cwd();
  }

  onInit(ctx) {
    this.root = ctx?.config?.root ?? this.root;
  }

  onTestRunEnd(testModules, unhandledErrors, reason) {
    const record = collectRunIntegrity(testModules, unhandledErrors, reason);
    const destination = path.resolve(this.root, this.outputFile);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  }
}
