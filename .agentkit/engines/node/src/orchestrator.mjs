/**
 * AgentKit Forge — Runtime Orchestration Engine
 * State machine for the 5-phase lifecycle: Discovery → Planning → Implementation → Validation → Ship.
 * Manages orchestrator state, event logging, and session locking.
 */
import { execFileSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';
import { emitEvent, readEvents as readEventsFiltered } from './event-emitter.mjs';
import { formatTimestamp } from './runner.mjs';
import {
  checkDependencies,
  createTask,
  formatTaskList,
  listTasks,
  processHandoffs,
  TERMINAL_STATES,
} from './task-protocol.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASES = {
  1: 'Discovery',
  2: 'Planning',
  3: 'Implementation',
  4: 'Validation',
  5: 'Ship',
};

const DEFAULT_TEAM_IDS = [
  'team-backend',
  'team-frontend',
  'team-data',
  'team-infra',
  'team-devops',
  'team-testing',
  'team-security',
  'team-docs',
  'team-product',
  'team-quality',
];

// Overridable via loadTeamIdsFromSpec(). Starts with defaults; initialized on first use.
let VALID_TEAM_IDS = [...DEFAULT_TEAM_IDS];
let _teamIdsInitialized = false;

const VALID_TEAM_STATUSES = ['idle', 'in_progress', 'blocked', 'done'];
const LOCK_STALE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Load team IDs from teams.yaml spec file.
 * Falls back to the hardcoded defaults if the file doesn't exist or is invalid.
 * @param {string} agentkitRoot
 * @returns {string[]}
 */
export function loadTeamIdsFromSpec(agentkitRoot) {
  try {
    const teamsPath = resolve(agentkitRoot, 'spec', 'teams.yaml');
    if (existsSync(teamsPath)) {
      const spec = yaml.load(readFileSync(teamsPath, 'utf-8'));
      if (spec.teams && Array.isArray(spec.teams)) {
        const ids = spec.teams.map((t) => t.id).filter(Boolean);
        if (ids.length > 0) {
          VALID_TEAM_IDS = ids;
          _teamIdsInitialized = true;
          return ids;
        }
      }
    }
  } catch (err) {
    console.warn(
      `[agentkit:orchestrate] Could not load teams from spec: ${err?.message ?? String(err)}`
    );
  }
  VALID_TEAM_IDS = [...DEFAULT_TEAM_IDS];
  _teamIdsInitialized = true;
  return DEFAULT_TEAM_IDS;
}

/**
 * Ensure team IDs are loaded from spec. Idempotent — only loads once.
 * Call this from any function that uses VALID_TEAM_IDS to ensure spec
 * teams are loaded even if runOrchestrate hasn't been called yet.
 * @param {string} agentkitRoot
 */
export function ensureTeamIds(agentkitRoot) {
  if (!_teamIdsInitialized) {
    loadTeamIdsFromSpec(agentkitRoot);
  }
}

/**
 * Default area→team routing map. Used when teams.yaml intake.routing is unavailable.
 * Matches the canonical issue template area values.
 */
const DEFAULT_AREA_ROUTING = {
  backend: 'team-backend',
  frontend: 'team-frontend',
  data: 'team-data',
  infra: 'team-infra',
  devops: 'team-devops',
  testing: 'team-testing',
  security: 'team-security',
  docs: 'team-docs',
  product: 'team-product',
  quality: 'team-quality',
  cli: 'team-backend',
  'sync-engine': 'team-devops',
};

/**
 * Cache for parsed teams.yaml to avoid re-reading on every call.
 * Keyed by resolved agentkitRoot path. Invalidated by process lifetime.
 */
const _teamsSpecCache = new Map();

/**
 * Load and cache teams.yaml spec from disk.
 * @param {string} [agentkitRoot] - Path to .agentkit directory
 * @returns {object|null} Parsed teams.yaml or null if unavailable
 */
function loadTeamsSpec(agentkitRoot) {
  if (!agentkitRoot) return null;
  const key = resolve(agentkitRoot);
  if (_teamsSpecCache.has(key)) return _teamsSpecCache.get(key);
  try {
    const teamsPath = resolve(agentkitRoot, 'spec', 'teams.yaml');
    if (existsSync(teamsPath)) {
      const spec = yaml.load(readFileSync(teamsPath, 'utf-8'));
      _teamsSpecCache.set(key, spec);
      return spec;
    }
  } catch {
    /* fall through */
  }
  _teamsSpecCache.set(key, null);
  return null;
}

