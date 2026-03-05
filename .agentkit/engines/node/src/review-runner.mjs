/**
 * AgentKit Forge — Review Runner
 * Automated pre-review checks: secret scanning, large file detection,
 * TODO/FIXME scanning, and lint on changed files.
 * This is NOT the AI review — that's the /review slash command.
 */
import { existsSync, readFileSync, promises as fsPromises, realpathSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import yaml from 'js-yaml';
import { emitEvent, readEvents } from './event-emitter.mjs';
import { appendEvent } from './orchestrator.mjs';
import { execCommand, runInPool } from './runner.mjs';
import { addTaskArtifact, createTask } from './task-protocol.mjs';
import {
  getIncrementalTestCommands,
  resolveCoverageCommand,
  parseCoveragePercentage,
} from './agent-integration.mjs';

// ---------------------------------------------------------------------------
// Secret patterns — compiled once at module level to avoid per-call overhead.
// The /g flag is safe with String.prototype.match() which resets lastIndex.
// ---------------------------------------------------------------------------

// Note: patterns use /g so String.prototype.match() returns all occurrences.
// If refactoring to use .exec()/.test(), create fresh RegExp instances per call
// to avoid stale lastIndex across files.
/**
 * Normalize review severity to canonical lowercase values matching
 * the issue template and task-protocol (critical/high/medium/low).
 * @param {string} severity - e.g. 'HIGH', 'MEDIUM', 'LOW'
 * @returns {string} Normalized lowercase severity
 */
export function normalizeSeverity(severity) {
  const s = String(severity).toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(s)) return s;
  return 'medium';
}

const SECRET_PATTERNS = [
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g },
  {
    name: 'Generic Secret',
    pattern: /(password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
  },
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
  '.lock', // package-lock.json, yarn.lock, etc.
  '.sum', // go.sum
  '.snap', // jest snapshots
];

// ---------------------------------------------------------------------------
// Symlink traversal validation — applied to ALL changedFiles entries
// ---------------------------------------------------------------------------

/**
 * Validate that every file in `files` resolves (via realpath) within `projectRoot`.
 * This catches symlinks that point outside the project even when files come from
 * `git diff --name-only` or `--range` (not just the `--file` flag).
 */
function validateChangedFilesForSymlinkTraversal(projectRoot, files) {
  let realProjectRoot;
  try {
    realProjectRoot = realpathSync(projectRoot);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err; // Re-throw permission errors and other unexpected OS errors
    return; // If projectRoot doesn't exist (e.g. in tests before setup), skip
  }
  for (const file of files) {
    const abs = resolve(projectRoot, file);
    try {
      const realPath = realpathSync(abs);
      if (!realPath.startsWith(realProjectRoot + sep) && realPath !== realProjectRoot) {
        throw new Error(
          `File must be within the project root (symlinks traversing outside are not allowed): ${file}`
        );
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // ENOENT: file doesn't exist yet (e.g. deleted between staging and scan) — let scanners skip it
    }
  }
}

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
    // Reject symlinks that resolve outside the project root.
    // Use realpathSync directly (no existsSync pre-check) to avoid a TOCTOU window.
    try {
      const realPath = realpathSync(abs);
      const realProjectRoot = realpathSync(projectRoot);
      if (!realPath.startsWith(realProjectRoot + sep) && realPath !== realProjectRoot) {
        throw new Error(
          `File must be within the project root (symlinks traversing outside are not allowed): ${flags.file}`
        );
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // re-throw our traversal error and unexpected OS errors
      // ENOENT: file doesn't exist yet (e.g. deleted between staging and scan) — let scanners skip it
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
  const tasks = files.map((file) => async () => {
    // Skip paths known to produce false positives (lockfiles, vendored code, etc.)
    const normalised = '/' + file.replace(/\\/g, '/');
    if (SKIP_SECRET_SCAN_PATHS.some((p) => normalised.includes(p))) return [];
    if (SKIP_SECRET_SCAN_EXTENSIONS.some((ext) => normalised.endsWith(ext))) return [];

    const fullPath = resolve(projectRoot, file);

    // We check existence/stats inside the task
    // We can use sync or async stat here. Using async for consistency.
    try {
      const stat = await fsPromises.stat(fullPath);
      if (stat.size > 1_000_000) return []; // Skip files > 1MB
    } catch {
      return [];
    }

    const ext = extname(file).toLowerCase();
    if (
      ['.png', '.jpg', '.gif', '.ico', '.woff', '.ttf', '.eot', '.zip', '.tar', '.gz'].includes(ext)
    )
      return [];

    const fileFindings = [];
    try {
      const content = await fsPromises.readFile(fullPath, 'utf-8');
      for (const secret of SECRET_PATTERNS) {
        const matches = content.match(secret.pattern);
        if (matches) {
          fileFindings.push({
            type: 'secret',
            severity: 'high',
            file,
            pattern: secret.name,
            count: matches.length,
          });
        }
      }
    } catch {
      /* skip unreadable files */
    }

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
          severity: 'medium',
          file,
          sizeBytes: stat.size,
          sizeMB: (stat.size / 1_000_000).toFixed(1),
        });
      }
    } catch {
      /* skip */
    }
  }
  return findings;
}

