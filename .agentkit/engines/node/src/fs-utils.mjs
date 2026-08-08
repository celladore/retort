/**
 * Retort — Filesystem Utilities
 * Stateless async I/O helpers used by the sync engine and other modules.
 * No domain knowledge — pure Node.js primitives.
 */
import { existsSync } from 'fs';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';

/**
 * UTF-8 byte order mark, as the single code point Node writes as EF BB BF.
 * Written as an escape rather than a literal — a literal BOM is invisible in an
 * editor and trivially deleted or duplicated by accident.
 */
export const UTF8_BOM = '\uFEFF';

/**
 * Extensions whose output must carry a UTF-8 BOM.
 *
 * Windows PowerShell 5.1 — still the default shell on Windows — decodes a
 * BOM-less script as ANSI/Windows-1252 rather than UTF-8. Any non-ASCII byte
 * sequence (em-dashes in comments, `ℹ️` in Write-Host strings) is then mangled
 * into replacement characters that can swallow a string terminator, and the
 * file fails to parse in its entirety. PowerShell 7+ defaults to UTF-8 and is
 * unaffected, which is why this only shows up under 5.1.
 *
 * The BOM is applied unconditionally rather than only when the content happens
 * to contain non-ASCII: a template that gains an em-dash later must not
 * silently become unparseable, and a deterministic rule avoids BOM churn as
 * content changes. Safe here because nothing execs a `.ps1` via its shebang —
 * hooks are invoked as `pwsh -File ...` and only `.sh` output gets `chmod +x`.
 */
const BOM_EXTENSIONS = new Set(['.ps1']);

/** True when `filePath`'s extension requires a UTF-8 BOM. */
export function needsUtf8Bom(filePath) {
  return BOM_EXTENSIONS.has(extname(String(filePath)).toLowerCase());
}

/**
 * Prefixes `content` with a UTF-8 BOM when `filePath` requires one.
 * Idempotent — content that already starts with a BOM is returned unchanged.
 */
export function applyUtf8Bom(filePath, content) {
  if (typeof content !== 'string') return content;
  if (!needsUtf8Bom(filePath)) return content;
  return content.startsWith(UTF8_BOM) ? content : UTF8_BOM + content;
}

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
  await writeFile(filePath, applyUtf8Bom(filePath, content), 'utf-8');
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
