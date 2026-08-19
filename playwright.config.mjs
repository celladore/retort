// GENERATED-adjacent config, but hand-authored — not a Retort sync output.
// Playwright config for retort's e2e suite. Targets are self-contained
// static pages (no dev server), so tests navigate directly via file:// URLs
// built relative to each spec file — see e2e/marketing-landing.spec.mjs.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
