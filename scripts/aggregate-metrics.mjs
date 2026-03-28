#!/usr/bin/env node
// aggregate-metrics.mjs — Parse events.log, compute per-agent metrics, write
// agent-metrics.json and agent-health.json to .claude/state/.
//
// Usage:
//   node scripts/aggregate-metrics.mjs [--state <dir>] [--window <days>]
//
// Options:
//   --state <dir>    Path to state directory (default: .claude/state)
//   --window <days>  Rolling window in days to include (default: 30, 0 = all)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const stateDir = resolve(getArg('--state', '.claude/state'));
const windowDays = parseInt(getArg('--window', '30'), 10);
const eventsLog = join(stateDir, 'events.log');
const metricsOut = join(stateDir, 'agent-metrics.json');
const healthOut = join(stateDir, 'agent-health.json');

if (!existsSync(eventsLog)) {
  console.error(`[aggregate-metrics] No events.log found at ${eventsLog}`);
  process.exit(0); // not an error — nothing to aggregate yet
}

// ── Parse events.log ──────────────────────────────────────────────────────
const windowStart =
  windowDays > 0 ? new Date(Date.now() - windowDays * 86_400_000).toISOString() : null;

const raw = readFileSync(eventsLog, 'utf8').split('\n').filter(Boolean);

// Per-agent accumulators
const agents = {};

const ensure = (team) => {
  if (!agents[team]) {
    agents[team] = {
      invocations: 0,
      tasksAccepted: 0,
      tasksRejected: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      toolCallsTotal: 0,
      lastInvoked: null,
    };
  }
  return agents[team];
};

for (const line of raw) {
  // ── [METRICS] text lines ─────────────────────────────────────────────
  // Format: [METRICS] team=<slug> event=<type> [taskId=<id>] [reason=<r>] timestamp=<ISO>
  if (line.startsWith('[METRICS]')) {
    const pairs = {};
    for (const token of line.replace('[METRICS]', '').trim().split(/\s+/)) {
      const [k, ...v] = token.split('=');
      if (k && v.length) pairs[k] = v.join('=');
    }
    const { team, event, timestamp } = pairs;
    if (!team || !event) continue;
    if (windowStart && timestamp && timestamp < windowStart) continue;

    const a = ensure(team);
    if (event === 'session_start') {
      a.invocations += 1;
      if (!a.lastInvoked || timestamp > a.lastInvoked) a.lastInvoked = timestamp;
    } else if (event === 'task_complete') {
      a.tasksCompleted += 1;
      a.tasksAccepted += 1;
    } else if (event === 'task_failed') {
      a.tasksFailed += 1;
      a.tasksAccepted += 1;
    }
    continue;
  }

  // ── JSON lines (check_completed, TURN_LIMIT_REACHED, etc.) ───────────
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }

  const ts = obj.timestamp;
  if (windowStart && ts && ts < windowStart) continue;

  // TURN_LIMIT_REACHED and LOOP_DETECTED carry team info via taskId;
  // we don't have the team here so just count globally for now.
  // Future: join against task files to resolve team.
}

// ── Compute derived fields ────────────────────────────────────────────────
for (const a of Object.values(agents)) {
  const total = a.tasksAccepted;
  a.avgToolCallsPerTask = total > 0 ? parseFloat((a.toolCallsTotal / total).toFixed(2)) : 0;
}

// ── Write agent-metrics.json ──────────────────────────────────────────────
const metrics = {
  schemaVersion: '1.0',
  generatedAt: new Date().toISOString(),
  windowStart: windowStart ?? 'all-time',
  windowDays: windowDays > 0 ? windowDays : null,
  agents,
  teams: Object.fromEntries(
    Object.entries(agents).map(([name, a]) => [name, { tasksRouted: a.tasksAccepted }])
  ),
};

writeFileSync(metricsOut, JSON.stringify(metrics, null, 2));
console.log(`[aggregate-metrics] Wrote ${metricsOut}`);

// ── Compute health scores → agent-health.json ─────────────────────────────
// Health score (0–1): weighted by completion rate and activity recency.
//   completionRate = tasksCompleted / max(tasksAccepted, 1)
//   rejectionPenalty = tasksRejected / max(invocations, 1)  (not yet tracked here)
//   score = completionRate  (simple v1; extend as data enriches)
//
// Trend and flags are derived from score thresholds.

const health = {};
for (const [team, a] of Object.entries(agents)) {
  const completionRate = a.tasksAccepted > 0 ? a.tasksCompleted / a.tasksAccepted : null; // null = never used

  let flag = null;
  let trend = 'stable';

  if (completionRate === null) {
    trend = 'unknown';
  } else if (completionRate < 0.5) {
    flag = 'high-failure-rate';
    trend = 'declining';
  } else if (completionRate < 0.75) {
    flag = 'elevated-failure-rate';
  }

  if (a.invocations === 0) {
    flag = 'idle';
    trend = 'unknown';
  }

  health[team] = {
    healthScore: completionRate !== null ? parseFloat(completionRate.toFixed(3)) : null,
    invocations: a.invocations,
    trend,
    flag,
    lastInvoked: a.lastInvoked,
  };
}

writeFileSync(healthOut, JSON.stringify(health, null, 2));
console.log(`[aggregate-metrics] Wrote ${healthOut}`);

// ── Summary ───────────────────────────────────────────────────────────────
const teamCount = Object.keys(agents).length;
const atRisk = Object.entries(health).filter(([, h]) => h.flag && h.flag !== 'idle');
const idle = Object.entries(health).filter(([, h]) => h.flag === 'idle');

console.log(`\nAgents tracked: ${teamCount}`);
if (atRisk.length) {
  console.log(`At-risk agents (${atRisk.length}): ${atRisk.map(([n]) => n).join(', ')}`);
}
if (idle.length) {
  console.log(`Idle agents (${idle.length}): ${idle.map(([n]) => n).join(', ')}`);
}
