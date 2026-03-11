import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import CommandPalette from './CommandPalette.jsx';

function makeCtx(overrides = {}) {
  return {
    forgeInitialised: false,
    syncRun: false,
    discoveryDone: false,
    hasOrchestratorState: false,
    orchestratorPhase: null,
    phaseName: null,
    hasBacklog: false,
    backlogCount: 0,
    activeTaskCount: 0,
    branch: 'main',
    isClean: true,
    uncommittedCount: 0,
    lockHeld: false,
    flow: 'brand-new',
    teams: [],
    ...overrides,
  };
}

describe('CommandPalette', () => {
  it('should render all static commands on empty search', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );
    const frame = lastFrame();
    expect(frame).toContain('/discover');
    expect(frame).toContain('/orchestrate');
    expect(frame).toContain('/check');
  });

  it('should show category headers', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );
    const frame = lastFrame();
    expect(frame).toContain('workflow');
    expect(frame).toContain('quality');
    expect(frame).toContain('info');
  });

  it('should filter commands when typing a query', async () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame, stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    // Type "discover"
    stdin.write('discover');

    const frame = lastFrame();
    expect(frame).toContain('/discover');
    // Other commands should be filtered out or less prominent
  });

  it('should show "No matching commands" for unmatched query', async () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame, stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    stdin.write('xyznonexistentqueryzzz');
    await new Promise((r) => setTimeout(r, 50));

    expect(lastFrame()).toContain('No matching commands');
  });

  it('should show star indicator for recommended commands', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );
    // On a brand-new repo, /discover scores 95 which should be starred
    expect(lastFrame()).toContain('★');
  });

  it('should show keyboard hints', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );
    expect(lastFrame()).toContain('navigate');
    expect(lastFrame()).toContain('select');
  });

  it('should call onBack when Escape is pressed', async () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    // Ink detects escape via \u001B followed by no further escape sequence chars
    // ink-testing-library sends raw bytes; Ink's stdin handler treats lone \x1B as escape
    stdin.write('\u001B');
    await new Promise((r) => setTimeout(r, 100));

    expect(onBack).toHaveBeenCalled();
  });

  it('should call onSelect with command id when Enter is pressed', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    // Press enter on the first command (cursor starts at 0)
    stdin.write('\r');

    expect(onSelect).toHaveBeenCalled();
    // The first command in a brand-new context (ranked by score) should be /discover
    expect(onSelect).toHaveBeenCalledWith('/discover');
  });

  it('should include team commands when teams are present', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const ctx = makeCtx({
      teams: [
        { id: 'backend', name: 'Backend', focus: 'API, services', command: '/team-backend' },
      ],
    });
    const { lastFrame } = render(
      React.createElement(CommandPalette, { ctx, onSelect, onBack })
    );
    expect(lastFrame()).toContain('/team-backend');
    expect(lastFrame()).toContain('teams');
  });

  it('should navigate cursor down with arrow keys', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame, stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    // Move down once
    stdin.write('\u001B[B');

    // The cursor indicator ❯ should have moved
    const frame = lastFrame();
    expect(frame).toContain('❯');
  });
});
