/**
 * Retort — CLI Flag Configuration
 *
 * The flag tables and the option-table builder used by cli.mjs `parseFlags`.
 *
 * These live in their own module because cli.mjs calls `main()` at import time
 * and terminates via `process.exit`, so it cannot be imported by a test. Keeping
 * the flag configuration here makes it directly assertable in-process — see
 * ADR-12 for why removing CLI subprocess spawns from the test suite matters.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/** Flags for CLI-internal commands not defined in commands.yaml. */
export const CLI_INTERNAL_FLAGS = {
  init: [
    'repoName',
    'force',
    'non-interactive',
    'ci',
    'preset',
    'external-knowledge',
    'external-mode',
    'windsurf-guides-path',
    'mystira-docs-path',
    'external-markdown-files',
    'external-git-repos',
    'external-target-platforms',
    'config-only',
    'skip-retortconfig',
    'write-retortconfig',
    'help',
  ],
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
    'yes',
    'no-prompt',
    'help',
  ],
  validate: ['auto-task', 'help'],
  'spec-validate': ['help'],
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
  add: ['help'],
  remove: ['clean', 'help'],
  list: ['help'],
  features: ['verbose', 'help'],
  'analyze-agents': ['output', 'matrix', 'format', 'help'],
  worktree: ['base', 'no-setup', 'dry-run', 'help'],
  run: ['id', 'assignee', 'dry-run', 'json', 'help'],
  harness: ['document', 'output', 'dry-run', 'diff', 'json', 'help'],
};

export const CLI_INTERNAL_FLAG_TYPES = {
  // init flags
  repoName: 'string',
  preset: 'string',
  'external-mode': 'string',
  'windsurf-guides-path': 'string',
  'mystira-docs-path': 'string',
  'external-markdown-files': 'string',
  'external-git-repos': 'string',
  'external-target-platforms': 'string',
  'non-interactive': 'boolean',
  ci: 'boolean',
  'external-knowledge': 'boolean',
  'config-only': 'boolean',
  'skip-retortconfig': 'boolean',
  'write-retortconfig': 'boolean',
  // sync flags
  overlay: 'string',
  only: 'string',
  overwrite: 'boolean',
  force: 'boolean',
  'dry-run': 'boolean',
  'no-clean': 'boolean',
  diff: 'boolean',
  yes: 'boolean',
  'no-prompt': 'boolean',
  // validate flags
  'auto-task': 'boolean',
  // tasks flags
  assignee: 'string',
  id: 'string',
  'process-handoffs': 'boolean',
  // delegate flags
  to: 'string',
  title: 'string',
  description: 'string',
  type: 'string',
  priority: 'string',
  scope: 'string',
  'depends-on': 'string',
  'handoff-to': 'string',
  // remove flags
  clean: 'boolean',
  // analyze-agents flags
  output: 'string',
  matrix: 'string',
  format: 'string',
  // worktree flags
  base: 'string',
  'no-setup': 'boolean',
  json: 'boolean',
  document: 'string',
};

/** Global flags that apply to all commands. */
export const GLOBAL_FLAGS = ['help', 'quiet', 'verbose'];

/**
 * Flags handled inline in parseFlags rather than via FLAG_TYPES.
 * `--status` is typed per-command (boolean for orchestrate, string for tasks).
 */
export const SPECIAL_CASED_FLAGS = new Set(['status']);

/** The flag-type table before commands.yaml is merged in. */
export function baseFlagTypes() {
  return {
    help: 'boolean',
    quiet: 'boolean',
    verbose: 'boolean',
    ...CLI_INTERNAL_FLAG_TYPES,
  };
}

/**
 * Load command flag definitions from commands.yaml.
 * @param {string} agentkitRoot
 * @returns {Promise<{ validFlags: Record<string, string[]>, flagTypes: Record<string, string> }>}
 */
export async function loadCommandFlags(agentkitRoot) {
  const validFlags = { ...CLI_INTERNAL_FLAGS };
  const flagTypes = baseFlagTypes();

  const specPath = resolve(agentkitRoot, 'spec', 'commands.yaml');
  if (!existsSync(specPath)) return { validFlags, flagTypes };

  try {
    // Imported lazily: cli.mjs only reaches this after ensureDependencies(),
    // because js-yaml may not be installed on a fresh checkout.
    const yaml = (await import('js-yaml')).default;
    const raw = readFileSync(specPath, 'utf-8');
    const spec = yaml.load(raw);
    if (!spec?.commands || !Array.isArray(spec.commands)) return { validFlags, flagTypes };

    for (const cmd of spec.commands) {
      if (!cmd.name || !Array.isArray(cmd.flags)) continue;
      const names = [];
      for (const flag of cmd.flags) {
        const name = (flag.name || '').replace(/^--/, '');
        if (!name) continue;
        names.push(name);
        const yamlType = (flag.type || 'string').toLowerCase();
        const parseType = yamlType === 'boolean' ? 'boolean' : 'string';
        if (!flagTypes[name]) flagTypes[name] = parseType;
      }
      if (!names.includes('help')) names.push('help');
      const existing = validFlags[cmd.name] ?? [];
      validFlags[cmd.name] = [...new Set([...existing, ...names])];
    }
  } catch {
    // If YAML parsing fails, fall back to whatever we have
  }

  // Self-validation: ensure every flag in validFlags has a type in flagTypes.
  for (const [cmd, flags] of Object.entries(validFlags)) {
    for (const flag of flags) {
      if (!flagTypes[flag] && !SPECIAL_CASED_FLAGS.has(flag)) {
        console.warn(
          `[retort] Warning: flag "--${flag}" is listed for command "${cmd}" ` +
            `but has no type definition. Add it to CLI_INTERNAL_FLAG_TYPES or commands.yaml.`
        );
      }
    }
  }

  return { validFlags, flagTypes };
}

/**
 * Build the parseArgs `options` table for a command.
 *
 * Throws when a flag is listed as valid for the command but has no type entry —
 * the "internal CLI configuration error" that makes the command unusable.
 *
 * @param {string} command
 * @param {Record<string, string[]>} validFlags
 * @param {Record<string, string>} flagTypes
 * @returns {Record<string, { type: string, short?: string }>}
 */
export function buildParseOptions(command, validFlags, flagTypes) {
  // Scope options to flags valid for this command plus global flags
  const commandFlags = validFlags[command] ?? [];
  const allFlags = new Set([...GLOBAL_FLAGS, ...commandFlags]);

  const options = {};
  for (const flagName of allFlags) {
    // --status is handled separately with a command-specific type
    if (SPECIAL_CASED_FLAGS.has(flagName)) continue;
    const type = flagTypes[flagName];
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

  return options;
}
