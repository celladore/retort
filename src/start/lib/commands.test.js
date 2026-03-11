import { describe, it, expect } from 'vitest';
import { COMMANDS, getAllCommands, rankCommands } from './commands.js';

/** Helper to create a minimal context object */
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

describe('COMMANDS', () => {
  it('should have unique ids', () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have a rank function on every command', () => {
    for (const cmd of COMMANDS) {
      expect(typeof cmd.rank).toBe('function');
    }
  });

  it('should have valid categories', () => {
    const validCategories = ['workflow', 'quality', 'info'];
    for (const cmd of COMMANDS) {
      expect(validCategories).toContain(cmd.category);
    }
  });
});

describe('getAllCommands', () => {
  it('should include static commands when no teams', () => {
    const ctx = makeCtx();
    const cmds = getAllCommands(ctx);
    expect(cmds.length).toBe(COMMANDS.length);
  });

  it('should add team commands from context', () => {
    const ctx = makeCtx({
      teams: [
        { id: 'backend', name: 'Backend', focus: 'API, services', command: '/team-backend' },
        { id: 'frontend', name: 'Frontend', focus: 'UI, components', command: '/team-frontend' },
      ],
    });
    const cmds = getAllCommands(ctx);
    expect(cmds.length).toBe(COMMANDS.length + 2);
    expect(cmds.find((c) => c.id === '/team-backend')).toBeDefined();
    expect(cmds.find((c) => c.id === '/team-frontend')).toBeDefined();
  });

  it('should filter out forge and strategic-ops teams', () => {
    const ctx = makeCtx({
      teams: [
        { id: 'forge', name: 'Forge', focus: 'Meta', command: '/team-forge' },
        { id: 'strategic-ops', name: 'StratOps', focus: 'Coordination', command: '/team-strategic-ops' },
        { id: 'backend', name: 'Backend', focus: 'API', command: '/team-backend' },
      ],
    });
    const cmds = getAllCommands(ctx);
    expect(cmds.find((c) => c.id === '/team-forge')).toBeUndefined();
    expect(cmds.find((c) => c.id === '/team-strategic-ops')).toBeUndefined();
    expect(cmds.find((c) => c.id === '/team-backend')).toBeDefined();
  });

  it('should assign category "team" to team commands', () => {
    const ctx = makeCtx({
      teams: [
        { id: 'backend', name: 'Backend', focus: 'API', command: '/team-backend' },
      ],
    });
    const cmds = getAllCommands(ctx);
    const teamCmd = cmds.find((c) => c.id === '/team-backend');
    expect(teamCmd.category).toBe('team');
  });
});

describe('rankCommands', () => {
  it('should sort commands by score descending', () => {
    const ctx = makeCtx();
    const cmds = getAllCommands(ctx);
    const ranked = rankCommands(cmds, ctx);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('should add score property to each command', () => {
    const ctx = makeCtx();
    const ranked = rankCommands(COMMANDS, ctx);
    for (const cmd of ranked) {
      expect(typeof cmd.score).toBe('number');
    }
  });

  describe('contextual ranking', () => {
    it('should rank /discover highly on brand-new repos', () => {
      const ctx = makeCtx({ discoveryDone: false });
      const ranked = rankCommands(COMMANDS, ctx);
      const discover = ranked.find((c) => c.id === '/discover');
      expect(discover.score).toBe(95);
    });

    it('should rank /discover low after discovery is done', () => {
      const ctx = makeCtx({ discoveryDone: true });
      const ranked = rankCommands(COMMANDS, ctx);
      const discover = ranked.find((c) => c.id === '/discover');
      expect(discover.score).toBe(20);
    });

    it('should rank /orchestrate high when discovery done but no session', () => {
      const ctx = makeCtx({ discoveryDone: true, hasOrchestratorState: false });
      const ranked = rankCommands(COMMANDS, ctx);
      const orchestrate = ranked.find((c) => c.id === '/orchestrate');
      expect(orchestrate.score).toBe(90);
    });

    it('should rank /orchestrate high when mid-session', () => {
      const ctx = makeCtx({ discoveryDone: true, hasOrchestratorState: true });
      const ranked = rankCommands(COMMANDS, ctx);
      const orchestrate = ranked.find((c) => c.id === '/orchestrate');
      expect(orchestrate.score).toBe(85);
    });

    it('should rank /check higher when working tree is dirty', () => {
      const dirtyCtx = makeCtx({ isClean: false });
      const cleanCtx = makeCtx({ isClean: true });
      const dirtyRank = rankCommands(COMMANDS, dirtyCtx).find((c) => c.id === '/check');
      const cleanRank = rankCommands(COMMANDS, cleanCtx).find((c) => c.id === '/check');
      expect(dirtyRank.score).toBeGreaterThan(cleanRank.score);
    });

    it('should rank /backlog higher when backlog has items', () => {
      const withBacklog = makeCtx({ hasBacklog: true });
      const noBacklog = makeCtx({ hasBacklog: false });
      const withRank = rankCommands(COMMANDS, withBacklog).find((c) => c.id === '/backlog');
      const noRank = rankCommands(COMMANDS, noBacklog).find((c) => c.id === '/backlog');
      expect(withRank.score).toBeGreaterThan(noRank.score);
    });

    it('should rank /project-status higher when orchestrator is active', () => {
      const active = makeCtx({ hasOrchestratorState: true });
      const inactive = makeCtx({ hasOrchestratorState: false });
      const activeRank = rankCommands(COMMANDS, active).find((c) => c.id === '/project-status');
      const inactiveRank = rankCommands(COMMANDS, inactive).find((c) => c.id === '/project-status');
      expect(activeRank.score).toBeGreaterThan(inactiveRank.score);
    });
  });
});
