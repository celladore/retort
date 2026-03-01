/**
 * AgentKit Forge — Handoff Generator
 * Creates a structured session handoff document with git state,
 * orchestrator state, and recent activity.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { execCommand, formatTimestamp } from './runner.mjs';
import { loadState, appendEvent, readEvents } from './orchestrator.mjs';

// ---------------------------------------------------------------------------
// Git state gathering
// ---------------------------------------------------------------------------

function getGitState(projectRoot) {
  const git = {};

  // Current branch
  const branchResult = execCommand('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot });
  if (branchResult.exitCode === 0) {
    git.branch = branchResult.stdout.trim();
  } else {
    console.warn('[agentkit:handoff] Could not determine git branch (is this a git repo?)');
    git.branch = 'unknown';
  }

  // Last commit
  const logResult = execCommand('git log -1 --format="%h %s"', { cwd: projectRoot });
  git.lastCommit = logResult.exitCode === 0 ? logResult.stdout.trim() : '';

  // Recent commits (last 5)
  const recentResult = execCommand('git log -5 --format="%h %s" --no-merges', { cwd: projectRoot });
  git.recentCommits = recentResult.exitCode === 0
    ? recentResult.stdout.trim().split('\n').filter(Boolean)
    : [];

  // Uncommitted changes count
  const statusResult = execCommand('git status --porcelain', { cwd: projectRoot });
  if (statusResult.exitCode === 0) {
    const lines = statusResult.stdout.trim().split('\n').filter(Boolean);
    git.uncommittedCount = lines.length;
    git.uncommittedFiles = lines.slice(0, 10).map(l => l.trim());
    if (lines.length > 10) {
      git.uncommittedFiles.push(`... and ${lines.length - 10} more`);
    }
  } else {
    git.uncommittedCount = 0;
    git.uncommittedFiles = [];
  }

  // Diff stats
  const diffResult = execCommand('git diff --stat HEAD', { cwd: projectRoot });
  git.diffSummary = diffResult.exitCode === 0 ? diffResult.stdout.trim() : '';

  return git;
}

// ---------------------------------------------------------------------------
// Document generation
// ---------------------------------------------------------------------------

function generateHandoffDoc(git, state, events, timestamp) {
  const lines = [
    `# Session Handoff`,
    ``,
    `**Date:** ${timestamp}`,
    `**Branch:** ${git.branch}`,
    `**Phase:** ${state.current_phase}/5 — ${state.phase_name}`,
    ``,
    `---`,
    ``,
    `## Summary`,
    ``,
    `Session ended at phase ${state.current_phase} (${state.phase_name}).`,
    `Next action: ${state.next_action}`,
    ``,
    `## Git State`,
    ``,
    `- **Branch:** ${git.branch}`,
    `- **Last commit:** ${git.lastCommit}`,
    `- **Uncommitted changes:** ${git.uncommittedCount}`,
    ``,
  ];

  if (git.recentCommits.length > 0) {
    lines.push(`### Recent Commits`);
    lines.push(``);
    for (const commit of git.recentCommits) {
      lines.push(`- ${commit}`);
    }
    lines.push(``);
  }

  if (git.uncommittedCount > 0) {
    lines.push(`### Uncommitted Files`);
    lines.push(``);
    for (const file of git.uncommittedFiles) {
      lines.push(`- ${file}`);
    }
    lines.push(``);
  }

  // Team progress
  const activeTeams = Object.entries(state.team_progress ?? {})
    .filter(([_, t]) => t.status !== 'idle');

  if (activeTeams.length > 0) {
    lines.push(`## Team Progress`);
    lines.push(``);
    lines.push(`| Team | Status | Notes |`);
    lines.push(`|------|--------|-------|`);
    for (const [teamId, team] of activeTeams) {
      const notes = (team.notes || '').replace(/\|/g, '\\|');
      lines.push(`| ${teamId} | ${team.status} | ${notes} |`);
    }
    lines.push(``);
  }

  // Todo items
  const openTodos = (state.todo_items || []).filter(t => t.status !== 'done');
  if (openTodos.length > 0) {
    lines.push(`## Open Items`);
    lines.push(``);
    for (const item of openTodos) {
      const icon = item.status === 'in_progress' ? '🔄' : item.status === 'blocked' ? '⛔' : '⬜';
      lines.push(`- ${icon} **${item.id}**: ${item.title} (${item.status})`);
    }
    lines.push(``);
  }

  // Recent events
  if (events.length > 0) {
    lines.push(`## Recent Activity`);
    lines.push(``);
    for (const evt of events) {
      const ts = formatTimestamp(evt.timestamp);
      lines.push(`- \`${ts}\` ${evt.action}${evt.team ? ` (${evt.team})` : ''}`);
    }
    lines.push(``);
  }

  // Next steps
  lines.push(`## Next Steps`);
  lines.push(``);
  lines.push(`1. ${state.next_action}`);
  if (git.uncommittedCount > 0) {
    lines.push(`2. Review and commit ${git.uncommittedCount} uncommitted change(s)`);
  }
  lines.push(``);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Generate session handoff document.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags - --save (write to docs/ai_handoffs/)
 * @returns {object}
 */
export async function runHandoff({ agentkitRoot, projectRoot, flags = {} }) {
  console.log('[agentkit:handoff] Generating session handoff...');
  console.log('');

  const timestamp = new Date().toISOString();
  const git = getGitState(projectRoot);
  const state = await loadState(projectRoot);
  const events = await readEvents(projectRoot, 10);

  const doc = generateHandoffDoc(git, state, events, timestamp);

  // Output the document
  console.log(doc);

  // Optionally save to file
  if (flags.save) {
    const handoffDir = resolve(projectRoot, 'docs', 'ai_handoffs');
    if (!existsSync(handoffDir)) {
      mkdirSync(handoffDir, { recursive: true });
    }
    // Include time in filename to avoid overwriting on same day
    const dateStr = timestamp.replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
    const filename = `handoff-${dateStr}.md`;
    const filepath = resolve(handoffDir, filename);
    writeFileSync(filepath, doc, 'utf-8');
    console.log(`Saved to: docs/ai_handoffs/${filename}`);
  }

  // Log event
  try {
    await appendEvent(projectRoot, 'handoff_generated', {
      branch: git.branch,
      uncommittedCount: git.uncommittedCount,
      phase: state.current_phase,
      saved: !!flags.save,
    });
  } catch (err) { console.warn(`[agentkit:handoff] Event logging failed: ${err?.message ?? String(err)}`); }

  return {
    timestamp,
    branch: git.branch,
    phase: state.current_phase,
    phaseName: state.phase_name,
    uncommittedCount: git.uncommittedCount,
    document: doc,
  };
}