/**
 * Clear the cached teams spec (useful for testing).
 */
export function clearTeamsSpecCache() {
  _teamsSpecCache.clear();
}

/**
 * Resolve an issue area to the assigned team ID.
 * Reads intake.routing from teams.yaml if available, falls back to defaults.
 * @param {string} area - One of the canonical issue area values
 * @param {string} [agentkitRoot] - Path to .agentkit directory for reading teams.yaml
 * @returns {string} Team ID (e.g. 'team-backend')
 */
export function resolveTeamByArea(area, agentkitRoot) {
  const spec = loadTeamsSpec(agentkitRoot);
  const routing = spec?.intake?.routing;
  if (routing && routing[area]) {
    const team = routing[area];
    return team.startsWith('team-') ? team : `team-${team}`;
  }
  return DEFAULT_AREA_ROUTING[area] || 'team-quality';
}

/**
 * Compute escalation teams based on issue metadata.
 * Returns additional team IDs that should be cc'd/notified.
 * @param {object} params
 * @param {string} params.area - Issue area
 * @param {string} params.priority - Priority level (P0-P4)
 * @param {string} [params.severity] - Severity level (critical/high/medium/low)
 * @param {string} [params.impact] - Impact scope
 * @param {string} [agentkitRoot] - Path to .agentkit directory
 * @returns {string[]} Additional team IDs to escalate to
 */
