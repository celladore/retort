import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

import { loadQuarantineRegistry, quarantinedFiles } from './scripts/test-quarantine.mjs';
import RunIntegrityReporter from './scripts/vitest-run-integrity-reporter.mjs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === 'true' || process.env.CI === '1';

// Quarantined files are excluded from this run and executed by the separate,
// non-blocking `Quarantined Tests` CI job instead. A malformed registry throws
// here rather than degrading to an empty list: silently running a quarantined
// file in the blocking suite is precisely what the registry exists to prevent.
// Set RETORT_TEST_QUARANTINE=off to run them alongside everything else.
const quarantineEnabled = process.env.RETORT_TEST_QUARANTINE !== 'off';
const registry = loadQuarantineRegistry(path.join(rootDir, 'test-quarantine.json'));
const excludedByQuarantine = quarantineEnabled ? quarantinedFiles(registry) : [];

export default defineConfig({
  test: {
    testTimeout: 30_000,
    // Setup hooks in sync-integration.test.mjs render a full output tree: a
    // single sync writes 600+ files and measures ~25s on Windows (more for an
    // all-targets sync), and the first hook to request a writable tree pays a
    // cold sync plus a recursive copy. The old 30s budget left no headroom and
    // made those hooks fail intermittently. This is sized for that worst case
    // while still catching a genuinely hung hook.
    hookTimeout: 240_000,
    exclude: [...configDefaults.exclude, '.tmp/**', ...excludedByQuarantine],
    // Rerun-based flake detection (ADR-12 decision 5), CI only.
    //
    // A retried test is NOT quietly promoted to green: anything that passes
    // only on a rerun is recorded as flaky by RunIntegrityReporter, surfaced by
    // reconcile-test-results.mjs as a warning with an annotation, and kept in
    // the uploaded artifact. That is the "labelled rather than retried into
    // green" the decision asks for.
    //
    // Deliberately not enabled locally. The failures this ADR chased were
    // Windows I/O-contention timeouts on developer machines; retrying them
    // there would hide the exact signal a developer needs while iterating.
    retry: isCI ? 1 : 0,
    reporters: [
      'default',
      // JUnit and JSON are uploaded as a CI artifact so a run stays inspectable
      // per-test after the fact, instead of only as console scrollback.
      ['junit', { outputFile: 'test-results/junit.xml' }],
      ['json', { outputFile: 'test-results/results.json' }],
      new RunIntegrityReporter({ outputFile: 'test-results/run-integrity.json' }),
    ],
    env: {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'commit.gpgsign',
      GIT_CONFIG_VALUE_0: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      // Thresholds are set at the realistic current floor with a small cushion
      // (lines/branches: enough to fail on regression, not block normal PRs).
      // The 80/80/80 target was reached via the `#520` ratchet:
      //   - Phase 1 (cost-tracker.mjs, check.mjs) — landed; branches → 70.
      //   - Phase 2 (init.mjs, orchestrator.mjs) — landed (#531, #533).
      //   - Phase 3 (discover.mjs, retort-config-wizard.mjs) — landed (#536).
      // Each phase ratcheted the branches floor up as headroom was earned.
      thresholds: {
        lines: 77,
        branches: 75,
        functions: 80,
      },
    },
  },
});
