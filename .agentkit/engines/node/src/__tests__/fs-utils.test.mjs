/**
 * Tests for fs-utils.mjs — small stateless I/O helpers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  applyUtf8Bom,
  ensureDir,
  needsUtf8Bom,
  runConcurrent,
  UTF8_BOM,
  walkDir,
  writeOutput,
} from '../fs-utils.mjs';

/** Raw bytes a UTF-8 BOM must occupy on disk. */
const BOM_BYTES = Buffer.from([0xef, 0xbb, 0xbf]);

describe('runConcurrent', () => {
  it('processes all items in chunks', async () => {
    const seen = [];
    await runConcurrent(
      [1, 2, 3, 4, 5],
      async (n) => {
        seen.push(n);
      },
      2
    );
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles an empty list', async () => {
    let called = 0;
    await runConcurrent([], async () => {
      called++;
    });
    expect(called).toBe(0);
  });

  it('respects the default concurrency when none is given', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const seen = [];
    await runConcurrent(items, async (n) => seen.push(n));
    expect(seen).toHaveLength(10);
  });
});

describe('ensureDir / writeOutput', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'fs-utils-test-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows file lock — ignore
    }
  });

  it('ensureDir creates a directory recursively', async () => {
    const target = join(tempDir, 'a', 'b', 'c');
    await ensureDir(target);
    // Subsequent call is a no-op
    await ensureDir(target);
    expect(() => readFileSync(target)).toThrow(); // it's a dir, not a file
  });

  it('writeOutput creates parent directories on the fly', async () => {
    const target = join(tempDir, 'nested', 'deep', 'file.txt');
    await writeOutput(target, 'hello world');
    expect(readFileSync(target, 'utf-8')).toBe('hello world');
  });

  it('writeOutput overwrites existing file content', async () => {
    const target = join(tempDir, 'file.txt');
    await writeOutput(target, 'first');
    await writeOutput(target, 'second');
    expect(readFileSync(target, 'utf-8')).toBe('second');
  });
});

describe('walkDir', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'fs-utils-walk-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows file lock — ignore
    }
  });

  it('yields nothing for a non-existent directory', async () => {
    const found = [];
    for await (const f of walkDir(join(tempDir, 'does-not-exist'))) {
      found.push(f);
    }
    expect(found).toEqual([]);
  });

  it('yields all files in a flat directory', async () => {
    writeFileSync(join(tempDir, 'a.txt'), 'a');
    writeFileSync(join(tempDir, 'b.txt'), 'b');
    const found = [];
    for await (const f of walkDir(tempDir)) {
      found.push(f);
    }
    expect(found).toHaveLength(2);
  });

  it('recurses into subdirectories', async () => {
    writeFileSync(join(tempDir, 'top.txt'), 'top');
    await ensureDir(join(tempDir, 'sub'));
    writeFileSync(join(tempDir, 'sub', 'inner.txt'), 'inner');
    const found = [];
    for await (const f of walkDir(tempDir)) {
      found.push(f);
    }
    expect(found.some((f) => f.endsWith('top.txt'))).toBe(true);
    expect(found.some((f) => f.endsWith('inner.txt'))).toBe(true);
  });
});

describe('needsUtf8Bom', () => {
  it('requires a BOM for .ps1 output', () => {
    expect(needsUtf8Bom('scripts/create-doc.ps1')).toBe(true);
  });

  it('matches the extension case-insensitively', () => {
    expect(needsUtf8Bom('scripts/Create-Doc.PS1')).toBe(true);
  });

  it('does not require a BOM for other shell or text output', () => {
    // A BOM would break the shebang line on POSIX shells.
    expect(needsUtf8Bom('scripts/create-doc.sh')).toBe(false);
    expect(needsUtf8Bom('CLAUDE.md')).toBe(false);
    expect(needsUtf8Bom('.claude/settings.json')).toBe(false);
    expect(needsUtf8Bom('noextension')).toBe(false);
  });
});

describe('applyUtf8Bom', () => {
  it('prefixes .ps1 content with a BOM', () => {
    expect(applyUtf8Bom('a.ps1', '# hi')).toBe(`${UTF8_BOM}# hi`);
  });

  it('is idempotent — never double-prefixes', () => {
    const once = applyUtf8Bom('a.ps1', '# hi');
    expect(applyUtf8Bom('a.ps1', once)).toBe(once);
  });

  it('leaves non-.ps1 content untouched', () => {
    expect(applyUtf8Bom('a.md', '# hi')).toBe('# hi');
  });

  it('passes non-string content through unchanged', () => {
    const buf = Buffer.from('x');
    expect(applyUtf8Bom('a.ps1', buf)).toBe(buf);
  });
});

describe('writeOutput — PowerShell 5.1 encoding', () => {
  let tempDir;
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'fsutils-bom-'));
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes .ps1 files with a leading UTF-8 BOM', async () => {
    const file = join(tempDir, 'hook.ps1');
    await writeOutput(file, 'Write-Host "hi"\n');

    expect(readFileSync(file).subarray(0, 3)).toEqual(BOM_BYTES);
  });

  it('keeps non-ASCII bytes intact after the BOM', async () => {
    // The exact characters that broke parsing under Windows PowerShell 5.1:
    // an em-dash in a comment and an info emoji in a Write-Host string.
    const file = join(tempDir, 'doc.ps1');
    await writeOutput(file, '# note — here\nWrite-Host "ℹ️ done"\n');

    const raw = readFileSync(file);
    expect(raw.subarray(0, 3)).toEqual(BOM_BYTES);
    expect(raw.toString('utf-8').slice(1)).toBe('# note — here\nWrite-Host "ℹ️ done"\n');
  });

  it('does not add a BOM to .sh output', async () => {
    const file = join(tempDir, 'hook.sh');
    await writeOutput(file, '#!/usr/bin/env bash\n');

    expect(readFileSync(file).subarray(0, 3)).not.toEqual(BOM_BYTES);
  });
});
