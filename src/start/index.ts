#!/usr/bin/env node

/**
 * ak-start — interactive entry point for Retort.
 *
 * Replaces the static markdown output of `/start` with a terminal UI
 * that combines two modes:
 *
 *   1. Conversation Flow — guided dialogue tree for new users
 *   2. Command Palette — fuzzy-searchable, context-ranked command list
 *
 * A persistent status bar shows repository state at a glance.
 *
 * Usage:
 *   node src/start/index.js          # interactive TUI
 *   node src/start/index.js --json   # output context as JSON (for scripts)
 */

import React from 'react';
import { render } from 'ink';
import { detect } from './lib/detect.js';
import App from './components/App.js';

const args = process.argv.slice(2);

// Help flag
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(
    [
      'ak-start — interactive entry point for Retort',
      '',
      'Usage:',
      '  ak-start          Interactive TUI (requires a terminal)',
      '  ak-start --json   Output context as JSON (for scripts)',
      '  ak-start --help   Show this help message',
      '',
      'Modes:',
      '  Guide    Guided dialogue tree for choosing the right command',
      '  Palette  Fuzzy-searchable, context-ranked command list',
      '',
      'Keyboard:',
      '  Tab      Toggle between Guide and Palette modes',
      '  ↑/↓     Navigate options',
      '  Enter    Select',
      '  Esc      Go back (Palette mode)',
      '  Ctrl+C   Exit',
      '',
    ].join('\n')
  );
  process.exit(0);
}

/** Detect context and write JSON to stdout. */
function dumpContextJson() {
  const ctx = detect();
  process.stdout.write(JSON.stringify(ctx, null, 2) + '\n');
  return ctx;
}

// JSON mode for scripting / piping
if (args.includes('--json')) {
  dumpContextJson();
  process.exit(0);
}

// TTY check — Ink requires an interactive terminal
if (!process.stdin.isTTY) {
  process.stderr.write('ak-start: not a terminal. Use --json for non-interactive output.\n');
  dumpContextJson();
  process.exit(1);
}

// Detect context (Phase 1 — silent)
const ctx = detect();

// Render interactive TUI (Phase 2 + 3)
const inkInstance = render(React.createElement(App, { ctx }));

// Clean exit on signals — unmount Ink before exiting
const cleanup = () => {
  inkInstance.unmount();
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
