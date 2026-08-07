import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    // A single full sync renders 600+ files and measures ~25s on Windows, so a
    // 30s hook budget left almost no headroom and made any sync-in-beforeAll
    // intermittently fail. Sync-heavy hooks may also do a cold sync plus a
    // recursive copy, so allow room for two while still catching real hangs.
    hookTimeout: 120_000,
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
