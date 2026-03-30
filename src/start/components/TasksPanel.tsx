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
import { getActiveTasks, type TaskInfo } from '../lib/tasks.js';

interface StatusMeta {
  label: string;
  color: string;
}

/** Status label and color for each active state. */
const STATUS_META: Record<string, StatusMeta> = {
  working: { label: '▶ working', color: 'green' },
  'input-required': { label: '? input', color: 'yellow' },
  accepted: { label: '✓ accepted', color: 'cyan' },
  submitted: { label: '○ submitted', color: 'gray' },
};

interface TasksPanelProps {
  cwd?: string;
}

export default function TasksPanel({ cwd }: TasksPanelProps) {
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

interface TaskRowProps {
  task: TaskInfo;
}

function TaskRow({ task }: TaskRowProps) {
  const meta = STATUS_META[task.status] ?? { label: task.status, color: 'white' };
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
