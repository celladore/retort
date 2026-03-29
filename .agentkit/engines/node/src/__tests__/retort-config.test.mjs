import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRetortConfig, loadRetortConfig } from '../retort-config.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = join(
    tmpdir(),
    `retort-config-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeConfig(projectRoot, content) {
  const configPath = join(projectRoot, '.retortconfig');
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, content, 'utf-8');
}

let tmpDir;

beforeEach(() => {
  tmpDir = makeTmpDir();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// loadRetortConfig
// ---------------------------------------------------------------------------

describe('loadRetortConfig', () => {
  it('should return null when no .retortconfig file exists', () => {
    const result = loadRetortConfig(tmpDir);
    expect(result).toBeNull();
  });

  it('should return an empty object for an empty file', () => {
    writeConfig(tmpDir, '');
    const result = loadRetortConfig(tmpDir);
    expect(result).toEqual({});
  });

  it('should parse a valid .retortconfig file', () => {
    writeConfig(
      tmpDir,
      `
retort_version: "3.x"
project:
  name: mystira-workspace
  type: dotnet-monorepo
agents:
  backend: mystira-squire
  model-economist: ~
features:
  cost_tracking:
    enabled: false
  coverage_guard:
    enabled: true
`
    );

    const result = loadRetortConfig(tmpDir);
    expect(result).toMatchObject({
      retort_version: '3.x',
      project: { name: 'mystira-workspace', type: 'dotnet-monorepo' },
      agents: { backend: 'mystira-squire', 'model-economist': null },
      features: {
        cost_tracking: { enabled: false },
        coverage_guard: { enabled: true },
      },
    });
  });

  it('should throw on invalid YAML syntax', () => {
    writeConfig(tmpDir, 'agents: [unclosed');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/Failed to parse .retortconfig/);
  });

  it('should throw on unknown top-level keys', () => {
    writeConfig(tmpDir, 'unknown_key: value\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/unknown keys/);
  });

  it('should throw when top-level value is not a mapping', () => {
    writeConfig(tmpDir, '- item1\n- item2\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/must be a YAML mapping/);
  });

  it('should throw when agents block is not a mapping', () => {
    writeConfig(tmpDir, 'agents:\n  - backend\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/'agents' must be a mapping/);
  });

  it('should throw when an agent entry is neither string nor null', () => {
    writeConfig(tmpDir, 'agents:\n  backend: 123\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/must be a string.*or ~ \(null/);
  });

  it('should throw when features block is not a mapping', () => {
    writeConfig(tmpDir, 'features:\n  - cost_tracking\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/'features' must be a mapping/);
  });

  it('should throw when a feature entry is not a mapping', () => {
    writeConfig(tmpDir, 'features:\n  cost_tracking: true\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/must be a mapping with an 'enabled' key/);
  });

  it('should throw when feature enabled is not a boolean', () => {
    writeConfig(tmpDir, 'features:\n  cost_tracking:\n    enabled: "yes"\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/must be a boolean/);
  });

  it('should throw when a feature entry has unknown keys', () => {
    writeConfig(tmpDir, 'features:\n  cost_tracking:\n    enabled: false\n    level: high\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/unknown keys.*level/);
  });

  it('should throw when project block has unknown keys', () => {
    writeConfig(tmpDir, 'project:\n  name: foo\n  unknown: bar\n');
    expect(() => loadRetortConfig(tmpDir)).toThrow(/'project' contains unknown keys/);
  });

  it('should accept a valid full .retortconfig with all optional sections', () => {
    writeConfig(
      tmpDir,
      `
retort_version: "3.x"
project:
  name: my-project
  type: typescript-app
  compliance: [gdpr]
  stacks: [typescript]
agents:
  frontend: my-frontend-agent
  backend: ~
features:
  team-orchestration:
    enabled: true
  cost-tracking:
    enabled: false
