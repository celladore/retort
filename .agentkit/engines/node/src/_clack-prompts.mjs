/**
 * Internal helper wrapping the dynamic import of `@clack/prompts`.
 *
 * Exists solely so tests can mock the relative-path module reliably.
 * vitest 4's `vi.doMock` for bare-module dynamic imports (e.g. directly
 * mocking `@clack/prompts`) is unreliable in thread workers on Linux —
 * the mock factory can race the dynamic `import()` inside the consumer,
 * causing the real module to load and the consumer's try/catch to fire.
 * Mocking a relative-path module avoids that race entirely.
 */
export async function resolveClackPrompts() {
  return import('@clack/prompts');
}
