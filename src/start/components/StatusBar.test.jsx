import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import StatusBar from './StatusBar.jsx';
import { makeCtx } from '../test-utils.js';

// StatusBar tests use a "discovered" baseline where forge is initialised
const statusCtx = (overrides = {}) =>
  makeCtx({ forgeInitialised: true, syncRun: true, discoveryDone: true, flow: 'discovered', ...overrides });

describe('StatusBar', () => {
  it('should show AK ✓ when forge is initialised and synced', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: statusCtx() }));
    expect(lastFrame()).toContain('AK ✓');
  });

  it('should show AK ✗ when forge is not initialised', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { ctx: statusCtx({ forgeInitialised: false }) })
    );
    expect(lastFrame()).toContain('AK ✗');
  });

  it('should show AK ✗ when sync has not run', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { ctx: statusCtx({ syncRun: false }) })
    );
    expect(lastFrame()).toContain('AK ✗');
  });

  it('should show phase name when orchestrator has active phase', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ orchestratorPhase: 3, phaseName: 'Implementation' }),
      })
    );
    expect(lastFrame()).toContain('Phase 3: Implementation');
  });

  it('should show Phase: — when no active phase', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: statusCtx() }));
    expect(lastFrame()).toContain('Phase: —');
  });

  it('should show backlog count when items exist', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ hasBacklog: true, backlogCount: 5 }),
      })
    );
    expect(lastFrame()).toContain('5');
  });

  it('should show 0 backlog when empty', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: statusCtx() }));
    expect(lastFrame()).toContain('0');
  });

  it('should show active task count when tasks exist', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ activeTaskCount: 3 }),
      })
    );
    expect(lastFrame()).toContain('3 tasks');
  });

  it('should use singular "task" for count of 1', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ activeTaskCount: 1 }),
      })
    );
    expect(lastFrame()).toContain('1 task');
    expect(lastFrame()).not.toContain('1 tasks');
  });

  it('should not show task segment when count is 0', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: statusCtx() }));
    expect(lastFrame()).not.toContain('task');
  });

  it('should show branch name', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ branch: 'feat/my-feature' }),
      })
    );
    expect(lastFrame()).toContain('feat/my-feature');
  });

  it('should truncate long branch names', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ branch: 'feat/this-is-a-very-long-branch-name-that-exceeds-limit' }),
      })
    );
    const frame = lastFrame();
    expect(frame).not.toContain('feat/this-is-a-very-long-branch-name-that-exceeds-limit');
    expect(frame).toContain('…');
  });

  it('should show clean ✓ when working tree is clean', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: statusCtx() }));
    expect(lastFrame()).toContain('clean ✓');
  });

  it('should show change count when working tree is dirty', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ isClean: false, uncommittedCount: 4 }),
      })
    );
    expect(lastFrame()).toContain('4 changed');
  });

  it('should show lock indicator when locked', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: statusCtx({ lockHeld: true }),
      })
    );
    expect(lastFrame()).toContain('locked');
  });

  it('should not show lock indicator when not locked', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: statusCtx() }));
    expect(lastFrame()).not.toContain('locked');
  });
});
