import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import ConversationFlow from './ConversationFlow.jsx';
import { makeCtx, waitFor } from '../test-utils.js';

const ENTER = '\r';
const DOWN = '\u001B[B';
const ESC = '\u001B';

let cleanup;

afterEach(() => {
  // Ensure Ink instance is torn down between tests
  cleanup?.();
  cleanup = null;
});

function renderFlow(ctx = makeCtx()) {
  const onSelect = vi.fn();
  const result = render(
    React.createElement(ConversationFlow, { ctx, onSelect })
  );
  cleanup = result.unmount;
  return { ...result, onSelect };
}

describe('ConversationFlow', () => {
  it('should render the root question on mount', () => {
    const { lastFrame } = renderFlow();
    expect(lastFrame()).toContain('What brings you here today?');
  });

  it('should show all root options', () => {
    const { lastFrame } = renderFlow();
    expect(lastFrame()).toContain('Build something new');
    expect(lastFrame()).toContain('Fix or improve something');
    expect(lastFrame()).toContain('Explore & understand');
    expect(lastFrame()).toContain('Ship or deploy');
  });

  it('should navigate to next node when selecting an option with next', async () => {
    const { lastFrame, stdin } = renderFlow();

    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('What kind of thing?'));
  });

  it('should navigate to fix-where on second option', async () => {
    const { lastFrame, stdin } = renderFlow();

    // ink-select-input processes DOWN and ENTER internally.
    // Send DOWN first, yield to the event loop, then send ENTER.
    stdin.write(DOWN);
    // Yield twice to ensure ink-select-input processes the cursor move
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('Where does the problem live?'));
  });

  it('should show command suggestion and call onSelect when reaching a leaf', async () => {
    const { lastFrame, stdin, onSelect } = renderFlow();

    // Build something new → first option (API / backend service)
    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('What kind of thing?'));

    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('Got it'));

    expect(lastFrame()).toContain('/team-backend');
    expect(onSelect).toHaveBeenCalledWith('/team-backend');
  });

  it('should show hint text for selected command', async () => {
    const { lastFrame, stdin } = renderFlow();

    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('What kind of thing?'));

    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('Backend team handles API'));
  });

  it('should show breadcrumbs after navigating deeper', async () => {
    const { lastFrame, stdin } = renderFlow();

    stdin.write(ENTER);
    await waitFor(() => {
      const frame = lastFrame();
      expect(frame).toContain('What kind of thing?');
      expect(frame).toContain('Build something new');
    });
  });

  it('should navigate back on Escape', async () => {
    const { lastFrame, stdin } = renderFlow();

    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('What kind of thing?'));

    stdin.write(ESC);
    await waitFor(() => expect(lastFrame()).toContain('What brings you here today?'));
  });

  it('should not navigate back from root on Escape', async () => {
    const { lastFrame, stdin } = renderFlow();

    stdin.write(ESC);
    await waitFor(() => expect(lastFrame()).toContain('What brings you here today?'));
  });

  it('should show "esc to go back" hint when not at root', async () => {
    const { lastFrame, stdin } = renderFlow();

    stdin.write(ENTER);
    await waitFor(() => expect(lastFrame()).toContain('esc to go back'));
  });

  it('should show error for unknown node', () => {
    const { lastFrame } = renderFlow();
    expect(lastFrame()).toContain('What brings you here today?');
  });
});
