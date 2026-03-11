import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 15_000,
    environment: 'node',
  },
});
