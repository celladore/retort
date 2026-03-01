/**
 * AgentKit Forge — Plan Runner
 * Shows current orchestrator state, backlog items, and suggests next actions
 * based on the current phase. This is the CLI companion to the /plan slash command.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { appendEvent, loadState, readEvents } from './orchestrator.mjs';
import { formatTimestamp } from './runner.mjs';

// ---------------------------------------------------------------------------
// Phase recommendations
// ---------------------------------------------------------------------------

const PHASE_GUIDANCE = {
  1: {
    title: 'Discovery Phase',
    goals: [
      'Understand the repository structure and tech stacks',
      'Identify existing patterns, conventions, and architecture',
      'Detect CI/CD, infrastructure, and deployment setup',
    ],
    commands: ['/discover', '/healthcheck'],
    tips: 'Start with /discover to scan the repo, then /healthcheck to verify build/test health.',
  },
  2: {
    title: 'Planning Phase',
    goals: [
      'Create implementation plans for identified work items',
      'Break down tasks and assign to teams',
      'Define acceptance criteria and quality gates',
    ],
    commands: ['/plan', '/sync-backlog'],
    tips: 'Use /plan to create structured plans. Update AGENT_BACKLOG.md with task items.',
  },
  3: {
    title: 'Implementation Phase',
    goals: [
      'Execute planned changes through team agents',
      'Follow the quality gates defined in QUALITY_GATES.md',
      'Keep backlog updated as work progresses',
    ],
    commands: ['/team-backend', '/team-frontend', '/team-data', '/team-testing', '/check'],
    tips: 'Delegate to team agents. Run /check frequently to catch issues early.',
  },
  4: {
    title: 'Validation Phase',
    goals: [
      'Verify all changes pass quality gates',
      'Run comprehensive checks (lint, test, build)',
      'Review changes for security, performance, and correctness',
    ],
    commands: ['/check', '/review', '/security'],
    tips: 'Run /check with all gates. Use /review for final code review.',
  },
  5: {
    title: 'Ship Phase',
    goals: [
      'Prepare deployment artifacts',
      'Update documentation and changelog',
      'Create handoff document for the session',
    ],
    commands: ['/deploy', '/handoff'],
    tips: 'Update docs, create a /handoff document, and prepare for deployment.',
  },
};

// ---------------------------------------------------------------------------
// Backlog reading
// ---------------------------------------------------------------------------

function readBacklog(projectRoot) {
  const backlogPath = resolve(projectRoot, 'AGENT_BACKLOG.md');
  if (!existsSync(backlogPath)) return null;

  const content = readFileSync(backlogPath, 'utf-8');
  const lines = content.split('\n');
  const items = [];
  let inTable = false;
  let headerCols = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table header row — match any pipe-delimited header containing common
    // backlog columns (ID, Priority, Task, Status, Team, etc.)
    if (!inTable && trimmed.startsWith('|')) {
      const cols = trimmed
        .split('|')
        .map((c) => c.trim().toLowerCase())
        .slice(1, -1);
      if (cols.some((c) => c === 'id' || c === 'priority' || c === 'task' || c === 'status')) {
        headerCols = cols;
        continue;
      }
    }

    // Skip separator rows like |---|---|
    if (trimmed.match(/^\|[\s-:|]+\|$/)) {
      if (headerCols) inTable = true;
      continue;
    }

    if (inTable && trimmed.startsWith('|')) {
      const parts = trimmed.split('|').map((c) => c.trim());
      const cells = parts.slice(1, parts.length - 1);
      if (cells.length >= 2) {
        const idIdx = headerCols && headerCols.indexOf('id') >= 0 ? headerCols.indexOf('id') : 0;
        const candidateIdx = headerCols
          ? ['task', 'title', 'description', 'what']
              .map((name) => headerCols.indexOf(name))
              .find((idx) => idx >= 0)
          : 1;
        const titleIdx = typeof candidateIdx === 'number' && candidateIdx >= 0 ? candidateIdx : 1;
        const statusIdx =
          headerCols && headerCols.indexOf('status') >= 0 ? headerCols.indexOf('status') : 2;
        const teamIdx =
          headerCols && headerCols.indexOf('team') >= 0 ? headerCols.indexOf('team') : 3;
        const priorityIdx =
          headerCols && headerCols.indexOf('priority') >= 0 ? headerCols.indexOf('priority') : 4;

        const maxIndex = Math.max(0, cells.length - 1);
        const safeId = idIdx >= 0 && idIdx < cells.length ? idIdx : Math.min(idIdx, maxIndex);
        const safeTitle =
          titleIdx >= 0 && titleIdx < cells.length ? titleIdx : Math.min(titleIdx, maxIndex);
        const safeStatus =
          statusIdx >= 0 && statusIdx < cells.length ? statusIdx : Math.min(statusIdx, maxIndex);
        const safeTeam =
          teamIdx >= 0 && teamIdx < cells.length ? teamIdx : Math.min(teamIdx, maxIndex);
        const safePriority =
          priorityIdx >= 0 && priorityIdx < cells.length
            ? priorityIdx
            : Math.min(priorityIdx, maxIndex);

        items.push({
          id: (cells[safeId] ?? '').toString(),
          title: (cells[safeTitle] ?? '').toString(),
          status: (cells[safeStatus] ?? '').toString(),
          team: (cells[safeTeam] ?? '').toString(),
          priority: (cells[safePriority] ?? '').toString(),
        });
      }
    } else if (inTable && !trimmed.startsWith('|')) {
      // End of current table; allow parsing further tables in the same file
      inTable = false;
      headerCols = null;
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Show plan status and recommendations.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 * @returns {object}
 */
