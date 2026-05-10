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
 * not a non-empty string, contains path separators / traversal sequences, or
 * contains characters that are invalid or ambiguous on Windows filesystems
 * (`:` / `*` / `?` / `"` / `<` / `>` / `|`) or any C0 control characters.
 * Used to defend against crafted spec entries that could read or write outside
 * their intended directories or produce invalid paths on win32 (e.g. a
 * category like `C:tmp` would otherwise turn into a drive-relative path).
 *
 * Lives in fs-utils (not platform-syncer) so that doctor.mjs and var-builders.mjs
 * can import it without pulling in the entire syncer (avoids a circular
 * import — var-builders is consumed by platform-syncer).
 */
export function isUnsafePathSegment(value) {
  if (typeof value !== 'string' || value.length === 0) return true;
  if (
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    value === '.' ||
    value.includes('\0')
  ) {
    return true;
  }
  // Windows-reserved characters: any of these makes the path invalid on win32.
  if (/[:*?"<>|]/.test(value)) return true;
  // Any C0 control char (0x00–0x1F) is unsafe regardless of platform.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(value)) return true;
  return false;
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
