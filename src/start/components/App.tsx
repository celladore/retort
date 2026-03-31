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

import React, { useState, useEffect, Component, type ReactNode } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import StatusBar from './StatusBar.js';
import MCPPanel from './MCPPanel.js';
import TasksPanel from './TasksPanel.js';
import ConversationFlow from './ConversationFlow.js';
import CommandPalette from './CommandPalette.js';
import type { RepoContext } from '../lib/detect.js';

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error) {
      return React.createElement(
        Box,
        { flexDirection: 'column', padding: 1 },
        React.createElement(Text, { color: 'red', bold: true }, 'ak-start encountered an error:'),
        React.createElement(
          Text,
          { color: 'red' },
          String(this.state.error.message || this.state.error)
        ),
        React.createElement(Text, { color: 'gray', dimColor: true }, 'Try: ak-start --json')
      );
    }
    return this.props.children;
  }
}

interface AppProps {
  ctx: RepoContext;
}

export default function App({ ctx }: AppProps) {
  return (
    <ErrorBoundary>
      <AppInner ctx={ctx} />
    </ErrorBoundary>
  );
}

type Mode = 'conversation' | 'palette';

function AppInner({ ctx }: AppProps) {
  const { exit } = useApp();

  const isFirstRun = !ctx.discoveryDone && !ctx.hasOrchestratorState;
  const [mode, setMode] = useState<Mode>(isFirstRun ? 'conversation' : 'palette');
  const [result, setResult] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.tab && !result) {
      setMode((m) => (m === 'conversation' ? 'palette' : 'conversation'));
    }
  });

  function handleCommandSelected(command: string) {
    setResult(command);
  }

  useEffect(() => {
    if (result) {
      exit();
    }
  }, [result, exit]);

  if (result) {
    return (
      <Box flexDirection="column" gap={1}>
        <Header mode={mode} />

        <Box paddingX={2} flexDirection="column" gap={1}>
          <Text color="green" bold>
            → Run this in your Claude session:
          </Text>
          <Box>
            <Text> </Text>
            <Text color="cyan" bold backgroundColor="gray">{` ${result} `}</Text>
          </Box>
          <Text color="gray" dimColor>
            Or describe your task in natural language — Claude will route it.
          </Text>
        </Box>

        <TasksPanel />
        <MCPPanel />
        <StatusBar ctx={ctx} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Header mode={mode} />

      {/* Uncommitted changes warning */}
      {ctx.flow === 'uncommitted' && (
        <Box paddingX={2}>
          <Text color="yellow">
            ⚠ {ctx.uncommittedCount} uncommitted change{ctx.uncommittedCount === 1 ? '' : 's'}{' '}
            detected. Consider committing or stashing before starting new work.
          </Text>
        </Box>
      )}

      {/* Mid-session context */}
      {ctx.flow === 'mid-session' && (
        <Box paddingX={2}>
          <Text color="cyan">
            ↻ Active session — Phase {ctx.orchestratorPhase}: {ctx.phaseName}
            {ctx.activeTaskCount > 0 &&
              ` (${ctx.activeTaskCount} active task${ctx.activeTaskCount === 1 ? '' : 's'})`}
          </Text>
        </Box>
      )}

      {/* Main content area */}
      {mode === 'conversation' ? (
        <ConversationFlow ctx={ctx} onSelect={handleCommandSelected} />
      ) : (
        <CommandPalette
          ctx={ctx}
          onSelect={handleCommandSelected}
          onBack={() => setMode('conversation')}
        />
      )}

      <TasksPanel />
      <MCPPanel />
      <StatusBar ctx={ctx} />
    </Box>
  );
}

interface HeaderProps {
  mode: Mode;
}

function Header({ mode }: HeaderProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1}>
        <Text color="blue" bold>
          AgentKit Forge
        </Text>
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