// Paths to skip during TODO scanning — agentkit framework internals should not
// appear as tech debt in consuming repos.
const SKIP_TODO_SCAN_PATHS = ['/.agentkit/engines/', '/.agentkit/templates/'];

async function scanTodos(projectRoot, files) {
  const todoPattern = /\b(TODO|FIXME|HACK|XXX|TEMP)\b.*$/gm;

  // Use a concurrency pool of 50 to avoid EMFILE on large scans
  const tasks = files.map((file) => async () => {
    const normalised = '/' + file.replace(/\\/g, '/');
    if (SKIP_TODO_SCAN_PATHS.some((p) => normalised.includes(p))) return [];

    const fullPath = resolve(projectRoot, file);

    try {
      const stat = await fsPromises.stat(fullPath);
      if (stat.size > 1_000_000) return [];
    } catch {
      return [];
    }

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
            severity: 'low',
            file,
            line: i + 1,
            text:
              matches[0].trim().length > 100
                ? matches[0].trim().slice(0, 97) + '...'
                : matches[0].trim(),
          });
        }
      }
    } catch {
      /* skip */
    }

    return fileFindings;
  });

  const results = await runInPool(tasks, CONCURRENCY_POOL_SIZE);
  return results.flat();
}

// ---------------------------------------------------------------------------
// Review → Task conversion
// ---------------------------------------------------------------------------

/**
 * Infer the responsible team area from a review finding.
 * @param {object} finding
 * @returns {string}
 */
function inferAreaFromFinding(finding) {
  if (finding.type === 'secret') return 'security';
  if (finding.type === 'large_file') return 'devops';
  return 'quality';
}

/**
 * Convert critical/high-severity findings into delegated tasks.
 * Only creates tasks for findings with severity 'critical' or 'high'.
 * @param {string} projectRoot
 * @param {object[]} findings
 * @returns {Promise<object[]>} Created tasks
 */
export async function convertFindingsToTasks(projectRoot, findings) {
  const actionable = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );
  if (!actionable.length) return [];

  const created = [];
  for (const finding of actionable) {
    const priority = finding.severity === 'critical' ? 'P0' : 'P1';
    const area = inferAreaFromFinding(finding);
    const title = `Fix ${finding.type}: ${finding.pattern || finding.file}`;

    const result = await createTask(projectRoot, {
      delegator: 'review-runner',
      assignees: [area],
      title,
      description: `Auto-created from review finding.\nFile: ${finding.file}\nType: ${finding.type}\nSeverity: ${finding.severity}${finding.count ? `\nMatches: ${finding.count}` : ''}`,
      type: 'implement',
      priority,
      severity: finding.severity,
      area,
      dependsOn: [],
      handoffTo: [],
      scope: finding.file ? [finding.file] : [],
    });

    if (result.task) {
      // Persist the finding as a review-findings artifact to disk
      await addTaskArtifact(projectRoot, result.task.id, {
        type: 'review-findings',
        summary: `${finding.type}: ${finding.pattern || ''} in ${finding.file}`,
        finding,
      });
      created.push(result.task);
    } else if (result.error) {
      console.warn(`[agentkit:review] Failed to create task for ${finding.type} in ${finding.file}: ${result.error}`);
    }
  }

  return created;
}

/**
 * Track unfixed findings by comparing current findings with previous review.
 * Emits a 'review_unfixed_findings' event for findings that persist across reviews.
 * @param {string} projectRoot
 * @param {object[]} currentFindings
 */
