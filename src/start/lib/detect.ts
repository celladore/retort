/**
 * Context detection module.
 *
 * Gathers the same signals as the /start command's Phase 1
 * (silent context detection) and returns a structured object
 * that the UI components use to decide what to render.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export type FlowType = 'brand-new' | 'discovered' | 'mid-session' | 'uncommitted';

export interface TeamInfo {
  id: string;
  name: string;
  focus: string;
  command: string;
}

export interface RepoContext {
  forgeInitialised: boolean;
  syncRun: boolean;
  discoveryDone: boolean;
  hasOrchestratorState: boolean;
  orchestratorPhase: number | null;
  phaseName: string | null;
  hasBacklog: boolean;
  backlogCount: number;
  activeTaskCount: number;
  branch: string;
  isClean: boolean;
  uncommittedCount: number;
  lockHeld: boolean;
  flow: FlowType;
  teams: TeamInfo[];
}

const PHASE_NAMES: Record<number, string> = {
  1: 'Discovery',
  2: 'Planning',
  3: 'Implementation',
  4: 'Validation',
  5: 'Ship',
};

/**
 * Run a git command safely using execFileSync (no shell interpolation).
 */
function runGit(args: string[], cwd: string, fallback = ''): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return fallback;
  }
}

/**
 * Count non-empty, non-header lines in AGENT_BACKLOG.md that look like items.
 */
function countBacklogItems(root: string): number {
  const backlogPath = join(root, 'AGENT_BACKLOG.md');
  if (!existsSync(backlogPath)) return 0;
  const content = readFileSync(backlogPath, 'utf8');
  const completedPattern = /\b(done|completed|closed)\b/i;
  const rows = content
    .split('\n')
    .filter(
      (line) =>
        line.startsWith('|') &&
        !line.match(/^\|\s*-/) &&
        !line.match(/^\|\s*#/) &&
        !completedPattern.test(line)
    );
  return Math.max(0, rows.length - 1);
}

/**
 * Parse teams from AGENT_TEAMS.md or fall back to scanning team-* commands.
 */
function parseTeams(root: string): TeamInfo[] {
  const teamsPath = join(root, 'AGENT_TEAMS.md');
  const teams: TeamInfo[] = [];

  if (existsSync(teamsPath)) {
    const content = readFileSync(teamsPath, 'utf8');
    const tableRows = content
      .split('\n')
      .filter((l) => l.startsWith('|') && !l.match(/^\|\s*[-:]+\s*\|/));
    const lines = tableRows.slice(1);
    for (const line of lines) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
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
 */
export function detect(root = process.cwd()): RepoContext {
  const forgeInitialised = existsSync(join(root, '.agentkit'));
  const syncRun = existsSync(join(root, '.claude', 'commands', 'orchestrate.md'));
  const discoveryDone = existsSync(join(root, 'AGENT_TEAMS.md'));

  const orchPath = join(root, '.claude', 'state', 'orchestrator.json');
  const hasOrchestratorState = existsSync(orchPath);
  let orchestratorPhase: number | null = null;
  if (hasOrchestratorState) {
    try {
      const state = JSON.parse(readFileSync(orchPath, 'utf8')) as { currentPhase?: unknown };
      const raw = state.currentPhase;
      orchestratorPhase = typeof raw === 'number' && raw >= 1 && raw <= 5 ? raw : null;
    } catch {
      // Malformed JSON — treat as no state
    }
  }
  const phaseName = orchestratorPhase ? (PHASE_NAMES[orchestratorPhase] ?? null) : null;

  const backlogCount = countBacklogItems(root);
  const hasBacklog = backlogCount > 0;

  const tasksDir = join(root, '.claude', 'state', 'tasks');
  let activeTaskCount = 0;
  if (existsSync(tasksDir)) {
    activeTaskCount = readdirSync(tasksDir).filter((f) => f.endsWith('.json')).length;
  }

  const branch = runGit(['branch', '--show-current'], root, 'unknown');
  const status = runGit(['status', '--porcelain'], root);
  const uncommittedCount = status ? status.split('\n').filter(Boolean).length : 0;
  const isClean = uncommittedCount === 0;

  const lockHeld = existsSync(join(root, '.claude', 'state', 'orchestrator.lock'));

  const teams = parseTeams(root);

  let flow: FlowType = 'brand-new';
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
