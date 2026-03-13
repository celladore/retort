import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock execFileSync for git commands
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { detect } from './detect.js';

describe('detect', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ak-detect-'));
    // Default: git returns sensible values
    execFileSync.mockImplementation((cmd, args) => {
      if (args.includes('--show-current')) return 'main\n';
      if (args.includes('--porcelain')) return '\n';
      return '';
    });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('forge initialisation', () => {
    it('should detect when .agentkit/ does not exist', () => {
      const ctx = detect(root);
      expect(ctx.forgeInitialised).toBe(false);
    });

    it('should detect when .agentkit/ exists', () => {
      mkdirSync(join(root, '.agentkit'));
      const ctx = detect(root);
      expect(ctx.forgeInitialised).toBe(true);
    });
  });

  describe('sync status', () => {
    it('should detect sync has not run when orchestrate.md is missing', () => {
      const ctx = detect(root);
      expect(ctx.syncRun).toBe(false);
    });

    it('should detect sync has run when orchestrate.md exists', () => {
      mkdirSync(join(root, '.claude', 'commands'), { recursive: true });
      writeFileSync(join(root, '.claude', 'commands', 'orchestrate.md'), '# Orchestrate');
      const ctx = detect(root);
      expect(ctx.syncRun).toBe(true);
    });
  });

  describe('discovery', () => {
    it('should detect discovery not done when AGENT_TEAMS.md is missing', () => {
      const ctx = detect(root);
      expect(ctx.discoveryDone).toBe(false);
    });

    it('should detect discovery done when AGENT_TEAMS.md exists', () => {
      writeFileSync(join(root, 'AGENT_TEAMS.md'), '# Teams');
      const ctx = detect(root);
      expect(ctx.discoveryDone).toBe(true);
    });
  });

  describe('orchestrator state', () => {
    it('should return null phase when no orchestrator.json exists', () => {
      const ctx = detect(root);
      expect(ctx.hasOrchestratorState).toBe(false);
      expect(ctx.orchestratorPhase).toBeNull();
      expect(ctx.phaseName).toBeNull();
    });

    it('should read currentPhase from orchestrator.json', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(
        join(root, '.claude', 'state', 'orchestrator.json'),
        JSON.stringify({ currentPhase: 3 })
      );
      const ctx = detect(root);
      expect(ctx.hasOrchestratorState).toBe(true);
      expect(ctx.orchestratorPhase).toBe(3);
      expect(ctx.phaseName).toBe('Implementation');
    });

    it('should handle all 5 phases', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      const expected = {
        1: 'Discovery',
        2: 'Planning',
        3: 'Implementation',
        4: 'Validation',
        5: 'Ship',
      };
      for (const [phase, name] of Object.entries(expected)) {
        writeFileSync(
          join(root, '.claude', 'state', 'orchestrator.json'),
          JSON.stringify({ currentPhase: Number(phase) })
        );
        const ctx = detect(root);
        expect(ctx.phaseName).toBe(name);
      }
    });

    it('should handle malformed JSON gracefully', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(join(root, '.claude', 'state', 'orchestrator.json'), '{broken json');
      const ctx = detect(root);
      expect(ctx.hasOrchestratorState).toBe(true);
      expect(ctx.orchestratorPhase).toBeNull();
      expect(ctx.phaseName).toBeNull();
    });

    it('should handle missing currentPhase field', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(
        join(root, '.claude', 'state', 'orchestrator.json'),
        JSON.stringify({ someOtherField: 'value' })
      );
      const ctx = detect(root);
      expect(ctx.orchestratorPhase).toBeNull();
    });

    it('should return null for invalid phase numbers', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(
        join(root, '.claude', 'state', 'orchestrator.json'),
        JSON.stringify({ currentPhase: 99 })
      );
      const ctx = detect(root);
      expect(ctx.orchestratorPhase).toBeNull();
      expect(ctx.phaseName).toBeNull();
    });

    it('should return null for non-numeric phase values', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(
        join(root, '.claude', 'state', 'orchestrator.json'),
        JSON.stringify({ currentPhase: 'three' })
      );
      const ctx = detect(root);
      expect(ctx.orchestratorPhase).toBeNull();
      expect(ctx.phaseName).toBeNull();
    });
  });

  describe('backlog', () => {
    it('should return 0 when AGENT_BACKLOG.md does not exist', () => {
      const ctx = detect(root);
      expect(ctx.hasBacklog).toBe(false);
      expect(ctx.backlogCount).toBe(0);
    });

    it('should count open table rows in AGENT_BACKLOG.md', () => {
      writeFileSync(
        join(root, 'AGENT_BACKLOG.md'),
        [
          '| ID | Title | Status |',
          '| --- | --- | --- |',
          '| 1 | Fix bug | open |',
          '| 2 | Add feature | open |',
          '| 3 | Refactor | done |',
        ].join('\n')
      );
      const ctx = detect(root);
      expect(ctx.hasBacklog).toBe(true);
      // Only open items counted (completed/done excluded)
      expect(ctx.backlogCount).toBe(2);
    });

    it('should exclude completed and closed items', () => {
      writeFileSync(
        join(root, 'AGENT_BACKLOG.md'),
        [
          '| ID | Title | Status |',
          '| --- | --- | --- |',
          '| 1 | Task A | completed |',
          '| 2 | Task B | closed |',
          '| 3 | Task C | open |',
        ].join('\n')
      );
      const ctx = detect(root);
      expect(ctx.backlogCount).toBe(1);
    });

    it('should return 0 for empty backlog file', () => {
      writeFileSync(join(root, 'AGENT_BACKLOG.md'), '');
      const ctx = detect(root);
      expect(ctx.hasBacklog).toBe(false);
      expect(ctx.backlogCount).toBe(0);
    });

    it('should return 0 for backlog with only headers', () => {
      writeFileSync(
        join(root, 'AGENT_BACKLOG.md'),
        ['| ID | Title | Status |', '| --- | --- | --- |'].join('\n')
      );
      const ctx = detect(root);
      expect(ctx.backlogCount).toBe(0);
    });
  });

  describe('active tasks', () => {
    it('should return 0 when tasks directory does not exist', () => {
      const ctx = detect(root);
      expect(ctx.activeTaskCount).toBe(0);
    });

    it('should count JSON files in tasks directory', () => {
      const tasksDir = join(root, '.claude', 'state', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, 'task-1.json'), '{}');
      writeFileSync(join(tasksDir, 'task-2.json'), '{}');
      writeFileSync(join(tasksDir, 'notes.md'), '');
      const ctx = detect(root);
      expect(ctx.activeTaskCount).toBe(2);
    });
  });

  describe('git state', () => {
    it('should read branch name from git', () => {
      execFileSync.mockImplementation((cmd, args) => {
        if (args.includes('--show-current')) return 'feat/my-feature\n';
        if (args.includes('--porcelain')) return '\n';
        return '';
      });
      const ctx = detect(root);
      expect(ctx.branch).toBe('feat/my-feature');
    });

    it('should pass root as cwd option to git', () => {
      const capturedOpts = [];
      execFileSync.mockImplementation((cmd, args, opts) => {
        capturedOpts.push(opts);
        if (args.includes('--show-current')) return 'main\n';
        if (args.includes('--porcelain')) return '\n';
        return '';
      });
      detect(root);
      // All git calls should use the root as cwd
      for (const opts of capturedOpts) {
        expect(opts.cwd).toBe(root);
      }
    });

    it('should detect clean working tree', () => {
      execFileSync.mockImplementation((cmd, args) => {
        if (args.includes('--show-current')) return 'main\n';
        if (args.includes('--porcelain')) return '';
        return '';
      });
      const ctx = detect(root);
      expect(ctx.isClean).toBe(true);
      expect(ctx.uncommittedCount).toBe(0);
    });

    it('should count uncommitted changes', () => {
      execFileSync.mockImplementation((cmd, args) => {
        if (args.includes('--show-current')) return 'main\n';
        if (args.includes('--porcelain')) return 'M file1.js\nA file2.js\n?? file3.js\n';
        return '';
      });
      const ctx = detect(root);
      expect(ctx.isClean).toBe(false);
      expect(ctx.uncommittedCount).toBe(3);
    });

    it('should fallback to defaults when git fails', () => {
      execFileSync.mockImplementation(() => {
        throw new Error('git not found');
      });
      const ctx = detect(root);
      expect(ctx.branch).toBe('unknown');
      expect(ctx.isClean).toBe(true);
    });
  });

  describe('lock', () => {
    it('should detect no lock when file is absent', () => {
      const ctx = detect(root);
      expect(ctx.lockHeld).toBe(false);
    });

    it('should detect lock when file exists', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(join(root, '.claude', 'state', 'orchestrator.lock'), '');
      const ctx = detect(root);
      expect(ctx.lockHeld).toBe(true);
    });
  });

  describe('team parsing', () => {
    it('should parse teams from AGENT_TEAMS.md table', () => {
      writeFileSync(
        join(root, 'AGENT_TEAMS.md'),
        [
          '| Name | id | focus |',
          '| --- | --- | --- |',
          '| Backend | backend | API, services |',
          '| Frontend | frontend | UI, components |',
        ].join('\n')
      );
      const ctx = detect(root);
      expect(ctx.teams).toHaveLength(2);
      expect(ctx.teams[0].id).toBe('backend');
      expect(ctx.teams[0].name).toBe('Backend');
      expect(ctx.teams[0].focus).toBe('API, services');
      expect(ctx.teams[0].command).toBe('/team-backend');
    });

    it('should handle tables with different header labels', () => {
      writeFileSync(
        join(root, 'AGENT_TEAMS.md'),
        [
          '| Label | ID | Description |',
          '| :--- | :--- | :--- |',
          '| Backend | backend | API, services |',
        ].join('\n')
      );
      const ctx = detect(root);
      expect(ctx.teams).toHaveLength(1);
      expect(ctx.teams[0].id).toBe('backend');
    });

    it('should fallback to scanning team-* command files', () => {
      mkdirSync(join(root, '.claude', 'commands'), { recursive: true });
      writeFileSync(join(root, '.claude', 'commands', 'team-backend.md'), '');
      writeFileSync(join(root, '.claude', 'commands', 'team-frontend.md'), '');
      writeFileSync(join(root, '.claude', 'commands', 'orchestrate.md'), '');
      const ctx = detect(root);
      expect(ctx.teams).toHaveLength(2);
      expect(ctx.teams[0].id).toBe('backend');
      expect(ctx.teams[1].id).toBe('frontend');
    });

    it('should return empty teams when no sources exist', () => {
      const ctx = detect(root);
      expect(ctx.teams).toEqual([]);
    });
  });

  describe('flow determination', () => {
    it('should return brand-new for empty repo', () => {
      const ctx = detect(root);
      expect(ctx.flow).toBe('brand-new');
    });

    it('should return discovered when AGENT_TEAMS.md exists', () => {
      writeFileSync(join(root, 'AGENT_TEAMS.md'), '# Teams');
      const ctx = detect(root);
      expect(ctx.flow).toBe('discovered');
    });

    it('should return mid-session when orchestrator has active phase', () => {
      writeFileSync(join(root, 'AGENT_TEAMS.md'), '# Teams');
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(
        join(root, '.claude', 'state', 'orchestrator.json'),
        JSON.stringify({ currentPhase: 2 })
      );
      const ctx = detect(root);
      expect(ctx.flow).toBe('mid-session');
    });

    it('should return uncommitted when there are changes', () => {
      execFileSync.mockImplementation((cmd, args) => {
        if (args.includes('--show-current')) return 'main\n';
        if (args.includes('--porcelain')) return 'M file.js\n';
        return '';
      });
      const ctx = detect(root);
      expect(ctx.flow).toBe('uncommitted');
    });

    it('should prioritize uncommitted over mid-session', () => {
      mkdirSync(join(root, '.claude', 'state'), { recursive: true });
      writeFileSync(
        join(root, '.claude', 'state', 'orchestrator.json'),
        JSON.stringify({ currentPhase: 3 })
      );
      execFileSync.mockImplementation((cmd, args) => {
        if (args.includes('--show-current')) return 'main\n';
        if (args.includes('--porcelain')) return 'M file.js\n';
        return '';
      });
      const ctx = detect(root);
      expect(ctx.flow).toBe('uncommitted');
    });
  });

  describe('return shape', () => {
    it('should return all expected fields', () => {
      const ctx = detect(root);
      const keys = [
        'forgeInitialised',
        'syncRun',
        'discoveryDone',
        'hasOrchestratorState',
        'orchestratorPhase',
        'phaseName',
        'hasBacklog',
        'backlogCount',
        'activeTaskCount',
        'branch',
        'isClean',
        'uncommittedCount',
        'lockHeld',
        'flow',
        'teams',
      ];
      for (const key of keys) {
        expect(ctx).toHaveProperty(key);
      }
    });
  });
});
