import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { loadAgentsSpec } from '../spec-loader.mjs';
import { buildAgentRegistry, buildCollaboratorsSection } from '../var-builders.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'sync-agents-test-'));
}

function writeYaml(dir, filename, content) {
  writeFileSync(join(dir, filename), content, 'utf-8');
}

const AGENT_A_YAML = `
engineering:
  - id: agent-a
    name: Agent A
    category: engineering
    role: >
      First agent. Does engineering things. Second sentence here.
    accepts:
      - implement
    depends-on:
      - agent-b
    notifies:
      - agent-c
    negotiation:
      can-negotiate-with:
        - agent-d
`;

const AGENT_B_YAML = `
testing:
  - id: agent-b
    name: Agent B
    category: testing
    role: >
      Second agent. Does testing things.
    accepts:
      - test
      - review
`;

// ---------------------------------------------------------------------------
// loadAgentsSpec
// ---------------------------------------------------------------------------

describe('loadAgentsSpec', () => {
  let tmp;

  beforeEach(() => {
    tmp = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('loads from spec/agents/ directory when it exists', () => {
    const specDir = join(tmp, 'spec', 'agents');
    mkdirSync(specDir, { recursive: true });
    writeYaml(specDir, 'engineering.yaml', AGENT_A_YAML);
    writeYaml(specDir, 'testing.yaml', AGENT_B_YAML);

    const result = loadAgentsSpec(join(tmp, 'spec', '..'));

    expect(result.agents).toBeDefined();
    expect(result.agents.engineering).toHaveLength(1);
    expect(result.agents.engineering[0].id).toBe('agent-a');
    expect(result.agents.testing).toHaveLength(1);
    expect(result.agents.testing[0].id).toBe('agent-b');
  });

  it('falls back to agents.yaml when directory does not exist', () => {
    const specDir = join(tmp, 'spec');
    mkdirSync(specDir, { recursive: true });
    writeYaml(
      specDir,
      'agents.yaml',
      `agents:\n  engineering:\n    - id: fallback-agent\n      name: Fallback\n`
    );

    const result = loadAgentsSpec(tmp);

    expect(result.agents.engineering[0].id).toBe('fallback-agent');
  });

  it('returns empty object when neither directory nor file exists', () => {
    const result = loadAgentsSpec(tmp);
    expect(result).toEqual({});
  });

  it('merges multiple category files into a single agents map', () => {
    const specDir = join(tmp, 'spec', 'agents');
    mkdirSync(specDir, { recursive: true });
    writeYaml(specDir, 'engineering.yaml', AGENT_A_YAML);
    writeYaml(specDir, 'testing.yaml', AGENT_B_YAML);

    const result = loadAgentsSpec(join(tmp, 'spec', '..'));

    const allIds = [
      ...result.agents.engineering.map((a) => a.id),
      ...result.agents.testing.map((a) => a.id),
    ];
    expect(allIds).toContain('agent-a');
    expect(allIds).toContain('agent-b');
    expect(allIds).toHaveLength(2);
  });

  it('ignores non-yaml files in the agents directory', () => {
    const specDir = join(tmp, 'spec', 'agents');
    mkdirSync(specDir, { recursive: true });
    writeYaml(specDir, 'engineering.yaml', AGENT_A_YAML);
    writeFileSync(join(specDir, 'README.md'), '# readme');
    writeFileSync(join(specDir, '.gitkeep'), '');

    const result = loadAgentsSpec(join(tmp, 'spec', '..'));

    expect(Object.keys(result.agents)).toEqual(['engineering']);
  });
});

// ---------------------------------------------------------------------------
// buildAgentRegistry
// ---------------------------------------------------------------------------

describe('buildAgentRegistry', () => {
  it('returns a Map keyed by agent id', () => {
    const spec = {
      agents: { engineering: [{ id: 'backend', name: 'Backend', role: 'Senior engineer.' }] },
    };
    const registry = buildAgentRegistry(spec);

    expect(registry).toBeInstanceOf(Map);
    expect(registry.has('backend')).toBe(true);
  });

  it('truncates role to first sentence', () => {
    const spec = {
      agents: {
        engineering: [{ id: 'a', name: 'A', role: 'First sentence. Second sentence. Third.' }],
      },
    };
    const registry = buildAgentRegistry(spec);
    expect(registry.get('a').roleSummary).toBe('First sentence');
  });

  it('caps role summary at 120 chars', () => {
    const longRole = 'x'.repeat(200);
    const spec = { agents: { engineering: [{ id: 'a', name: 'A', role: longRole }] } };
    const registry = buildAgentRegistry(spec);
    expect(registry.get('a').roleSummary.length).toBeLessThanOrEqual(120);
  });

  it('includes category, accepts, name from spec', () => {
    const spec = {
      agents: {
        testing: [
          {
            id: 'test-lead',
            name: 'Test Lead',
            role: 'Leads testing.',
            accepts: ['test', 'review'],
          },
        ],
      },
    };
    const registry = buildAgentRegistry(spec);
    const entry = registry.get('test-lead');
    expect(entry.category).toBe('testing');
    expect(entry.accepts).toEqual(['test', 'review']);
    expect(entry.name).toBe('Test Lead');
  });

  it('returns empty Map for empty spec', () => {
    expect(buildAgentRegistry({}).size).toBe(0);
    expect(buildAgentRegistry({ agents: {} }).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildCollaboratorsSection
// ---------------------------------------------------------------------------

describe('buildCollaboratorsSection', () => {
  let registry;

  beforeEach(() => {
    registry = new Map([
      [
        'agent-b',
        {
          id: 'agent-b',
          name: 'Agent B',
          category: 'testing',
          roleSummary: 'Does testing',
          accepts: ['test'],
        },
      ],
      [
        'agent-c',
        {
          id: 'agent-c',
          name: 'Agent C',
          category: 'ops',
          roleSummary: 'Does ops',
          accepts: ['review'],
        },
      ],
      [
        'agent-d',
        {
          id: 'agent-d',
          name: 'Agent D',
          category: 'design',
          roleSummary: 'Does design',
          accepts: [],
        },
      ],
    ]);
  });

  it('returns empty string when agent has no relationships', () => {
    const agent = { id: 'solo', 'depends-on': [], notifies: [] };
    expect(buildCollaboratorsSection(agent, registry)).toBe('');
  });

  it('includes agents from depends-on, notifies, and can-negotiate-with', () => {
    const agent = {
      id: 'agent-a',
      'depends-on': ['agent-b'],
      notifies: ['agent-c'],
      negotiation: { 'can-negotiate-with': ['agent-d'] },
    };
    const section = buildCollaboratorsSection(agent, registry);

    expect(section).toContain('agent-b');
    expect(section).toContain('agent-c');
    expect(section).toContain('agent-d');
  });

  it('deduplicates agents that appear in multiple relationship lists', () => {
    const agent = {
      id: 'agent-a',
      'depends-on': ['agent-b'],
      notifies: ['agent-b'], // duplicate
    };
    const section = buildCollaboratorsSection(agent, registry);
    const matches = (section.match(/agent-b/g) || []).length;
    expect(matches).toBe(1);
  });

  it('excludes the agent itself from its own collaborators section', () => {
    const agent = {
      id: 'agent-b',
      notifies: ['agent-b'], // self-reference
    };
    expect(buildCollaboratorsSection(agent, registry)).toBe('');
  });

  it('silently skips unknown IDs and calls warn callback', () => {
    const warnings = [];
    const agent = { id: 'agent-a', 'depends-on': ['unknown-agent'] };
    const section = buildCollaboratorsSection(agent, registry, {
      warn: (msg) => warnings.push(msg),
    });

    expect(section).toBe('');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('unknown-agent');
  });

  it('formats each collaborator with name, category, role, and accepts', () => {
    const agent = { id: 'agent-a', 'depends-on': ['agent-b'] };
    const section = buildCollaboratorsSection(agent, registry);

    expect(section).toContain('**[agent-b]**');
    expect(section).toContain('Agent B');
    expect(section).toContain('testing');
    expect(section).toContain('Does testing');
    expect(section).toContain('accepts: test');
  });

  it('omits accepts clause when agent accepts nothing', () => {
    const agent = { id: 'agent-a', 'depends-on': ['agent-d'] };
    const section = buildCollaboratorsSection(agent, registry);
    expect(section).not.toContain('accepts:');
  });
});
