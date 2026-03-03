import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests do real file-system I/O and sync runs; 5s default is too tight on slow/busy hosts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
