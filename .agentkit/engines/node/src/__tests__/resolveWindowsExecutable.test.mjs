import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { resolveWindowsExecutable } from '../runner.mjs';

describe('resolveWindowsExecutable()', () => {
  const originalPlatform = process.platform;
  let originalEnv;

  beforeEach(() => {
    vi.resetModules();
    // Deep clone env to prevent side effects
    originalEnv = { ...process.env };
    process.env = { ...originalEnv };
    // Default PATHEXT for testing
    process.env.PATHEXT = '.COM;.EXE;.BAT;.CMD';

    // Mock platform to win32, ensuring configurable so it can be restored
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    });

    vi.spyOn(fs, 'statSync').mockImplementation(() => ({ isFile: () => false }));
  });

  afterEach(() => {
    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    });
    // Restore env
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns original command if not on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    expect(resolveWindowsExecutable('ls')).toBe('ls');
  });

  it('resolves absolute path with extension', () => {
    // Use path.join to get OS-specific separators for the absolute path simulation
    const absPath = path.resolve('/bin/tool.exe');

    vi.spyOn(path, 'isAbsolute').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === absPath }));

    expect(resolveWindowsExecutable(absPath)).toBe(absPath);
  });

  it('resolves absolute path by appending extension', () => {
    const inputPath = path.resolve('/bin/tool');
    const resolvedPath = path.resolve('/bin/tool.CMD');

    vi.spyOn(path, 'isAbsolute').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === resolvedPath }));

    expect(resolveWindowsExecutable(inputPath)).toBe(resolvedPath);
  });

  it('resolves explicit relative path against cwd', () => {
    const cwd = path.resolve('/project');
    const relativeCmd = './script';
    // When resolved against cwd, it becomes absolute: /project/script.BAT
    const resolvedPath = path.resolve(cwd, 'script.BAT');

    // The implementation should verify: resolve(cwd, './script') + .BAT exists
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === resolvedPath }));

    expect(resolveWindowsExecutable(relativeCmd, cwd)).toBe(resolvedPath);
  });

  it('resolves command in CWD (implicit relative)', () => {
    const cwd = path.resolve('/project');
    const cmd = 'script';
    const resolvedPath = path.join(cwd, 'script.BAT');

    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === resolvedPath }));

    expect(resolveWindowsExecutable(cmd, cwd)).toBe(resolvedPath);
  });

  it('resolves command in PATH', () => {
    const binDir = path.resolve('/bin');
    process.env.PATH = `${path.resolve('/windows')}${path.delimiter}${binDir}`;
    const cmd = 'npm';
    const resolvedPath = path.join(binDir, 'npm.CMD');

    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === resolvedPath }));

    expect(resolveWindowsExecutable(cmd)).toBe(resolvedPath);
  });

  it('returns original command if not found', () => {
    process.env.PATH = path.resolve('/windows');
    expect(resolveWindowsExecutable('missing-tool')).toBe('missing-tool');
  });

  it('prioritizes CWD over PATH', () => {
    const cwd = path.resolve('/project');
    const cmd = 'tool';
    const cwdPath = path.join(cwd, 'tool.EXE');
    const pathPath = path.join(path.resolve('/bin'), 'tool.EXE');
    process.env.PATH = path.resolve('/bin');

    // Both exist
    vi.spyOn(fs, 'statSync').mockImplementation((p) => ({ isFile: () => p === cwdPath || p === pathPath }));

    expect(resolveWindowsExecutable(cmd, cwd)).toBe(cwdPath);
  });
});
