import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests do real file-system I/O and sync runs; 5s default is too tight on slow/busy hosts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Disable file parallelism: tests modify shared state (node_modules, temp dirs at repo root)
    // which causes race conditions (e.g. prettier binary unavailable during fresh-install test).
    fileParallelism: false,
  },
});
