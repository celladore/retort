import { describe, it, expect } from 'vitest';

import { collectRunIntegrity } from '../vitest-run-integrity-reporter.mjs';

/**
 * Minimal stand-in for the Vitest reporter API surface this reporter uses.
 * Building fakes rather than booting Vitest keeps the test fast and lets it
 * express states — notably `pending` — that only occur when a worker dies.
 */
function makeModule(moduleId, tests, state = 'passed') {
  const cases = tests.map((test) => ({
    fullName: test.name,
    options: { mode: test.mode ?? 'run' },
    result: () => (test.state === undefined ? undefined : { state: test.state }),
    diagnostic: () =>
      test.flaky === true ? { flaky: true, retryCount: test.retryCount ?? 1 } : {},
  }));

  return {
    moduleId,
    state: () => state,
    children: { allTests: () => cases },
  };
}

describe('collectRunIntegrity', () => {
  it('should count every reported outcome', () => {
    // Arrange
    const modules = [
      makeModule('/repo/a.test.mjs', [
        { name: 'a1', state: 'passed' },
        { name: 'a2', state: 'failed' },
        { name: 'a3', state: 'skipped' },
        { name: 'a4', state: 'skipped', mode: 'todo' },
      ]),
    ];

    // Act
    const record = collectRunIntegrity(modules);

    // Assert
    expect(record.counts).toEqual({
      total: 4,
      passed: 1,
      failed: 1,
      skipped: 1,
      todo: 1,
      unreported: 0,
    });
    expect(record.unreportedTests).toEqual([]);
  });

  it('should record tests whose result never arrived', () => {
    // Arrange — a worker died after the first test; the rest stay `pending`.
    const modules = [
      makeModule('/repo/crash.test.mjs', [
        { name: 'c1', state: 'passed' },
        { name: 'c2', state: 'pending' },
        { name: 'c3' },
      ]),
    ];

    // Act
    const record = collectRunIntegrity(modules);

    // Assert
    expect(record.counts.unreported).toBe(2);
    expect(record.unreportedTests).toEqual([
      { file: '/repo/crash.test.mjs', name: 'c2', state: 'pending' },
      { file: '/repo/crash.test.mjs', name: 'c3', state: 'pending' },
    ]);
    expect(record.modules[0]).toMatchObject({
      file: '/repo/crash.test.mjs',
      total: 3,
      unreported: 2,
    });
  });

  it('should label a test that passed only on retry', () => {
    // Arrange
    const modules = [
      makeModule('/repo/a.test.mjs', [
        { name: 'steady', state: 'passed' },
        { name: 'intermittent', state: 'passed', flaky: true, retryCount: 1 },
      ]),
    ];

    // Act
    const record = collectRunIntegrity(modules);

    // Assert — the retry rescued it, so it must be labelled rather than hidden.
    expect(record.counts.passed).toBe(2);
    expect(record.flakyTests).toEqual([
      { file: '/repo/a.test.mjs', name: 'intermittent', retryCount: 1 },
    ]);
  });

  it('should capture unhandled errors that never attach to a test', () => {
    // Arrange
    const errors = [{ name: 'Error', message: 'Worker exited unexpectedly', stack: 'at worker' }];

    // Act
    const record = collectRunIntegrity([], errors, 'failed');

    // Assert
    expect(record.reason).toBe('failed');
    expect(record.unhandledErrors).toEqual([
      { name: 'Error', message: 'Worker exited unexpectedly', stack: 'at worker' },
    ]);
  });

  it('should tolerate a module with no diagnostic support', () => {
    // Arrange — `diagnostic()` is only available after a test finishes.
    const module = {
      moduleId: '/repo/a.test.mjs',
      children: {
        allTests: () => [{ fullName: 'a1', options: {}, result: () => ({ state: 'passed' }) }],
      },
    };

    // Act
    const record = collectRunIntegrity([module]);

    // Assert
    expect(record.counts.passed).toBe(1);
    expect(record.flakyTests).toEqual([]);
    expect(record.modules[0].state).toBe('unknown');
  });
});