`
    );
    expect(() => loadRetortConfig(tmpDir)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyRetortConfig
// ---------------------------------------------------------------------------

describe('applyRetortConfig', () => {
  it('should be a no-op when config is null', () => {
    const vars = {};
    applyRetortConfig(vars, null);
    expect(vars).toEqual({});
  });

  it('should initialise maps and not error when config is an empty object', () => {
    const vars = {};
    applyRetortConfig(vars, {});
    // An empty config still initialises the agent structures so that downstream
    // code can safely iterate them without null-guards
    expect(vars.retortAgentMap).toEqual({});
    expect(vars.retortDisabledAgents).toBeInstanceOf(Set);
    expect(vars.retortDisabledAgents.size).toBe(0);
    // No feature overrides should be created
    expect(vars.retortDisabledFeatures).toBeUndefined();
    expect(vars.retortEnabledFeatures).toBeUndefined();
  });

  it('should populate retortAgentMap for remapped agents', () => {
    const vars = {};
    applyRetortConfig(vars, {
      agents: { backend: 'mystira-squire', frontend: 'my-illuminator' },
    });
    expect(vars.retortAgentMap).toEqual({
      backend: 'mystira-squire',
      frontend: 'my-illuminator',
    });
    expect(vars.retortDisabledAgents).toBeInstanceOf(Set);
    expect(vars.retortDisabledAgents.size).toBe(0);
  });

  it('should populate retortDisabledAgents for null-valued agents', () => {
    const vars = {};
    applyRetortConfig(vars, {
      agents: { 'model-economist': null, 'input-clarifier': null },
    });
    expect(vars.retortDisabledAgents).toBeInstanceOf(Set);
    expect(vars.retortDisabledAgents.has('model-economist')).toBe(true);
    expect(vars.retortDisabledAgents.has('input-clarifier')).toBe(true);
    expect(vars.retortAgentMap).toEqual({});
  });

  it('should handle mixed remap and disable in the same config', () => {
    const vars = {};
    applyRetortConfig(vars, {
      agents: {
        backend: 'mystira-squire',
        'model-economist': null,
      },
    });
    expect(vars.retortAgentMap).toEqual({ backend: 'mystira-squire' });
    expect(vars.retortDisabledAgents.has('model-economist')).toBe(true);
  });

  it('should add disabled features to retortDisabledFeatures', () => {
    const vars = {};
    applyRetortConfig(vars, {
      features: {
        'cost-tracking': { enabled: false },
        'session-handoff': { enabled: false },
      },
    });
    expect(vars.retortDisabledFeatures).toBeInstanceOf(Set);
    expect(vars.retortDisabledFeatures.has('cost-tracking')).toBe(true);
    expect(vars.retortDisabledFeatures.has('session-handoff')).toBe(true);
  });

  it('should add force-enabled features to retortEnabledFeatures', () => {
    const vars = {};
    applyRetortConfig(vars, {
      features: {
        'coverage-guard': { enabled: true },
        'mcp-integration': { enabled: true },
      },
    });
    expect(vars.retortEnabledFeatures).toBeInstanceOf(Set);
    expect(vars.retortEnabledFeatures.has('coverage-guard')).toBe(true);
    expect(vars.retortEnabledFeatures.has('mcp-integration')).toBe(true);
  });

  it('should not set retortDisabledFeatures when all features are enabled', () => {
    const vars = {};
    applyRetortConfig(vars, {
      features: { 'team-orchestration': { enabled: true } },
    });
    expect(vars.retortDisabledFeatures).toBeUndefined();
    expect(vars.retortEnabledFeatures?.has('team-orchestration')).toBe(true);
  });

  it('should warn on unmapped agent IDs when agentIds list is provided', () => {
    const warnMock = vi.fn();
    const vars = {};
    applyRetortConfig(
      vars,
      { agents: { 'nonexistent-agent': 'some-target' } },
      { warn: warnMock, agentIds: ['backend', 'frontend'] }
    );
    expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('nonexistent-agent'));
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('does not match any known agent ID')
    );
  });

  it('should not warn for valid agent IDs in agentIds list', () => {
    const warnMock = vi.fn();
    const vars = {};
    applyRetortConfig(
      vars,
      { agents: { backend: 'my-backend' } },
      { warn: warnMock, agentIds: ['backend', 'frontend'] }
    );
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('should not warn when agentIds list is not provided', () => {
    const warnMock = vi.fn();
    const vars = {};
    applyRetortConfig(vars, { agents: { 'any-agent': 'some-target' } }, { warn: warnMock });
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('should initialise retortAgentMap and retortDisabledAgents even when they are absent', () => {
    const vars = {};
    applyRetortConfig(vars, { agents: {} });
    expect(vars.retortAgentMap).toBeDefined();
    expect(vars.retortDisabledAgents).toBeInstanceOf(Set);
  });

  it('should preserve existing retortAgentMap entries when merging', () => {
    const vars = { retortAgentMap: { frontend: 'existing-frontend' } };
    applyRetortConfig(vars, { agents: { backend: 'new-backend' } });
    expect(vars.retortAgentMap).toEqual({
      frontend: 'existing-frontend',
      backend: 'new-backend',
    });
  });
});
