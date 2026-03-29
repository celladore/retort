import { EventEmitter } from 'events';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextRegistry } from '../context-registry.mjs';
import { RuntimeStateManager } from '../runtime-state-manager.mjs';
import { SpecAccessor } from '../spec-accessor.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = join(
    tmpdir(),
    `context-registry-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

const TEAMS_YAML = `
teams:
  - id: backend
    name: Backend Team
    focus: API development
    scope:
      - src/api/**
  - id: frontend
    name: Frontend Team
    focus: UI development
    scope:
      - src/ui/**
`.trimStart();

const AGENTS_YAML = `
agents:
  - id: backend-agent
    team: backend
    description: Handles API tasks
`.trimStart();

const PROJECT_YAML = `
name: test-project
phase: active
stack:
  languages:
    - typescript
testing:
  unit:
    - vitest
  coverage: 80
`.trimStart();

// ---------------------------------------------------------------------------
// describe ContextRegistry
// ---------------------------------------------------------------------------

describe('ContextRegistry', () => {
  let tmpDir;
  let projectRoot;
  let agentkitRoot;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    projectRoot = join(tmpDir, 'project');
    agentkitRoot = join(projectRoot, '.agentkit');
    mkdirSync(join(agentkitRoot, 'spec'), { recursive: true });
    writeFile(join(agentkitRoot, 'spec', 'teams.yaml'), TEAMS_YAML);
    writeFile(join(agentkitRoot, 'spec', 'agents.yaml'), AGENTS_YAML);
    writeFile(join(agentkitRoot, 'spec', 'project.yaml'), PROJECT_YAML);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('should assign projectRoot and derive agentkitRoot', () => {
      // Arrange + Act
      const registry = new ContextRegistry(projectRoot);

      // Assert
      expect(registry.projectRoot).toBe(projectRoot);
      expect(registry.agentkitRoot).toBe(join(projectRoot, '.agentkit'));
    });

    it('should accept a custom agentkitRoot via options', () => {
      // Arrange
      const customRoot = join(tmpDir, 'custom-agentkit');

      // Act
      const registry = new ContextRegistry(projectRoot, { agentkitRoot: customRoot });

      // Assert
      expect(registry.agentkitRoot).toBe(customRoot);
    });

    it('should create a new EventEmitter when none is provided', () => {
      // Arrange + Act
      const registry = new ContextRegistry(projectRoot);

      // Assert
      expect(registry.events).toBeInstanceOf(EventEmitter);
    });

    it('should use a provided EventEmitter instance', () => {
      // Arrange
      const emitter = new EventEmitter();

      // Act
      const registry = new ContextRegistry(projectRoot, { events: emitter });

      // Assert
      expect(registry.events).toBe(emitter);
    });

    it('should create a SpecAccessor backed by agentkitRoot', () => {
      // Arrange + Act
      const registry = new ContextRegistry(projectRoot);

      // Assert
      expect(registry.spec).toBeInstanceOf(SpecAccessor);
    });

    it('should use a provided SpecAccessor instance', () => {
      // Arrange
      const spec = new SpecAccessor(agentkitRoot);

      // Act
      const registry = new ContextRegistry(projectRoot, { spec });

      // Assert
      expect(registry.spec).toBe(spec);
    });

    it('should create a RuntimeStateManager sharing the EventEmitter', () => {
      // Arrange
      const emitter = new EventEmitter();

      // Act
      const registry = new ContextRegistry(projectRoot, { events: emitter });

      // Assert
      expect(registry.state).toBeInstanceOf(RuntimeStateManager);
    });

    it('should use a provided RuntimeStateManager instance', () => {
      // Arrange
      const state = new RuntimeStateManager(projectRoot);

      // Act
      const registry = new ContextRegistry(projectRoot, { state });

      // Assert
      expect(registry.state).toBe(state);
    });
  });

  // -------------------------------------------------------------------------
  // teams() and agents()
  // -------------------------------------------------------------------------

  describe('teams()', () => {
    it('should return the teams array from the spec', () => {
      // Arrange
      const registry = new ContextRegistry(projectRoot);

      // Act
      const teams = registry.teams();

      // Assert
      expect(Array.isArray(teams)).toBe(true);
      expect(teams).toHaveLength(2);
      expect(teams[0].id).toBe('backend');
      expect(teams[1].id).toBe('frontend');
    });

    it('should return null when teams.yaml is missing', () => {
      // Arrange — spec dir without teams.yaml
      const emptyAgentkitRoot = join(tmpDir, 'empty-agentkit');
      mkdirSync(join(emptyAgentkitRoot, 'spec'), { recursive: true });
      const registry = new ContextRegistry(projectRoot, { agentkitRoot: emptyAgentkitRoot });

      // Act
      const teams = registry.teams();

      // Assert
      expect(teams).toBeNull();
    });
  });

  describe('agents()', () => {
    it('should return the agents spec from the spec accessor', () => {
      // Arrange
      const registry = new ContextRegistry(projectRoot);

      // Act
      const agents = registry.agents();

      // Assert
      expect(agents).not.toBeNull();
      expect(typeof agents).toBe('object');
    });

    it('should return null when agents.yaml is missing', () => {
      // Arrange — spec dir without agents.yaml
      const emptyAgentkitRoot = join(tmpDir, 'empty-agentkit2');
      mkdirSync(join(emptyAgentkitRoot, 'spec'), { recursive: true });
      const registry = new ContextRegistry(projectRoot, { agentkitRoot: emptyAgentkitRoot });

      // Act
      const agents = registry.agents();

      // Assert
      expect(agents).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // static create()
  // -------------------------------------------------------------------------

  describe('create()', () => {
    it('should return a ContextRegistry instance', async () => {
      // Arrange + Act
      const registry = await ContextRegistry.create(projectRoot, { skipValidation: true });

      // Assert
      expect(registry).toBeInstanceOf(ContextRegistry);
    });

    it('should emit context:ready on the EventEmitter', async () => {
      // Arrange
      const emitter = new EventEmitter();
      const received = [];
      emitter.on('context:ready', (data) => received.push(data));

      // Act
      await ContextRegistry.create(projectRoot, { events: emitter, skipValidation: true });

      // Assert
      expect(received).toHaveLength(1);
      expect(received[0].projectRoot).toBe(projectRoot);
    });

    it('should throw when spec validation returns errors', async () => {
      // Arrange — write invalid spec (missing required fields)
      const badAgentkitRoot = join(tmpDir, 'bad-agentkit');
      mkdirSync(join(badAgentkitRoot, 'spec'), { recursive: true });
      writeFile(join(badAgentkitRoot, 'spec', 'project.yaml'), 'phase: active\n');

      // Act + Assert
      await expect(
        ContextRegistry.create(projectRoot, { agentkitRoot: badAgentkitRoot })
      ).rejects.toThrow('spec validation failed');
    });

    it('should skip validation when skipValidation is true', async () => {
      // Arrange — spec dir with no files at all
      const emptyAgentkitRoot = join(tmpDir, 'empty-for-skip');
      mkdirSync(join(emptyAgentkitRoot, 'spec'), { recursive: true });

      // Act + Assert — should not throw
      const registry = await ContextRegistry.create(projectRoot, {
        agentkitRoot: emptyAgentkitRoot,
        skipValidation: true,
      });
      expect(registry).toBeInstanceOf(ContextRegistry);
    });
  });

  // -------------------------------------------------------------------------
  // static createForTest()
  // -------------------------------------------------------------------------

  describe('createForTest()', () => {
    it('should use default projectRoot when none is provided', () => {
      // Arrange + Act
      const registry = ContextRegistry.createForTest();

      // Assert
      expect(registry.projectRoot).toBe('/test/project');
    });

    it('should accept a custom projectRoot', () => {
      // Arrange + Act
      const registry = ContextRegistry.createForTest({ projectRoot: '/custom/root' });

      // Assert
      expect(registry.projectRoot).toBe('/custom/root');
    });

    it('should not validate spec on creation', () => {
      // Arrange — no spec files anywhere
      // Act + Assert — should not throw
      expect(() => ContextRegistry.createForTest({ projectRoot: '/nonexistent' })).not.toThrow();
    });

    it('should use injected spec stub', () => {
      // Arrange
      const stubSpec = {
        teams: () => [{ id: 'stub-team', scope: ['**'] }],
        agents: () => null,
        validate: () => [],
      };

      // Act
      const registry = ContextRegistry.createForTest({ spec: stubSpec });

      // Assert
      expect(registry.teams()).toEqual([{ id: 'stub-team', scope: ['**'] }]);
    });

    it('should use injected state stub', () => {
      // Arrange
      const stubState = { getState: () => ({ phase: 'test' }) };

      // Act
      const registry = ContextRegistry.createForTest({ state: stubState });

      // Assert
      expect(registry.state.getState()).toEqual({ phase: 'test' });
    });

    it('should use injected EventEmitter', () => {
      // Arrange
      const emitter = new EventEmitter();

      // Act
      const registry = ContextRegistry.createForTest({ events: emitter });

      // Assert
      expect(registry.events).toBe(emitter);
    });
  });

  // -------------------------------------------------------------------------
  // Integration: state and events share the same emitter
  // -------------------------------------------------------------------------

  describe('shared EventEmitter between state and registry', () => {
    it('should receive state:updated events via registry.events', () => {
      // Arrange
      const emitter = new EventEmitter();
      const registry = new ContextRegistry(projectRoot, { events: emitter });
      const received = [];
      emitter.on('state:updated', (data) => received.push(data));

      // Act
      registry.state.updateState({ current_phase: 1 });

      // Assert
      expect(received).toHaveLength(1);
      expect(received[0].current_phase).toBe(1);
    });

    it('should receive task:created events via registry.events', () => {
      // Arrange
      const emitter = new EventEmitter();
      const registry = new ContextRegistry(projectRoot, { events: emitter });
      const received = [];
      emitter.on('task:created', (task) => received.push(task));

      // Act
      registry.state.createTask({ type: 'implement', description: 'test task' });

      // Assert
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('implement');
    });
  });
});
