import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.mjs'],
    testTimeout: 15_000,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/start/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
