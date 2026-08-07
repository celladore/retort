import { configDefaults, defineConfig } from 'vitest/config';

// Suites that perform full runSync passes. Each sync writes hundreds of files
// and spawns Prettier subprocesses, so running these concurrently with the rest
// of the suite saturates I/O and trips the per-test timeouts non-deterministically.
// They are isolated into a sequential project instead. See ADR-12.
const SYNC_HEAVY = [
  'engines/node/src/__tests__/sync-integration.test.mjs',
  'engines/node/src/__tests__/command-prefix.test.mjs',
  'engines/node/src/__tests__/sync-agent-features.test.mjs',
];

const shared = {
  testTimeout: 30_000,
  hookTimeout: 30_000,
  env: {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'commit.gpgsign',
    GIT_CONFIG_VALUE_0: 'false',
  },
};

export default defineConfig({
  test: {
    ...shared,
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
    projects: [
      {
        test: {
          ...shared,
          name: 'unit',
          include: ['engines/node/src/__tests__/**/*.test.mjs'],
          exclude: [...configDefaults.exclude, ...SYNC_HEAVY],
        },
      },
      {
        test: {
          ...shared,
          name: 'sync-heavy',
          include: SYNC_HEAVY,
          // Run these files one at a time — the contention is between files,
          // not within them.
          fileParallelism: false,
        },
      },
    ],
  },
});
