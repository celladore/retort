/**
 * Tests for ADR-15 native agent dispatch — the frontmatter emitter that turns
 * generated agent personas into registrable Claude Code subagents.
 *
 * Unit coverage for the pure derivation helpers in var-builders.mjs, plus
 * integration coverage over syncClaudeAgents rendering the real agent spec
 * through the real template.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import yaml from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { syncClaudeAgents, syncClaudeSettings } from '../platform-syncer.mjs';
import { clearTemplateTextCache, loadAgentsSpec } from '../spec-loader.mjs';
import { renderTemplate } from '../template-utils.mjs';
import {
  AGENT_CATEGORY_COLORS,
  AGENT_NAME_PATTERN,
  CODE_WRITING_TASK_TYPES,
  DEFAULT_DISPATCH_MODE,
  DEFAULT_SUBAGENT_SPAWN_DEPTH,
  DISPATCH_MODES,
  DISPATCH_CAPABLE_CATEGORIES,
  MAX_AGENT_DESCRIPTION_LENGTH,
  MAX_SUBAGENT_SPAWN_DEPTH,
  MIN_SUBAGENT_SPAWN_DEPTH,
  WRITE_TASK_TYPES,
  buildAgentVars,
  buildTeamDispatchTable,
  deriveAgentDescription,
  deriveAgentIsolation,
  deriveAgentTools,
  deriveCanDispatch,
  deriveDisallowedTools,
  resolveDispatchMode,
  resolveMaxSubagentSpawnDepth,
  resolveTeamAgents,
} from '../var-builders.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const TEMPLATES_DIR = resolve(AGENTKIT_ROOT, 'templates');

// ---------------------------------------------------------------------------
// deriveAgentDescription
// ---------------------------------------------------------------------------

describe('deriveAgentDescription', () => {
  it('uses dispatch.when-to-use verbatim when present', () => {
    const agent = {
      id: 'backend',
      accepts: ['implement'],
      focus: ['apps/api/**'],
      role: 'Senior backend engineer.',
      dispatch: { 'when-to-use': 'Use for API endpoints and service-layer architecture.' },
    };

    expect(deriveAgentDescription(agent)).toBe(
      'Use for API endpoints and service-layer architecture.'
    );
  });

  it('collapses a folded multi-line when-to-use onto a single line', () => {
    const agent = { id: 'a', dispatch: { 'when-to-use': '  Use for API\n  endpoints.\n' } };

    expect(deriveAgentDescription(agent)).toBe('Use for API endpoints.');
  });

  it('derives from accepts, the first three focus globs, and the first role sentence', () => {
    const agent = {
      id: 'backend',
      accepts: ['implement', 'review', 'plan'],
      focus: ['apps/api/**', 'services/**', 'src/server/**', 'controllers/**', 'routes/**'],
      role: 'Senior backend engineer responsible for API design. Ensures clean separation.',
    };

    expect(deriveAgentDescription(agent)).toBe(
      'Use for implement, review, plan work in apps/api/**, services/**, src/server/**. ' +
        'Senior backend engineer responsible for API design.'
    );
  });

  it('terminates the derived role sentence when the role has no full stop', () => {
    const agent = { id: 'a', accepts: ['review'], focus: ['docs/**'], role: 'Reviews things' };

    expect(deriveAgentDescription(agent)).toBe('Use for review work in docs/**. Reviews things.');
  });

  it('omits the focus clause when the agent has no focus globs', () => {
    const agent = { id: 'a', accepts: ['review'], role: 'Reviews things.' };

    expect(deriveAgentDescription(agent)).toBe('Use for review work. Reviews things.');
  });

  it('omits the accepts clause when the agent has no accepted task types', () => {
    const agent = { id: 'a', focus: ['docs/**'], role: 'Reviews things.' };

    expect(deriveAgentDescription(agent)).toBe('Use for work in docs/**. Reviews things.');
  });

  it('drops a role whose first sentence is empty rather than emitting a stray full stop', () => {
    const agent = { id: 'a', accepts: ['review'], role: '. Something else.' };

    expect(deriveAgentDescription(agent)).toBe('Use for review work.');
  });

  it('never returns an empty description for a bare agent', () => {
    expect(deriveAgentDescription({ id: 'a', name: 'Agent A' })).toBe('Retort Agent A persona.');
    expect(deriveAgentDescription({ id: 'a' })).toBe('Retort a persona.');
    expect(deriveAgentDescription({})).toBe('Retort agent persona.');
    expect(deriveAgentDescription(undefined)).toBe('Retort agent persona.');
  });

  it('truncates an over-long when-to-use to 500 characters with an ellipsis', () => {
    const agent = { id: 'a', dispatch: { 'when-to-use': 'x'.repeat(900) } };

    const result = deriveAgentDescription(agent);

    expect(result).toHaveLength(MAX_AGENT_DESCRIPTION_LENGTH);
    expect(result.endsWith('...')).toBe(true);
  });

  it('truncates an over-long derived description to 500 characters', () => {
    const agent = { id: 'a', accepts: ['implement'], focus: ['x/**'], role: 'y'.repeat(900) };

    expect(deriveAgentDescription(agent)).toHaveLength(MAX_AGENT_DESCRIPTION_LENGTH);
  });

  it('leaves a description exactly at the limit untouched', () => {
    const exact = 'z'.repeat(MAX_AGENT_DESCRIPTION_LENGTH);

    expect(deriveAgentDescription({ id: 'a', dispatch: { 'when-to-use': exact } })).toBe(exact);
  });
});

// ---------------------------------------------------------------------------
// deriveAgentIsolation
// ---------------------------------------------------------------------------

describe('deriveAgentIsolation', () => {
  it.each(CODE_WRITING_TASK_TYPES)('returns worktree when accepts contains %s', (type) => {
    expect(deriveAgentIsolation([type])).toBe('worktree');
  });

  it.each(['review', 'investigate', 'plan', 'audit', 'discover', 'document'])(
    'returns an empty string for the read-only type %s',
    (type) => {
      expect(deriveAgentIsolation([type])).toBe('');
    }
  );

  it('returns an empty string for an empty or missing accepts list', () => {
    expect(deriveAgentIsolation([])).toBe('');
    expect(deriveAgentIsolation(undefined)).toBe('');
    expect(deriveAgentIsolation('implement')).toBe('');
  });

  it('returns worktree when a code-writing type is mixed with read-only types', () => {
    expect(deriveAgentIsolation(['plan', 'review', 'implement'])).toBe('worktree');
  });

  it('lets dispatch.isolation override the derivation in both directions', () => {
    expect(deriveAgentIsolation(['implement'], { isolation: 'none' })).toBe('');
    expect(deriveAgentIsolation(['review'], { isolation: 'worktree' })).toBe('worktree');
  });

  it('derives normally for auto, an absent block, or an unrecognised value', () => {
    expect(deriveAgentIsolation(['implement'], { isolation: 'auto' })).toBe('worktree');
    expect(deriveAgentIsolation(['implement'], {})).toBe('worktree');
    // A typo must not silently disable isolation — the validator reports it
    expect(deriveAgentIsolation(['implement'], { isolation: 'worktee' })).toBe('worktree');
  });
});

// ---------------------------------------------------------------------------
// deriveAgentTools
// ---------------------------------------------------------------------------

describe('deriveAgentTools', () => {
  const base = {
    id: 'backend',
    accepts: ['implement'],
    'preferred-tools': ['Read', 'Write', 'Bash'],
  };

  it('returns an empty string in the default inherit mode', () => {
    expect(deriveAgentTools(base, true)).toBe('');
    expect(deriveAgentTools({ ...base, dispatch: { 'tools-mode': 'inherit' } }, true)).toBe('');
  });

  it('emits the allowlist when the agent opts in', () => {
    const agent = { ...base, dispatch: { 'tools-mode': 'allowlist' } };

    expect(deriveAgentTools(agent, false)).toBe('Read, Write, Bash');
  });

  it('appends Agent only when the agent may dispatch', () => {
    const agent = { ...base, dispatch: { 'tools-mode': 'allowlist' } };

    expect(deriveAgentTools(agent, true)).toBe('Read, Write, Bash, Agent');
  });

  it('does not append Agent twice when it is already listed', () => {
    const agent = {
      ...base,
      'preferred-tools': ['Read', 'Agent'],
      dispatch: { 'tools-mode': 'allowlist' },
    };

    expect(deriveAgentTools(agent, true)).toBe('Read, Agent');
  });

  it('subtracts the write tools for a read-only agent', () => {
    const agent = {
      ...base,
      accepts: ['review'],
      'preferred-tools': ['Read', 'Write', 'Edit', 'NotebookEdit', 'Grep'],
      dispatch: { 'tools-mode': 'allowlist' },
    };

    expect(deriveAgentTools(agent, false)).toBe('Read, Grep');
  });

  it('falls back to inherit rather than emitting an empty allowlist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const agent = { ...base, 'preferred-tools': [], dispatch: { 'tools-mode': 'allowlist' } };

      // An empty `tools:` launches a subagent with no tools at all
      expect(deriveAgentTools(agent, false)).toBe('');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('backend'));
    } finally {
      warn.mockRestore();
    }
  });

  it('ignores blank and non-string tool entries', () => {
    const agent = {
      ...base,
      'preferred-tools': ['Read', '  ', null, 42, ' Grep '],
      dispatch: { 'tools-mode': 'allowlist' },
    };

    expect(deriveAgentTools(agent, false)).toBe('Read, Grep');
  });
});

// ---------------------------------------------------------------------------
// resolveMaxSubagentSpawnDepth
// ---------------------------------------------------------------------------

describe('resolveMaxSubagentSpawnDepth', () => {
  it('defaults to 2 when the setting is absent', () => {
    expect(resolveMaxSubagentSpawnDepth(undefined)).toBe(DEFAULT_SUBAGENT_SPAWN_DEPTH);
    expect(resolveMaxSubagentSpawnDepth({})).toBe(DEFAULT_SUBAGENT_SPAWN_DEPTH);
    expect(resolveMaxSubagentSpawnDepth({ 'max-subagent-spawn-depth': null })).toBe(
      DEFAULT_SUBAGENT_SPAWN_DEPTH
    );
  });

  it.each([MIN_SUBAGENT_SPAWN_DEPTH, 2, MAX_SUBAGENT_SPAWN_DEPTH])(
    'accepts the in-range value %i',
    (depth) => {
      expect(resolveMaxSubagentSpawnDepth({ 'max-subagent-spawn-depth': depth })).toBe(depth);
    }
  );

  it.each([0, -1, 4, 7, 2.5, '2', true])(
    'warns and falls back to the default for the invalid value %p',
    (depth) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        // Falls back rather than clamping — clamping 7 to 3 emits a number nobody asked for
        expect(resolveMaxSubagentSpawnDepth({ 'max-subagent-spawn-depth': depth })).toBe(
          DEFAULT_SUBAGENT_SPAWN_DEPTH
        );
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('max-subagent-spawn-depth'));
      } finally {
        warn.mockRestore();
      }
    }
  );

  it('is not derived from max-handoff-chain-depth (ADR-15 §4)', () => {
    // A spawn tree nests and multiplies where a handoff chain runs sequentially;
    // 7 nested contexts is a token-budget hazard, not a deeper handoff chain.
    expect(resolveMaxSubagentSpawnDepth({ 'max-handoff-chain-depth': 7 })).toBe(
      DEFAULT_SUBAGENT_SPAWN_DEPTH
    );
  });
});

// ---------------------------------------------------------------------------
// deriveDisallowedTools
// ---------------------------------------------------------------------------

describe('deriveDisallowedTools', () => {
  it('denies the write tools for a read-only agent', () => {
    expect(deriveDisallowedTools(['review', 'investigate'])).toBe('Write, Edit, NotebookEdit');
  });

  it.each(WRITE_TASK_TYPES)('denies nothing when accepts contains the write type %s', (type) => {
    expect(deriveDisallowedTools([type])).toBe('');
  });

  it('treats document as write-capable even though it is not code-writing', () => {
    expect(deriveDisallowedTools(['plan', 'review', 'investigate', 'document'])).toBe('');
    expect(deriveAgentIsolation(['plan', 'review', 'investigate', 'document'])).toBe('');
  });

  it('denies the write tools for an empty or missing accepts list', () => {
    expect(deriveDisallowedTools([])).toBe('Write, Edit, NotebookEdit');
    expect(deriveDisallowedTools(undefined)).toBe('Write, Edit, NotebookEdit');
  });

  it('appends Agent for a non-dispatching agent', () => {
    expect(deriveDisallowedTools(['implement'], false)).toBe('Agent');
    expect(deriveDisallowedTools(['review'], false)).toBe('Write, Edit, NotebookEdit, Agent');
  });

  it('defaults to leaving the Agent tool available', () => {
    expect(deriveDisallowedTools(['implement'])).toBe('');
    expect(deriveDisallowedTools(['implement'], true)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// deriveCanDispatch
// ---------------------------------------------------------------------------

describe('deriveCanDispatch', () => {
  it.each(DISPATCH_CAPABLE_CATEGORIES)('defaults to true for the %s category', (category) => {
    expect(deriveCanDispatch(category, undefined)).toBe(true);
  });

  it.each([
    'engineering',
    'testing',
    'operations',
    'product',
    'design',
    'marketing',
    'cost-operations',
    'feature-management',
  ])('defaults to false for the leaf category %s', (category) => {
    expect(deriveCanDispatch(category, undefined)).toBe(false);
  });

  it('defaults to false for an unknown category', () => {
    expect(deriveCanDispatch('not-a-category', {})).toBe(false);
  });

  it('honours a per-agent override in both directions', () => {
    expect(deriveCanDispatch('engineering', { 'can-dispatch': true })).toBe(true);
    expect(deriveCanDispatch('team-creation', { 'can-dispatch': false })).toBe(false);
  });

  it('ignores a non-boolean override and falls back to the category default', () => {
    expect(deriveCanDispatch('engineering', { 'can-dispatch': 'yes' })).toBe(false);
    expect(deriveCanDispatch('team-creation', { 'can-dispatch': 'no' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Worked examples from the implementation spec
// ---------------------------------------------------------------------------

describe('worked examples (docs/planning/agents-teams/agent-dispatch-capability.md)', () => {
  it('backend — write-capable, isolated in a worktree', () => {
    const accepts = ['implement', 'review', 'plan'];

    expect(deriveDisallowedTools(accepts)).toBe('');
    expect(deriveAgentIsolation(accepts)).toBe('worktree');
  });

  it('forge — write-capable via document, but no worktree', () => {
    const accepts = ['plan', 'review', 'investigate', 'document'];

    expect(deriveDisallowedTools(accepts)).toBe('');
    expect(deriveAgentIsolation(accepts)).toBe('');
  });

  it('security-auditor — read-only, write tools denied', () => {
    const accepts = ['review', 'investigate'];

    expect(deriveDisallowedTools(accepts)).toBe('Write, Edit, NotebookEdit');
    expect(deriveAgentIsolation(accepts)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildAgentVars — dispatch variables
// ---------------------------------------------------------------------------

describe('buildAgentVars dispatch variables', () => {
  const agent = {
    id: 'backend',
    name: 'Backend Engineer',
    accepts: ['implement', 'review', 'plan'],
    focus: ['apps/api/**'],
    role: 'Senior backend engineer.',
  };

  it('emits name, description, model, isolation, and colour', () => {
    const result = buildAgentVars(agent, 'engineering', {});

    expect(result.agentDispatchName).toBe('backend');
    expect(result.agentDescription).not.toBe('');
    expect(result.agentModel).toBe('inherit');
    expect(result.agentIsolation).toBe('worktree');
    expect(result.agentColor).toBe(AGENT_CATEGORY_COLORS.engineering);
  });

  it('never promotes preferred-tools to an allowlist by default', () => {
    const withTools = { ...agent, 'preferred-tools': ['Read', 'Write', 'Bash'] };

    const result = buildAgentVars(withTools, 'engineering', {});

    // Documented as prose only — an allowlist here would strip Agent/Skill/MCP tools.
    expect(result.agentTools).toBe('');
    expect(result.agentToolsList).toBe('- Read\n- Write\n- Bash');
  });

  it('denies the Agent tool to a leaf category', () => {
    const readOnly = { ...agent, accepts: ['review'] };

    expect(buildAgentVars(readOnly, 'engineering', {}).agentDisallowedTools).toBe(
      'Write, Edit, NotebookEdit, Agent'
    );
    expect(buildAgentVars(readOnly, 'engineering', {}).agentCanDispatch).toBe(false);
  });

  it('leaves the Agent tool with a coordinator category', () => {
    const result = buildAgentVars(agent, 'strategic-operations', {});

    expect(result.agentDisallowedTools).toBe('');
    expect(result.agentCanDispatch).toBe(true);
  });

  it('honours an authored dispatch.model', () => {
    const withModel = { ...agent, dispatch: { model: 'opus' } };

    expect(buildAgentVars(withModel, 'engineering', {}).agentModel).toBe('opus');
  });

  it('honours dispatch.isolation over the accepts-derived value', () => {
    const forcedOff = { ...agent, dispatch: { isolation: 'none' } };
    const forcedOn = { ...agent, accepts: ['review'], dispatch: { isolation: 'worktree' } };

    expect(buildAgentVars(forcedOff, 'engineering', {}).agentIsolation).toBe('');
    expect(buildAgentVars(forcedOn, 'engineering', {}).agentIsolation).toBe('worktree');
  });

  it('honours dispatch.color over the category default', () => {
    const withColour = { ...agent, dispatch: { color: 'red' } };

    expect(buildAgentVars(withColour, 'engineering', {}).agentColor).toBe('red');
  });

  it('emits background only when the agent opts in', () => {
    expect(buildAgentVars(agent, 'engineering', {}).agentBackground).toBe('');
    expect(
      buildAgentVars({ ...agent, dispatch: { background: true } }, 'engineering', {})
        .agentBackground
    ).toBe('true');
  });

  it('drops disallowedTools when an allowlist takes over as the single authority', () => {
    const allowlisted = {
      ...agent,
      accepts: ['review'],
      'preferred-tools': ['Read', 'Write', 'Grep'],
      dispatch: { 'tools-mode': 'allowlist' },
    };

    const result = buildAgentVars(allowlisted, 'engineering', {});

    // Read-only guardrail applied by subtraction from the list, not by a second key
    expect(result.agentTools).toBe('Read, Grep');
    expect(result.agentDisallowedTools).toBe('');
  });

  it('omits the colour for an unknown category rather than guessing', () => {
    expect(buildAgentVars(agent, 'not-a-category', {}).agentColor).toBe('');
  });

  it('warns when an agent id cannot be used as a subagent name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      buildAgentVars({ ...agent, id: 'forge:backend' }, 'engineering', {});
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('forge:backend'));
    } finally {
      warn.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// syncClaudeAgents — integration over the real spec and template
// ---------------------------------------------------------------------------

/** Splits a generated file into its raw frontmatter block and body. */
function splitFrontmatter(content) {
  expect(content.startsWith('---\n')).toBe(true);
  const closingIdx = content.indexOf('\n---', 3);
  expect(closingIdx).toBeGreaterThan(-1);
  return {
    frontmatter: content.slice(4, closingIdx),
    body: content.slice(closingIdx + 4),
    closingIdx,
  };
}

