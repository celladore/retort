#!/usr/bin/env node
/**
 * Retort CLI Router
 * Routes subcommands to their handlers.
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { parseArgs } from 'node:util';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  baseFlagTypes,
  buildParseOptions,
  CLI_INTERNAL_FLAGS,
  loadCommandFlags,
} from './cli-flags.mjs';
import { VALID_COMMANDS } from './commands-registry.mjs';
import { findMissingRuntimeDependencies } from './dependency-bootstrap.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

// Read version from package.json (single source of truth)
let VERSION = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(resolve(AGENTKIT_ROOT, 'package.json'), 'utf-8'));
  VERSION = pkg.version || VERSION;
} catch {
  /* fallback to 0.0.0 */
}

// Re-export for callers that import from cli.mjs directly
export { VALID_COMMANDS } from './commands-registry.mjs';

// Workflow commands with runtime handlers
const WORKFLOW_COMMANDS = ['orchestrate', 'plan', 'check', 'review', 'handoff', 'healthcheck'];

// Commands that are slash-command-only (no CLI handler)
const SLASH_ONLY_COMMANDS = ['project-review', 'scaffold', 'preflight'];

// Populated lazily in main() after ensureDependencies + commands.yaml load
let VALID_FLAGS = { ...CLI_INTERNAL_FLAGS };
let FLAG_TYPES = baseFlagTypes();

const args = process.argv.slice(2);
const command = args[0];
// Strip the bare `--` separator injected by `npm run`/`pnpm run` when the
// caller uses `pnpm run agentkit:init -- --repoName foo` so that flags reach
// parseArgs correctly.
let commandArgs = args.slice(1);
if (commandArgs[0] === '--') commandArgs = commandArgs.slice(1);

