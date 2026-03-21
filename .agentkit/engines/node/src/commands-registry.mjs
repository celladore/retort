/**
 * Retort — Command Registry
 * Single source of truth for CLI command names.
 * Imported by both cli.mjs (routing) and validate.mjs (parity check).
 */

/** All commands the CLI recognises. Keep in sync with commands.yaml. */
export const VALID_COMMANDS = [
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
  'import-issues',
  'backlog',
  'sync-backlog',
  'add',
  'remove',
  'list',
  'features',
  'tasks',
  'delegate',
  'doctor',
  'scaffold',
  'preflight',
  'analyze-agents',
  'cicd-optimize',
];

/**
 * CLI-only commands intentionally absent from the user-facing commands.yaml spec.
 * These are framework internals, not slash commands.
 */
export const FRAMEWORK_COMMANDS = new Set([
  'validate',
  'spec-validate',
  'add',
  'remove',
  'list',
  'tasks',
  'delegate',
  'features',
  'init',
]);
