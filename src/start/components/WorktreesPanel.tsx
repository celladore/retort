/**
 * WorktreesPanel — displays active git worktrees in the TUI.
 *
 * Lists all worktrees for the current repo, highlighting agent-owned
 * branches (those matching the feat|fix|chore/agent-<name>/ convention).
 *
 * Renders nothing if there is only one worktree (the main one), or if no
 * worktree is agent-owned, since there is nothing interesting to show.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { getAgentWorktrees, type WorktreeInfo } from '../lib/worktrees.js';

interface WorktreesPanelProps {
  cwd?: string;
}

export default function WorktreesPanel({ cwd }: WorktreesPanelProps) {
  const worktrees = getAgentWorktrees(cwd);

  if (worktrees.length <= 1 || !worktrees.some((w) => w.isAgent)) return null;

  return (
    <Box flexDirection="column" paddingX={2} gap={0}>
      <Text color="gray" dimColor>
        Active worktrees
      </Text>
      {worktrees.map((wt) => (
        <WorktreeRow key={wt.path} wt={wt} />
      ))}
    </Box>
  );
}

interface WorktreeRowProps {
  wt: WorktreeInfo;
}

function WorktreeRow({ wt }: WorktreeRowProps) {
  const label = wt.isMain ? '(main)' : wt.branch || '(detached)';
  const color = wt.isMain ? 'gray' : wt.isAgent ? 'cyan' : 'white';

  return (
    <Box gap={1}>
      <Text color={color}>{wt.isAgent ? '⚡' : '○'}</Text>
      <Text color={color}>{label}</Text>
      {wt.head && (
        <Text color="gray" dimColor>
          {wt.head}
        </Text>
      )}
    </Box>
  );
}
