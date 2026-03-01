#!/usr/bin/env node
/**
 * AgentKit Forge CLI Router
 * Routes subcommands to their handlers.
 */
import { parseArgs } from 'node:util';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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

const VALID_COMMANDS = [
  'init',
  'sync',
  'validate',
  'discover',
  'spec-validate',
  'orchestrate',
  'plan',
  'check',
  'review',
  'handoff',
  'healthcheck',
  'cost',
  'project-review',
  'add',
  'remove',
  'list',
  'tasks',
  'delegate',
  'doctor',
  'scaffold',
  'preflight',
];

// Workflow commands with runtime handlers
const WORKFLOW_COMMANDS = ['orchestrate', 'plan', 'check', 'review', 'handoff', 'healthcheck'];

// Commands that are slash-command-only (no CLI handler)
const SLASH_ONLY_COMMANDS = ['project-review', 'scaffold', 'preflight'];

const VALID_FLAGS = {
  init: ['repoName', 'force', 'non-interactive', 'ci', 'preset', 'help'],
  sync: [
    'overlay',
    'only',
    'dry-run',
    'overwrite',
    'force',
    'quiet',
    'verbose',
    'no-clean',
    'diff',
    'help',
  ],
  validate: ['help'],
  discover: ['output', 'depth', 'include-deps', 'help'],
  'spec-validate': ['help'],
  orchestrate: [
    'assess-only',
    'scope',
    'dry-run',
    'team',
    'phase',
    'status',
    'force-unlock',
    'help',
  ],
  plan: ['issue', 'output', 'depth', 'help'],
  check: ['fix', 'fast', 'stack', 'bail', 'help'],
  review: ['pr', 'range', 'file', 'focus', 'severity', 'help'],
  handoff: ['format', 'include-diff', 'tag', 'save', 'help'],
  healthcheck: ['stack', 'fix', 'verbose', 'help'],
  cost: ['summary', 'sessions', 'report', 'month', 'format', 'last', 'help'],
  tasks: ['status', 'assignee', 'type', 'priority', 'id', 'process-handoffs', 'help'],
  delegate: [
    'to',
    'title',
    'description',
    'type',
    'priority',
    'depends-on',
    'handoff-to',
    'scope',
    'help',
  ],
  doctor: ['verbose', 'help'],
  scaffold: ['type', 'name', 'stack', 'path', 'help'],
  preflight: ['stack', 'range', 'base', 'strict', 'help'],
  'project-review': ['scope', 'focus', 'phase', 'help'],
  add: ['help'],
  remove: ['clean', 'help'],
  list: ['help'],
};

// Global flags that apply to all commands
const GLOBAL_FLAGS = ['help', 'quiet', 'verbose'];

// Explicit flag types to ensure correct parsing via node:util parseArgs
const FLAG_TYPES = {
  // Global
  help: 'boolean',
  quiet: 'boolean',
  verbose: 'boolean',

  // Strings
  repoName: 'string',
  preset: 'string',
  only: 'string', // comma-separated
  output: 'string',
  depth: 'string',
  scope: 'string',
  team: 'string',
  phase: 'string',
  issue: 'string',
  pr: 'string',
  range: 'string',
  file: 'string',
  focus: 'string',
  severity: 'string',
  format: 'string',
  tag: 'string',
  month: 'string',
  last: 'string',
  assignee: 'string',
  type: 'string',
  priority: 'string',
  id: 'string',
  to: 'string',
  title: 'string',
  description: 'string',
  'depends-on': 'string',
  'handoff-to': 'string',
  name: 'string',
  stack: 'string',
  path: 'string',
  base: 'string',
  overlay: 'string',

  // Booleans
  force: 'boolean',
  'non-interactive': 'boolean',
  ci: 'boolean',
  'dry-run': 'boolean',
  overwrite: 'boolean',
  'no-clean': 'boolean',
  diff: 'boolean',
  'include-deps': 'boolean',
  'assess-only': 'boolean',
  'force-unlock': 'boolean',
  fix: 'boolean',
  fast: 'boolean',
  bail: 'boolean',
  'include-diff': 'boolean',
  save: 'boolean',
  summary: 'boolean',
  sessions: 'boolean',
  report: 'boolean',
  'process-handoffs': 'boolean',
  clean: 'boolean',
  strict: 'boolean',
};

const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

