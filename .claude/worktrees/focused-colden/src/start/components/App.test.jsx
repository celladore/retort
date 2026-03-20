import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import App from './App.jsx';
import { makeCtx, waitFor } from '../test-utils.js';

describe('App', () => {
  it('should start in conversation mode for first-run context', () => {
    const { lastFrame } = render(React.createElement(App, { ctx: makeCtx() }));
    const frame = lastFrame();
    expect(frame).toContain('● Guide');
    expect(frame).toContain('○ Palette');
    expect(frame).toContain('What brings you here today?');
  });

  it('should start in palette mode for discovered context', () => {
    const ctx = makeCtx({ discoveryDone: true, flow: 'discovered' });
    const { lastFrame } = render(React.createElement(App, { ctx }));
    const frame = lastFrame();
    expect(frame).toContain('○ Guide');
    expect(frame).toContain('● Palette');
    expect(frame).toContain('/discover');
  });

  it('should start in palette mode for mid-session context', () => {
    const ctx = makeCtx({
      discoveryDone: true,
      hasOrchestratorState: true,
      orchestratorPhase: 3,
      phaseName: 'Implementation',
      flow: 'mid-session',
    });
    const { lastFrame } = render(React.createElement(App, { ctx }));
    expect(lastFrame()).toContain('● Palette');
  });

  it('should show header with AgentKit Forge branding', () => {
    const { lastFrame } = render(React.createElement(App, { ctx: makeCtx() }));
    expect(lastFrame()).toContain('AgentKit Forge');
    expect(lastFrame()).toContain('Start');
  });

  it('should show tab switch hint', () => {
    const { lastFrame } = render(React.createElement(App, { ctx: makeCtx() }));
    expect(lastFrame()).toContain('Tab to switch');
  });

  it('should toggle to palette mode on Tab', async () => {
    const { lastFrame, stdin } = render(React.createElement(App, { ctx: makeCtx() }));

    stdin.write('\t');
    await waitFor(() => expect(lastFrame()).toContain('● Palette'));
  });

  it('should toggle back to conversation mode on second Tab', async () => {
    const { lastFrame, stdin } = render(React.createElement(App, { ctx: makeCtx() }));

    stdin.write('\t');
    await waitFor(() => expect(lastFrame()).toContain('● Palette'));
    stdin.write('\t');
    await waitFor(() => expect(lastFrame()).toContain('● Guide'));
  });

  it('should show uncommitted changes warning when flow is uncommitted', () => {
    const ctx = makeCtx({
      flow: 'uncommitted',
      isClean: false,
      uncommittedCount: 3,
    });
    const { lastFrame } = render(React.createElement(App, { ctx }));
    expect(lastFrame()).toContain('3 uncommitted changes');
  });

  it('should show singular "change" for 1 uncommitted', () => {
    const ctx = makeCtx({
      flow: 'uncommitted',
      isClean: false,
      uncommittedCount: 1,
    });
    const { lastFrame } = render(React.createElement(App, { ctx }));
    expect(lastFrame()).toContain('1 uncommitted change ');
  });

  it('should show mid-session context with phase info', () => {
    const ctx = makeCtx({
      flow: 'mid-session',
      hasOrchestratorState: true,
      discoveryDone: true,
      orchestratorPhase: 4,
      phaseName: 'Validation',
      activeTaskCount: 2,
    });
    const { lastFrame } = render(React.createElement(App, { ctx }));
    expect(lastFrame()).toContain('Phase 4: Validation');
    expect(lastFrame()).toContain('2 active tasks');
  });

  it('should show singular "task" for 1 active task', () => {
    const ctx = makeCtx({
      flow: 'mid-session',
      hasOrchestratorState: true,
      discoveryDone: true,
      orchestratorPhase: 3,
      phaseName: 'Implementation',
      activeTaskCount: 1,
    });
    const { lastFrame } = render(React.createElement(App, { ctx }));
    expect(lastFrame()).toContain('1 active task)');
  });

  it('should always show the StatusBar', () => {
    const { lastFrame } = render(React.createElement(App, { ctx: makeCtx() }));
    expect(lastFrame()).toContain('AK');
  });

  it('should show result screen with selected command before exit', async () => {
    const { lastFrame, stdin } = render(React.createElement(App, { ctx: makeCtx() }));

    // Navigate: root → Build something new
    stdin.write('\r');
    await waitFor(() => expect(lastFrame()).toContain('What kind of thing?'));

    // Yield so ink-select-input can initialise before processing ENTER
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Select first leaf: API / backend service → triggers result screen + exit
    stdin.write('\r');
    await waitFor(() => {
      const frame = lastFrame();
      expect(frame).toContain('Run this in your Claude session');
      expect(frame).toContain('/team-backend');
    });
  });
});