function parseFlags(command, args) {
  try {
    const options = buildParseOptions(command, VALID_FLAGS, FLAG_TYPES);

    const { values, positionals, tokens } = parseArgs({
      args,
      options,
      strict: false, // allow unknown flags/positionals
      allowPositionals: true,
      tokens: true,
    });

    // With strict: false, parseArgs returns boolean true for a known string option
    // that is passed without a value (e.g. --status with no argument). Enforce that
    // all known string options received an actual string value.
    for (const [flagName, flagOpt] of Object.entries(options)) {
      if (
        flagOpt.type === 'string' &&
        Object.hasOwn(values, flagName) &&
        typeof values[flagName] !== 'string'
      ) {
        throw new TypeError(`Option '--${flagName} <value>' argument missing`);
      }
    }

    // Use the tokens list to detect and warn about unknown flags. With strict: false,
    // unknown flags are silently discarded from values and do not appear in positionals,
    // so the tokens API is the only reliable way to surface them to the user.
    const knownFlags = new Set(Object.keys(options));
    for (const token of tokens) {
      if (token.kind === 'option' && !knownFlags.has(token.name)) {
        console.warn(`[retort:${command}] Warning: unrecognized flag --${token.name} (ignored)`);
      }
    }

    return { ...values, _args: positionals };
  } catch (err) {
    console.error(`Error parsing arguments: ${err.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Retort v${VERSION}

Usage: node cli.mjs <command> [options]

Commands:
  init            Initialize repo overlay from template
                  --non-interactive   Skip prompts, use auto-detected defaults
                  --preset <name>     Use preset: minimal, full, team
                  --ci                Alias for --non-interactive
                  --external-knowledge Enable external knowledge integration
                  --external-mode <m> metadata-overlays | direct-copy | hybrid
                  --windsurf-guides-path <path>
                  --mystira-docs-path <path>
                  --external-markdown-files <csv>
                  --external-git-repos <csv>
                  --external-target-platforms <csv>
  sync            Render all AI tool configs from spec + overlay
                  --only <targets>    Sync only specific targets (comma-separated)
                  --overwrite         Overwrite project-owned files (docs/, .vscode/, etc.)
                  --force             Alias for --overwrite
                  -q, --quiet         Reduce output (errors only)
                  -v, --verbose       List each file written
                  --no-clean          Don't delete orphaned files from previous sync
                  --diff              Show what would change without writing
                  --yes, --no-prompt  Skip interactive prompts (apply all changes)
  validate        Validate generated outputs
  discover        Scan repo to detect tech stacks and structure
  spec-validate   Validate YAML spec files for schema correctness

Tool Management:
  add <tool...>   Add AI tool(s) to render targets and sync
  remove <tool...> Remove AI tool(s) from render targets
                  --clean             Also delete generated files
  list            Show enabled and available AI tools

Feature Management:
  features                 List all kit features and their status
                  --verbose           Show available presets
  features enable <f...>   Enable one or more kit features
  features disable <f...>  Disable one or more kit features
  features preset <name>   Apply a named feature preset (minimal, standard, full, lean)

Workflow Commands:
  orchestrate     Multi-team coordination workflow (state machine)
  plan            Show plan status and recommendations
  check           Run quality gates (format, lint, typecheck, test, build)
  review          Run automated review checks (secrets, large files, TODOs)
  handoff         Generate session handoff document
  healthcheck     Pre-flight validation of repo health

Task Delegation:
  tasks           List and inspect delegated tasks
                  --status <s>      Filter by status (submitted, working, completed, etc.)
                  --assignee <team>  Filter by assignee team
                  --id <task-id>     Show details for a specific task
                  --process-handoffs Process handoff chains before listing
  delegate        Create a delegated task for a team
                  --to <team>       Assignee team (required)
                  --title <text>    Task title (required)
                  --type <type>     Task type: implement, review, plan, investigate, test, document
                  --priority <p>    Priority: P0, P1, P2, P3 (default P2)
                  --depends-on <id> Depend on another task ID
                  --handoff-to <t>  Auto-handoff to team on completion

Diagnostics:
  doctor          Run Retort diagnostics and setup checks
                  --verbose         Include detailed diagnostics
  harness doctor  Verify the vendored Agent Harnessing contract lock and schema
  harness validate --document <path>
                  Validate a contract document offline against the pinned schema
  harness generate [--output <path>] [--dry-run] [--diff]
                  Generate or update a conservative repo-local HarnessManifest
  harness options:
                  --document <path> Document to validate (validate only)
                  --output <path>   Output path (default: .agentkit/harness/manifest.json)
                  --dry-run         Preview generation without writing
                  --diff            Include the proposed manifest diff
                  --json            Emit machine-readable output

Backlog & Issue Tracking:
  import-issues   Import issues from external tracker into local backlog
                  --tracker <type>    Tracker type: github, linear
                  --state <state>     Filter: open, closed, all (default: open)
                  --labels <csv>      Filter by labels
                  --since <date>      Only issues updated since ISO date
                  --limit <n>         Max issues to fetch (default: 100)
                  --dry-run           Preview without writing
                  --force             Override autoImport gate
  backlog         Display consolidated backlog with filtering
                  --format <fmt>      Output: table, json, yaml, csv
                  --team <name>       Filter by team
                  --priority <csv>    Filter by priority (e.g. P0,P1)
                  --source <src>      Filter by source
                  --status <status>   Filter by status
                  --sort <field>      Sort: priority, team, source, updated
  sync-backlog    Sync backlog with external tracker + local sources
                  --tracker <type>    Tracker type: github, linear
                  --direction <dir>   pull (default) or push
                  --state <state>     Filter: open, closed, all
                  --labels <csv>      Filter by labels
                  --owner-team <t>    Override owner team
                  --team <name>       Display filter (post-sync)
                  --since <date>      Only issues updated since ISO date
                  --limit <n>         Max issues to fetch
                  --force             Override autoImport gate

Worktree Management:
  worktree create <path> [branch]
                  Create a git worktree and write .agentkit-repo marker
                  --base <branch>     Branch to base the new worktree branch on
                  --no-setup          Skip automatic pnpm install
                  --dry-run           Preview without making changes

Utility Commands:
  cost            Session cost and usage tracking
  analyze-agents  Generate agent/team relationship matrix
                  --output <path>     Output file (default: docs/agents/agent-team-matrix.md)
                  --matrix <n>        Specific matrix (1-8, supplementary, all; default: all)
                  --format <fmt>      Output format: markdown, json (default: markdown)

Slash-Command Only:
  project-review  Comprehensive project audit (use as /project-review in AI tool)
  scaffold        Generate convention-aligned skeletons (use as /scaffold in AI tool)
  preflight       Run enhanced release-readiness checks (use as /preflight in AI tool)

Options:
  orchestrate:
    --status            Show current orchestrator state
    --force-unlock      Clear stale session lock
    --phase <1-5>       Jump to specific phase

  check:
    --fix               Auto-fix issues where possible
    --fast              Skip build step
    --stack <name>      Limit to specific tech stack
    --bail              Stop on first failure
    --coverage          Run coverage checks and enforce thresholds

  review:
    --range <range>     Git commit range (e.g. HEAD~3..HEAD)
    --file <path>       Review a specific file

  handoff:
    --save              Save handoff to docs/ai_handoffs/

  cost:
    --summary           Show recent session summary
    --sessions          List recent sessions
    --report            Generate aggregate report
    --month <YYYY-MM>   Month for report
    --format <fmt>      Export format: json, csv (default: table)
    --last <period>     Time period (e.g. 7d, 30d)

  All commands:
    --help              Show this help message

Environment:
  DEBUG=1              Show stack traces on errors
`);
}

function ensureDependencies(agentkitRoot) {
  const pkgPath = resolve(agentkitRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return true;
  }
  const missingDependencies = findMissingRuntimeDependencies(agentkitRoot);
  if (missingDependencies.length === 0) return true;

  const hasPnpm =
    spawnSync('pnpm', ['--version'], { encoding: 'utf8', windowsHide: true }).status === 0;
  const installCmd = hasPnpm ? 'pnpm' : 'npm';
  const installArgs = hasPnpm ? ['install'] : ['install'];
  console.warn(
    `[retort] Missing dependencies (${missingDependencies.join(', ')}). ` +
      `Running ${installCmd} install in .agentkit...`
  );
  const r = spawnSync(installCmd, installArgs, {
    cwd: agentkitRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (r.status !== 0) {
    console.error(
      `[retort] Failed to install dependencies. Run manually: ${installCmd} -C .agentkit install`
    );
    return false;
  }
  return true;
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (!VALID_COMMANDS.includes(command)) {
    console.error(`Unknown command: "${command}"`);
    console.error(`Valid commands: ${VALID_COMMANDS.join(', ')}`);
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  // Short-circuit help for subcommands before dependency checks and dynamic imports.
  if (Array.isArray(commandArgs) && commandArgs.some((arg) => arg === '--help' || arg === '-h')) {
    showHelp();
    process.exit(0);
  }

  if (!ensureDependencies(AGENTKIT_ROOT)) {
    process.exit(1);
  }

  const loaded = await loadCommandFlags(AGENTKIT_ROOT);
  VALID_FLAGS = loaded.validFlags;
  FLAG_TYPES = loaded.flagTypes;

  const flags = parseFlags(command, commandArgs);

  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  // Record command invocation for cost tracking (best-effort)
  try {
    const { recordCommand } = await import('./cost-tracker.mjs');
    recordCommand(AGENTKIT_ROOT, command).catch(() => {});
  } catch {
    /* cost tracking is optional */
  }

  try {
    switch (command) {
      case 'init': {
        if (flags['config-only']) {
          const { runRetortConfigWizard } = await import('./retort-config-wizard.mjs');
          await runRetortConfigWizard({
            agentkitRoot: AGENTKIT_ROOT,
            projectRoot: PROJECT_ROOT,
            flags,
            prefill: null,
          });
          break;
        }
        const { runInit } = await import('./init.mjs');
        await runInit({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'sync': {
        const { runSync } = await import('./synchronize.mjs');
        await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'validate': {
        const { runValidate } = await import('./validate.mjs');
        await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'discover': {
        const { runDiscover } = await import('./discover.mjs');
        await runDiscover({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'spec-validate': {
        const { runSpecValidation } = await import('./spec-validator.mjs');
        const result = runSpecValidation(AGENTKIT_ROOT);
        if (!result.valid) process.exit(1);
        break;
      }
      case 'orchestrate': {
        const { runOrchestrate } = await import('./orchestrator.mjs');
        await runOrchestrate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'check': {
        const { runCheck } = await import('./check.mjs');
        const result = await runCheck({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: PROJECT_ROOT,
          flags,
        });
        if (!result.overallPassed) process.exit(1);
        break;
      }
      case 'review': {
        const { runReview } = await import('./review-runner.mjs');
        const result = await runReview({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: PROJECT_ROOT,
          flags,
        });
        if (result.status === 'FAIL') process.exit(1);
        break;
      }
      case 'plan': {
        const { runPlan } = await import('./plan-runner.mjs');
        await runPlan({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'handoff': {
        const { runHandoff } = await import('./handoff.mjs');
        await runHandoff({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'healthcheck': {
        const { runHealthcheck } = await import('./healthcheck.mjs');
        await runHealthcheck({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'cost': {
        const { runCost } = await import('./cost-tracker.mjs');
        await runCost({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'doctor': {
        const { runDoctor } = await import('./doctor.mjs');
        const result = await runDoctor({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: PROJECT_ROOT,
          flags,
        });
        if (!result.ok) process.exit(1);
        break;
      }
      case 'harness': {
        const { runHarness } = await import('./harness-contract.mjs');
        const result = await runHarness({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: PROJECT_ROOT,
          flags,
        });
        if (!result.ok) process.exit(1);
        break;
      }
      case 'import-issues': {
        const { runImportIssues } = await import('./import-issues.mjs');
        await runImportIssues({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: PROJECT_ROOT,
          flags,
        });
        break;
      }
      case 'backlog': {
        const { runBacklogViewer } = await import('./backlog-viewer.mjs');
        await runBacklogViewer({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: PROJECT_ROOT,
          flags,
        });
        break;
      }
      case 'sync-backlog': {
        const { runSyncBacklog } = await import('./sync-backlog-runner.mjs');
        await runSyncBacklog({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: PROJECT_ROOT,
          flags,
        });
        break;
      }
      case 'tasks': {
        const { runTasks } = await import('./task-cli.mjs');
        await runTasks({ projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'delegate': {
        const { runDelegate } = await import('./task-cli.mjs');
        await runDelegate({ projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'run': {
        const { runRun } = await import('./run-cli.mjs');
        await runRun({ projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'add': {
        const { runAdd } = await import('./tool-manager.mjs');
        await runAdd({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'remove': {
        const { runRemove } = await import('./tool-manager.mjs');
        await runRemove({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'list': {
        const { runList } = await import('./tool-manager.mjs');
        await runList({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      case 'features': {
        // Sub-actions: list (default), enable, disable, preset
        const subAction = (flags._args || [])[0];
        if (subAction === 'enable') {
          flags._args = flags._args.slice(1);
          const { runFeatureEnable } = await import('./feature-manager.mjs');
          await runFeatureEnable({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        } else if (subAction === 'disable') {
          flags._args = flags._args.slice(1);
          const { runFeatureDisable } = await import('./feature-manager.mjs');
          await runFeatureDisable({
            agentkitRoot: AGENTKIT_ROOT,
            projectRoot: PROJECT_ROOT,
            flags,
          });
        } else if (subAction === 'preset') {
          flags._args = flags._args.slice(1);
          const { runFeaturePreset } = await import('./feature-manager.mjs');
          await runFeaturePreset({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        } else {
          const { runFeatures } = await import('./feature-manager.mjs');
          await runFeatures({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        }
        break;
      }
      case 'analyze-agents': {
        const { loadFullAgentGraph, renderAllMatrices, renderMatrix, renderAllAsJson } =
          await import('./agent-analysis.mjs');
        const graph = loadFullAgentGraph(AGENTKIT_ROOT);
        const matrixArg = flags.matrix || 'all';
        const formatArg = flags.format || 'markdown';
        const outputPath = flags.output
          ? resolve(PROJECT_ROOT, flags.output)
          : resolve(PROJECT_ROOT, 'docs', 'agents', 'agent-team-matrix.md');

        let content;
        if (formatArg === 'json') {
          content = JSON.stringify(renderAllAsJson(graph), null, 2);
        } else {
          content = renderMatrix(graph, matrixArg);
        }

        const { mkdirSync, writeFileSync } = await import('fs');
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, content, 'utf-8');
        console.log(`[retort:analyze-agents] Matrix written to ${outputPath}`);
        console.log(
          `  ${graph.agents.length} agents, ${graph.teams.length} teams, ${graph.categories.length} categories`
        );
        break;
      }
      case 'worktree': {
        const { runWorktree } = await import('./worktree.mjs');
        await runWorktree({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT, flags });
        break;
      }
      default: {
        if (SLASH_ONLY_COMMANDS.includes(command)) {
          const cmdFile = resolve(PROJECT_ROOT, '.claude', 'commands', `${command}.md`);
          console.log(`[retort:${command}] Slash command: /${command}`);
          console.log();
          console.log(`This is an AI agent slash command. Use it within your AI tool:`);
          console.log(`  Claude Code:  /${command}`);
          console.log(`  Cursor:       @${command}`);
          console.log();
          if (existsSync(cmdFile)) {
            console.log(`Command definition: .claude/commands/${command}.md`);
          } else {
            console.log('Run "retort sync" first to generate command files.');
          }
          break;
        }
      }
    }
  } catch (err) {
    console.error(`[retort:${command}] Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    } else {
      console.error('  (set DEBUG=1 for full stack trace)');
    }
    process.exit(1);
  }
}

main();
