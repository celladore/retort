import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests do real file-system I/O and sync runs; 5s default is too tight on slow/busy hosts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Disable GPG commit signing for tests that create temporary git repos.
    // Global commit.gpgsign=true causes git-commit to fail in isolated test dirs.
    env: {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'commit.gpgsign',
      GIT_CONFIG_VALUE_0: 'false',
    },
  },
});
