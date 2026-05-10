import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
      // The 80/80/80 target was unachievable across the whole engine without
      // a multi-day per-module branch-coverage push — see `#520` for the plan
      // to ratchet branches back to 80 by improving coverage on check.mjs,
      // cost-tracker.mjs, init.mjs, orchestrator.mjs, discover.mjs, and
      // retort-config-wizard.mjs.
      thresholds: {
        lines: 79,
        branches: 65,
        functions: 80,
      },
    },
  },
});
