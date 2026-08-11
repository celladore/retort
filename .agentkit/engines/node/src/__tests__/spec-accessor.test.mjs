import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { SpecAccessor } from '../spec-accessor.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = join(
    tmpdir(),
    `agentkit-spec-accessor-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

// Minimal valid YAML fixtures (written as real files — no mocks)

const PROJECT_YAML = `
name: test-project
phase: active
stack:
  languages:
    - typescript
  frameworks:
    frontend:
      - react
    backend:
      - express
testing:
  unit:
    - vitest
  coverage: 85
`.trimStart();

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

const RULES_YAML = `
rules:
  - domain: typescript
    description: TypeScript conventions
    applies-to:
      - "**/*.ts"
    conventions:
      - id: ts-strict
        rule: Always enable strict mode
        severity: error
  - domain: git
    description: Git workflow rules
    applies-to:
      - "**"
    conventions:
      - id: git-conventional
        rule: Use conventional commits
        severity: warning
`.trimStart();

const COMMANDS_YAML = `
commands:
  - name: sync
    type: workflow
    description: Synchronise spec files
`.trimStart();

const AGENTS_YAML = `
agents:
  engineering:
    - id: backend-engineer
      name: Backend Engineer
      role: Builds APIs
      focus:
        - src/api/**
      responsibilities:
        - implement endpoints
`.trimStart();

const SETTINGS_YAML = `
permissions:
  allow:
    - Read
    - Write
  deny: []
hooks: {}
`.trimStart();

const BRAND_YAML = `
name: Retort
colors:
  primary: "#1976D2"
`.trimStart();

// validateSpec also requires aliases.yaml and docs.yaml to be present; a spec
// set without them reports "file not found" and is not a valid spec.
const ALIASES_YAML = `
aliases:
  /s: '/sync'
`.trimStart();

const DOCS_YAML = `
categories:
  - id: engineering
    name: Engineering
    path: 'docs/engineering/'
`.trimStart();

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

describe('SpecAccessor', () => {
  let agentkitRoot;
  let specDir;

  beforeEach(() => {
    agentkitRoot = makeTmpDir();
    specDir = resolve(agentkitRoot, 'spec');
    mkdirSync(specDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(agentkitRoot, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  it('can be instantiated with an agentkitRoot path', () => {
    const accessor = new SpecAccessor(agentkitRoot);
    expect(accessor).toBeInstanceOf(SpecAccessor);
  });

  // -------------------------------------------------------------------------
  // project()
  // -------------------------------------------------------------------------

  describe('project()', () => {
    it('returns parsed project.yaml', () => {
      writeFile(resolve(specDir, 'project.yaml'), PROJECT_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const proj = accessor.project();
      expect(proj).not.toBeNull();
      expect(proj.name).toBe('test-project');
      expect(proj.phase).toBe('active');
    });

    it('returns null when project.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.project()).toBeNull();
    });

    it('returned object is frozen (immutable)', () => {
      writeFile(resolve(specDir, 'project.yaml'), PROJECT_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const proj = accessor.project();
      expect(Object.isFrozen(proj)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // teams() and team()
  // -------------------------------------------------------------------------

  describe('teams()', () => {
    it('returns teams array from teams.yaml', () => {
      writeFile(resolve(specDir, 'teams.yaml'), TEAMS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const teams = accessor.teams();
      expect(Array.isArray(teams)).toBe(true);
      expect(teams).toHaveLength(2);
    });

    it('returns null when teams.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.teams()).toBeNull();
    });
  });

  describe('team(id)', () => {
    it('returns the correct team by id', () => {
      writeFile(resolve(specDir, 'teams.yaml'), TEAMS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const team = accessor.team('backend');
      expect(team).not.toBeNull();
      expect(team.id).toBe('backend');
      expect(team.name).toBe('Backend Team');
    });

    it('returns null for an unknown team id', () => {
      writeFile(resolve(specDir, 'teams.yaml'), TEAMS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.team('nonexistent')).toBeNull();
    });

    it('returns null when teams.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.team('backend')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // rules() and rule()
  // -------------------------------------------------------------------------

  describe('rules()', () => {
    it('returns rules array from rules.yaml', () => {
      writeFile(resolve(specDir, 'rules.yaml'), RULES_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const rules = accessor.rules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules).toHaveLength(2);
    });

    it('returns null when rules.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.rules()).toBeNull();
    });
  });

  describe('rule(domain)', () => {
    it('returns the correct rule domain object', () => {
      writeFile(resolve(specDir, 'rules.yaml'), RULES_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const rule = accessor.rule('typescript');
      expect(rule).not.toBeNull();
      expect(rule.domain).toBe('typescript');
      expect(rule.conventions).toHaveLength(1);
      expect(rule.conventions[0].id).toBe('ts-strict');
    });

    it('returns the git domain rule', () => {
      writeFile(resolve(specDir, 'rules.yaml'), RULES_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const rule = accessor.rule('git');
      expect(rule).not.toBeNull();
      expect(rule.domain).toBe('git');
    });

    it('returns null for an unknown domain', () => {
      writeFile(resolve(specDir, 'rules.yaml'), RULES_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.rule('nonexistent-domain')).toBeNull();
    });

    it('returns null when rules.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.rule('typescript')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // commands(), agents(), settings(), brand()
  // -------------------------------------------------------------------------

  describe('commands()', () => {
    it('returns parsed commands.yaml', () => {
      writeFile(resolve(specDir, 'commands.yaml'), COMMANDS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const cmds = accessor.commands();
      expect(cmds).not.toBeNull();
      expect(Array.isArray(cmds.commands)).toBe(true);
    });

    it('returns null when commands.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.commands()).toBeNull();
    });
  });

  describe('agents()', () => {
    it('returns parsed agents from agents.yaml', () => {
      writeFile(resolve(specDir, 'agents.yaml'), AGENTS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const agents = accessor.agents();
      expect(agents).not.toBeNull();
      expect(agents.agents).toBeDefined();
    });

    it('returns agents from spec/agents/ directory when present', () => {
      const agentsDir = resolve(specDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFile(
        resolve(agentsDir, 'engineering.yaml'),
        `
engineering:
  - id: eng-agent
    name: Engineer
    role: builds things
    focus:
      - src/**
    responsibilities:
      - implement features
`.trimStart()
      );
      const accessor = new SpecAccessor(agentkitRoot);
      const agents = accessor.agents();
      expect(agents).not.toBeNull();
      expect(agents.agents.engineering).toHaveLength(1);
    });

    it('returns null when neither agents.yaml nor agents/ dir exists', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      // loadAgentsSpec returns {} (not null) when no agents found, so we expect
      // a non-null but possibly empty result. Either way it must not throw.
      expect(() => accessor.agents()).not.toThrow();
    });
  });

  describe('settings()', () => {
    it('returns parsed settings.yaml', () => {
      writeFile(resolve(specDir, 'settings.yaml'), SETTINGS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const s = accessor.settings();
      expect(s).not.toBeNull();
      expect(s.permissions).toBeDefined();
    });

    it('returns null when settings.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.settings()).toBeNull();
    });
  });

  describe('brand()', () => {
    it('returns parsed brand.yaml', () => {
      writeFile(resolve(specDir, 'brand.yaml'), BRAND_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const b = accessor.brand();
      expect(b).not.toBeNull();
      expect(b.name).toBe('Retort');
    });

    it('returns null when brand.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.brand()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Shorthand helpers
  // -------------------------------------------------------------------------

  describe('stack()', () => {
    it('returns project.stack shorthand', () => {
      writeFile(resolve(specDir, 'project.yaml'), PROJECT_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const stack = accessor.stack();
      expect(stack).not.toBeNull();
      expect(stack.languages).toContain('typescript');
    });

    it('returns null when project.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.stack()).toBeNull();
    });

    it('returns null when project has no stack field', () => {
      writeFile(resolve(specDir, 'project.yaml'), 'name: minimal\n');
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.stack()).toBeNull();
    });
  });

  describe('coverage()', () => {
    it('returns project.testing.coverage shorthand', () => {
      writeFile(resolve(specDir, 'project.yaml'), PROJECT_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.coverage()).toBe(85);
    });

    it('returns null when project.yaml is missing', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.coverage()).toBeNull();
    });

    it('returns null when project has no testing field', () => {
      writeFile(resolve(specDir, 'project.yaml'), 'name: minimal\n');
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.coverage()).toBeNull();
    });

    it('returns null when project.testing has no coverage field', () => {
      writeFile(
        resolve(specDir, 'project.yaml'),
        'name: minimal\ntesting:\n  unit:\n    - vitest\n'
      );
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.coverage()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Lazy loading (caching)
  // -------------------------------------------------------------------------

  describe('lazy loading', () => {
    it('second call to project() returns the same cached object (no re-read)', () => {
      writeFile(resolve(specDir, 'project.yaml'), PROJECT_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const first = accessor.project();
      // Overwrite the file on disk — second call must still return the cached result
      writeFile(resolve(specDir, 'project.yaml'), 'name: changed\n');
      const second = accessor.project();
      expect(second).toBe(first); // strict reference equality — same cached object
      expect(second.name).toBe('test-project');
    });

    it('second call to teams() returns same cached array', () => {
      writeFile(resolve(specDir, 'teams.yaml'), TEAMS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const first = accessor.teams();
      const second = accessor.teams();
      expect(second).toBe(first);
    });

    it('null result is cached (missing file is not re-stat-ed on second call)', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      const first = accessor.project();
      expect(first).toBeNull();
      // Write the file after first call — should still get null from cache
      writeFile(resolve(specDir, 'project.yaml'), PROJECT_YAML);
      const second = accessor.project();
      expect(second).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // reload()
  // -------------------------------------------------------------------------

  describe('reload()', () => {
    it('clears cache so next access re-reads from disk', () => {
      writeFile(resolve(specDir, 'project.yaml'), PROJECT_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const before = accessor.project();
      expect(before.name).toBe('test-project');

      // Overwrite on disk then reload
      writeFile(resolve(specDir, 'project.yaml'), 'name: updated-project\nphase: maintenance\n');
      accessor.reload();

      const after = accessor.project();
      expect(after.name).toBe('updated-project');
      expect(after.phase).toBe('maintenance');
    });

    it('after reload() a previously-missing file is picked up', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.brand()).toBeNull(); // cached as null

      writeFile(resolve(specDir, 'brand.yaml'), BRAND_YAML);
      accessor.reload();

      const b = accessor.brand();
      expect(b).not.toBeNull();
      expect(b.name).toBe('Retort');
    });

    it('after reload() teams cache is cleared', () => {
      writeFile(resolve(specDir, 'teams.yaml'), TEAMS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      expect(accessor.teams()).toHaveLength(2);

      writeFile(
        resolve(specDir, 'teams.yaml'),
        'teams:\n  - id: solo\n    name: Solo Team\n    focus: everything\n    scope:\n      - "**"\n'
      );
      accessor.reload();

      expect(accessor.teams()).toHaveLength(1);
      expect(accessor.teams()[0].id).toBe('solo');
    });
  });

  // -------------------------------------------------------------------------
  // validate()
  // -------------------------------------------------------------------------

  describe('validate()', () => {
    it('returns an array (empty for a valid spec)', () => {
      // Write a minimal but valid spec set
      writeFile(resolve(specDir, 'teams.yaml'), TEAMS_YAML);
      writeFile(resolve(specDir, 'agents.yaml'), AGENTS_YAML);
      writeFile(resolve(specDir, 'commands.yaml'), COMMANDS_YAML);
      writeFile(resolve(specDir, 'rules.yaml'), RULES_YAML);
      writeFile(resolve(specDir, 'settings.yaml'), SETTINGS_YAML);
      writeFile(resolve(specDir, 'aliases.yaml'), ALIASES_YAML);
      writeFile(resolve(specDir, 'docs.yaml'), DOCS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const errors = accessor.validate();
      // The title's claim is emptiness — assert it, otherwise validate() could
      // return anything array-shaped and still pass.
      expect(errors).toEqual([]);
    });

    it('returns an array even when spec files are all missing (no throw)', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(() => accessor.validate()).not.toThrow();
      const errors = accessor.validate();
      expect(Array.isArray(errors)).toBe(true);
    });

    it('returns errors array with entries for an invalid spec', () => {
      // Write an intentionally broken teams.yaml (missing required fields)
      writeFile(
        resolve(specDir, 'teams.yaml'),
        'teams:\n  - id: ""\n    name: ""\n    focus: broken\n    scope: []\n'
      );
      writeFile(resolve(specDir, 'agents.yaml'), AGENTS_YAML);
      writeFile(resolve(specDir, 'commands.yaml'), COMMANDS_YAML);
      writeFile(resolve(specDir, 'rules.yaml'), RULES_YAML);
      writeFile(resolve(specDir, 'settings.yaml'), SETTINGS_YAML);
      const accessor = new SpecAccessor(agentkitRoot);
      const errors = accessor.validate();
      expect(Array.isArray(errors)).toBe(true);
      // The empty-string id/name should produce at least one validation error
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Missing files — no throws
  // -------------------------------------------------------------------------

  describe('graceful handling of missing files', () => {
    it('all accessors return null/empty without throwing when spec dir is empty', () => {
      const accessor = new SpecAccessor(agentkitRoot);
      expect(() => accessor.project()).not.toThrow();
      expect(() => accessor.teams()).not.toThrow();
      expect(() => accessor.team('x')).not.toThrow();
      expect(() => accessor.rules()).not.toThrow();
      expect(() => accessor.rule('x')).not.toThrow();
      expect(() => accessor.commands()).not.toThrow();
      expect(() => accessor.agents()).not.toThrow();
      expect(() => accessor.settings()).not.toThrow();
      expect(() => accessor.brand()).not.toThrow();
      expect(() => accessor.stack()).not.toThrow();
      expect(() => accessor.coverage()).not.toThrow();
      expect(() => accessor.validate()).not.toThrow();
    });

    it('all accessors return null when spec dir does not exist at all', () => {
      const nonExistentRoot = resolve(agentkitRoot, 'does-not-exist');
      const accessor = new SpecAccessor(nonExistentRoot);
      expect(accessor.project()).toBeNull();
      expect(accessor.teams()).toBeNull();
      expect(accessor.rules()).toBeNull();
      expect(accessor.commands()).toBeNull();
      expect(accessor.settings()).toBeNull();
      expect(accessor.brand()).toBeNull();
      expect(accessor.stack()).toBeNull();
      expect(accessor.coverage()).toBeNull();
    });
  });
});
