#!/usr/bin/env node

/**
 * ak-start — interactive entry point for AgentKit Forge.
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
import App from './components/App.jsx';

const args = process.argv.slice(2);

// JSON mode for scripting / piping
if (args.includes('--json')) {
  const ctx = detect();
  process.stdout.write(JSON.stringify(ctx, null, 2) + '\n');
  process.exit(0);
}

// Detect context (Phase 1 — silent)
const ctx = detect();

// Render interactive TUI (Phase 2 + 3)
render(React.createElement(App, { ctx }));