describe('syncClaudeAgents frontmatter emission', () => {
  let tmp;
  let files;

  beforeAll(async () => {
    clearTemplateTextCache();
    tmp = mkdtempSync(join(tmpdir(), 'agent-dispatch-test-'));
    const agentsSpec = loadAgentsSpec(AGENTKIT_ROOT);
    const vars = {
      lastAgent: 'retort',
      lastModel: 'sync-engine',
      syncDate: '2026-08-07',
      defaultBranch: 'main',
      shared_sharedState: '',
      shared_concurrencyControls: '',
      shared_guidelines: '',
      shared_prRules: '',
    };

    await syncClaudeAgents(TEMPLATES_DIR, tmp, vars, '3.1.0', 'retort', agentsSpec, {});

    const dir = join(tmp, '.claude', 'agents');
    files = new Map(
      readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => [f.replace(/\.md$/, ''), readFileSync(join(dir, f), 'utf-8')])
    );
  });

  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    clearTemplateTextCache();
  });

  it('emits one file per spec agent', () => {
    expect(files.size).toBeGreaterThanOrEqual(30);
  });

  it('parses as YAML frontmatter plus a markdown body for every agent', () => {
    for (const [id, content] of files) {
      const { frontmatter, body } = splitFrontmatter(content);
      const parsed = yaml.load(frontmatter);

      expect(parsed, id).toBeTypeOf('object');
      expect(body, id).toContain('# ');
    }
  });

  it('gives every agent a non-empty name and description', () => {
    for (const [id, content] of files) {
      const parsed = yaml.load(splitFrontmatter(content).frontmatter);

      expect(parsed.name, id).toBe(id);
      expect(typeof parsed.description, id).toBe('string');
      expect(parsed.description.trim(), id).not.toBe('');
      expect(parsed.description.length, id).toBeLessThanOrEqual(MAX_AGENT_DESCRIPTION_LENGTH);
    }
  });

  it('emits names that Claude Code will accept', () => {
    for (const [id, content] of files) {
      const parsed = yaml.load(splitFrontmatter(content).frontmatter);

      expect(parsed.name, id).toMatch(AGENT_NAME_PATTERN);
      expect(parsed.name, id).not.toContain(':');
    }
  });

  it('places the GENERATED header after the closing --- of the frontmatter', () => {
    for (const [id, content] of files) {
      const headerIdx = content.indexOf('GENERATED by Retort');
      const { closingIdx } = splitFrontmatter(content);

      expect(headerIdx, id).toBeGreaterThan(closingIdx);
      // Regression guard: a header at position 0 would sit above the frontmatter and
      // silently reduce the file to a prose persona.
      expect(content.indexOf('<!--'), id).toBeGreaterThan(closingIdx);
    }
  });

  it('never emits a frontmatter key with an empty value', () => {
    for (const [id, content] of files) {
      const { frontmatter } = splitFrontmatter(content);
      for (const line of frontmatter.split('\n')) {
        if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
        expect(line, `${id}: "${line}"`).not.toMatch(/^[A-Za-z][A-Za-z-]*:\s*$/);
      }
    }
  });

  it('emits no tools allowlist, because no retort agent opts into allowlist mode', () => {
    for (const [id, content] of files) {
      const parsed = yaml.load(splitFrontmatter(content).frontmatter);

      expect(parsed, id).not.toHaveProperty('tools');
    }
  });

  it('withholds Agent from leaf categories and leaves it with coordinators', () => {
    const denies = (id) =>
      String(yaml.load(splitFrontmatter(files.get(id)).frontmatter).disallowedTools || '')
        .split(', ')
        .includes('Agent');

    // engineering is a leaf category — a backend agent fanning out is where budgets die
    expect(denies('backend')).toBe(true);
    // strategic-operations coordinates; the team graph already models it fanning out
    expect(denies('adoption-strategist')).toBe(false);
  });

  it('renders the write-capable backend agent with worktree isolation', () => {
    const parsed = yaml.load(splitFrontmatter(files.get('backend')).frontmatter);

    expect(parsed).toMatchObject({
      name: 'backend',
      model: 'inherit',
      isolation: 'worktree',
      color: 'blue',
      // write-capable, so only the leaf-category Agent denial applies
      disallowedTools: 'Agent',
    });
    expect(parsed.description).toContain('Use for implement, review, plan work in');
  });

  it('renders the read-only security-auditor agent without write tools', () => {
    const parsed = yaml.load(splitFrontmatter(files.get('security-auditor')).frontmatter);

    expect(parsed).toMatchObject({
      name: 'security-auditor',
      // routed to opus by dispatch.model — a missed authorisation gap costs more
      model: 'opus',
      disallowedTools: 'Write, Edit, NotebookEdit, Agent',
    });
    expect(parsed).not.toHaveProperty('isolation');
  });

  it('renders a document-accepting agent as write-capable without a worktree', () => {
    const parsed = yaml.load(splitFrontmatter(files.get('adoption-strategist')).frontmatter);

    expect(parsed).not.toHaveProperty('disallowedTools');
    expect(parsed).not.toHaveProperty('isolation');
  });

  it('keeps preferred-tools rendering as the prose Preferred Tools section', () => {
    const content = files.get('backend');

    expect(content).toContain('## Preferred Tools');
    expect(content).toContain('- Read');
  });

  it('does not warn about missing frontmatter for any agent', () => {
    for (const [id, content] of files) {
      expect(content.startsWith('---'), id).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Template rendering — YAML-hostile description values
// ---------------------------------------------------------------------------

describe('agent TEMPLATE.md frontmatter quoting', () => {
  const templatePath = join(TEMPLATES_DIR, 'claude', 'agents', 'TEMPLATE.md');

  function renderAgent(agent, category) {
    const template = readFileSync(templatePath, 'utf-8');
    const vars = buildAgentVars(agent, category, {
      lastAgent: 'retort',
      lastModel: 'sync-engine',
      syncDate: '2026-08-07',
      shared_sharedState: '',
      shared_concurrencyControls: '',
      shared_guidelines: '',
      shared_prRules: '',
      retortRemapTarget: '',
    });
    return renderTemplate(template, vars, templatePath);
  }

  it('survives a description containing quotes, colons, and hashes', () => {
    const rendered = renderAgent(
      {
        id: 'quoter',
        name: 'Quoter',
        accepts: ['review'],
        dispatch: {
          'when-to-use': "Use when the repo's config: a #hash, a 'quote', and a \"double\".",
        },
      },
      'engineering'
    );

    const parsed = yaml.load(splitFrontmatter(rendered).frontmatter);

    expect(parsed.description).toBe(
      "Use when the repo's config: a #hash, a 'quote', and a \"double\"."
    );
  });

  it('keeps a multi-line role from breaking out of the frontmatter block', () => {
    const rendered = renderAgent(
      {
        id: 'multiliner',
        name: 'Multiliner',
        accepts: ['review'],
        focus: ['docs/**'],
        role: 'First line\n---\nstill the role. Second sentence.',
      },
      'engineering'
    );

    const { frontmatter } = splitFrontmatter(rendered);

    expect(() => yaml.load(frontmatter)).not.toThrow();
    expect(frontmatter.split('\n').filter((l) => l.startsWith('---'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// syncClaudeSettings — CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH
// ---------------------------------------------------------------------------

describe('syncClaudeSettings spawn depth env', () => {
  const PERMISSIONS = { allow: [], deny: [] };

  /** Runs the real settings template through the syncer and parses the output. */
  async function renderSettings(vars) {
    const dir = mkdtempSync(join(tmpdir(), 'agent-dispatch-settings-'));
    try {
      await syncClaudeSettings(TEMPLATES_DIR, dir, vars, '3.2.0', PERMISSIONS, {});
      return JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf-8'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('emits the configured depth as a string', async () => {
    const settings = await renderSettings({ maxSubagentSpawnDepth: 2 });

    // settings.json env values must be strings, not numbers
    expect(settings.env).toEqual({ CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '2' });
  });

  it('emits whatever depth the spec resolved to', async () => {
    const settings = await renderSettings({ maxSubagentSpawnDepth: 3 });

    expect(settings.env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH).toBe('3');
  });

  it('omits the env block entirely when no depth is resolved', async () => {
    const settings = await renderSettings({});

    expect(settings).not.toHaveProperty('env');
  });

  it('leaves permissions untouched', async () => {
    const settings = await renderSettings({ maxSubagentSpawnDepth: 2 });

    expect(settings.permissions).toEqual(PERMISSIONS);
  });

  it('matches the depth the repo spec actually configures', () => {
    const teamsSpec = yaml.load(
      readFileSync(resolve(AGENTKIT_ROOT, 'spec', 'teams.yaml'), 'utf-8')
    );

    // Guards the one number that decides how wide a live /orchestrate run can go
    expect(resolveMaxSubagentSpawnDepth(teamsSpec)).toBe(DEFAULT_SUBAGENT_SPAWN_DEPTH);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — delegation backend and the team → subagent_type routing table
// ---------------------------------------------------------------------------

describe('resolveDispatchMode', () => {
  it('defaults to native when nothing is configured', () => {
    expect(resolveDispatchMode(undefined, undefined)).toBe(DEFAULT_DISPATCH_MODE);
    expect(resolveDispatchMode({}, {})).toBe('native');
    expect(resolveDispatchMode({}, { dispatch: {} })).toBe('native');
  });

  it.each(DISPATCH_MODES)('accepts the mode %s from the shared spec', (mode) => {
    expect(resolveDispatchMode({}, { dispatch: { mode } })).toBe(mode);
  });

  it('lets the repo overlay opt out without forking settings.yaml', () => {
    expect(
      resolveDispatchMode({ dispatchMode: 'task-file' }, { dispatch: { mode: 'native' } })
    ).toBe('task-file');
  });

  it('warns and falls back for an unknown mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(resolveDispatchMode({}, { dispatch: { mode: 'rpc' } })).toBe(DEFAULT_DISPATCH_MODE);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('dispatch mode'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('buildTeamDispatchTable', () => {
  const agentsSpec = {
    agents: {
      backend: [{ id: 'backend', name: 'Backend Engineer', role: 'r' }],
      testing: [
        { id: 'test-lead', name: 'Test Lead', role: 'r' },
        { id: 'coverage-tracker', name: 'Coverage Tracker', role: 'r' },
      ],
    },
  };

  it('names the lead agent, not the team, as the subagent_type', () => {
    const table = buildTeamDispatchTable({ teams: [{ id: 'testing' }] }, agentsSpec);

    // The whole point: dispatching `testing` fails; `test-lead` is the agent
    expect(table).toBe('| `testing` | `test-lead` | `test-lead`, `coverage-tracker` |');
  });

  it('emits one row per team that resolves at least one agent', () => {
    const table = buildTeamDispatchTable(
      { teams: [{ id: 'backend' }, { id: 'testing' }] },
      agentsSpec
    );

    expect(table.split('\n')).toHaveLength(2);
  });

  it('skips a team with no agents rather than emitting an empty cell', () => {
    const table = buildTeamDispatchTable({ teams: [{ id: 'ghost' }] }, agentsSpec);

    expect(table).toBe('');
  });

  it('honours an explicit agents list over category matching', () => {
    const table = buildTeamDispatchTable(
      { teams: [{ id: 'backend', agents: ['coverage-tracker'] }] },
      agentsSpec
    );

    expect(table).toBe('| `backend` | `coverage-tracker` | `coverage-tracker` |');
  });

  it('returns an empty string for a missing spec', () => {
    expect(buildTeamDispatchTable(undefined, undefined)).toBe('');
    expect(buildTeamDispatchTable({}, {})).toBe('');
  });

  it('covers every team in the real spec that has agents', () => {
    const teamsSpec = yaml.load(
      readFileSync(resolve(AGENTKIT_ROOT, 'spec', 'teams.yaml'), 'utf-8')
    );
    const realAgents = loadAgentsSpec(AGENTKIT_ROOT);

    const table = buildTeamDispatchTable(teamsSpec, realAgents);
    const rows = table.split('\n').filter(Boolean);

    expect(rows.length).toBeGreaterThan(0);
    // Every lead named in the table must be a real, registrable agent id
    const known = new Set(
      Object.values(realAgents.agents)
        .flat()
        .map((a) => a.id)
    );
    for (const row of rows) {
      const lead = row.split('|')[2].trim().replaceAll('`', '');
      expect(known.has(lead), `${lead} is not a known agent id`).toBe(true);
      expect(lead).toMatch(AGENT_NAME_PATTERN);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveTeamAgents — team id / agent category are different vocabularies
// ---------------------------------------------------------------------------

describe('resolveTeamAgents id fallback', () => {
  const agentsSpec = {
    agents: {
      engineering: [
        { id: 'backend', name: 'Backend Engineer', role: 'r' },
        { id: 'frontend', name: 'Frontend Engineer', role: 'r' },
      ],
      testing: [{ id: 'test-lead', name: 'Test Lead', role: 'r' }],
    },
  };

  it('resolves a team whose id names an agent in another category', () => {
    // `backend` the team vs `backend` the agent, categorised under `engineering`
    expect(resolveTeamAgents('backend', {}, agentsSpec)).toEqual([
      { id: 'backend', name: 'Backend Engineer', role: 'r', category: 'engineering' },
    ]);
  });

  it('still prefers a category match over the id fallback', () => {
    const resolved = resolveTeamAgents('testing', {}, agentsSpec);

    expect(resolved.map((a) => a.id)).toEqual(['test-lead']);
  });

  it('still prefers an explicit agents list over both', () => {
    const resolved = resolveTeamAgents('backend', { agents: ['test-lead'] }, agentsSpec);

    expect(resolved.map((a) => a.id)).toEqual(['test-lead']);
  });

  it('returns nothing when the team matches no category and no agent id', () => {
    expect(resolveTeamAgents('ghost', {}, agentsSpec)).toEqual([]);
  });

  it('gives every team in the real spec at least one agent', () => {
    const teamsSpec = yaml.load(
      readFileSync(resolve(AGENTKIT_ROOT, 'spec', 'teams.yaml'), 'utf-8')
    );
    const realAgents = loadAgentsSpec(AGENTKIT_ROOT);

    const orphans = (teamsSpec.teams || [])
      .filter((team) => resolveTeamAgents(team.id, team, realAgents).length === 0)
      .map((team) => team.id);

    // A team with no agents has no persona section and no dispatchable target
    expect(orphans).toEqual([]);
  });
});
