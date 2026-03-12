# Plan: End-to-End Implementation — Interactive TUI Entry Point

## Goal

Make the `ak-start` TUI a production-ready, fully tested, documented feature that integrates cleanly with the existing `/start` Claude command and the AgentKit Forge workflow.

## Assumptions

- The TUI is a **companion** to the `/start` Claude command, not a replacement. `/start` runs inside Claude sessions; `ak-start` runs in a standalone terminal.
- Vitest is the test framework. A root-level vitest config will be created since tests live in `src/`, not `.agentkit/`.
- Ink v6 supports `ink-testing-library` for component tests.
- The conversation tree and command registry are the correct abstractions — no architectural rework needed.
- The 80% coverage target applies to the new `src/start/` code.

## Steps

### Phase 1 — Test Infrastructure & Unit Tests (blocking)

1. **Create root vitest config** — Add `vitest.config.mjs` at repo root targeting `src/**/*.test.js`. This is separate from `.agentkit/vitest.config.mjs` which tests the sync engine.

2. **Add test dependencies** — Install `vitest` and `ink-testing-library` as dev dependencies at root.

3. **Write unit tests for `detect.js`** — File: `src/start/lib/detect.test.js`. Cover:
   - Brand-new repo (no `.agentkit/`, no `AGENT_TEAMS.md`, no orchestrator state)
   - Discovered repo (has `AGENT_TEAMS.md`, no orchestrator)
   - Mid-session repo (has orchestrator.json with currentPhase)
   - Uncommitted changes (mock `git status --porcelain` output)
   - Malformed orchestrator.json (should not crash)
   - Empty AGENT_TEAMS.md (should return empty teams array)
   - Backlog counting with various table formats
   - Team parsing with real AGENT_TEAMS.md format
   - Fallback team parsing from `.claude/commands/team-*.md` files
   - Lock detection

4. **Write unit tests for `commands.js`** — File: `src/start/lib/commands.test.js`. Cover:
   - `getAllCommands()` includes both static commands and dynamic team commands
   - `rankCommands()` sorts by score descending
   - Context-specific ranking: `/discover` scores high on brand-new repos, low on discovered repos
   - `/orchestrate` scores high when discovery is done but no active session
   - Fuse.js search integration: verify fuzzy matching works for common queries

5. **Write component tests for `ConversationFlow.jsx`** — File: `src/start/components/ConversationFlow.test.js`. Cover:
   - Renders root question on mount
   - Navigating to a leaf node shows command suggestion
   - Breadcrumbs update as user navigates deeper
   - All tree paths lead to a valid command (exhaustive path test)
   - `onSelect` callback fires with the correct command string

6. **Write component tests for `CommandPalette.jsx`** — File: `src/start/components/CommandPalette.test.js`. Cover:
   - Renders all commands grouped by category on empty search
   - Typing a query filters commands via fuzzy search
   - Arrow keys move cursor
   - Enter key fires `onSelect` with the selected command
   - Escape key fires `onBack`
   - Star indicator appears for high-score commands

7. **Write component tests for `StatusBar.jsx`** — File: `src/start/components/StatusBar.test.js`. Cover:
   - Shows "AK ✓" when forge is initialised and synced
   - Shows "AK ✗" when not initialised
   - Shows phase name when orchestrator has active phase
   - Shows backlog count
   - Shows branch name (truncated if long)
   - Shows "clean ✓" vs "N changed"
   - Shows lock indicator when locked

8. **Write component tests for `App.jsx`** — File: `src/start/components/App.test.js`. Cover:
   - First-run context starts in conversation mode
   - Discovered context starts in palette mode
   - Tab key toggles between modes
   - Uncommitted changes warning renders when flow === 'uncommitted'
   - Mid-session context shows phase info
   - Command selection shows result with suggested command

9. **Add `test:start` script** to `package.json` — Run only TUI tests: `vitest run --config vitest.config.mjs`.

10. **Verify coverage** — Run `vitest run --coverage` and ensure ≥ 80% on `src/start/`.

### Phase 2 — Error Handling & Edge Cases

11. **Add TTY detection to `index.js`** — Before calling `render()`, check `process.stdin.isTTY`. If not a TTY, output the JSON context and a message suggesting `--json` flag instead of crashing.

12. **Add error boundary to `App.jsx`** — Wrap the main content in a React error boundary component that catches render errors and displays a fallback message with the error, plus the `--json` alternative.

