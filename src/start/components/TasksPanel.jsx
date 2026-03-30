/**
 * TasksPanel — displays active agent tasks in the TUI.
 *
 * Shows tasks from `.claude/state/tasks/` grouped by status:
 *   working → input-required → accepted → submitted
 *
 * Renders nothing when there are no active tasks.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { getActiveTasks } from '../lib/tasks.js';

/** Status label and color for each active state. */
const STATUS_META = {
  working: { label: '▶ working', color: 'green' },
  'input-required': { label: '? input', color: 'yellow' },
  accepted: { label: '✓ accepted', color: 'cyan' },
  submitted: { label: '○ submitted', color: 'gray' },
};

/**
 * @param {{ cwd?: string }} props
 *   cwd — repository root passed to getActiveTasks; defaults to process.cwd()
 */
export default function TasksPanel({ cwd }) {
  const tasks = getActiveTasks(cwd);

  if (tasks.length === 0) return null;

  return (
    <Box flexDirection="column" paddingX={2} gap={0}>
      <Text color="gray" dimColor>
        Active tasks
      </Text>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </Box>
  );
}

/**
 * @param {{ task: import('../lib/tasks.js').TaskInfo }} props
 */
function TaskRow({ task }) {
  const meta = STATUS_META[task.status] || { label: task.status, color: 'white' };
  const assignee = task.assignees.length > 0 ? task.assignees[0] : '';

  return (
    <Box gap={1}>
      <Text color={meta.color}>{meta.label}</Text>
      {task.priority && (
        <Text color="gray" dimColor>
          [{task.priority}]
        </Text>
      )}
      <Text color="white">{task.title}</Text>
      {assignee && (
        <Text color="gray" dimColor>
          → {assignee}
        </Text>
      )}
    </Box>
  );
}
