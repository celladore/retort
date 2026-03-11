/**
 * App — root component for the /start TUI.
 *
 * Manages the two-mode hybrid:
 *   1. ConversationFlow (first-run or explicit) — guided dialogue tree
 *   2. CommandPalette (returning users or Tab) — fuzzy search palette
 *
 * StatusBar is always visible at the bottom.
 *
 * Keyboard:
 *   Tab    — toggle between conversation and palette
 *   Ctrl+C — exit
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import StatusBar from './StatusBar.jsx';
import ConversationFlow from './ConversationFlow.jsx';
import CommandPalette from './CommandPalette.jsx';

/**
 * @param {{ ctx: import('../lib/detect.js').RepoContext }} props
 */
export default function App({ ctx }) {
  const { exit } = useApp();

  // Determine initial mode based on context
  const isFirstRun = !ctx.discoveryDone && !ctx.hasOrchestratorState;
  const [mode, setMode] = useState(isFirstRun ? 'conversation' : 'palette');
  const [result, setResult] = useState(null);

  // Toggle between modes with Tab
  useInput((input, key) => {
    if (key.tab && !result) {
      setMode((m) => (m === 'conversation' ? 'palette' : 'conversation'));
    }
  });

  function handleCommandSelected(command) {
    setResult(command);
  }

  // If a command was selected, show the result and exit
  if (result) {
    return (
      <Box flexDirection="column" gap={1}>
        <Header ctx={ctx} mode={mode} />

        <Box paddingX={2} flexDirection="column" gap={1}>
          <Text color="green" bold>→ Run this in your Claude session:</Text>
          <Box>
            <Text>  </Text>
            <Text color="cyan" bold backgroundColor="gray">{` ${result} `}</Text>
          </Box>
          <Text color="gray" dimColor>
            Or describe your task in natural language — Claude will route it.
          </Text>
        </Box>

        <StatusBar ctx={ctx} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Header ctx={ctx} mode={mode} />

      {/* Uncommitted changes warning */}
      {ctx.flow === 'uncommitted' && (
        <Box paddingX={2}>
          <Text color="yellow">
            ⚠ {ctx.uncommittedCount} uncommitted change{ctx.uncommittedCount === 1 ? '' : 's'} detected.
            Consider committing or stashing before starting new work.
          </Text>
        </Box>
      )}

      {/* Mid-session context */}
      {ctx.flow === 'mid-session' && (
        <Box paddingX={2}>
          <Text color="cyan">
            ↻ Active session — Phase {ctx.orchestratorPhase}: {ctx.phaseName}
            {ctx.activeTaskCount > 0 && ` (${ctx.activeTaskCount} active task${ctx.activeTaskCount === 1 ? '' : 's'})`}
          </Text>
        </Box>
      )}

      {/* Main content area */}
      {mode === 'conversation' ? (
        <ConversationFlow ctx={ctx} onSelect={handleCommandSelected} />
      ) : (
        <CommandPalette ctx={ctx} onSelect={handleCommandSelected} onBack={() => setMode('conversation')} />
      )}

      <StatusBar ctx={ctx} />
    </Box>
  );
}

function Header({ ctx, mode }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1}>
        <Text color="blue" bold>AgentKit Forge</Text>
        <Text color="gray">—</Text>
        <Text color="white">Start</Text>
      </Box>
      <Box gap={2}>
        <Text color={mode === 'conversation' ? 'cyan' : 'gray'} bold={mode === 'conversation'}>
          {mode === 'conversation' ? '● Guide' : '○ Guide'}
        </Text>
        <Text color={mode === 'palette' ? 'cyan' : 'gray'} bold={mode === 'palette'}>
          {mode === 'palette' ? '● Palette' : '○ Palette'}
        </Text>
        <Text color="gray" dimColor>
          (Tab to switch)
        </Text>
      </Box>
    </Box>
  );
}