13. **Validate orchestrator.json schema in `detect.js`** — After JSON.parse, check that `currentPhase` is a number 1-5. If not, treat as no state.

14. **Handle missing git** — In `detect.js`, if `git` is not available (command not found), set branch to `(no git)`, isClean to true, uncommittedCount to 0, and flow to `brand-new`.

15. **Extract conversation tree to config** — Move the `TREE` constant from `ConversationFlow.jsx` to `src/start/lib/conversation-tree.js` so it can be tested independently and extended without touching the component.

### Phase 3 — Documentation

16. **Add `--help` flag** — In `index.js`, handle `--help` to print usage information (modes, flags, keyboard shortcuts).

17. **Update the `/start` command** — Add a section to `.claude/commands/start.md` noting that users can also run `pnpm start` or `ak-start` for an interactive TUI experience outside of Claude sessions.

### Phase 4 — Polish

18. **Add terminal width awareness** — In `CommandPalette.jsx`, use `useStdout()` from ink to get terminal width and truncate command descriptions that would overflow.

19. **Add `--no-color` flag** — Respect `NO_COLOR` env var per https://no-color.org/ standard. Ink supports this natively but verify it works.

20. **Add process cleanup** — In `index.js`, handle `SIGINT` and `SIGTERM` to cleanly unmount ink before exit.

## File Touch List

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `vitest.config.mjs` | CREATE | Root vitest config for `src/` tests |
| 2 | `package.json` | MODIFY | Add vitest, ink-testing-library devDeps; add `test:start` script |
| 3 | `src/start/lib/detect.test.js` | CREATE | Unit tests for context detection |
| 4 | `src/start/lib/commands.test.js` | CREATE | Unit tests for command registry and ranking |
| 5 | `src/start/components/ConversationFlow.test.js` | CREATE | Component tests for conversation flow |
| 6 | `src/start/components/CommandPalette.test.js` | CREATE | Component tests for command palette |
| 7 | `src/start/components/StatusBar.test.js` | CREATE | Component tests for status bar |
| 8 | `src/start/components/App.test.js` | CREATE | Component tests for root app |
| 9 | `src/start/index.js` | MODIFY | Add TTY detection, --help flag, process cleanup |
| 10 | `src/start/components/App.jsx` | MODIFY | Add error boundary |
| 11 | `src/start/lib/detect.js` | MODIFY | Improve error handling, validate schemas |
| 12 | `src/start/lib/conversation-tree.js` | CREATE | Extracted conversation tree config |
| 13 | `src/start/components/ConversationFlow.jsx` | MODIFY | Import tree from separate file |
| 14 | `src/start/components/CommandPalette.jsx` | MODIFY | Terminal width awareness |
| 15 | `.claude/commands/start.md` | MODIFY | Add TUI cross-reference note |

## Validation Plan

```bash
# 1. Install test dependencies
pnpm add -D vitest @vitest/coverage-v8 ink-testing-library

# 2. Run the full test suite
pnpm run test:start

# 3. Run with coverage
pnpm run test:start -- --coverage

# 4. Verify coverage meets threshold
# Look for: All files >= 80% lines, branches, functions

# 5. Build the TUI
pnpm run start:build

# 6. Test JSON mode
node dist/start/index.js --json

# 7. Test help flag
node dist/start/index.js --help

# 8. Test TTY detection (pipe to cat to simulate non-TTY)
echo "" | node dist/start/index.js 2>&1

# 9. Run existing project tests (ensure no regressions)
pnpm test
```

## Rollback Plan

All changes are in `src/start/` (new files) and `package.json` (additive). Rollback:
```bash
git revert <commit-sha>   # Revert the implementation commits
pnpm install              # Restore original dependencies
```
No database migrations, no infrastructure changes, no breaking API changes.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `ink-testing-library` may not support Ink v6 | Tests won't work | Check compatibility before installing; fall back to snapshot testing with `render().lastFrame()` |
| React 19 breaking changes with ink-testing-library | Component tests fail | Pin ink-testing-library version; use `@testing-library/react` patterns adapted for ink |
| Terminal width differences across environments | Layout breaks on narrow terminals | Use `useStdout()` hook and set sensible minimums (80 cols) |
| ConversationFlow tree grows complex | Hard to maintain and test | Extraction to config file (Step 15) makes it data-driven and testable |
| esbuild JSX transform changes | Build breaks | Pin esbuild version (already done in package.json) |
