/**
 * AgentKit Forge — Backlog Store
 * Reads and writes backlog data in both JSON and Markdown formats.
 */
import { existsSync, readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';

const BACKLOG_JSON_PATH = '.claude/state/backlog.json';
const BACKLOG_MD_PATH = 'AGENT_BACKLOG.md';

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

// ---------------------------------------------------------------------------
// JSON store
// ---------------------------------------------------------------------------

/**
 * Read backlog from JSON store.
 * @param {string} projectRoot
 * @returns {object[]} Array of BacklogItem objects
 */
export function readBacklogJson(projectRoot) {
  const filePath = resolve(projectRoot, BACKLOG_JSON_PATH);
  if (!existsSync(filePath)) return [];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/**
 * Write backlog to JSON store.
 * @param {string} projectRoot
 * @param {object[]} items
 */
export async function writeBacklogJson(projectRoot, items) {
  const filePath = resolve(projectRoot, BACKLOG_JSON_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  const data = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    count: items.length,
    items,
  };
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Markdown store
// ---------------------------------------------------------------------------

/**
 * Parse existing AGENT_BACKLOG.md into structured items.
 * Extracts items from markdown table rows.
 * @param {string} projectRoot
 * @returns {object[]} Partial BacklogItem objects (may lack some fields)
 */
export function readBacklogMarkdown(projectRoot) {
  const filePath = resolve(projectRoot, BACKLOG_MD_PATH);
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, 'utf-8');
  const items = [];

  // Match table rows: | Priority | Team | Task | Phase | Status | Notes |
  const tableRowRegex = /^\|\s*(P[0-3])\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)\|/gm;
  let match;
  while ((match = tableRowRegex.exec(content)) !== null) {
    const [, priority, team, task, phase, status, notes] = match;
    items.push({
      id: null,
      externalId: null,
      externalUrl: null,
      title: task.trim(),
      priority: priority.trim(),
      status: status.trim().toLowerCase().replace(/\s+/g, '-'),
      phase: phase.trim(),
      team: team.trim().toLowerCase().replace(/^t\d+-/i, ''),
      assignee: null,
      source: 'manual',
      what: notes.trim(),
      why: '',
      acceptance: [],
      files: [],
      labels: [],
      milestone: null,
      createdAt: null,
      updatedAt: null,
      closedAt: null,
      lastSyncedAt: null,
      dirty: false,
    });
  }

  return items;
}

/**
 * Render backlog items to AGENT_BACKLOG.md format.
 * @param {string} projectRoot
 * @param {object[]} items
 * @param {string} [repoName='']
 */
export async function writeBacklogMarkdown(projectRoot, items, repoName = '') {
  const filePath = resolve(projectRoot, BACKLOG_MD_PATH);
  const now = new Date().toISOString().split('T')[0];

  // Group by priority
  const groups = { P0: [], P1: [], P2: [], P3: [] };
  const completed = [];
  for (const item of items) {
    if (item.status === 'completed') {
      completed.push(item);
    } else {
      const p = item.priority in groups ? item.priority : 'P3';
      groups[p].push(item);
    }
  }

  // Count by source
  const sourceCounts = {};
  for (const item of items) {
    const src = item.source || 'manual';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  const sourceStr = Object.entries(sourceCounts)
    .map(([s, c]) => `${s} (${c})`)
    .join(', ');

  const totalOpen = items.length - completed.length;

  function renderTable(groupItems) {
    if (!groupItems.length) return '_None_\n';
    const lines = [
      '| Priority | Team | Task | Phase | Status | Source | Notes |',
      '| -------- | ---- | ---- | ----- | ------ | ------ | ----- |',
    ];
    for (const item of groupItems) {
      const extRef = item.externalId ? ` [${item.externalId}]` : '';
      const statusDisplay = (item.status || 'open').replace(/-/g, ' ');
      const statusCap = statusDisplay.charAt(0).toUpperCase() + statusDisplay.slice(1);
      lines.push(
        `| ${item.priority} | ${item.team} | ${item.title}${extRef} | ${item.phase || 'Planning'} | ${statusCap} | ${item.source || 'manual'} | ${item.what?.slice(0, 80) || ''} |`
      );
    }
    return lines.join('\n') + '\n';
  }

  const md = `# Agent Backlog${repoName ? ` — ${repoName}` : ''}

> Auto-synced on ${now}. Manual edits to items with external IDs will be overwritten on next sync.

## Summary

- **Total items:** ${items.length} (${totalOpen} open, ${completed.length} completed)
- **P0 (blocking):** ${groups.P0.length}
- **P1 (high):** ${groups.P1.length}
- **P2 (medium):** ${groups.P2.length}
- **P3 (low):** ${groups.P3.length}
- **Sources:** ${sourceStr || 'none'}

---

## P0 — Blocking

${renderTable(groups.P0)}

## P1 — High Priority

${renderTable(groups.P1)}

## P2 — Medium Priority

${renderTable(groups.P2)}

## P3 — Low Priority

${renderTable(groups.P3)}

## Completed

${renderTable(completed)}

---

_This backlog is maintained by AgentKit Forge. Use \`/sync-backlog\` to refresh_
_or \`agentkit import-issues\` to import from external trackers._
`;

  await writeFile(filePath, md, 'utf-8');
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort items by the given field.
 * @param {object[]} items
 * @param {string} sortBy - 'priority' | 'team' | 'source' | 'updated'
 * @returns {object[]}
 */
export function sortItems(items, sortBy = 'priority') {
  const copy = [...items];
  switch (sortBy) {
    case 'priority':
      return copy.sort(
        (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
      );
    case 'team':
      return copy.sort((a, b) => (a.team || '').localeCompare(b.team || ''));
    case 'source':
      return copy.sort((a, b) => (a.source || '').localeCompare(b.source || ''));
    case 'updated':
      return copy.sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      );
    default:
      return copy;
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Filter items by criteria.
 * @param {object[]} items
 * @param {object} filters
 * @param {string} [filters.team]
 * @param {string} [filters.priority] - Comma-separated priorities
 * @param {string} [filters.source]
 * @param {string} [filters.status]
 * @returns {object[]}
 */
export function filterItems(items, filters = {}) {
  let result = items;

  if (filters.team) {
    const t = filters.team.toLowerCase();
    result = result.filter((i) => i.team?.toLowerCase() === t);
  }

  if (filters.priority) {
    const priorities = new Set(filters.priority.split(',').map((p) => p.trim().toUpperCase()));
    result = result.filter((i) => priorities.has(i.priority));
  }

  if (filters.source) {
    const s = filters.source.toLowerCase();
    result = result.filter((i) => i.source?.toLowerCase() === s);
  }

  if (filters.status) {
    const st = filters.status.toLowerCase();
    result = result.filter((i) => i.status?.toLowerCase() === st);
  }

  return result;
}
