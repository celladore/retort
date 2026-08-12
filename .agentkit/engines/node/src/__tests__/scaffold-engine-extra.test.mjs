import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { cleanStaleFiles, runPostSyncPrettier } from '../scaffold-engine.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(prefix) {
  const dir = join(
    tmpdir(),
    `scaffold-extra-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSync(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

const noop = () => {};

// ---------------------------------------------------------------------------
// cleanStaleFiles — path traversal protection
// ---------------------------------------------------------------------------

describe('cleanStaleFiles — path traversal', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = makeTmpDir('clean-traversal');
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('blocks path traversal attempts in manifest entries', async () => {
    // A previous manifest contains a malicious entry that resolves outside the
    // project root. cleanStaleFiles should warn and skip rather than unlink.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const count = await cleanStaleFiles({
      projectRoot,
      previousManifest: { files: { '../escape.txt': { hash: 'abc' } } },
      newManifestFiles: {},
      noClean: false,
      logVerbose: noop,
    });

    expect(count).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/path traversal in manifest/i));
    warnSpy.mockRestore();
  });

  it('warns but does not throw when unlink fails', async () => {
    // Add a stale entry that exists but points to a directory (rmdir would
    // succeed via unlink on POSIX-only? unlink on a directory throws EISDIR).
    const staleDirPath = join(projectRoot, 'stale-dir');
    mkdirSync(staleDirPath, { recursive: true });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const count = await cleanStaleFiles({
      projectRoot,
      previousManifest: { files: { 'stale-dir': { hash: 'abc' } } },
      newManifestFiles: {},
      noClean: false,
      logVerbose: noop,
    });

    // unlink on a directory should fail; cleanStaleFiles should warn and not throw.
    // count remains 0 because unlink was unsuccessful.
    expect(count).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/could not clean stale file/i));
    warnSpy.mockRestore();
  });

  it('does not unlink when newManifestFiles already lists the file', async () => {
    const filePath = join(projectRoot, 'kept.md');
    writeSync(filePath, 'keep me\n');

    const count = await cleanStaleFiles({
      projectRoot,
      previousManifest: { files: { 'kept.md': { hash: 'a' } } },
      newManifestFiles: { 'kept.md': { hash: 'b' } },
      noClean: false,
      logVerbose: noop,
    });

    expect(count).toBe(0);
    // file should still exist
    const { existsSync } = await import('fs');
    expect(existsSync(filePath)).toBe(true);
  });

  it('does not throw when previousManifest.files is empty', async () => {
    const count = await cleanStaleFiles({
      projectRoot,
      previousManifest: { files: {} },
      newManifestFiles: {},
      noClean: false,
      logVerbose: noop,
    });
    expect(count).toBe(0);
  });

  it('skips silently when the orphan path no longer exists', async () => {
    const count = await cleanStaleFiles({
      projectRoot,
      previousManifest: { files: { 'never-existed.md': { hash: 'a' } } },
      newManifestFiles: {},
      noClean: false,
      logVerbose: noop,
    });
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runPostSyncPrettier — short-circuit cases
// ---------------------------------------------------------------------------

describe('runPostSyncPrettier', () => {
  let projectRoot;
  let agentkitRoot;

  beforeEach(() => {
    projectRoot = makeTmpDir('prettier-project');
    agentkitRoot = makeTmpDir('prettier-agentkit');
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(agentkitRoot, { recursive: true, force: true });
  });

  it('returns silently when prettier is not installed', async () => {
    // No node_modules/prettier/bin/prettier.cjs in agentkitRoot
    await expect(
      runPostSyncPrettier({
        agentkitRoot,
        projectRoot,
        writtenFiles: [join(projectRoot, 'a.md')],
        logVerbose: noop,
      })
    ).resolves.toBeUndefined();
  });

  it('returns silently when writtenFiles is empty', async () => {
    // Stub a fake prettier bin so the existence check passes
    const fakeBin = resolve(agentkitRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
    writeSync(fakeBin, '#!/usr/bin/env node\nconsole.log("noop");\n');

    await expect(
      runPostSyncPrettier({
        agentkitRoot,
        projectRoot,
        writtenFiles: [],
        logVerbose: noop,
      })
    ).resolves.toBeUndefined();
  });
});
