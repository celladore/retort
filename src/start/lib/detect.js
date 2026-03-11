/**
 * Context detection module.
 *
 * Gathers the same signals as the /start command's Phase 1
 * (silent context detection) and returns a structured object
 * that the UI components use to decide what to render.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * @typedef {'brand-new' | 'discovered' | 'mid-session' | 'uncommitted'} FlowType
 *
 * @typedef {Object} RepoContext
 * @property {boolean}       forgeInitialised  .agentkit/ directory exists
 * @property {boolean}       syncRun           .claude/commands/orchestrate.md exists
 * @property {boolean}       discoveryDone     AGENT_TEAMS.md exists at repo root
 * @property {boolean}       hasOrchestratorState  orchestrator.json exists
 * @property {number|null}   orchestratorPhase current phase (1-5) or null
 * @property {string|null}   phaseName         human-readable phase name
 * @property {boolean}       hasBacklog        AGENT_BACKLOG.md has items
 * @property {number}        backlogCount      rough count of backlog items
 * @property {number}        activeTaskCount   number of task JSON files
 * @property {string}        branch            current git branch
 * @property {boolean}       isClean           working tree is clean
 * @property {number}        uncommittedCount  number of uncommitted changes
 * @property {boolean}       lockHeld          orchestrator lock exists
 * @property {FlowType}      flow              which UI flow to show
 * @property {Array<Object>} teams             parsed team definitions
 */

const PHASE_NAMES = {
  1: 'Discovery',
  2: 'Planning',
  3: 'Implementation',
  4: 'Validation',
  5: 'Ship',
};

/**
 * Run a shell command and return trimmed stdout, or fallback on error.
 */
function run(cmd, fallback = '') {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return fallback;
  }
}

/**
 * Count non-empty, non-header lines in AGENT_BACKLOG.md that look like items.
 */
function countBacklogItems(root) {
  const backlogPath = join(root, 'AGENT_BACKLOG.md');
  if (!existsSync(backlogPath)) return 0;
  const content = readFileSync(backlogPath, 'utf8');
  // Count table rows (lines starting with |) that aren't header separators
  const rows = content.split('\n').filter(
    (line) => line.startsWith('|') && !line.match(/^\|\s*-/) && !line.match(/^\|\s*#/)
  );
  // Subtract header row
  return Math.max(0, rows.length - 1);
}

/**
 * Parse teams from AGENT_TEAMS.md or fall back to scanning team-* commands.
 */
function parseTeams(root) {
  const teamsPath = join(root, 'AGENT_TEAMS.md');
  const teams = [];

  if (existsSync(teamsPath)) {
    const content = readFileSync(teamsPath, 'utf8');
    // Table format: | Name | id | focus | scope | accepts | handoff | Status | Lead |
    // Skip header rows and separator rows
    const lines = content.split('\n').filter(
      (l) =>
        l.startsWith('|') &&
        !l.match(/^\|\s*-/) &&
        !l.match(/^\|\s*(Team|Name)/i)
    );
    for (const line of lines) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        const id = cells[1] || cells[0].toLowerCase().replace(/\s+/g, '-');
        teams.push({
          id,
          name: cells[0],
          focus: cells[2] || '',
          command: `/team-${id}`,
        });
      }
    }
  }

  // Fallback: scan for team-* command files
  if (teams.length === 0) {
    const cmdDir = join(root, '.claude', 'commands');
    if (existsSync(cmdDir)) {
      const files = readdirSync(cmdDir).filter((f) => f.startsWith('team-') && f.endsWith('.md'));
      for (const f of files) {
        const id = f.replace('team-', '').replace('.md', '');
        teams.push({
          id,
          name: id.toUpperCase(),
          focus: '',
          command: `/team-${id}`,
        });
      }
    }
  }

  return teams;
}

/**
 * Detect repository context. This is the equivalent of /start Phase 1.
 *
 * @param {string} [root=process.cwd()] - Repository root path
 * @returns {RepoContext}
 */
export function detect(root = process.cwd()) {
  const forgeInitialised = existsSync(join(root, '.agentkit'));
  const syncRun = existsSync(join(root, '.claude', 'commands', 'orchestrate.md'));
  const discoveryDone = existsSync(join(root, 'AGENT_TEAMS.md'));

  // Orchestrator state
  const orchPath = join(root, '.claude', 'state', 'orchestrator.json');
  const hasOrchestratorState = existsSync(orchPath);
  let orchestratorPhase = null;
  if (hasOrchestratorState) {
    try {
      const state = JSON.parse(readFileSync(orchPath, 'utf8'));
      orchestratorPhase = state.currentPhase ?? null;
    } catch {
      // Malformed JSON — treat as no state
    }
  }
  const phaseName = orchestratorPhase ? PHASE_NAMES[orchestratorPhase] ?? null : null;

  // Backlog
  const backlogCount = countBacklogItems(root);
  const hasBacklog = backlogCount > 0;

  // Active tasks
  const tasksDir = join(root, '.claude', 'state', 'tasks');
  let activeTaskCount = 0;
  if (existsSync(tasksDir)) {
    activeTaskCount = readdirSync(tasksDir).filter((f) => f.endsWith('.json')).length;
  }

  // Git state — use -C to target the correct repo when root !== cwd
  const branch = run(`git -C "${root}" branch --show-current`, 'unknown');
  const status = run(`git -C "${root}" status --porcelain`);
  const uncommittedCount = status ? status.split('\n').filter(Boolean).length : 0;
  const isClean = uncommittedCount === 0;

  // Lock
  const lockHeld = existsSync(join(root, '.claude', 'state', 'orchestrator.lock'));

  // Teams
  const teams = parseTeams(root);

  // Determine flow
  let flow = 'brand-new';
  if (uncommittedCount > 0) {
    flow = 'uncommitted';
  } else if (hasOrchestratorState && orchestratorPhase) {
    flow = 'mid-session';
  } else if (discoveryDone) {
    flow = 'discovered';
  }

  return {
    forgeInitialised,
    syncRun,
    discoveryDone,
    hasOrchestratorState,
    orchestratorPhase,
    phaseName,
    hasBacklog,
    backlogCount,
    activeTaskCount,
    branch,
    isClean,
    uncommittedCount,
    lockHeld,
    flow,
    teams,
  };
}