export async function runPlan({ projectRoot, flags = {} }) {
  console.log('[agentkit:plan] Current plan and status...');
  console.log('');

  const state = await loadState(projectRoot);
  const phase = state.current_phase;
  const guidance = PHASE_GUIDANCE[phase] || PHASE_GUIDANCE[1];

  // --- Current Phase ---
  console.log(`=== Phase ${phase}/5: ${state.phase_name} ===`);
  console.log('');
  console.log(`Goals:`);
  for (const goal of guidance.goals) {
    console.log(`  • ${goal}`);
  }
  console.log('');
  console.log(`Recommended commands: ${guidance.commands.join(', ')}`);
  console.log(`Tip: ${guidance.tips}`);
  console.log('');

  // --- Team Status ---
  const activeTeams = Object.entries(state.team_progress ?? {}).filter(
    ([_, t]) => t.status !== 'idle'
  );

  if (activeTeams.length > 0) {
    console.log('--- Active Teams ---');
    for (const [teamId, team] of activeTeams) {
      const icon = { in_progress: '▶', blocked: '!', done: '✓' }[team.status] || ' ';
      console.log(`  [${icon}] ${teamId}: ${team.status}${team.notes ? ` — ${team.notes}` : ''}`);
    }
    console.log('');
  }

  // --- Todo Items ---
  const todoItems = state.todo_items ?? [];
  if (todoItems.length > 0) {
    console.log(`--- Todo Items (${todoItems.length}) ---`);
    const pending = todoItems.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    for (const item of pending.slice(0, 10)) {
      const icon = item.status === 'in_progress' ? '▶' : '○';
      console.log(`  [${icon}] ${item.id}: ${item.title}${item.team ? ` (${item.team})` : ''}`);
    }
    const done = todoItems.filter((t) => t.status === 'done').length;
    if (done > 0) {
      console.log(`  (${done} completed items)`);
    }
    console.log('');
  }

  // --- Backlog ---
  const backlog = readBacklog(projectRoot);
  if (backlog && backlog.length > 0) {
    console.log(`--- Backlog Items (${backlog.length}) ---`);
    for (const item of backlog.slice(0, 10)) {
      console.log(
        `  ${item.id}: ${item.title} [${item.status}]${item.team ? ` → ${item.team}` : ''}`
      );
    }
    if (backlog.length > 10) {
      console.log(`  ... and ${backlog.length - 10} more`);
    }
    console.log('');
  }

  // --- Recent Events ---
  const events = await readEvents(projectRoot, 5);
  if (events.length > 0) {
    console.log('--- Recent Activity ---');
    for (const evt of events) {
      const ts = formatTimestamp(evt.timestamp);
      console.log(`  ${ts}  ${evt.action}`);
    }
    console.log('');
  }

  // --- Next Action ---
  console.log(`Next: ${state.next_action}`);

  // Log event
  try {
    await appendEvent(projectRoot, 'plan_viewed', { phase, phase_name: state.phase_name });
  } catch (err) {
    console.warn(`[agentkit:plan] Event logging failed: ${err?.message ?? String(err)}`);
  }

  return {
    phase,
    phaseName: state.phase_name,
    guidance,
    activeTeams: activeTeams.length,
    todoItems: todoItems.length,
    backlogItems: backlog ? backlog.length : 0,
  };
}
