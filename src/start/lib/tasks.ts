/**
 * Task discovery module.
 *
 * Reads `.claude/state/tasks/*.json` and returns structured active-task
 * objects. Used by TasksPanel to display in-flight agent work without
 * importing fs/path directly in components.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TaskInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignees: string[];
  type: string;
}

/** States that are visible in the TUI (non-terminal, non-archived). */
const ACTIVE_STATES = new Set<string>(['working', 'input-required', 'accepted', 'submitted']);

/** Display order for active states (most urgent first). */
const STATE_ORDER = ['working', 'input-required', 'accepted', 'submitted'];

/**
 * Read and parse a single task JSON file. Returns null on any parse error.
 */
export function parseTaskFile(filePath: string): TaskInfo | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    return {
      id: String(data['id'] || ''),
      title: String(data['title'] || '(untitled)'),
      status: String(data['status'] || ''),
      priority: String(data['priority'] || ''),
      assignees: Array.isArray(data['assignees'])
        ? (data['assignees'] as unknown[]).map(String)
        : [],
      type: String(data['type'] || ''),
    };
  } catch {
    return null;
  }
}

/**
 * Return all active tasks from `.claude/state/tasks/`, sorted by display
 * order (working first) then by priority (P0 before P4).
 */
export function getActiveTasks(cwd = process.cwd()): TaskInfo[] {
  const tasksDir = join(cwd, '.claude', 'state', 'tasks');
  if (!existsSync(tasksDir)) return [];

  let files: string[];
  try {
    files = readdirSync(tasksDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const tasks = files
    .map((f) => parseTaskFile(join(tasksDir, f)))
    .filter((t): t is TaskInfo => t !== null && ACTIVE_STATES.has(t.status));

  tasks.sort((a, b) => {
    const si = STATE_ORDER.indexOf(a.status);
    const sj = STATE_ORDER.indexOf(b.status);
    if (si !== sj) return si - sj;
    return a.priority.localeCompare(b.priority);
  });

  return tasks;
}