export function computeEscalation({ area, priority, severity, impact }, agentkitRoot) {
  const escalateTeams = new Set();
  const spec = loadTeamsSpec(agentkitRoot);
  const esc = spec?.intake?.escalation;

  let securityTeams = ['team-security', 'team-devops'];
  let blockedTeams = ['team-product'];
  let opsTeam = 'team-quality';

  if (esc?.securityCritical) {
    securityTeams = esc.securityCritical.map((t) => (t.startsWith('team-') ? t : `team-${t}`));
  }
  if (esc?.blockedCrossTeam) {
    blockedTeams = esc.blockedCrossTeam.map((t) => (t.startsWith('team-') ? t : `team-${t}`));
  }
  const configOps = spec?.intake?.operationsTeam;
  if (configOps) {
    opsTeam = configOps.startsWith('team-') ? configOps : `team-${configOps}`;
  }

  // Rule 1: Critical severity in security-sensitive areas → security escalation
  if (severity === 'critical' && ['security', 'infra', 'backend'].includes(area)) {
    securityTeams.forEach((t) => escalateTeams.add(t));
  }

  // Rule 2: All-users impact + P0 priority → blocked escalation
  if (impact === 'all users' && priority === 'P0') {
    blockedTeams.forEach((t) => escalateTeams.add(t));
  }

  // Rule 3: Any P0 → notify operations team
  if (priority === 'P0') {
    escalateTeams.add(opsTeam);
  }

  return [...escalateTeams];
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function stateDir(projectRoot) {
  return resolve(projectRoot, '.agentkit', 'state');
}

function statePath(projectRoot) {
  return resolve(stateDir(projectRoot), 'orchestrator.json');
}

function eventsPath(projectRoot) {
  return resolve(stateDir(projectRoot), 'events.log');
}

function lockPath(projectRoot) {
  return resolve(stateDir(projectRoot), 'orchestrator.lock');
}

// ---------------------------------------------------------------------------
// State directory migration (.claude/state → .agentkit/state)
// ---------------------------------------------------------------------------

const _migrated = new Set();

/**
 * Migrate state from legacy `.claude/state/` to `.agentkit/state/` if needed.
 * Copies files to the new location and leaves the old directory intact for one
 * release (deprecation period). Only runs once per projectRoot per process.
 * @param {string} projectRoot
 */
function migrateStateDirIfNeeded(projectRoot) {
  if (_migrated.has(projectRoot)) return;
  _migrated.add(projectRoot);

  const oldDir = resolve(projectRoot, '.claude', 'state');
  const newDir = stateDir(projectRoot);

  if (!existsSync(oldDir) || existsSync(newDir)) return;

  try {
    // Recursively copy old → new
    cpSync(oldDir, newDir, { recursive: true });
    console.warn(
      '[agentkit] Migrated state from .claude/state/ to .agentkit/state/. ' +
        'The old directory is preserved for backward compatibility and can be removed in a future release.'
    );
  } catch (err) {
    console.warn(`[agentkit] State migration failed: ${err.message}. Falling back to new directory.`);
    mkdirSync(newDir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

/**
 * Create default orchestrator state.
 * @param {string} projectRoot
 * @returns {object}
 */
function createDefaultState(projectRoot) {
  let repoId = 'unknown';
  const markerPath = resolve(projectRoot, '.agentkit-repo');
  if (existsSync(markerPath)) {
    repoId = readFileSync(markerPath, 'utf-8').trim();
  }

  let branch = 'main';
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    /* fallback */
  }

  const teamProgress = {};
  for (const teamId of VALID_TEAM_IDS) {
    teamProgress[teamId] = { status: 'idle', notes: '' };
  }

  return {
    schema_version: '1.0.0',
    repo_id: repoId,
    branch,
    session_id: '',
    current_phase: 1,
    phase_name: 'Discovery',
    last_phase_completed: 0,
    next_action: 'Run /orchestrate to begin project assessment',
    team_progress: teamProgress,
    todo_items: [],
    recent_results: [],
    completed: false,
  };
}

/**
 * Load orchestrator state from disk. Creates default state if missing.
 * @param {string} projectRoot
 * @returns {object} state
 */
export function loadState(projectRoot) {
  migrateStateDirIfNeeded(projectRoot);
  const path = statePath(projectRoot);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch (err) {
      console.warn(`[agentkit:orchestrate] Corrupted state file, resetting: ${err.message}`);
    }
  }
  const state = createDefaultState(projectRoot);
  saveState(projectRoot, state);
  return state;
}

/**
 * Save orchestrator state to disk atomically.
 * @param {string} projectRoot
 * @param {object} state
 */
export function saveState(projectRoot, state) {
  const dir = stateDir(projectRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const path = statePath(projectRoot);
  const tmpPath = path + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  renameSync(tmpPath, path);
}

// ---------------------------------------------------------------------------
// Lock Management
// ---------------------------------------------------------------------------

/**
 * Acquire an exclusive session lock.
 * @param {string} projectRoot
 * @param {{ pid?: number, hostname?: string, sessionId?: string }} holder
 * @returns {{ acquired: boolean, existingLock?: object }}
 */
export function acquireLock(projectRoot, holder = {}) {
  const lPath = lockPath(projectRoot);
  const dir = stateDir(projectRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lockData = {
    pid: holder.pid || process.pid,
    hostname: holder.hostname || getHostname(),
    started_at: new Date().toISOString(),
    session_id: holder.sessionId || '',
  };

  try {
    // Atomic create — fails with EEXIST if lock file already exists
    writeFileSync(lPath, JSON.stringify(lockData, null, 2) + '\n', {
      encoding: 'utf-8',
      flag: 'wx',
    });
    return { acquired: true };
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    // Lock file exists — check staleness
    let existing;
    try {
      existing = JSON.parse(readFileSync(lPath, 'utf-8'));
    } catch {
      // Corrupted lock file — delete and retry
      try {
        unlinkSync(lPath);
      } catch {
        /* ignore */
      }
      try {
        writeFileSync(lPath, JSON.stringify(lockData, null, 2) + '\n', {
          encoding: 'utf-8',
          flag: 'wx',
        });
        return { acquired: true };
      } catch {
        return { acquired: false, existingLock: null };
      }
    }
    const age = Date.now() - new Date(existing.started_at).getTime();
    if (age < LOCK_STALE_MS) {
      return { acquired: false, existingLock: existing };
    }
    // Stale lock — remove and retry once
    try {
      unlinkSync(lPath);
    } catch (unlinkErr) {
      if (unlinkErr?.code !== 'ENOENT') {
        throw unlinkErr;
      }
    }
    try {
      writeFileSync(lPath, JSON.stringify(lockData, null, 2) + '\n', {
        encoding: 'utf-8',
        flag: 'wx',
      });
      return { acquired: true };
    } catch {
      // Another process acquired the lock — re-read current holder
      let currentLock = existing;
      try {
        currentLock = JSON.parse(readFileSync(lPath, 'utf-8'));
      } catch {
        /* use stale data as fallback */
      }
      return { acquired: false, existingLock: currentLock };
    }
  }
}

function getHostname() {
  try {
    return execFileSync('hostname', [], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Release the session lock.
 * @param {string} projectRoot
 * @returns {boolean} true if lock was released, false if no lock existed
 */
export function releaseLock(projectRoot) {
  const path = lockPath(projectRoot);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch (err) {
      console.warn(`[agentkit:orchestrate] Failed to release lock: ${err.message}`);
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Check lock status without acquiring.
 * @param {string} projectRoot
 * @returns {{ locked: boolean, stale: boolean, lock?: object }}
 */
export function checkLock(projectRoot) {
  const path = lockPath(projectRoot);
  if (!existsSync(path)) {
    return { locked: false, stale: false };
  }
  let lock;
  try {
    lock = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    // Corrupted lock file — treat as unlocked
    return { locked: false, stale: false };
  }
  const age = Date.now() - new Date(lock.started_at).getTime();
  return {
    locked: true,
    stale: age >= LOCK_STALE_MS,
    lock,
  };
}

// ---------------------------------------------------------------------------
// Event Logging
// ---------------------------------------------------------------------------

/**
 * Append an event to the events log.
 * @param {string} projectRoot
 * @param {string} action - What happened (e.g. 'phase_advanced', 'check_completed')
 * @param {object} data - Event data
 */
export function appendEvent(projectRoot, action, data = {}) {
  emitEvent(projectRoot, action, data, { source: 'orchestrator' });
}

/**
 * Read recent events from the log.
 * @param {string} projectRoot
 * @param {number} limit - Max events to return (default 20)
 * @returns {object[]}
 */
export function readEvents(projectRoot, limit = 20) {
  return readEventsFiltered(projectRoot, { limit });
}

// ---------------------------------------------------------------------------
// Phase Transitions
// ---------------------------------------------------------------------------

/**
 * Advance the orchestrator to the next phase.
 * @param {object} state - Current state
 * @returns {{ state: object, advanced: boolean, error?: string }}
 */
export function advancePhase(state) {
  if (state.completed) {
    return { state, advanced: false, error: 'All phases are already complete' };
  }

  const current = state.current_phase;
  if (current >= 5) {
    const newState = {
      ...state,
      completed: true,
      next_action: 'Project workflow complete. All phases finished.',
    };
    return { state: newState, advanced: true };
  }

  const next = current + 1;
  const newState = {
    ...state,
    current_phase: next,
    phase_name: PHASES[next],
    last_phase_completed: current,
    next_action: getNextAction(next),
  };
  return { state: newState, advanced: true };
}

/**
 * Set the orchestrator to a specific phase (for --phase flag).
 * @param {object} state
 * @param {number} phase - Phase number (1-5)
 * @returns {{ state: object, error?: string }}
 */
export function setPhase(state, phase) {
  if (phase < 1 || phase > 5 || !Number.isInteger(phase)) {
    return { state, error: `Invalid phase: ${phase}. Must be 1-5.` };
  }
  const newState = {
    ...state,
    current_phase: phase,
    phase_name: PHASES[phase],
    last_phase_completed: phase - 1,
    next_action: getNextAction(phase),
    completed: false,
  };
  return { state: newState };
}

function getNextAction(phase) {
  switch (phase) {
    case 1:
      return 'Run /discover to scan the repository and identify tech stacks';
    case 2:
      return 'Run /plan to create implementation plans for identified work items';
    case 3:
      return 'Delegate to team agents (/team-*) to implement planned changes';
    case 4:
      return 'Run /check to validate all changes pass quality gates';
    case 5:
      return 'Run /review for final review, then prepare deployment';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Team Status
// ---------------------------------------------------------------------------

/**
 * Update a team's status.
 * @param {object} state
 * @param {string} teamId - e.g. 'team-backend'
 * @param {string} status - One of: idle, in_progress, blocked, done
 * @param {string} [notes]
 * @returns {{ state: object, error?: string }}
 */
export function updateTeamStatus(state, teamId, status, notes, agentkitRoot) {
  if (agentkitRoot) ensureTeamIds(agentkitRoot);
  if (!VALID_TEAM_IDS.includes(teamId)) {
    return { state, error: `Unknown team: ${teamId}. Valid teams: ${VALID_TEAM_IDS.join(', ')}` };
  }
  if (!VALID_TEAM_STATUSES.includes(status)) {
    return { state, error: `Invalid status: ${status}. Valid: ${VALID_TEAM_STATUSES.join(', ')}` };
  }

  const newState = {
    ...state,
    team_progress: {
      ...state.team_progress,
      [teamId]: {
        ...state.team_progress[teamId],
        status,
        notes: notes ?? state.team_progress[teamId]?.notes ?? '',
        last_updated: new Date().toISOString(),
      },
    },
  };
  return { state: newState };
}

// ---------------------------------------------------------------------------
// Status Display
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable status summary.
 * @param {string} projectRoot
 * @returns {string}
 */
export function getStatus(projectRoot, agentkitRoot) {
  if (agentkitRoot) ensureTeamIds(agentkitRoot);
  const state = loadState(projectRoot);
  const lockStatus = checkLock(projectRoot);
  const events = readEvents(projectRoot, 5);

  const lines = [
    `=== AgentKit Forge — Orchestrator Status ===`,
    ``,
    `Repo:      ${state.repo_id}`,
    `Branch:    ${state.branch}`,
    `Session:   ${state.session_id || '(none)'}`,
    `Phase:     ${state.current_phase}/5 — ${state.phase_name}`,
    `Completed: ${state.completed ? 'Yes' : 'No'}`,
    `Next:      ${state.next_action}`,
    ``,
  ];

  // Lock info
  if (lockStatus.locked) {
    lines.push(`Lock:      LOCKED${lockStatus.stale ? ' (STALE)' : ''}`);
    lines.push(`  PID:     ${lockStatus.lock.pid}`);
    lines.push(`  Since:   ${lockStatus.lock.started_at}`);
    lines.push(``);
  }

  // Team progress
  lines.push(`--- Team Progress ---`);
  for (const teamId of VALID_TEAM_IDS) {
    const team = state.team_progress[teamId] || { status: 'idle' };
    const icon = { idle: ' ', in_progress: '▶', blocked: '!', done: '✓' }[team.status] || ' ';
    const line = `  [${icon}] ${teamId.padEnd(16)} ${team.status}${team.notes ? ` — ${team.notes}` : ''}`;
    lines.push(line);
  }
  lines.push(``);

  // Todo items
  if (state.todo_items.length > 0) {
    lines.push(`--- Todo Items (${state.todo_items.length}) ---`);
    for (const item of state.todo_items.slice(0, 10)) {
      const icon = { pending: '○', in_progress: '▶', done: '✓', blocked: '!' }[item.status] || '○';
      lines.push(`  [${icon}] ${item.id}: ${item.title} (${item.status})`);
    }
    if (state.todo_items.length > 10) {
      lines.push(`  ... and ${state.todo_items.length - 10} more`);
    }
    lines.push(``);
  }

  // Recent events
  if (events.length > 0) {
    lines.push(`--- Recent Events ---`);
    for (const evt of events) {
      const ts = formatTimestamp(evt.timestamp);
      lines.push(`  ${ts}  ${evt.action}${evt.team ? ` (${evt.team})` : ''}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Task Delegation (A2A-lite protocol)
// ---------------------------------------------------------------------------

/**
 * Delegate a task to a team/agent.
 * @param {string} projectRoot
 * @param {object} state - Current orchestrator state
 * @param {object} taskData - Task creation data (see task-protocol.mjs createTask)
 * @returns {Promise<{ state: object, task: object|null, error?: string }>}
 */
export async function delegateTask(projectRoot, state, taskData) {
  const result = await createTask(projectRoot, {
    ...taskData,
    delegator: taskData.delegator || 'orchestrator',
  });

  if (result.error) {
    return { state, task: null, error: result.error };
  }

  const task = result.task;

  // Update orchestrator state — track active tasks per team
  // Deep clone to ensure immutability
  const newState = {
    ...state,
    active_tasks: state.active_tasks ? JSON.parse(JSON.stringify(state.active_tasks)) : {},
    team_progress: state.team_progress ? JSON.parse(JSON.stringify(state.team_progress)) : {},
  };
  if (!newState.active_tasks) newState.active_tasks = {};

  for (const assignee of task.assignees || []) {
    if (!newState.active_tasks[assignee]) {
      newState.active_tasks[assignee] = [];
    }
    newState.active_tasks[assignee].push(task.id);

    // Initialize or merge team_progress with uniform structure
    if (!newState.team_progress[assignee]) {
      newState.team_progress[assignee] = {
        status: 'in_progress',
        tasks: {},
        last_updated: new Date().toISOString(),
      };
    }
    // Ensure tasks object exists
    if (!newState.team_progress[assignee].tasks) {
      newState.team_progress[assignee].tasks = {};
    }
    // Set task as present in tasks object
    newState.team_progress[assignee].tasks[task.id] = { status: 'in_progress', present: true };
    // Preserve existing fields and update timestamp
    newState.team_progress[assignee] = {
      ...newState.team_progress[assignee],
      status: 'in_progress',
      notes: `Task ${task.id}: ${task.title}`,
      last_updated: new Date().toISOString(),
    };
  }

  return { state: newState, task };
}

/**
 * Check task dependencies and unblock tasks. Returns cloned state with unblocked tasks applied.
 * @param {string} projectRoot
 * @param {object} state - Current orchestrator state
 * @returns {Promise<{ state: object, unblocked: string[], errors: string[] }>}
 */
export async function orchestratorCheckDependencies(projectRoot, state) {
  const { unblocked, errors } = await checkDependencies(projectRoot);

  // Clone state to ensure immutability
  const newState = {
    ...state,
    active_tasks: state.active_tasks ? JSON.parse(JSON.stringify(state.active_tasks)) : {},
    team_progress: state.team_progress ? JSON.parse(JSON.stringify(state.team_progress)) : {},
  };

  // Apply unblocked tasks to state
  if (unblocked.length > 0 && newState.team_progress) {
    for (const taskId of unblocked) {
      // Mark unblocked tasks as ready/available in team_progress
      for (const [teamId, progress] of Object.entries(newState.team_progress)) {
        if (progress.tasks && progress.tasks[taskId]) {
          progress.tasks[taskId].status = 'ready';
          progress.tasks[taskId].blocked = false;
        }
      }
    }
  }

  return { state: newState, unblocked, errors };
}

/**
 * Process completed tasks with handoffTo and create follow-up tasks.
 * Updates orchestrator state with new delegations.
 * @param {string} projectRoot
 * @param {object} state - Current orchestrator state
 * @returns {Promise<{ state: object, created: object[], errors: string[] }>}
 */
export async function orchestratorProcessHandoffs(projectRoot, state) {
  const { created, errors } = await processHandoffs(projectRoot, 'orchestrator');

  // Deep clone to ensure immutability
  const newState = {
    ...state,
    active_tasks: state.active_tasks ? JSON.parse(JSON.stringify(state.active_tasks)) : {},
    team_progress: state.team_progress ? JSON.parse(JSON.stringify(state.team_progress)) : {},
  };
  for (const task of created) {
    // Track new handoff tasks in orchestrator state
    if (!newState.active_tasks) newState.active_tasks = {};
    if (!newState.team_progress) newState.team_progress = {};

    for (const assignee of task.assignees || []) {
      // Update active_tasks
      if (!newState.active_tasks[assignee]) {
        newState.active_tasks[assignee] = [];
      }
      newState.active_tasks[assignee].push(task.id);

      // Update team_progress to match delegateTask behavior
      if (!newState.team_progress[assignee]) {
        newState.team_progress[assignee] = {
          status: 'in_progress',
          tasks: {},
          last_updated: new Date().toISOString(),
        };
        newState.team_progress[assignee].tasks[task.id] = {
          status: 'in_progress',
          present: true,
        };
      } else {
        if (!newState.team_progress[assignee].tasks) {
          newState.team_progress[assignee].tasks = {};
        }
        newState.team_progress[assignee].tasks[task.id] = {
          status: 'in_progress',
          present: true,
        };
        newState.team_progress[assignee].status = 'in_progress';
        newState.team_progress[assignee].last_updated = new Date().toISOString();
      }
    }
  }

  return { state: newState, created, errors };
}

/**
 * Get a summary of all active tasks for display.
 * @param {string} projectRoot
 * @returns {string}
 */
export function getTasksSummary(projectRoot) {
  const dir = resolve(projectRoot, '.agentkit', 'state', 'tasks');
  if (!existsSync(dir)) return 'No tasks in the task queue.';

  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'));
  } catch {
    return 'No tasks in the task queue.';
  }

  const activeTasks = [];
  for (const file of files) {
    try {
      const content = readFileSync(resolve(dir, file), 'utf-8');
      const task = JSON.parse(content);
      if (task && typeof task === 'object' && !Array.isArray(task)) {
        activeTasks.push(task);
      }
    } catch {
      // Skip unreadable/corrupted task files in summary output
    }
  }

  if (activeTasks.length === 0) return 'No tasks in the task queue.';

  const nonTerminal = activeTasks.filter((t) => !TERMINAL_STATES.includes(t.status));
  const terminal = activeTasks.filter((t) => TERMINAL_STATES.includes(t.status));
  const lines = ['--- Task Queue ---', ''];

  if (nonTerminal.length > 0) {
    lines.push(`Active tasks: ${nonTerminal.length}`);
    lines.push(formatTaskList(nonTerminal));
    lines.push('');
  }

  if (terminal.length > 0) {
    lines.push(`Completed/closed tasks: ${terminal.length}`);
  }

  return lines.join('\n');
}

/**
 * Async task summary helper for callers already using async flows.
 * @param {string} projectRoot
 * @returns {Promise<string>}
 */
export async function getTasksSummaryAsync(projectRoot) {
  const listResult = await listTasks(projectRoot);
  const activeTasks = Array.isArray(listResult?.tasks) ? listResult.tasks : [];
  if (activeTasks.length === 0) return 'No tasks in the task queue.';

  const nonTerminal = activeTasks.filter((t) => !TERMINAL_STATES.includes(t.status));
  const terminal = activeTasks.filter((t) => TERMINAL_STATES.includes(t.status));

  const lines = ['--- Task Queue ---', ''];

  if (nonTerminal.length > 0) {
    lines.push(`Active tasks: ${nonTerminal.length}`);
    lines.push(formatTaskList(nonTerminal));
    lines.push('');
  }

  if (terminal.length > 0) {
    lines.push(`Completed/closed tasks: ${terminal.length}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI Handler
// ---------------------------------------------------------------------------

/**
 * Run the orchestrate command from CLI.
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 */
export async function runOrchestrate({ agentkitRoot, projectRoot, flags }) {
  const userContext = Array.isArray(flags._args) && flags._args.length > 0
    ? flags._args.join(' ')
    : null;

  // Load team IDs from spec if available (overrides hardcoded defaults)
  loadTeamIdsFromSpec(agentkitRoot);

  // --status: show current state
  if (flags.status) {
    console.log(getStatus(projectRoot));
    return;
  }

  // --force-unlock: clear stale lock
  if (flags['force-unlock']) {
    const released = releaseLock(projectRoot);
    if (released) {
      console.log('[agentkit:orchestrate] Lock released.');
      appendEvent(projectRoot, 'lock_force_released');
    } else {
      console.log('[agentkit:orchestrate] No lock to release.');
    }
    return;
  }

  // Acquire lock
  const lockResult = acquireLock(projectRoot);
  if (!lockResult.acquired) {
    const lock = lockResult.existingLock;
    if (lock) {
      console.error(
        `[agentkit:orchestrate] Session locked by PID ${lock.pid} since ${lock.started_at}.`
      );
    } else {
      console.error(`[agentkit:orchestrate] Session lock exists but is corrupted.`);
    }
    console.error(`Use --force-unlock to override.`);
    process.exit(1);
  }

  try {
    const state = loadState(projectRoot);

    // --phase N: jump to specific phase
    if (flags.phase) {
      const phase = parseInt(flags.phase, 10);
      const result = setPhase(state, phase);
      if (result.error) {
        console.error(`[agentkit:orchestrate] ${result.error}`);
        return;
      }
      saveState(projectRoot, result.state);
      appendEvent(projectRoot, 'phase_set', { phase, phase_name: PHASES[phase] });
      console.log(`[agentkit:orchestrate] Phase set to ${phase} — ${PHASES[phase]}`);
      console.log(`Next action: ${result.state.next_action}`);
      return;
    }

    // Default: show status and advance phase if requested
    console.log(getStatus(projectRoot));
    console.log('');
    console.log('Use this command within your AI tool as a slash command for full orchestration.');
    console.log(`Current phase: ${state.current_phase}/5 — ${state.phase_name}`);
    console.log(`Next action: ${state.next_action}`);

    appendEvent(projectRoot, 'orchestrate_invoked', {
      phase: state.current_phase,
      phase_name: state.phase_name,
      ...(userContext ? { userContext } : {}),
    });
  } finally {
    releaseLock(projectRoot);
  }
}

export { PHASES, VALID_TEAM_IDS, VALID_TEAM_STATUSES };

// Re-export task protocol for convenience
  export {
    addTaskArtifact,
    createTask,
    formatTaskList,
    formatTaskSummary,
    getTask as getTaskById,
    listTasks,
    updateTaskStatus as updateTaskState
  } from './task-protocol.mjs';

