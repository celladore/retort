/**
 * AgentKit Forge — Check Command (Quality Gate Runner)
 * Auto-detects tech stacks and runs format, lint, typecheck, test, build in sequence.
 * Outputs a structured results table and logs to events.
 */
import { existsSync, readFileSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import yaml from 'js-yaml';
import { join, resolve } from 'path';
import { parseCoveragePercentage, resolveCoverageCommand } from './agent-integration.mjs';
import { appendEvent } from './events.mjs';
import { commandExists, execCommand, formatDuration, isValidCommand } from './runner.mjs';

// ---------------------------------------------------------------------------
// Step definitions per tech stack
// ---------------------------------------------------------------------------

/**
 * Resolve typecheck command for node stack: use package script when defined.
 * Prefers running the script body directly when it is a simple node no-op so the
 * step does not depend on pnpm in the spawned process PATH.
 * @param {object} stack - Stack config
 * @param {string} projectRoot - Project root path
 * @returns {string} Command to run
 */
function resolveTypecheckCommand(stack, projectRoot) {
  if (stack.name !== 'node' || !stack.typecheck || !projectRoot) return stack.typecheck;
  try {
    const pkgPath = resolve(projectRoot, 'package.json');
    if (!existsSync(pkgPath)) return stack.typecheck;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const script = pkg.scripts?.typecheck;
    if (typeof script !== 'string' || !script.trim()) return stack.typecheck;
    const trimmed = script.trim();
    // If the script is a simple node one-liner, run it directly to avoid
    // depending on a package manager binary being present.
    if (/^node\s+-e\s+/.test(trimmed)) return trimmed;

    // Otherwise, prefer running the script via the project's package manager.
    // Detect package manager by lockfile + available executable, then fall
    // back to any available PM, and finally to the configured stack.typecheck.
    let pm = null;
    if (existsSync(resolve(projectRoot, 'pnpm-lock.yaml')) && commandExists('pnpm')) {
      pm = 'pnpm';
    } else if (existsSync(resolve(projectRoot, 'package-lock.json')) && commandExists('npm')) {
      pm = 'npm';
    } else if (existsSync(resolve(projectRoot, 'yarn.lock')) && commandExists('yarn')) {
      pm = 'yarn';
    } else if (commandExists('pnpm')) {
      pm = 'pnpm';
    } else if (commandExists('npm')) {
      pm = 'npm';
    } else if (commandExists('yarn')) {
      pm = 'yarn';
    }

    if (pm === 'yarn') return 'yarn typecheck';
    if (pm) return `${pm} run typecheck`;

    // If we can't determine a usable package manager, fall back to the
    // stack-configured command, which might be a direct executable.
    return stack.typecheck;
  } catch {
    /* ignore */
  }
  return stack.typecheck;
}

/**
 * Build the check steps for a detected stack.
 * @param {object} stack - Stack config from teams.yaml techStacks
 * @param {object} flags - CLI flags
 * @param {string} agentkitRoot - Path to .agentkit root
 * @param {string} [projectRoot] - Project root (for node typecheck script resolution)
 * @returns {Array<{ name: string, command: string, fixCommand?: string }>}
 */
function buildSteps(stack, flags, agentkitRoot, projectRoot) {
  const steps = [];

  if (stack.formatter) {
    if (typeof stack.formatter !== 'string' || !stack.formatter.trim()) {
      console.warn(`[agentkit:check] Skipping non-string formatter value`);
    } else {
      const resolved = resolveFormatter(stack.formatter, agentkitRoot);
      if (!isValidCommand(resolved.check)) {
        console.warn(`[agentkit:check] Skipping invalid formatter command: ${stack.formatter}`);
      } else if (!isAllowedFormatter(resolved)) {
        console.warn(`[agentkit:check] Skipping unrecognized formatter: ${stack.formatter}`);
      } else {
        const fixCmd = flags.fix && resolved.fix ? resolved.fix : null;
        steps.push({
          name: 'format',
          command: resolved.check,
          fixCommand: fixCmd,
        });
      }
    }
  }

  if (stack.linter) {
    const resolved = resolveLinter(stack.linter);
    if (!isValidCommand(resolved.check)) {
      console.warn(`[agentkit:check] Skipping invalid linter command: ${stack.linter}`);
    } else if (!isAllowedLinter(resolved)) {
      console.warn(`[agentkit:check] Skipping unrecognized linter: ${stack.linter}`);
    } else {
      const fixCmd = flags.fix && resolved.fix ? resolved.fix : null;
      steps.push({
        name: 'lint',
        command: resolved.check,
        fixCommand: fixCmd,
      });
    }
  }

  if (stack.typecheck) {
    const typecheckCmd = resolveTypecheckCommand(stack, projectRoot);
    if (!isValidCommand(typecheckCmd)) {
      console.warn(`[agentkit:check] Skipping invalid typecheck command: ${stack.typecheck}`);
    } else {
      steps.push({
        name: 'typecheck',
        command: typecheckCmd,
      });
    }
  }

  if (stack.testCommand) {
    if (!isValidCommand(stack.testCommand)) {
      console.warn(`[agentkit:check] Skipping invalid test command: ${stack.testCommand}`);
    } else {
      steps.push({
        name: 'test',
        command: stack.testCommand,
      });
    }
  }

  if (stack.buildCommand && !flags.fast) {
    if (!isValidCommand(stack.buildCommand)) {
      console.warn(`[agentkit:check] Skipping invalid build command: ${stack.buildCommand}`);
    } else {
      steps.push({
        name: 'build',
        command: stack.buildCommand,
      });
    }
  }

  return steps;
}

// Allowed formatter base executables. Values from the YAML spec must resolve to
// one of these (after resolveFormatter mapping) to prevent a compromised spec
// from executing arbitrary binaries.
const ALLOWED_FORMATTER_BASES = new Set([
  'prettier',
  'black',
  'cargo',
  'dotnet',
  'gofmt',
  'rustfmt',
  'clang-format',
  'autopep8',
  'yapf',
  'isort',
  'shfmt',
  'stylua',
]);

// Packages allowed to run via npx. 'npx' alone is too broad — a compromised
// spec could set formatter: "npx malicious-package" and pass the base check.
const ALLOWED_NPX_PACKAGES = new Set(['prettier']);

/**
 * Resolve a formatter shorthand to its check/fix command variants.
 * Returns an object with { cmd, check, fix } so buildSteps can use
 * tool-specific CLI syntax instead of hardcoding Prettier-style flags.
 * @param {string} formatter
 * @param {string} [agentkitRoot]
 * @returns {{ cmd: string, check: string, fix: string }}
 */
function resolveFormatter(formatter, agentkitRoot) {
  const prettierBin = agentkitRoot
    ? resolve(agentkitRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs').replace(/\\/g, '/')
    : '.agentkit/node_modules/prettier/bin/prettier.cjs';

  const map = {
    prettier: {
      cmd: 'prettier',
      check: `node "${prettierBin}" --check .`,
      fix: `node "${prettierBin}" --write .`,
    },
    black: { cmd: 'black', check: 'black --check .', fix: 'black .' },
    'cargo fmt': { cmd: 'cargo fmt', check: 'cargo fmt -- --check', fix: 'cargo fmt' },
    'dotnet format': {
      cmd: 'dotnet format',
      check: 'dotnet format --verify-no-changes',
      fix: 'dotnet format',
    },
  };
  const entry = map[formatter];
  if (entry) return entry;
  // Unknown formatter — return raw command without appending flags
  return { cmd: formatter, check: formatter, fix: formatter };
}

/**
 * Resolve a linter shorthand to its check/fix command variants.
 * @param {string} linter
 * @returns {{ cmd: string, check: string, fix: string | null }}
 */
function resolveLinter(linter) {
  const map = {
    eslint: { cmd: 'eslint', check: 'eslint .', fix: 'eslint --fix .' },
    'cargo clippy': { cmd: 'cargo clippy', check: 'cargo clippy', fix: 'cargo clippy --fix' },
    pylint: { cmd: 'pylint', check: 'pylint .', fix: null },
    flake8: { cmd: 'flake8', check: 'flake8 .', fix: null },
  };
  const entry = map[linter];
  if (entry) return entry;
  // Unknown linter — return raw command without appending flags
  return { cmd: linter, check: linter, fix: null };
}

/**
 * Check if a resolved formatter command uses an allowed base executable.
 * When the base is 'npx', the package argument (second token) must also
 * appear in ALLOWED_NPX_PACKAGES to prevent arbitrary package execution.
 * @param {{ cmd: string, check: string, fix: string }} resolved - The resolved formatter object
 * @returns {boolean}
 */
function isAllowedFormatter(resolved) {
  const parts = resolved.cmd.split(/\s+/);
  const base = parts[0];
  if (base === 'npx') {
    const pkg = parts[1] || '';
    return ALLOWED_NPX_PACKAGES.has(pkg);
  }
  return ALLOWED_FORMATTER_BASES.has(base);
}

// Allowed linter base executables. Values from the YAML spec must resolve to
// one of these to prevent a compromised spec from executing arbitrary binaries.
const ALLOWED_LINTER_BASES = new Set([
  'eslint',
  'cargo',
  'pylint',
  'flake8',
  'rubocop',
  'golangci-lint',
  'tslint',
  'stylelint',
  'shellcheck',
]);

/**
 * Check if a resolved linter command uses an allowed base executable.
 * @param {{ cmd: string, check: string, fix: string|null }} resolved
 * @returns {boolean}
 */
function isAllowedLinter(resolved) {
  const base = resolved.cmd.split(/\s+/)[0];
  return ALLOWED_LINTER_BASES.has(base);
}

/**
 * Detect tech stacks from teams.yaml techStacks config.
 * @param {string} agentkitRoot
 * @param {string} projectRoot
 * @param {string} [filterStack] - Optional stack name to filter to
 * @returns {Promise<object[]>}
 */
async function detectStacks(agentkitRoot, projectRoot, filterStack) {
  const teamsPath = resolve(agentkitRoot, 'spec', 'teams.yaml');
  if (!existsSync(teamsPath)) return [];

  const spec = yaml.load(readFileSync(teamsPath, 'utf-8'));
  const stacks = spec.techStacks || [];

  // Optimization: Read project root directory once if any stack uses wildcard detection
  let projectFiles = null;
  const needsWildcard = stacks.some(
    (stack) =>
      (!filterStack || stack.name === filterStack) &&
      Array.isArray(stack.detect) &&
      stack.detect.some((m) => typeof m === 'string' && m.startsWith('*'))
  );

  if (needsWildcard) {
    try {
      projectFiles = await readdir(projectRoot);
    } catch {
      projectFiles = [];
    }
  }

  return stacks.filter((stack) => {
    if (filterStack && stack.name !== filterStack) return false;
    // Check if any detect markers exist in the project
    if (!Array.isArray(stack.detect)) return false;
    return stack.detect.some((marker) => {
      if (typeof marker !== 'string') return false;
      if (marker.startsWith('*')) {
        // Wildcard: check for files with this extension at root using cached file list
        if (!projectFiles) return false;
        const ext = marker.slice(1);
        return projectFiles.some((f) => f.endsWith(ext));
      }
      return existsSync(resolve(projectRoot, marker));
    });
  });
}

// ---------------------------------------------------------------------------
// Unresolved placeholder audit
// ---------------------------------------------------------------------------

/**
 * Regex matching {{variable}} placeholders that remain after template rendering.
 * Excludes block helpers like {{#if}}, {{/if}}, {{else}}, and pipe-default syntax.
 */
const UNRESOLVED_RE = /\{\{(?!#|\/|else\}\})([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

/**
 * Scan generated output directories for files containing unresolved {{variable}}
 * placeholders. These indicate variables that lack defaults in both project.yaml
 * and spec-defaults.yaml.
 *
 * @param {string} projectRoot
 * @param {string[]} outputDirs - Directories to scan (e.g. .claude, .github/instructions)
 * @returns {Promise<Array<{ file: string, variables: string[] }>>}
 */
export async function auditUnresolvedPlaceholders(projectRoot, outputDirs) {
  const findings = [];

  for (const dir of outputDirs) {
    const fullDir = resolve(projectRoot, dir);
    if (!existsSync(fullDir)) continue;

    await walkForPlaceholders(fullDir, projectRoot, findings);
  }

  return findings;
}

async function walkForPlaceholders(dir, projectRoot, findings, depth = 0) {
  if (depth > 5) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      await walkForPlaceholders(fullPath, projectRoot, findings, depth + 1);
    } else if (/\.(md|yaml|yml|json|mjs|js|ts)$/.test(entry.name)) {
      try {
        const content = await readFile(fullPath, 'utf-8');
        const matches = [...content.matchAll(UNRESOLVED_RE)].map((m) => m[1]);
        if (matches.length > 0) {
          const unique = [...new Set(matches)];
          const relPath = fullPath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '');
          findings.push({ file: relPath, variables: unique });
        }
      } catch {
        /* skip unreadable files */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Load coverage threshold from project.yaml.
 * @param {string} agentkitRoot
 * @returns {number|null} Coverage threshold percentage or null if not configured
 */
function loadCoverageThreshold(agentkitRoot) {
  try {
    const projectPath = resolve(agentkitRoot, 'spec', 'project.yaml');
    if (!existsSync(projectPath)) return null;
    const spec = yaml.load(readFileSync(projectPath, 'utf-8'));
    const threshold = spec?.testing?.coverage;
    return typeof threshold === 'number' ? threshold : null;
  } catch {
    return null;
  }
}

/**
 * Run quality gate checks.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags - --fix, --fast, --stack, --coverage
 * @returns {object} results
 */
export async function runCheck({ agentkitRoot, projectRoot, flags = {} }) {
  const userContext =
    Array.isArray(flags._args) && flags._args.length > 0 ? flags._args.join(' ') : null;

  console.log('[agentkit:check] Running quality gates...');
  if (userContext) {
    console.log(`[agentkit:check] Context: ${userContext}`);
  }
  console.log('');

  const detectedStacks = await detectStacks(agentkitRoot, projectRoot, flags.stack);

  if (detectedStacks.length === 0) {
    console.log('[agentkit:check] No tech stacks detected. Nothing to check.');
    console.log('Tip: Ensure your project has marker files (package.json, Cargo.toml, etc.)');
    return { stacks: [], overallStatus: 'SKIP', overallPassed: true, coverage: null };
  }

  const allResults = [];
  const coverageResults = [];
  const coverageThreshold = loadCoverageThreshold(agentkitRoot);

  for (const stack of detectedStacks) {
    console.log(`--- Stack: ${stack.name} ---`);
    const steps = buildSteps(stack, flags, agentkitRoot, projectRoot);
    const stackResults = [];

    for (const step of steps) {
      process.stdout.write(`  ${step.name.padEnd(12)} `);

      // Check if the base command exists
      const parts = step.command.split(' ').filter(Boolean);
      const isNpx = parts[0] === 'npx';
      const baseCmd = isNpx ? parts[1] || '' : parts[0];

      let result;
      if (!isNpx && baseCmd && !commandExists(baseCmd)) {
        result = {
          exitCode: -1,
          stdout: '',
          stderr: `Command not found: ${baseCmd}`,
          durationMs: 0,
        };
        console.log(`SKIP (${baseCmd} not found)`);
      } else {
        // If --fix and we have a fix command, run that first
        if (flags.fix && step.fixCommand) {
          const fixResult = execCommand(step.fixCommand, { cwd: projectRoot });
          if (fixResult.exitCode !== 0) {
            console.warn(`  fix command failed (exit ${fixResult.exitCode})`);
          }
        }
        result = execCommand(step.command, { cwd: projectRoot });
        const status = result.exitCode === 0 ? 'PASS' : 'FAIL';
        console.log(`${status}  (${formatDuration(result.durationMs)})`);
      }

      stackResults.push({
        step: step.name,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        status: result.exitCode === 0 ? 'PASS' : result.exitCode === -1 ? 'SKIP' : 'FAIL',
        stdout: result.stdout.slice(0, 500),
        stderr: result.stderr.slice(0, 500),
      });

      // If --bail flag (future), stop on first failure
      if (flags.bail && result.exitCode > 0) break;
    }

    // Coverage check: run after test step if --coverage flag or threshold is configured
    if (flags.coverage || coverageThreshold != null) {
      const covCmd = resolveCoverageCommand(stack, projectRoot);
      if (covCmd.command && isValidCommand(covCmd.command)) {
        process.stdout.write(`  ${'coverage'.padEnd(12)} `);
        const covResult = execCommand(covCmd.command, { cwd: projectRoot });
        const percentage = parseCoveragePercentage(
          covResult.stdout + '\n' + covResult.stderr,
          covCmd.parser
        );

        let covStatus = 'SKIP';
        if (percentage != null) {
          if (coverageThreshold != null && percentage < coverageThreshold) {
            covStatus = 'FAIL';
            console.log(`FAIL  (${percentage.toFixed(1)}% < ${coverageThreshold}% threshold)`);
          } else {
            covStatus = 'PASS';
            console.log(
              `PASS  (${percentage.toFixed(1)}%${coverageThreshold != null ? ` >= ${coverageThreshold}%` : ''})`
            );
          }
        } else {
          console.log(`SKIP (could not parse coverage)`);
        }

        stackResults.push({
          step: 'coverage',
          exitCode: covStatus === 'FAIL' ? 1 : covStatus === 'SKIP' ? -1 : 0,
          durationMs: covResult.durationMs,
          status: covStatus,
          stdout: covResult.stdout.slice(0, 500),
          stderr: covResult.stderr.slice(0, 500),
          coveragePercentage: percentage,
          coverageThreshold,
        });

        coverageResults.push({
          stack: stack.name,
          percentage,
          threshold: coverageThreshold,
          status: covStatus,
        });
      }
    }

    allResults.push({ stack: stack.name, steps: stackResults });
    console.log('');
  }

  // --- Unresolved placeholder audit ---
  const outputDirs = [
    '.claude',
    '.github/instructions',
    '.cursor',
    '.clinerules',
    '.roo',
    '.windsurf',
  ];
  const unresolvedFindings = await auditUnresolvedPlaceholders(projectRoot, outputDirs);
  if (unresolvedFindings.length > 0) {
    console.log('--- Unresolved Placeholders ---');
    for (const finding of unresolvedFindings) {
      console.log(`  ${finding.file}: ${finding.variables.join(', ')}`);
    }
    console.log(`  WARN  ${unresolvedFindings.length} file(s) with unresolved variables`);
    console.log('  Tip: Add defaults in .agentkit/spec/spec-defaults.yaml or project.yaml');
    console.log('');
  }

  // --- Summary ---
  const overallPassed = allResults.every((s) =>
    s.steps.every((step) => step.status === 'PASS' || step.status === 'SKIP')
  );
  const overallStatus = overallPassed ? 'PASS' : 'FAIL';

  console.log(`=== Quality Gate: ${overallStatus} ===`);
  console.log('');

  // Results table — compute column width dynamically
  let maxLabelLen = 'Step'.length;
  for (const stackResult of allResults) {
    for (const step of stackResult.steps) {
      const label = `${stackResult.stack}:${step.step}`;
      if (label.length > maxLabelLen) maxLabelLen = label.length;
    }
  }
  const pad = maxLabelLen + 2; // 2-char gutter
  console.log(`${'Step'.padEnd(pad)}Status  Duration`);
  console.log(`${'─'.repeat(pad)}  ──────  ────────`);
  for (const stackResult of allResults) {
    for (const step of stackResult.steps) {
      const name = `${stackResult.stack}:${step.step}`.padEnd(pad);
      const status = step.status.padEnd(6);
      console.log(`${name}${status}  ${formatDuration(step.durationMs)}`);
    }
  }

  // Coverage summary
  if (coverageResults.length > 0) {
    console.log('');
    console.log('--- Coverage ---');
    for (const cov of coverageResults) {
      const pct = cov.percentage != null ? `${cov.percentage.toFixed(1)}%` : 'N/A';
      const thresh = cov.threshold != null ? ` (threshold: ${cov.threshold}%)` : '';
      console.log(`  ${cov.stack}: ${pct}${thresh} — ${cov.status}`);
    }
  }

  // Log event
  try {
    await appendEvent(projectRoot, 'check_completed', {
      overallStatus,
      stacks: allResults.map((s) => ({
        stack: s.stack,
        steps: s.steps.map((st) => ({
          step: st.step,
          status: st.status,
          durationMs: st.durationMs,
        })),
      })),
      coverage: coverageResults.length > 0 ? coverageResults : undefined,
      flags: {
        fix: !!flags.fix,
        fast: !!flags.fast,
        coverage: !!flags.coverage,
        stack: flags.stack || null,
      },
      ...(userContext ? { userContext } : {}),
    });
  } catch (err) {
    console.warn(`[agentkit:check] Event logging failed: ${err?.message ?? String(err)}`);
  }

  return {
    stacks: allResults,
    overallStatus,
    overallPassed,
    coverage: coverageResults,
    ...(userContext ? { userContext } : {}),
  };
}

// Export internal helpers so they can be directly unit-tested.
// auditUnresolvedPlaceholders is exported at declaration above.
export {
  ALLOWED_FORMATTER_BASES,
  ALLOWED_LINTER_BASES,
  ALLOWED_NPX_PACKAGES,
  isAllowedFormatter,
  isAllowedLinter,
  resolveFormatter,
  resolveLinter,
};
