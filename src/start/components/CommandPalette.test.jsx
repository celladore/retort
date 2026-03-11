import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import CommandPalette from './CommandPalette.jsx';
import { makeCtx, waitFor } from '../test-utils.js';

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

  it('should filter commands when typing a query', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame, stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    stdin.write('discover');

    const frame = lastFrame();
    expect(frame).toContain('/discover');
  });

  it('should show "No matching commands" for unmatched query', async () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame, stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    stdin.write('xyznonexistentqueryzzz');
    await waitFor(() => expect(lastFrame()).toContain('No matching commands'));
  });

  it('should show star indicator for recommended commands', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { lastFrame } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );
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
    stdin.write('\u001B');
    await waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('should call onSelect with command id when Enter is pressed', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const { stdin } = render(
      React.createElement(CommandPalette, { ctx: makeCtx(), onSelect, onBack })
    );

    stdin.write('\r');

    expect(onSelect).toHaveBeenCalled();
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

    stdin.write('\u001B[B');

    const frame = lastFrame();
    expect(frame).toContain('❯');
  });
});
