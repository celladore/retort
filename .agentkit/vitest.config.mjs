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
      reporter: ['text', 'text-summary'],
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'text-summary'],
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'text-summary'],
  },
});
