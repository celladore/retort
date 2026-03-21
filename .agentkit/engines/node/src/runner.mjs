/**
 * Retort — Process Execution Helper
 * Shared utility for running shell commands with timeout, output capture, and timing.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Parse a command string into [executable, ...args].
 * Handles simple quoted arguments.
 * @param {string} cmd
 * @returns {string[]}
 */
function parseCommand(cmd) {
  const regex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
  const parts = [];
  let match;
  while ((match = regex.exec(cmd)) !== null) {
    // Strip quotes from each quoted segment while preserving content.
    // Handles --format="%h %s" -> --format=%h %s (not just boundary quotes).
    parts.push(match[0].replace(/"([^"]*)"|'([^']*)'/g, '$1$2'));
  }
  return parts.length > 0 ? parts : [];
}

/**
 * Validate a command string against shell injection patterns.
 * Rejects commands containing shell metacharacters.
 * @param {string} cmd
 * @returns {boolean}
 */
export function isValidCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  return !/[$`|;&<>(){}!\\\r\n]/.test(cmd);
}

/**
 * Resolves the full path of an executable on Windows, simulating shell-like resolution.
 * Checks PATH and PATHEXT to find .exe, .cmd, .bat, etc.
 * @param {string} command - The command to resolve (e.g. 'npm', 'git')
 * @param {string} [cwd] - Optional current working directory to check first
 * @returns {string} - The resolved absolute path or the original command if not found
 */
export function resolveWindowsExecutable(command, cwd) {
  // If we are not on Windows, just return the command
  if (process.platform !== 'win32') return command;

  // Helper to verify file existence (optimized to single FS call)
  const isFile = (p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  };

  // Helper to check extensions
  const checkExtensions = (basePath) => {
    const pathExt = (
      process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH'
    ).split(';');

    // Check if the path itself is a file first (e.g. strict match or already has extension)
    if (isFile(basePath)) return basePath;

    // Try appending each extension
    for (const ext of pathExt) {
      const p = basePath + ext;
      if (isFile(p)) return p;
    }
    return null;
  };

  // 1. Handle absolute paths
  if (path.isAbsolute(command)) {
    return checkExtensions(command) || command;
  }

  // 2. Handle explicit relative paths (./, ../, .\, ..\)
  if (/^(\.|\.\.)[\\/]/.test(command)) {
    // If cwd is provided, resolve relative to it; otherwise relative to process.cwd() (default behavior of path.resolve)
    const resolved = cwd ? path.resolve(cwd, command) : path.resolve(command);
    return checkExtensions(resolved) || command;
  }

  // 3. Check CWD if provided (for non-relative, non-absolute commands)
  if (cwd) {
    const localPath = path.join(cwd, command);
    const resolved = checkExtensions(localPath);
    if (resolved) return resolved;
  }

  // 4. Check PATH
  const pathEnv = process.env.PATH || process.env.Path || process.env.path || '';
  const pathDirs = pathEnv.split(path.delimiter);

  for (const dir of pathDirs) {
    const cleanDir = dir.replace(/^"|"$/g, '').trim();
    if (!cleanDir) continue;

    const fullPath = path.join(cleanDir, command);
    const resolved = checkExtensions(fullPath);
    if (resolved) return resolved;
  }

  // Fallback: return original command if resolution fails
  return command;
}

/**
 * Execute a command and capture results.
 * Uses spawnSync with argument arrays to avoid shell injection.
 * @param {string} cmd - Command to run
 * @param {object} opts
 * @param {string} opts.cwd - Working directory
 * @param {number} opts.timeout - Timeout in ms (default 300000 = 5 min)
 * @returns {{ exitCode: number, stdout: string, stderr: string, durationMs: number }}
 */
export function execCommand(cmd, { cwd, timeout = 300_000 } = {}) {
  const start = Date.now();
  const parsed = parseCommand(cmd);
  if (parsed.length === 0) {
    return { exitCode: 1, stdout: '', stderr: 'Empty command', durationMs: 0 };
  }
  let [executable, ...args] = parsed;

  // SECURITY (defense-in-depth):
  // On Windows, manually resolve the executable path to avoid using shell:true by default.
  // This prevents command injection vulnerabilities via cmd.exe argument parsing quirks.
  // However, .cmd and .bat files cannot be spawned directly without shell on Windows,
  // so we fall back to spawning via cmd.exe /d /s /c for those extensions.
  if (process.platform === 'win32') {
    const resolved = resolveWindowsExecutable(executable, cwd);
    if (resolved.toLowerCase().endsWith('.cmd') || resolved.toLowerCase().endsWith('.bat')) {
      // Spawn via cmd.exe to support .cmd/.bat files (e.g. npm.cmd, pnpm.cmd, npx.cmd).
      // Use /d (disable AutoRun), /s (strip surrounding quotes), /c (execute and exit).
      args = ['/d', '/s', '/c', resolved, ...args];
      executable = process.env.ComSpec || 'cmd.exe';
    } else {
      executable = resolved;
    }
  }

  const result = spawnSync(executable, args, {
    cwd,
    timeout,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: false,
  });

  if (result.error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: result.error.message,
      durationMs: Date.now() - start,
    };
  }

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    durationMs: Date.now() - start,
  };
}

/**
 * Check if a command exists on the system PATH.
 * @param {string} cmd - Command name (e.g. 'pnpm', 'cargo')
 * @returns {boolean}
 */
export function commandExists(cmd) {
  const bin = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(bin, [cmd], { encoding: 'utf-8', stdio: 'pipe' });
  return result.status === 0;
}

/**
 * Format milliseconds into a human-readable duration string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) {
    // Truncate (not round) to avoid "60.0s" at the boundary
    const s = Math.floor(ms / 100) / 10;
    return `${s.toFixed(1)}s`;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const remainS = totalSeconds % 60;
  return `${m}m ${remainS}s`;
}

/**
 * Format an ISO timestamp for display (strips T separator and milliseconds).
 * "2026-02-23T17:30:00.123Z" -> "2026-02-23 17:30:00"
 * @param {string} isoTimestamp
 * @returns {string}
 */
export function formatTimestamp(isoTimestamp) {
  return isoTimestamp.replace('T', ' ').replace(/(\.\d+)?Z$/, '');
}

/**
 * Limit concurrency for an array of promise-returning functions.
 * Similar to p-limit but minimal implementation.
 * @param {Array<() => Promise<any>>} tasks
 * @param {number} concurrency
 * @returns {Promise<any[]>}
 */
export async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  const executing = [];

  for (let i = 0; i < tasks.length; i++) {
    const index = i;
    const p = tasks[index]().then((res) => {
      results[index] = res;
      return res;
    });

    // Wrap so the promise removes itself from `executing` when it settles,
    // ensuring Promise.race() below reliably picks up newly-freed slots.
    const e = p.finally(() => {
      const idx = executing.indexOf(e);
      if (idx !== -1) executing.splice(idx, 1);
    });

    executing.push(e);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Run tasks with a concurrency limit using an iterator-based pool.
 * @template T
 * @param {Array<() => Promise<T>>} tasks
 * @param {number} concurrency
 * @returns {Promise<T[]>}
 */
export async function runInPool(tasks, concurrency) {
  if (!Array.isArray(tasks)) {
    throw new TypeError('runInPool: tasks must be an array');
  }
  if (tasks.length === 0) return [];

  let limit = Math.floor(concurrency);
  if (!isFinite(limit) || limit <= 0) {
    throw new RangeError('runInPool: concurrency must be a finite positive integer');
  }
  limit = Math.min(limit, tasks.length);

  const results = new Array(tasks.length);
  const iterator = tasks.entries();
  const workers = new Array(limit).fill(iterator).map(async (iter) => {
    for (const [index, task] of iter) {
      results[index] = await task();
    }
  });
  await Promise.all(workers);
  return results;
}