export async function trackUnfixedFindings(projectRoot, currentFindings) {
  const previousEvents = readEvents(projectRoot, {
    action: 'review_completed',
    limit: 1,
  });

  if (!previousEvents.length || !Array.isArray(previousEvents[0].findingDetails)) {
    return { unfixed: [], isFirstRun: true };
  }

  const prevFindings = previousEvents[0].findingDetails;

  // Match by type + file + pattern (fingerprint)
  const fingerprint = (f) => `${f.type}:${f.file}:${f.pattern || ''}`;
  const prevSet = new Set(prevFindings.map(fingerprint));
  const unfixed = currentFindings.filter((f) => prevSet.has(fingerprint(f)));

  if (unfixed.length > 0) {
    emitEvent(projectRoot, 'review_unfixed_findings', {
      count: unfixed.length,
      findings: unfixed.map((f) => ({
        type: f.type,
        severity: f.severity,
        file: f.file,
        pattern: f.pattern || null,
      })),
    }, { source: 'review-runner' });
  }

  return { unfixed, isFirstRun: false };
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
export async function runReview({
  agentkitRoot /* kept for interface compatibility with other runner functions */,
  projectRoot,
  flags = {},
}) {
  const userContext = Array.isArray(flags._args) && flags._args.length > 0
    ? flags._args.join(' ')
    : null;

  console.log('[agentkit:review] Running automated review checks...');
  if (userContext) {
    console.log(`[agentkit:review] Context: ${userContext}`);
  }
  console.log('');

  const changedFiles = getChangedFiles(projectRoot, flags);
  validateChangedFilesForSymlinkTraversal(projectRoot, changedFiles);

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
      console.log(
        `  ⚠ ${f.severity} ${f.pattern} in ${f.file} (${f.count} match${f.count > 1 ? 'es' : ''})`
      );
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

  // --- Test Coverage Delta ---
  let coverageDelta = null;
  if (flags.coverage === true) {
    console.log('--- Test Coverage Check ---');
    try {
      const teamsPath = resolve(projectRoot, '.agentkit', 'spec', 'teams.yaml');
      if (existsSync(teamsPath)) {
        const teamsSpec = yaml.load(readFileSync(teamsPath, 'utf-8'));
        const techStacks = teamsSpec?.techStacks || [];
        const testCommands = getIncrementalTestCommands(changedFiles, techStacks);

        if (testCommands.length > 0) {
          for (const { stack, command } of testCommands) {
            const covCmd = resolveCoverageCommand({ testCommand: command });
            if (covCmd.command) {
              const covResult = execCommand(covCmd.command, { cwd: projectRoot });
              const percentage = parseCoveragePercentage(
                covResult.stdout + '\n' + covResult.stderr,
                covCmd.parser
              );

              if (percentage != null) {
                coverageDelta = { stack, percentage, command: covCmd.command };
                allFindings.push({
                  type: 'coverage',
                  severity: percentage < 50 ? 'MEDIUM' : 'LOW',
                  stack,
                  percentage,
                });
                console.log(`  ${stack}: ${percentage.toFixed(1)}% coverage on changed files`);
              } else {
                console.log(`  ${stack}: coverage data not parseable`);
              }
              break; // Only run coverage for the first matching stack
            }
          }
        } else {
          console.log('  No matching test commands for changed files');
        }
      } else {
        console.log('  Skipped (no teams.yaml)');
      }
    } catch (err) {
      console.log(`  Skipped (${err?.message ?? 'error'})`);
    }
    console.log('');
  }

  // Summary
  const hasHighSeverity = allFindings.some((f) => f.severity === 'high' || f.severity === 'critical');
  const status = hasHighSeverity ? 'FAIL' : 'PASS';

  console.log(`=== Review: ${status} ===`);
  console.log(
    `Files: ${changedFiles.length} | Findings: ${allFindings.length} (${secrets.length} secrets, ${largeFiles.length} large files, ${todos.length} TODOs${coverageDelta ? `, coverage: ${coverageDelta.percentage.toFixed(1)}%` : ''})`
  );

  // Track unfixed findings (compare with previous review)
  const { unfixed } = await trackUnfixedFindings(projectRoot, allFindings);
  if (unfixed.length > 0) {
    console.log(`\n  ⚠ ${unfixed.length} finding(s) persist from previous review`);
  }

  // Log event with detailed findings for guardrail tracking
  try {
    await appendEvent(projectRoot, 'review_completed', {
      filesReviewed: changedFiles.length,
      totalFindings: allFindings.length,
      secretFindings: secrets.length,
      coverage: coverageDelta,
      status,
      ...(userContext ? { userContext } : {}),
      findingDetails: allFindings.map((f) => ({
        type: f.type,
        severity: f.severity,
        file: f.file,
        pattern: f.pattern || null,
      })),
    });
  } catch (err) {
    console.warn(`[agentkit:review] Event logging failed: ${err?.message ?? String(err)}`);
  }

  // Auto-create tasks for critical/high findings when --auto-task is set
  let createdTasks = [];
  if (flags['auto-task'] && hasHighSeverity) {
    try {
      createdTasks = await convertFindingsToTasks(projectRoot, allFindings);
      if (createdTasks.length > 0) {
        console.log(`\n[agentkit:review] Created ${createdTasks.length} task(s) from findings`);
        for (const task of createdTasks) {
          console.log(`  → ${task.id}: ${task.title}`);
          emitEvent(projectRoot, 'review_auto_task', {
            taskId: task.id,
            findingType: task.artifacts?.[0]?.finding?.type,
            severity: task.severity,
          }, { source: 'review-runner' });
        }
      }
    } catch (err) {
      console.warn(`[agentkit:review] Auto-task creation failed: ${err?.message ?? String(err)}`);
    }
  }

  return {
    files: changedFiles.length,
    findings: allFindings,
    secrets: secrets.length,
    largeFiles: largeFiles.length,
    todos: todos.length,
    coverage: coverageDelta,
    status,
    unfixedFindings: unfixed.length,
    createdTasks: createdTasks.length,
    ...(userContext ? { userContext } : {}),
  };
}
