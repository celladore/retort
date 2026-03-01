/**
 * AgentKit Forge — Check Command (Quality Gate Runner)
 * Auto-detects tech stacks and runs format, lint, typecheck, test, build in sequence.
 * Outputs a structured results table and logs to events.
 */
import { existsSync, readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { execCommand, commandExists, formatDuration, isValidCommand } from './runner.mjs';
import { appendEvent } from './orchestrator.mjs';

// ---------------------------------------------------------------------------
// Step definitions per tech stack
// ---------------------------------------------------------------------------

/**
 * Build the check steps for a detected stack.
 * @param {object} stack - Stack config from teams.yaml techStacks
 * @param {object} flags - CLI flags
 * @returns {Array<{ name: string, command: string, fixCommand?: string }>}
 */
function buildSteps(stack, flags) {
  const steps = [];

  if (stack.formatter) {
    if (typeof stack.formatter !== 'string' || !stack.formatter.trim()) {
      console.warn(`[agentkit:check] Skipping non-string formatter value`);
    } else {
      const resolved = resolveFormatter(stack.formatter);
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
    if (!isValidCommand(stack.typecheck)) {
      console.warn(`[agentkit:check] Skipping invalid typecheck command: ${stack.typecheck}`);
    } else {
      steps.push({
        name: 'typecheck',
        command: stack.typecheck,
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
  'prettier', 'black', 'cargo', 'dotnet', 'gofmt', 'rustfmt',
  'clang-format', 'autopep8', 'yapf', 'isort', 'shfmt', 'stylua',
]);

// Packages allowed to run via npx. 'npx' alone is too broad — a compromised
// spec could set formatter: "npx malicious-package" and pass the base check.
const ALLOWED_NPX_PACKAGES = new Set([
  'prettier',
]);

/**
 * Resolve a formatter shorthand to its check/fix command variants.
 * Returns an object with { cmd, check, fix } so buildSteps can use
 * tool-specific CLI syntax instead of hardcoding Prettier-style flags.
 * @param {string} formatter
 * @returns {{ cmd: string, check: string, fix: string }}
 */
function resolveFormatter(formatter) {
  const map = {
    prettier:        { cmd: 'npx prettier',  check: 'npx prettier --check .',            fix: 'npx prettier --write .' },
    black:           { cmd: 'black',         check: 'black --check .',                   fix: 'black .' },
    'cargo fmt':     { cmd: 'cargo fmt',     check: 'cargo fmt -- --check',              fix: 'cargo fmt' },
    'dotnet format': { cmd: 'dotnet format', check: 'dotnet format --verify-no-changes', fix: 'dotnet format' },
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
    eslint:          { cmd: 'eslint',        check: 'eslint .',       fix: 'eslint --fix .' },
    'cargo clippy':  { cmd: 'cargo clippy',  check: 'cargo clippy',   fix: 'cargo clippy --fix' },
    pylint:          { cmd: 'pylint',        check: 'pylint .',       fix: null },
    flake8:          { cmd: 'flake8',        check: 'flake8 .',       fix: null },
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
  'eslint', 'cargo', 'pylint', 'flake8', 'rubocop', 'golangci-lint',
  'tslint', 'stylelint', 'shellcheck',
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
  const needsWildcard = stacks.some(stack =>
    (!filterStack || stack.name === filterStack) &&
    Array.isArray(stack.detect) &&
    stack.detect.some(m => typeof m === 'string' && m.startsWith('*'))
  );

  if (needsWildcard) {
    try {
      projectFiles = await readdir(projectRoot);
    } catch {
      projectFiles = [];
    }
  }

  return stacks.filter(stack => {
    if (filterStack && stack.name !== filterStack) return false;
    // Check if any detect markers exist in the project
    if (!Array.isArray(stack.detect)) return false;
    return stack.detect.some(marker => {
      if (typeof marker !== 'string') return false;
      if (marker.startsWith('*')) {
        // Wildcard: check for files with this extension at root using cached file list
        if (!projectFiles) return false;
        const ext = marker.replace('*', '');
        return projectFiles.some(f => f.endsWith(ext));
      }
      return existsSync(resolve(projectRoot, marker));
    });
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Run quality gate checks.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags - --fix, --fast, --stack
 * @returns {object} results
 */
export async function runCheck({ agentkitRoot, projectRoot, flags = {} }) {
  console.log('[agentkit:check] Running quality gates...');
  console.log('');

  const detectedStacks = await detectStacks(agentkitRoot, projectRoot, flags.stack);

  if (detectedStacks.length === 0) {
    console.log('[agentkit:check] No tech stacks detected. Nothing to check.');
    console.log('Tip: Ensure your project has marker files (package.json, Cargo.toml, etc.)');
    return { stacks: [], overallStatus: 'SKIP', overallPassed: true };
  }

  const allResults = [];

  for (const stack of detectedStacks) {
    console.log(`--- Stack: ${stack.name} ---`);
    const steps = buildSteps(stack, flags);
    const stackResults = [];

    for (const step of steps) {
      process.stdout.write(`  ${step.name.padEnd(12)} `);

      // Check if the base command exists
      const parts = step.command.split(' ').filter(Boolean);
      const isNpx = parts[0] === 'npx';
      const baseCmd = isNpx ? (parts[1] || '') : parts[0];

      let result;
      if (!isNpx && baseCmd && !commandExists(baseCmd)) {
        result = { exitCode: -1, stdout: '', stderr: `Command not found: ${baseCmd}`, durationMs: 0 };
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

    allResults.push({ stack: stack.name, steps: stackResults });
    console.log('');
  }

  // --- Summary ---
  const overallPassed = allResults.every(s =>
    s.steps.every(step => step.status === 'PASS' || step.status === 'SKIP')
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

  // Log event
  try {
    await appendEvent(projectRoot, 'check_completed', {
      overallStatus,
      stacks: allResults.map(s => ({
        stack: s.stack,
        steps: s.steps.map(st => ({ step: st.step, status: st.status, durationMs: st.durationMs })),
      })),
      flags: { fix: !!flags.fix, fast: !!flags.fast, stack: flags.stack || null },
    });
  } catch (err) { console.warn(`[agentkit:check] Event logging failed: ${err?.message ?? String(err)}`); }

  return { stacks: allResults, overallStatus, overallPassed };
}

// Export internal helpers so they can be directly unit-tested.
export {
  resolveFormatter,
  resolveLinter,
  isAllowedFormatter,
  isAllowedLinter,
  ALLOWED_FORMATTER_BASES,
  ALLOWED_NPX_PACKAGES,
  ALLOWED_LINTER_BASES,
};
