/**
 * AgentKit Forge — Review Runner
 * Automated pre-review checks: secret scanning, large file detection,
 * TODO/FIXME scanning, and lint on changed files.
 * This is NOT the AI review — that's the /review slash command.
 */
import { existsSync, readFileSync, readdirSync, statSync, realpathSync, promises as fsPromises } from 'fs';
import { resolve, relative, extname, sep } from 'path';
import { execCommand, formatDuration, runInPool } from './runner.mjs';
import { appendEvent } from './orchestrator.mjs';

// ---------------------------------------------------------------------------
// Secret patterns — compiled once at module level to avoid per-call overhead.
// The /g flag is safe with String.prototype.match() which resets lastIndex.
// ---------------------------------------------------------------------------

// Note: patterns use /g so String.prototype.match() returns all occurrences.
// If refactoring to use .exec()/.test(), create fresh RegExp instances per call
// to avoid stale lastIndex across files.
const SECRET_PATTERNS = [
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: 'Generic Secret', pattern: /(password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: 'Connection String', pattern: /mongodb(\+srv)?:\/\/[^\s'"]+/g },
  { name: 'JWT', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
];

// Maximum number of files processed in parallel during secret/TODO scanning.
// Keeps the number of open file descriptors bounded and avoids EMFILE errors.
const CONCURRENCY_POOL_SIZE = 50;

// Paths that commonly produce false positives in secret scanning, or that are
// framework internals (.agentkit/) which should not be reported as app issues.
const SKIP_SECRET_SCAN_PATHS = [
  '/node_modules/',
  '/vendor/',
  '/third_party/',
  '/.git/',
  '/.agentkit/engines/',
  '/.agentkit/templates/',
];

const SKIP_SECRET_SCAN_EXTENSIONS = [
  '.lock',    // package-lock.json, yarn.lock, etc.
  '.sum',     // go.sum
  '.snap',    // jest snapshots
];

// ---------------------------------------------------------------------------
// Diff scope detection
// ---------------------------------------------------------------------------

function getChangedFiles(projectRoot, flags) {
  if (flags.range) {
    // Validate range to prevent shell injection — only allow commit-range notation.
    // Intentionally restrictive: blocks @{...} reflog syntax and special chars that
    // could be interpreted by cmd.exe on Windows (where shell:true is used).
    // Allowed: alphanumeric, dots, dashes, slashes, colons, carets, tildes, and .. / ... range operators.
    // Max 256 chars to prevent abuse via extremely long inputs.
    if (
      flags.range.length > 256 ||
      !/^[a-zA-Z0-9._\-/:^~@]+(?:\.{2,3}[a-zA-Z0-9._\-/:^~@]+)?$/.test(flags.range) ||
      /[@][{]/.test(flags.range)
    ) {
      throw new Error(`Invalid --range value: ${flags.range}`);
    }
    const r = execCommand(`git diff --name-only ${flags.range}`, { cwd: projectRoot });
    return r.exitCode === 0 ? r.stdout.trim().split('\n').filter(Boolean) : [];
  }

    if (flags.file) {
    // Constrain to project root to prevent path traversal
    const abs = resolve(projectRoot, flags.file);
    if (!abs.startsWith(resolve(projectRoot) + sep) && abs !== resolve(projectRoot)) {
      throw new Error(`--file must be within the project root: ${flags.file}`);
    }

    if (existsSync(abs)) {
      const stats = statSync(abs);
      if (!stats.isFile()) {
        throw new Error(`File is not a regular file: ${flags.file}`);
      }
      const realPath = realpathSync(abs);
      const realProjectRoot = realpathSync(projectRoot);
      if (!realPath.startsWith(realProjectRoot + sep) && realPath !== realProjectRoot) {
        throw new Error(`File must be within the project root (symlinks traversing outside are not allowed): ${flags.file}`);
      }
    } else {
      throw new Error(`File not found: ${flags.file}`);
    }

    return [flags.file];
  }

  // Default: uncommitted changes (staged + unstaged)
  const r = execCommand('git diff --name-only HEAD', { cwd: projectRoot });
  if (r.exitCode !== 0) {
    // Fallback to unstaged only
    const r2 = execCommand('git diff --name-only', { cwd: projectRoot });
    return r2.exitCode === 0 ? r2.stdout.trim().split('\n').filter(Boolean) : [];
  }
  return r.stdout.trim().split('\n').filter(Boolean);
}

// ---------------------------------------------------------------------------
// Check functions
// ---------------------------------------------------------------------------

async function scanSecrets(projectRoot, files) {
  // Use a concurrency pool of 50 to avoid EMFILE on large scans
  const tasks = files.map(file => async () => {
    // Skip paths known to produce false positives (lockfiles, vendored code, etc.)
    const normalised = '/' + file.replace(/\\/g, '/');
    if (SKIP_SECRET_SCAN_PATHS.some(p => normalised.includes(p))) return [];
    if (SKIP_SECRET_SCAN_EXTENSIONS.some(ext => normalised.endsWith(ext))) return [];

    const fullPath = resolve(projectRoot, file);

    // We check existence/stats inside the task
    // We can use sync or async stat here. Using async for consistency.
    try {
      const stat = await fsPromises.stat(fullPath);
      if (stat.size > 1_000_000) return []; // Skip files > 1MB
    } catch { return []; }

    const ext = extname(file).toLowerCase();
    if (['.png', '.jpg', '.gif', '.ico', '.woff', '.ttf', '.eot', '.zip', '.tar', '.gz'].includes(ext)) return [];

    const fileFindings = [];
    try {
      const content = await fsPromises.readFile(fullPath, 'utf-8');
      for (const secret of SECRET_PATTERNS) {
        const matches = content.match(secret.pattern);
        if (matches) {
          fileFindings.push({
            type: 'secret',
            severity: 'HIGH',
            file,
            pattern: secret.name,
            count: matches.length,
          });
        }
      }
    } catch { /* skip unreadable files */ }

    return fileFindings;
  });

  const results = await runInPool(tasks, CONCURRENCY_POOL_SIZE);
  return results.flat();
}

function scanLargeFiles(projectRoot, files, threshold = 500_000) {
  const findings = [];
  for (const file of files) {
    const fullPath = resolve(projectRoot, file);
    try {
      const stat = statSync(fullPath);
      if (stat.size > threshold) {
        findings.push({
          type: 'large_file',
          severity: 'MEDIUM',
          file,
          sizeBytes: stat.size,
          sizeMB: (stat.size / 1_000_000).toFixed(1),
        });
      }
    } catch { /* skip */ }
  }
  return findings;
}

// Paths to skip during TODO scanning — agentkit framework internals should not
// appear as tech debt in consuming repos.
const SKIP_TODO_SCAN_PATHS = [
  '/.agentkit/engines/',
  '/.agentkit/templates/',
];

async function scanTodos(projectRoot, files) {
  const todoPattern = /\b(TODO|FIXME|HACK|XXX|TEMP)\b.*$/gm;

  // Use a concurrency pool of 50 to avoid EMFILE on large scans
  const tasks = files.map(file => async () => {
    const normalised = '/' + file.replace(/\\/g, '/');
    if (SKIP_TODO_SCAN_PATHS.some(p => normalised.includes(p))) return [];

    const fullPath = resolve(projectRoot, file);

    try {
      const stat = await fsPromises.stat(fullPath);
      if (stat.size > 1_000_000) return [];
    } catch { return []; }

    const ext = extname(file).toLowerCase();
    if (['.png', '.jpg', '.gif', '.ico', '.woff', '.ttf'].includes(ext)) return [];

    const fileFindings = [];
    try {
      const content = await fsPromises.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const matches = lines[i].match(todoPattern);
        if (matches) {
          fileFindings.push({
            type: 'todo',
            severity: 'LOW',
            file,
            line: i + 1,
            text: matches[0].trim().length > 100 ? matches[0].trim().slice(0, 97) + '...' : matches[0].trim(),
          });
        }
      }
    } catch { /* skip */ }

    return fileFindings;
  });

  const results = await runInPool(tasks, CONCURRENCY_POOL_SIZE);
  return results.flat();
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Run automated review checks.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags - --range, --file
 * @returns {object}
 */
export async function runReview({ agentkitRoot /* kept for interface compatibility with other runner functions */, projectRoot, flags = {} }) {
  console.log('[agentkit:review] Running automated review checks...');
  console.log('');

  const changedFiles = getChangedFiles(projectRoot, flags);

  if (changedFiles.length === 0) {
    console.log('[agentkit:review] No changed files found.');
    console.log('Tip: Commit some changes or use --range <commit>..<commit> to specify a range.');
    return { files: 0, findings: [], status: 'SKIP' };
  }

  console.log(`Files to review: ${changedFiles.length}`);
  for (const f of changedFiles.slice(0, 20)) {
    console.log(`  ${f}`);
  }
  if (changedFiles.length > 20) {
    console.log(`  ... and ${changedFiles.length - 20} more`);
  }
  console.log('');

  // Run checks
  const allFindings = [];

  console.log('--- Secret Scan ---');
  // Parallel secret scan
  const secrets = await scanSecrets(projectRoot, changedFiles);
  allFindings.push(...secrets);
  if (secrets.length > 0) {
    for (const f of secrets) {
      console.log(`  ⚠ ${f.severity} ${f.pattern} in ${f.file} (${f.count} match${f.count > 1 ? 'es' : ''})`);
    }
  } else {
    console.log('  ✓ No secrets detected');
  }
  console.log('');

  console.log('--- Large File Detection ---');
  // This is still sync and fast (stat only), keeping it sync is fine or could be async.
  // Given it's just stat, let's leave it as is unless requested.
  const largeFiles = scanLargeFiles(projectRoot, changedFiles);
  allFindings.push(...largeFiles);
  if (largeFiles.length > 0) {
    for (const f of largeFiles) {
      console.log(`  ⚠ ${f.file} (${f.sizeMB} MB)`);
    }
  } else {
    console.log('  ✓ No oversized files');
  }
  console.log('');

  console.log('--- TODO/FIXME Scan ---');
  // Parallel TODO scan
  const todos = await scanTodos(projectRoot, changedFiles);
  allFindings.push(...todos);
  if (todos.length > 0) {
    for (const f of todos.slice(0, 10)) {
      console.log(`  · ${f.file}:${f.line} — ${f.text}`);
    }
    if (todos.length > 10) {
      console.log(`  ... and ${todos.length - 10} more`);
    }
  } else {
    console.log('  ✓ No TODOs found in changed files');
  }
  console.log('');

  // Summary
  const hasHighSeverity = allFindings.some(f => f.severity === 'HIGH');
  const status = hasHighSeverity ? 'FAIL' : 'PASS';

  console.log(`=== Review: ${status} ===`);
  console.log(`Files: ${changedFiles.length} | Findings: ${allFindings.length} (${secrets.length} secrets, ${largeFiles.length} large files, ${todos.length} TODOs)`);

  // Log event
  try {
    appendEvent(projectRoot, 'review_completed', {
      filesReviewed: changedFiles.length,
      totalFindings: allFindings.length,
      secretFindings: secrets.length,
      status,
    });
  } catch (err) { console.warn(`[agentkit:review] Event logging failed: ${err?.message ?? String(err)}`); }

  return {
    files: changedFiles.length,
    findings: allFindings,
    secrets: secrets.length,
    largeFiles: largeFiles.length,
    todos: todos.length,
    status,
  };
}