function parseFlags(command, args) {
  // Scope options to flags valid for this command plus global flags
  const commandFlags = VALID_FLAGS[command] ?? [];
  const allFlags = new Set([...GLOBAL_FLAGS, ...commandFlags]);

  const options = {};
  for (const flagName of allFlags) {
    // --status is handled separately with a command-specific type
    if (flagName === 'status') continue;
    const type = FLAG_TYPES[flagName];
    if (!type) {
      throw new Error(
        `Internal CLI configuration error: flag "--${flagName}" is listed as valid for ` +
        `command "${command}" but has no entry in FLAG_TYPES.`
      );
    }
    options[flagName] = { type };
    if (flagName === 'quiet') options[flagName].short = 'q';
    if (flagName === 'verbose') options[flagName].short = 'v';
  }

  // Only add --status for commands that support it, with the correct type:
  // orchestrate: boolean flag, tasks: string value
  if (commandFlags.includes('status')) {
    options.status = { type: command === 'orchestrate' ? 'boolean' : 'string' };
  }

  try {
    const { values, positionals } = parseArgs({
      args,
      options,
      strict: false, // allow unknown flags/positionals
      allowPositionals: true
    });

    // With strict: false, parseArgs returns boolean true for a known string option
    // that is passed without a value (e.g. --status with no argument). Enforce that
    // all known string options received an actual string value.
    for (const [flagName, flagOpt] of Object.entries(options)) {
      if (flagOpt.type === 'string' && Object.hasOwn(values, flagName) && typeof values[flagName] !== 'string') {
        throw new TypeError(`Option '--${flagName} <value>' argument missing`);
      }
    }

    // With strict: false, unknown flag tokens end up in positionals instead of values.
    // Filter them out, warn the user, and exclude them from the positional args.
    // For flags without an inline value (e.g. --foo bar), also skip the next token
    // so bare values don't end up as positional arguments.
    const unknownFlags = [];
    const filteredPositionals = [];
    for (let i = 0; i < positionals.length; i++) {
      const token = positionals[i];
      if (typeof token === 'string' && token.length >= 2 && token.startsWith('-')) {
        unknownFlags.push(token);
        console.warn(`[agentkit:${command}] Warning: unrecognised flag ${token} (ignored)`);
        // Skip the next token if it looks like a value (not a flag) for flags
        // that don't embed their value inline (e.g. --foo bar, but not --foo=bar).
        if (
          !token.includes('=') &&
          i + 1 < positionals.length &&
          !positionals[i + 1].startsWith('-')
        ) {
          i++;
        }
      } else {
        filteredPositionals.push(token);
      }
    }

    return { ...values, _args: filteredPositionals };
  } catch (err) {
    console.error(`Error parsing arguments: ${err.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
AgentKit Forge v${VERSION}

Usage: node cli.mjs <command> [options]

Commands:
  init            Initialize repo overlay from template
                  --non-interactive   Skip prompts, use auto-detected defaults
                  --preset <name>     Use preset: minimal, full, team
                  --ci                Alias for --non-interactive
  sync            Render all AI tool configs from spec + overlay
                  --only <targets>    Sync only specific targets (comma-separated)
                  --overwrite         Overwrite project-owned files (docs/, .vscode/, etc.)
                  --force             Alias for --overwrite
                  -q, --quiet         Reduce output (errors only)
                  -v, --verbose       List each file written
                  --no-clean          Don't delete orphaned files from previous sync
                  --diff              Show what would change without writing
  validate        Validate generated outputs
  discover        Scan repo to detect tech stacks and structure
  spec-validate   Validate YAML spec files for schema correctness

Tool Management:
  add <tool...>   Add AI tool(s) to render targets and sync
  remove <tool...> Remove AI tool(s) from render targets
                  --clean             Also delete generated files
  list            Show enabled and available AI tools

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
  doctor          Run AgentKit diagnostics and setup checks
                  --verbose         Include detailed diagnostics

Utility Commands:
  cost            Session cost and usage tracking

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
  const jsYamlPath = resolve(agentkitRoot, 'node_modules', 'js-yaml', 'package.json');
  if (existsSync(jsYamlPath)) {
    return true;
  }
  const pkgPath = resolve(agentkitRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return true;
  }
  const hasPnpm =
    spawnSync('pnpm', ['--version'], { encoding: 'utf8', windowsHide: true }).status === 0;
  const installCmd = hasPnpm ? 'pnpm' : 'npm';
  const installArgs = hasPnpm ? ['install'] : ['install'];
  console.warn(
    `[agentkit] Dependencies not installed. Running ${installCmd} install in .agentkit...`
  );
  const r = spawnSync(installCmd, installArgs, {
    cwd: agentkitRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (r.status !== 0) {
    console.error(
      `[agentkit] Failed to install dependencies. Run manually: ${installCmd} -C .agentkit install`
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

  const flags = parseFlags(command, commandArgs);

  // Show command-specific help
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  // Warn on unrecognised flags
  const validForCommand = [...(VALID_FLAGS[command] || []), ...GLOBAL_FLAGS];
  for (const key of Object.keys(flags)) {
    if (key === '_args') continue;
    if (!validForCommand.includes(key)) {
      console.warn(`[agentkit:${command}] Warning: unrecognised flag --${key} (ignored)`);
    }
  }

  if (!ensureDependencies(AGENTKIT_ROOT)) {
    process.exit(1);
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
      default: {
        if (SLASH_ONLY_COMMANDS.includes(command)) {
          const cmdFile = resolve(PROJECT_ROOT, '.claude', 'commands', `${command}.md`);
          console.log(`[agentkit:${command}] Slash command: /${command}`);
          console.log();
          console.log(`This is an AI agent slash command. Use it within your AI tool:`);
          console.log(`  Claude Code:  /${command}`);
          console.log(`  Cursor:       @${command}`);
          console.log();
          if (existsSync(cmdFile)) {
            console.log(`Command definition: .claude/commands/${command}.md`);
          } else {
            console.log('Run "agentkit sync" first to generate command files.');
          }
          break;
        }
      }
    }
  } catch (err) {
    console.error(`[agentkit:${command}] Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    } else {
      console.error('  (set DEBUG=1 for full stack trace)');
    }
    process.exit(1);
  }
}

main();
