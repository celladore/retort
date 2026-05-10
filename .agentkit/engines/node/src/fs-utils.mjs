/**
 * Retort — Filesystem Utilities
 * Stateless async I/O helpers used by the sync engine and other modules.
 * No domain knowledge — pure Node.js primitives.
 */
import { existsSync } from 'fs';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

export async function runConcurrent(items, fn, concurrency = 50) {
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(fn));
  }
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeOutput(filePath, content) {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Returns true if `value` is unsafe to use as a single path segment — i.e.
 * not a non-empty string, or contains path separators / traversal sequences.
 * Used to defend against crafted spec entries that could read or write outside
 * their intended directories.
 *
 * Lives in fs-utils (not platform-syncer) so that doctor.mjs and var-builders.mjs
 * can import it without pulling in the entire syncer (avoids a circular
 * import — var-builders is consumed by platform-syncer).
 */
export function isUnsafePathSegment(value) {
  if (typeof value !== 'string' || value.length === 0) return true;
  return (
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    value === '.' ||
    value.includes('\0')
  );
}

export async function* walkDir(dir) {
  if (!existsSync(dir)) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else {
      yield full;
    }
  }
}
