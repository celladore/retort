/**
 * Regression guard — `.ps1` files must not be readable-only-by-pwsh.
 *
 * Windows PowerShell 5.1 (still the default shell on Windows) decodes a BOM-less
 * script as ANSI/Windows-1252 rather than UTF-8. A single non-ASCII byte sequence —
 * an em-dash in a comment, `ℹ️` in a Write-Host string — is then mangled into
 * replacement characters that can swallow a string terminator, and the file fails
 * to parse in its entirety ("Missing closing '}'" / TerminatorExpectedAtEndOfString).
 * PowerShell 7+ defaults to UTF-8 and parses the same bytes clean, which is why this
 * stayed invisible to anyone testing with `pwsh`.
 *
 * Two properties are asserted:
 *
 *  1. Any `.ps1` containing non-ASCII bytes carries a BOM. This is the actual
 *     parse-safety invariant — a pure-ASCII script is decoded identically under
 *     both ANSI and UTF-8, so it is safe without one.
 *  2. Every `.ps1` under the sync-owned output directories carries a BOM
 *     unconditionally, which is what `applyUtf8Bom()` in the file writer
 *     guarantees. This catches a regression in the writer even while the
 *     rendered content happens to be pure ASCII.
 *
 * Deliberately excluded: `.agentkit/templates/**`. Templates are the *input* to
 * rendering, never executed as PowerShell, and a leading BOM there would sit in
 * front of the `<# agentkit: scaffold: ... #>` frontmatter and break scaffold-mode
 * detection. Their BOM is applied at render time by the writer instead.
 */
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');

/** Raw bytes a UTF-8 BOM must occupy on disk. */
const BOM_BYTES = Buffer.from([0xef, 0xbb, 0xbf]);

/** Templates are rendered, not executed — they must stay BOM-less. See header. */
const EXCLUDED_PREFIX = '.agentkit/templates/';

/** Directories whose `.ps1` content is written by the sync engine. */
const SYNC_OWNED_PREFIXES = ['scripts/', '.claude/hooks/', '.github/scripts/'];

function trackedPowerShellFiles() {
  const out = execFileSync('git', ['ls-files', '*.ps1'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.startsWith(EXCLUDED_PREFIX));
}

function hasBom(raw) {
  return raw.subarray(0, 3).equals(BOM_BYTES);
}

/** True when any byte is outside ASCII, i.e. the file decodes differently under ANSI. */
function hasNonAscii(raw) {
  return raw.some((byte) => byte > 0x7f);
}

const files = trackedPowerShellFiles();

describe('shipped PowerShell scripts', () => {
  it('finds tracked .ps1 files to check', () => {
    // Guards against the glob silently matching nothing and the suite passing vacuously.
    expect(files.length).toBeGreaterThan(0);
  });

  it('has at least one sync-owned .ps1 to cover', () => {
    const owned = files.filter((f) => SYNC_OWNED_PREFIXES.some((p) => f.startsWith(p)));
    expect(owned.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is parseable by Windows PowerShell 5.1', (file) => {
    const raw = readFileSync(resolve(REPO_ROOT, file));
    if (!hasNonAscii(raw)) return; // pure ASCII — decodes identically under ANSI

    expect(
      hasBom(raw),
      `${file} contains non-ASCII bytes but has no UTF-8 BOM — Windows PowerShell 5.1 ` +
        `will decode it as Windows-1252 and fail to parse it. Non-ASCII .ps1 output must ` +
        `be written through applyUtf8Bom() in fs-utils.mjs.`
    ).toBe(true);
  });

  const syncOwned = files.filter((f) => SYNC_OWNED_PREFIXES.some((p) => f.startsWith(p)));

  it.each(syncOwned)('%s carries a BOM from the sync writer', (file) => {
    const raw = readFileSync(resolve(REPO_ROOT, file));
    expect(hasBom(raw)).toBe(true);
  });
});
