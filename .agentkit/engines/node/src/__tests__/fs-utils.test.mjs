/**
 * Tests for fs-utils.mjs — small stateless I/O helpers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { ensureDir, runConcurrent, walkDir, writeOutput } from '../fs-utils.mjs';

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
