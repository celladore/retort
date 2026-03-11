/**
 * CommandPalette — fuzzy-searchable, context-ranked command selector.
 *
 * Inspired by VS Code's Ctrl+K but built for the terminal and
 * aware of repository state. Commands are pre-ranked by contextual
 * relevance (starred = recommended). Type to fuzzy-filter.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │ > search query_                          │
 *   ├──────────────────────────────────────────┤
 *   │ ★ /discover     Scan codebase            │
 *   │   /healthcheck  Verify build & tests      │
 *   │   /orchestrate  Full lifecycle workflow    │
 *   │ ─────────── teams ───────────────────────│
 *   │   /team-backend   API, services           │
 *   └──────────────────────────────────────────┘
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Fuse from 'fuse.js';
import { getAllCommands, rankCommands } from '../lib/commands.js';

const CATEGORY_LABELS = {
  workflow: 'workflow',
  quality: 'quality',
  info: 'info',
  team: 'teams',
};

const CATEGORY_ORDER = ['workflow', 'quality', 'info', 'team'];

/** Fuse.js match tolerance — 0 = exact, 1 = anything. 0.4 balances typo tolerance vs. noise. */
const FUSE_THRESHOLD = 0.4;

/** Minimum score for a command to be shown with the ★ recommended indicator. */
const RECOMMENDED_SCORE = 70;

/**
 * @param {{
 *   ctx: import('../lib/detect.js').RepoContext,
 *   onSelect: (command: string) => void,
 *   onBack: () => void,
 * }} props
 */
export default function CommandPalette({ ctx, onSelect, onBack }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const allCommands = useMemo(() => {
    const cmds = getAllCommands(ctx);
    return rankCommands(cmds, ctx);
  }, [ctx]);

  const fuse = useMemo(
    () =>
      new Fuse(allCommands, {
        keys: ['id', 'label', 'desc', 'tags'],
        threshold: FUSE_THRESHOLD,
        includeScore: true,
      }),
    [allCommands]
  );

  // Filter commands
  const displayed = useMemo(() => {
    if (!query.trim()) return allCommands;
    return fuse.search(query).map((r) => r.item);
  }, [query, allCommands, fuse]);

  // Group by category (only when not searching)
  const grouped = useMemo(() => {
    if (query.trim()) return null; // Flat list during search
    const groups = {};
    for (const cmd of displayed) {
      const cat = cmd.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(cmd);
    }
    return groups;
  }, [displayed, query]);

  // Flat list for cursor navigation
  const flatList = useMemo(() => {
    if (grouped) {
      const items = [];
      for (const cat of CATEGORY_ORDER) {
        if (grouped[cat]) {
          items.push({ type: 'header', category: cat });
          items.push(...grouped[cat].map((cmd) => ({ type: 'command', ...cmd })));
        }
      }
      return items;
    }
    return displayed.map((cmd) => ({ type: 'command', ...cmd }));
  }, [grouped, displayed]);

  // Clamp cursor
  const commandItems = flatList.filter((i) => i.type === 'command');
  const clampedCursor = Math.min(cursor, Math.max(0, commandItems.length - 1));

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setCursor((prev) => Math.max(0, Math.min(prev, commandItems.length - 1) - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((prev) => Math.min(commandItems.length - 1, Math.min(prev, commandItems.length - 1) + 1));
      return;
    }
    if (key.return && commandItems[clampedCursor]) {
      onSelect(commandItems[clampedCursor].id);
      return;
    }
  });

  const topScore = allCommands[0]?.score ?? 0;

  // Pre-compute command indices for cursor tracking (keyed by id for stability)
  const commandIndices = useMemo(() => {
    const indices = new Map();
    let ci = 0;
    for (const item of flatList) {
      if (item.type === 'command') {
        indices.set(item.id, ci++);
      }
    }
    return indices;
  }, [flatList]);

  return (
    <Box flexDirection="column">
      {/* Search input */}
      <Box
        borderStyle="single"
        borderColor="cyan"
        paddingX={1}
      >
        <Text color="cyan" bold>{'> '}</Text>
        <TextInput
          value={query}
          onChange={(val) => {
            setQuery(val);
            setCursor(0);
          }}
          placeholder="What do you want to do?"
        />
      </Box>

      {/* Results */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        borderTop={false}
        paddingX={1}
      >
        {flatList.length === 0 && (
          <Text color="gray" dimColor>No matching commands</Text>
        )}

        {flatList.map((item, idx) => {
          if (item.type === 'header') {
            return (
              <Text key={`header-${item.category}`} color="gray" dimColor>
                {'  '}── {CATEGORY_LABELS[item.category] || item.category} ──
              </Text>
            );
          }

          const thisIndex = commandIndices.get(item.id) ?? 0;
          const isActive = thisIndex === clampedCursor;
          const isRecommended = item.score >= topScore && item.score >= RECOMMENDED_SCORE;

          return (
            <Box key={`cmd-${item.id}`} gap={1}>
              <Text color={isActive ? 'cyan' : 'white'} bold={isActive}>
                {isActive ? '❯' : ' '}
              </Text>
              <Text color={isRecommended ? 'yellow' : 'gray'}>
                {isRecommended ? '★' : ' '}
              </Text>
              <Text color={isActive ? 'cyan' : 'white'} bold={isActive}>
                {item.id.padEnd(18)}
              </Text>
              <Text color="gray" dimColor={!isActive}>
                {item.desc}
              </Text>
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ↑↓ navigate  ⏎ select  esc back  ★ = recommended
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
