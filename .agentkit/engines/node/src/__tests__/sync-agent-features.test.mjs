import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, resolve } from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readYaml, loadAgentsSpec } from '../spec-loader.mjs';
import { resolveTeamAgents } from '../var-builders.mjs';
import { runSync } from '../synchronize.mjs';
import { renderTemplate, replacePlaceholders } from '../template-utils.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENTKIT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

function makeTmpDir() {
  const dir = resolve(
    tmpdir(),
    `agentkit-wave1-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeNamedTmpProject(name) {
  const parent = makeTmpDir();
  const dir = resolve(parent, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeTestFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// P2: Feature-gated shared sections
// ---------------------------------------------------------------------------

describe('P2: Feature-gated shared sections', () => {
  it('loads sections.yaml from the real spec', () => {
    const sectionsPath = resolve(AGENTKIT_ROOT, 'spec', 'sections.yaml');
    const sectionsSpec = readYaml(sectionsPath);

    expect(sectionsSpec).toBeDefined();
    expect(sectionsSpec.sections).toBeDefined();
    expect(sectionsSpec.sections.sharedState).toBeDefined();
    expect(sectionsSpec.sections.concurrencyControls).toBeDefined();
    expect(sectionsSpec.sections.guidelines).toBeDefined();
    expect(sectionsSpec.sections.prRules).toBeDefined();
  });

  it('sections with gate=null are always included regardless of feature state', () => {
    const sectionsSpec = readYaml(resolve(AGENTKIT_ROOT, 'spec', 'sections.yaml'));
    const guidelines = sectionsSpec.sections.guidelines;
    const prRules = sectionsSpec.sections.prRules;

    expect(guidelines.gate).toBeNull();
    expect(prRules.gate).toBeNull();
    expect(guidelines.content).toContain('Guidelines');
    expect(prRules.content).toContain('PR & Commit Rules');
  });

  it('gated sections are populated when feature is enabled', () => {
    const sectionsSpec = readYaml(resolve(AGENTKIT_ROOT, 'spec', 'sections.yaml'));
    const vars = { hasTeamOrchestration: true };

    for (const [key, section] of Object.entries(sectionsSpec.sections)) {
      const gate = section.gate;
      const isGateEnabled = !gate || vars[gate];
      vars[`shared_${key}`] = isGateEnabled ? section.content || '' : '';
    }

    expect(vars.shared_sharedState).toContain('AGENT_BACKLOG.md');
    expect(vars.shared_concurrencyControls).toContain('Concurrency Controls');
    expect(vars.shared_guidelines).toContain('Guidelines');
    expect(vars.shared_prRules).toContain('PR & Commit Rules');
  });

  it('gated sections are empty when feature is disabled', () => {
    const sectionsSpec = readYaml(resolve(AGENTKIT_ROOT, 'spec', 'sections.yaml'));
    const vars = { hasTeamOrchestration: false };

    for (const [key, section] of Object.entries(sectionsSpec.sections)) {
      const gate = section.gate;
      const isGateEnabled = !gate || vars[gate];
      vars[`shared_${key}`] = isGateEnabled ? section.content || '' : '';
    }

    // Gated sections should be empty
    expect(vars.shared_sharedState).toBe('');
    expect(vars.shared_concurrencyControls).toBe('');

    // Ungated sections should still have content
    expect(vars.shared_guidelines).toContain('Guidelines');
    expect(vars.shared_prRules).toContain('PR & Commit Rules');
  });

  it('template placeholder replacement works with shared_ vars', () => {
    const template = 'Before\n\n{{shared_sharedState}}\n\nAfter';
    const vars = { shared_sharedState: '## Shared State\n\n- Item 1\n- Item 2' };

    const result = replacePlaceholders(template, vars);
    expect(result).toContain('## Shared State');
    expect(result).toContain('Before');
    expect(result).toContain('After');
    expect(result).not.toContain('{{shared_sharedState}}');
  });

  it('empty shared_ var results in clean output', () => {
    const template = 'Before\n\n{{shared_taskProtocol}}\n\nAfter';
    const vars = { shared_taskProtocol: '' };

    const result = replacePlaceholders(template, vars);
    expect(result).not.toContain('{{shared_taskProtocol}}');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });
});

// ---------------------------------------------------------------------------
// P0: resolveTeamAgents unit tests
// ---------------------------------------------------------------------------

describe('P0: resolveTeamAgents', () => {
  const mockAgentsSpec = {
    agents: {
      product: [
        { id: 'product-manager', name: 'Product Manager', role: 'PM role description' },
        { id: 'roadmap-tracker', name: 'Roadmap Tracker', role: 'Roadmap tracking' },
      ],
      engineering: [
        { id: 'backend', name: 'Backend Engineer', role: 'Backend development' },
        { id: 'frontend', name: 'Frontend Engineer', role: 'Frontend development' },
      ],
      testing: [{ id: 'test-lead', name: 'Test Lead', role: 'Testing leadership' }],
    },
  };

  it('resolves agents by category match (fallback)', () => {
    const result = resolveTeamAgents('product', { id: 'product' }, mockAgentsSpec);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('product-manager');
    expect(result[0].name).toBe('Product Manager');
    expect(result[0].category).toBe('product');
    expect(result[1].id).toBe('roadmap-tracker');
  });

  it('resolves agents by explicit agents list', () => {
    const team = { id: 'custom-team', agents: ['backend', 'test-lead'] };
    const result = resolveTeamAgents('custom-team', team, mockAgentsSpec);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('backend');
    expect(result[0].category).toBe('engineering');
    expect(result[1].id).toBe('test-lead');
    expect(result[1].category).toBe('testing');
  });

  it('returns empty array when no category matches', () => {
    const result = resolveTeamAgents('nonexistent', { id: 'nonexistent' }, mockAgentsSpec);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for null/undefined agentsSpec', () => {
    const result = resolveTeamAgents('product', { id: 'product' }, null);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty agents object', () => {
    const result = resolveTeamAgents('product', { id: 'product' }, { agents: {} });
    expect(result).toHaveLength(0);
  });

  it('handles explicit agents list with unknown agent IDs gracefully', () => {
    const team = { id: 'team', agents: ['backend', 'nonexistent-agent'] };
    const result = resolveTeamAgents('team', team, mockAgentsSpec);

    // Should find backend but skip nonexistent
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('backend');
  });

  it('prefers explicit agents list over category fallback', () => {
    // Team ID matches 'product' category, but has explicit agents list
    const team = { id: 'product', agents: ['test-lead'] };
    const result = resolveTeamAgents('product', team, mockAgentsSpec);

    // Should use explicit list, not category match
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-lead');
  });

  it('handles empty explicit agents list as fallback to category', () => {
    const team = { id: 'product', agents: [] };
    const result = resolveTeamAgents('product', team, mockAgentsSpec);

    // Empty array should fall through to category match
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('product-manager');
  });

  it('resolves agents from real agents spec', () => {
    const agentsSpec = loadAgentsSpec(AGENTKIT_ROOT);

    // Product category should have agents
    const productAgents = resolveTeamAgents('product', { id: 'product' }, agentsSpec);
    expect(productAgents.length).toBeGreaterThan(0);
    expect(productAgents.some((a) => a.id === 'product-manager')).toBe(true);

    // Testing category should have agents
    const testingAgents = resolveTeamAgents('testing', { id: 'testing' }, agentsSpec);
    expect(testingAgents.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// P0 + P2: Integration test — sync produces correct team commands
// ---------------------------------------------------------------------------

describe('P0 + P2 Integration: sync generates agent personas and shared sections', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeNamedTmpProject('agentkit-forge');
    const originalLog = console.log;
    console.log = () => {};
    try {
      await runSync({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot,
        flags: { quiet: false },
      });
    } finally {
      console.log = originalLog;
    }
  }, 120_000);

  afterAll(() => {
    if (projectRoot) {
      rmSync(resolve(projectRoot, '..'), { recursive: true, force: true });
    }
  });

  it('team-product.md contains agent personas after sync', () => {
    const teamProduct = readFileSync(
      resolve(projectRoot, '.claude', 'commands', 'team-product.md'),
      'utf-8'
    );

    expect(teamProduct).toContain('## Agent Personas');
    expect(teamProduct).toContain('Product Manager');
    expect(teamProduct).toContain('**Role:**');
  });

  it('team-backend.md resolves its persona by agent id when no category matches', () => {
    const teamBackend = readFileSync(
      resolve(projectRoot, '.claude', 'commands', 'team-backend.md'),
      'utf-8'
    );

    // There is no `backend` agent *category* — the agent lives under
    // `engineering` with the id `backend`. This previously left the team with no
    // personas at all, which resolveTeamAgents' id fallback now fixes (ADR-15).
    expect(teamBackend).toContain('## Agent Personas');
    expect(teamBackend).toContain('Backend Engineer');
    expect(teamBackend).toContain('**Role:**');
  });

  it('generated agent files contain shared sections from sections.yaml', () => {
    const agentFile = readFileSync(
      resolve(projectRoot, '.claude', 'agents', 'product-manager.md'),
      'utf-8'
    );

    // Should contain shared sections (hasTeamOrchestration is enabled)
    expect(agentFile).toContain('## Shared State');
    expect(agentFile).toContain('AGENT_BACKLOG.md');
    expect(agentFile).toContain('### Concurrency Controls');

    // Should contain ungated sections
    expect(agentFile).toContain('## Guidelines');
    expect(agentFile).toContain('## Mandatory PR & Commit Rules');
  });
});

// ---------------------------------------------------------------------------
// P7: Concurrency protocol simplification
// ---------------------------------------------------------------------------

describe('P7: Concurrency protocol simplification', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeNamedTmpProject('agentkit-forge');
    const originalLog = console.log;
    console.log = () => {};
    try {
      await runSync({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot,
        flags: { quiet: false },
      });
    } finally {
      console.log = originalLog;
    }
  }, 120_000);

  afterAll(() => {
    if (projectRoot) {
      rmSync(resolve(projectRoot, '..'), { recursive: true, force: true });
    }
  });

  it('agent files contain brief concurrency summary, not full protocol', () => {
    const agentFile = readFileSync(
      resolve(projectRoot, '.claude', 'agents', 'product-manager.md'),
      'utf-8'
    );

    // Should have brief concurrency controls
    expect(agentFile).toContain('Concurrency Controls');
    expect(agentFile).toContain('docs/orchestration/concurrency-protocol.md');

    // Should NOT have the full inline protocol (flock, fstat, inode)
    expect(agentFile).not.toContain('flock');
    expect(agentFile).not.toContain('fstat');
    expect(agentFile).not.toContain('inode');
  });

  it('full concurrency protocol reference doc exists', () => {
    const docPath = resolve(
      AGENTKIT_ROOT,
      '..',
      'docs',
      'orchestration',
      'concurrency-protocol.md'
    );
    expect(existsSync(docPath)).toBe(true);

    const content = readFileSync(docPath, 'utf-8');
    expect(content).toContain('Lock Acquisition Protocol');
    expect(content).toContain('Stale-Lock Takeover');
    expect(content).toContain('Event Log');
  });

  it('concurrency section is gated behind hasTeamOrchestration', () => {
    const sectionsSpec = readYaml(resolve(AGENTKIT_ROOT, 'spec', 'sections.yaml'));
    const concurrency = sectionsSpec.sections.concurrencyControls;

    expect(concurrency.gate).toBe('hasTeamOrchestration');
  });
});
