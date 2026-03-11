import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import StatusBar from './StatusBar.jsx';

function makeCtx(overrides = {}) {
  return {
    forgeInitialised: true,
    syncRun: true,
    discoveryDone: true,
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
    flow: 'discovered',
    teams: [],
    ...overrides,
  };
}

describe('StatusBar', () => {
  it('should show AK ✓ when forge is initialised and synced', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: makeCtx() }));
    expect(lastFrame()).toContain('AK ✓');
  });

  it('should show AK ✗ when forge is not initialised', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { ctx: makeCtx({ forgeInitialised: false }) })
    );
    expect(lastFrame()).toContain('AK ✗');
  });

  it('should show AK ✗ when sync has not run', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, { ctx: makeCtx({ syncRun: false }) })
    );
    expect(lastFrame()).toContain('AK ✗');
  });

  it('should show phase name when orchestrator has active phase', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ orchestratorPhase: 3, phaseName: 'Implementation' }),
      })
    );
    expect(lastFrame()).toContain('Phase 3: Implementation');
  });

  it('should show Phase: — when no active phase', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: makeCtx() }));
    expect(lastFrame()).toContain('Phase: —');
  });

  it('should show backlog count when items exist', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ hasBacklog: true, backlogCount: 5 }),
      })
    );
    expect(lastFrame()).toContain('5');
  });

  it('should show 0 backlog when empty', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: makeCtx() }));
    expect(lastFrame()).toContain('0');
  });

  it('should show active task count when tasks exist', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ activeTaskCount: 3 }),
      })
    );
    expect(lastFrame()).toContain('3 tasks');
  });

  it('should use singular "task" for count of 1', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ activeTaskCount: 1 }),
      })
    );
    expect(lastFrame()).toContain('1 task');
    expect(lastFrame()).not.toContain('1 tasks');
  });

  it('should not show task segment when count is 0', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: makeCtx() }));
    expect(lastFrame()).not.toContain('task');
  });

  it('should show branch name', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ branch: 'feat/my-feature' }),
      })
    );
    expect(lastFrame()).toContain('feat/my-feature');
  });

  it('should truncate long branch names', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ branch: 'feat/this-is-a-very-long-branch-name-that-exceeds-limit' }),
      })
    );
    const frame = lastFrame();
    expect(frame).not.toContain('feat/this-is-a-very-long-branch-name-that-exceeds-limit');
    expect(frame).toContain('…');
  });

  it('should show clean ✓ when working tree is clean', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: makeCtx() }));
    expect(lastFrame()).toContain('clean ✓');
  });

  it('should show change count when working tree is dirty', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ isClean: false, uncommittedCount: 4 }),
      })
    );
    expect(lastFrame()).toContain('4 changed');
  });

  it('should show lock indicator when locked', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        ctx: makeCtx({ lockHeld: true }),
      })
    );
    expect(lastFrame()).toContain('locked');
  });

  it('should not show lock indicator when not locked', () => {
    const { lastFrame } = render(React.createElement(StatusBar, { ctx: makeCtx() }));
    expect(lastFrame()).not.toContain('locked');
  });
});
