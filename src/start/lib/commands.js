/**
 * Command registry for the palette.
 *
 * Each command has metadata so the palette can rank, filter,
 * and display contextually relevant suggestions.
 */

/**
 * @typedef {Object} Command
 * @property {string}   id        Slash command name (e.g. '/discover')
 * @property {string}   label     Short display name
 * @property {string}   desc      One-line description
 * @property {string}   category  'workflow' | 'team' | 'quality' | 'info'
 * @property {string[]} tags      Searchable keywords
 * @property {(ctx: import('./detect.js').RepoContext) => number} rank
 *   Returns 0-100 relevance score given current context. Higher = more relevant.
 */

/** @type {Command[]} */
export const COMMANDS = [
  // ── Workflow ──────────────────────────────────────────
  {
    id: '/discover',
    label: 'Discover',
    desc: 'Scan codebase, detect tech stacks & teams',
    category: 'workflow',
    tags: ['scan', 'explore', 'inventory', 'setup'],
    rank: (ctx) => (!ctx.discoveryDone ? 95 : 20),
  },
  {
    id: '/orchestrate',
    label: 'Orchestrate',
    desc: 'Full lifecycle — assess, plan, delegate, ship',
    category: 'workflow',
    tags: ['lifecycle', 'delegate', 'coordinate', 'master'],
    rank: (ctx) => (ctx.discoveryDone && !ctx.hasOrchestratorState ? 90 : ctx.hasOrchestratorState ? 85 : 40),
  },
  {
    id: '/plan',
    label: 'Plan',
    desc: 'Structured planning before implementation',
    category: 'workflow',
    tags: ['design', 'architecture', 'feature', 'bug'],
    rank: (ctx) => (ctx.discoveryDone ? 70 : 30),
  },

  // ── Quality ───────────────────────────────────────────
  {
    id: '/check',
    label: 'Check',
    desc: 'Run all quality gates (lint + test + build)',
    category: 'quality',
    tags: ['lint', 'test', 'build', 'quality', 'gate', 'ci'],
    rank: (ctx) => (ctx.isClean ? 40 : 60),
  },
  {
    id: '/review',
    label: 'Review',
    desc: 'Code review with quality gates',
    category: 'quality',
    tags: ['code review', 'pr', 'pull request'],
    rank: (ctx) => (!ctx.isClean ? 55 : 30),
  },
  {
    id: '/healthcheck',
    label: 'Healthcheck',
    desc: 'Verify build, lint, tests all pass',
    category: 'quality',
    tags: ['health', 'verify', 'status', 'build'],
    rank: (ctx) => (!ctx.discoveryDone ? 70 : 35),
  },
  {
    id: '/security',
    label: 'Security',
    desc: 'Security audit — deps, secrets, OWASP',
    category: 'quality',
    tags: ['security', 'audit', 'vulnerability', 'secrets'],
    rank: () => 25,
  },

  // ── Info ──────────────────────────────────────────────
  {
    id: '/project-status',
    label: 'Project Status',
    desc: 'PM dashboard — progress, risks, metrics',
    category: 'info',
    tags: ['status', 'dashboard', 'progress', 'pm'],
    rank: (ctx) => (ctx.hasOrchestratorState ? 65 : 30),
  },
  {
    id: '/project-review',
    label: 'Project Review',
    desc: 'Comprehensive production-grade audit',
    category: 'info',
    tags: ['audit', 'assessment', 'production'],
    rank: (ctx) => (ctx.discoveryDone ? 45 : 20),
  },
  {
    id: '/backlog',
    label: 'Backlog',
    desc: 'View consolidated work items',
    category: 'info',
    tags: ['backlog', 'tasks', 'work', 'items', 'todo'],
    rank: (ctx) => (ctx.hasBacklog ? 60 : 20),
  },
  {
    id: '/cost',
    label: 'Cost',
    desc: 'Session cost and usage tracking',
    category: 'info',
    tags: ['cost', 'usage', 'tokens', 'spending'],
    rank: () => 15,
  },
];

/**
 * Build the full command list including dynamic team commands.
 *
 * @param {import('./detect.js').RepoContext} ctx
 * @returns {Command[]}
 */
export function getAllCommands(ctx) {
  // Exclude meta-teams that coordinate other teams rather than doing direct work
  const teamCommands = ctx.teams
    .filter((t) => !['forge', 'strategic-ops'].includes(t.id))
    .map((t) => ({
      id: `/team-${t.id}`,
      label: t.name,
      desc: t.focus || `${t.name} team`,
      category: 'team',
      tags: [t.id, t.name.toLowerCase(), t.focus.toLowerCase()],
      rank: () => 50,
    }));

  return [...COMMANDS, ...teamCommands];
}

/**
 * Rank and sort commands by contextual relevance.
 *
 * @param {Command[]} commands
 * @param {import('./detect.js').RepoContext} ctx
 * @returns {Command[]}
 */
export function rankCommands(commands, ctx) {
  return commands
    .map((cmd) => ({ ...cmd, score: cmd.rank(ctx) }))
    .sort((a, b) => b.score - a.score);
}
