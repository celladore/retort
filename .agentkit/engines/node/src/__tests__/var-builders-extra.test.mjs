import { describe, it, expect } from 'vitest';
import {
  inferMaxTaskTurns,
  inferMaxHandoffChainDepth,
  inferMaxStagnationTurns,
  inferTestingCoverage,
  buildBrowserTestingVars,
  getTeamCommandStem,
  isFeatureEnabled,
  isItemFeatureEnabled,
  buildTeamVars,
  buildAreaRoutingTable,
  buildCommandVars,
  buildAgentVars,
  buildAgentRegistry,
} from '../var-builders.mjs';

// ---------------------------------------------------------------------------
// inferMaxTaskTurns
// ---------------------------------------------------------------------------
describe('inferMaxTaskTurns', () => {
  it('returns 15 for solo team', () => {
    expect(inferMaxTaskTurns('solo')).toBe(15);
  });

  it('returns 25 for small team', () => {
    expect(inferMaxTaskTurns('small')).toBe(25);
  });

  it('returns 35 for medium team', () => {
    expect(inferMaxTaskTurns('medium')).toBe(35);
  });

  it('returns 35 for large team', () => {
    expect(inferMaxTaskTurns('large')).toBe(35);
  });

  it('falls back to 25 for unknown size', () => {
    expect(inferMaxTaskTurns('huge')).toBe(25);
    expect(inferMaxTaskTurns(undefined)).toBe(25);
    expect(inferMaxTaskTurns(null)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// inferMaxHandoffChainDepth
// ---------------------------------------------------------------------------
describe('inferMaxHandoffChainDepth', () => {
  it('returns 3 for small team count (<=3)', () => {
    expect(inferMaxHandoffChainDepth(1)).toBe(3);
    expect(inferMaxHandoffChainDepth(3)).toBe(3);
  });

  it('returns 5 for medium team count (4-6)', () => {
    expect(inferMaxHandoffChainDepth(4)).toBe(5);
    expect(inferMaxHandoffChainDepth(6)).toBe(5);
  });

  it('returns 7 for large team count (>6)', () => {
    expect(inferMaxHandoffChainDepth(7)).toBe(7);
    expect(inferMaxHandoffChainDepth(13)).toBe(7);
  });

  it('returns 3 for zero or negative team count', () => {
    expect(inferMaxHandoffChainDepth(0)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// inferMaxStagnationTurns
// ---------------------------------------------------------------------------
describe('inferMaxStagnationTurns', () => {
  it('returns 15 for greenfield', () => {
    expect(inferMaxStagnationTurns('greenfield')).toBe(15);
  });

  it('returns 10 for active', () => {
    expect(inferMaxStagnationTurns('active')).toBe(10);
  });

  it('returns 5 for maintenance and legacy', () => {
    expect(inferMaxStagnationTurns('maintenance')).toBe(5);
    expect(inferMaxStagnationTurns('legacy')).toBe(5);
  });

  it('falls back to 10 for unknown phase', () => {
    expect(inferMaxStagnationTurns('unknown')).toBe(10);
    expect(inferMaxStagnationTurns(undefined)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// inferTestingCoverage
// ---------------------------------------------------------------------------
describe('inferTestingCoverage', () => {
  it("returns '60' for greenfield", () => {
    expect(inferTestingCoverage('greenfield')).toBe('60');
  });

  it("returns '80' for active", () => {
    expect(inferTestingCoverage('active')).toBe('80');
  });

  it("returns '90' for maintenance and legacy", () => {
    expect(inferTestingCoverage('maintenance')).toBe('90');
    expect(inferTestingCoverage('legacy')).toBe('90');
  });

  it("falls back to '80' for unknown phase", () => {
    expect(inferTestingCoverage('huh')).toBe('80');
    expect(inferTestingCoverage(undefined)).toBe('80');
  });
});

// ---------------------------------------------------------------------------
// buildBrowserTestingVars
// ---------------------------------------------------------------------------
describe('buildBrowserTestingVars', () => {
  it('returns both flags false when project spec is null/undefined', () => {
    expect(buildBrowserTestingVars(null)).toEqual({ usesPlaywright: false, usesBrowser: false });
    expect(buildBrowserTestingVars(undefined)).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
  });

  it('returns both flags false when testing.e2e is missing', () => {
    expect(buildBrowserTestingVars({})).toEqual({ usesPlaywright: false, usesBrowser: false });
    expect(buildBrowserTestingVars({ testing: {} })).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
  });

  it('returns both flags false when testing.e2e is not an array', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: 'playwright' } })).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
  });

  it('detects playwright (case-insensitive)', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: ['Playwright'] } })).toEqual({
      usesPlaywright: true,
      usesBrowser: false,
    });
    expect(buildBrowserTestingVars({ testing: { e2e: ['playwright'] } })).toEqual({
      usesPlaywright: true,
      usesBrowser: false,
    });
  });

  it('detects cypress as a browser tool', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: ['cypress'] } })).toEqual({
      usesPlaywright: false,
      usesBrowser: true,
    });
  });

  it('detects puppeteer as a browser tool', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: ['puppeteer'] } })).toEqual({
      usesPlaywright: false,
      usesBrowser: true,
    });
  });

  it('detects webdriverio as a browser tool', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: ['webdriverio'] } })).toEqual({
      usesPlaywright: false,
      usesBrowser: true,
    });
  });

  it('playwright takes precedence over other browser tools', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: ['playwright', 'cypress'] } })).toEqual({
      usesPlaywright: true,
      usesBrowser: false,
    });
  });

  it('returns both false for unknown e2e tools', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: ['testcafe', 'nightwatch'] } })).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
  });

  it('handles non-string entries gracefully', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: [null, 42, undefined] } })).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
  });
});

// ---------------------------------------------------------------------------
// getTeamCommandStem
// ---------------------------------------------------------------------------
describe('getTeamCommandStem', () => {
  it('prepends team- when not already present', () => {
    expect(getTeamCommandStem('backend')).toBe('team-backend');
  });

  it('returns the id unchanged when already prefixed with team-', () => {
    expect(getTeamCommandStem('team-backend')).toBe('team-backend');
  });

  it('handles single-character ids', () => {
    expect(getTeamCommandStem('q')).toBe('team-q');
  });
});

// ---------------------------------------------------------------------------
// isFeatureEnabled
// ---------------------------------------------------------------------------
describe('isFeatureEnabled', () => {
  it('returns true when the feature var is undefined (graceful default)', () => {
    expect(isFeatureEnabled('coding-rules', {})).toBe(true);
  });

  it('returns true when the feature var is true', () => {
    expect(isFeatureEnabled('coding-rules', { feature_coding_rules: true })).toBe(true);
  });

  it('returns false when the feature var is explicitly false', () => {
    expect(isFeatureEnabled('coding-rules', { feature_coding_rules: false })).toBe(false);
  });

  it('replaces hyphens with underscores in the feature var lookup', () => {
    // 'mcp-integration' → 'feature_mcp_integration'
    expect(isFeatureEnabled('mcp-integration', { feature_mcp_integration: false })).toBe(false);
  });

  it('returns true for non-false, non-undefined values (graceful)', () => {
    // Only an explicit `false` disables; truthy strings, 0, null all stay enabled
    expect(isFeatureEnabled('x', { feature_x: 'yes' })).toBe(true);
    expect(isFeatureEnabled('x', { feature_x: null })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isItemFeatureEnabled
// ---------------------------------------------------------------------------
describe('isItemFeatureEnabled', () => {
  it('returns true when the item has no requiredFeature', () => {
    expect(isItemFeatureEnabled({}, {})).toBe(true);
    expect(isItemFeatureEnabled({ name: 'foo' }, { feature_x: false })).toBe(true);
  });

  it('returns true when the requiredFeature is enabled', () => {
    expect(
      isItemFeatureEnabled({ requiredFeature: 'coding-rules' }, { feature_coding_rules: true })
    ).toBe(true);
  });

  it('returns false when the requiredFeature is disabled', () => {
    expect(
      isItemFeatureEnabled({ requiredFeature: 'coding-rules' }, { feature_coding_rules: false })
    ).toBe(false);
  });

  it('returns true (graceful default) when the requiredFeature var is undefined', () => {
    expect(isItemFeatureEnabled({ requiredFeature: 'unknown' }, {})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildAreaRoutingTable
// ---------------------------------------------------------------------------
describe('buildAreaRoutingTable', () => {
  it('returns the default routing string when no overrides are provided', () => {
    const result = buildAreaRoutingTable({});
    // Default routing should include all canonical areas
    expect(result).toContain('`backend`→backend');
    expect(result).toContain('`frontend`→frontend');
    expect(result).toContain('`cli`→backend');
    expect(result).toContain('`sync-engine`→devops');
  });

  it('returns the default routing string when teamsIntake is undefined', () => {
    const result = buildAreaRoutingTable(undefined);
    expect(result).toContain('`backend`→backend');
  });

  it('overrides specific areas while preserving other defaults', () => {
    const result = buildAreaRoutingTable({ routing: { backend: 'platform', cli: 'devops' } });
    expect(result).toContain('`backend`→platform');
    expect(result).toContain('`cli`→devops');
    // Frontend default still present
    expect(result).toContain('`frontend`→frontend');
  });

  it('adds new areas not present in defaults', () => {
    const result = buildAreaRoutingTable({ routing: { 'ml-ops': 'data' } });
    expect(result).toContain('`ml-ops`→data');
  });

  it('separates entries with ", "', () => {
    const result = buildAreaRoutingTable({});
    // Must have a comma-space between entries
    expect(result).toMatch(/, /);
  });
});

// ---------------------------------------------------------------------------
// buildCommandVars
// ---------------------------------------------------------------------------
describe('buildCommandVars', () => {
  it('returns command variables with prompt trimmed and {{stateDir}} replaced', () => {
    const cmd = {
      name: 'check',
      description: '  Run quality gates  ',
      prompt: '  Read {{stateDir}}/note.md  ',
      flags: [],
    };
    const result = buildCommandVars(cmd, { foo: 'bar' });
    expect(result.foo).toBe('bar');
    expect(result.commandName).toBe('check');
    expect(result.commandDescription).toBe('Run quality gates');
    expect(result.commandPrompt).toContain('.claude/state/note.md');
    expect(result.commandPrompt.startsWith(' ')).toBe(false);
  });

  it('uses the provided stateDir override', () => {
    const cmd = { name: 'plan', description: '', prompt: '{{stateDir}}/x', flags: [] };
    const result = buildCommandVars(cmd, {}, '.agentkit/state');
    expect(result.commandPrompt).toBe('.agentkit/state/x');
  });

  it('applies command prefix when commandPrefix is set', () => {
    const cmd = { name: 'check', description: '', prompt: '', flags: [] };
    const result = buildCommandVars(cmd, { commandPrefix: 'kits' });
    expect(result.commandPrefixedName).toBe('kits-check');
  });

  it('uses bare command name when commandPrefix is null', () => {
    const cmd = { name: 'check', description: '', prompt: '', flags: [] };
    const result = buildCommandVars(cmd, {});
    expect(result.commandPrefixedName).toBe('check');
  });

  it('flags isSyncBacklog true only for the sync-backlog command', () => {
    expect(
      buildCommandVars({ name: 'sync-backlog', description: '', prompt: '', flags: [] }, {})
        .isSyncBacklog
    ).toBe(true);
    expect(
      buildCommandVars({ name: 'check', description: '', prompt: '', flags: [] }, {}).isSyncBacklog
    ).toBe(false);
  });

  it('falls back gracefully when prompt is missing or non-string', () => {
    const result = buildCommandVars({ name: 'x', description: '', prompt: undefined }, {});
    expect(result.commandPrompt).toBe('');
    const result2 = buildCommandVars({ name: 'x', description: '', prompt: 42 }, {});
    expect(result2.commandPrompt).toBe('');
  });

  it('handles non-string description gracefully', () => {
    const result = buildCommandVars({ name: 'x', description: null, prompt: '' }, {});
    expect(result.commandDescription).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildTeamVars
// ---------------------------------------------------------------------------
describe('buildTeamVars', () => {
  it('builds the full team variable set with explicit team config', () => {
    const team = {
      id: 'backend',
      name: 'BACKEND',
      focus: 'API',
      scope: ['apps/api/**'],
      accepts: ['implement', 'review'],
      'handoff-chain': ['testing', 'docs'],
      'max-task-turns': 50,
      'max-handoff-chain-depth': 9,
      'max-stagnation-turns': 7,
    };
    const vars = { teamSize: 'small', projectPhase: 'active' };
    const teamsSpec = { teams: [team] };
    const agentsSpec = { agents: {} };

    const out = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    expect(out.teamId).toBe('backend');
    expect(out.teamName).toBe('BACKEND');
    expect(out.teamFocus).toBe('API');
    expect(out.teamScope).toBe('apps/api/**');
    expect(out.teamAccepts).toBe('implement, review');
    expect(out.teamHandoffChain).toBe('testing → docs');
    expect(out.maxTaskTurns).toBe(50);
    expect(out.maxHandoffChainDepth).toBe(9);
    expect(out.maxStagnationTurns).toBe(7);
    expect(out.teamHasAgents).toBe(false);
    expect(out.teamAgentSummaries).toBe('');
  });

  it('falls back to inferred values when team-specific tuning is missing', () => {
    const team = { id: 'qa', name: 'QA', focus: 'Tests' };
    const vars = { teamSize: 'solo', projectPhase: 'greenfield' };
    const teamsSpec = { teams: [{ id: 'a' }, { id: 'b' }] };
    const agentsSpec = { agents: {} };

    const out = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    expect(out.maxTaskTurns).toBe(15); // solo
    expect(out.maxHandoffChainDepth).toBe(3); // 2 teams ≤ 3
    expect(out.maxStagnationTurns).toBe(15); // greenfield
  });

  it('uses default fallback (5 teams) when teamsSpec is missing', () => {
    const team = { id: 'qa', name: 'QA' };
    const out = buildTeamVars(team, {}, undefined, { agents: {} });
    // 5 teams falls in the 4-6 bucket → 5
    expect(out.maxHandoffChainDepth).toBe(5);
  });

  it('coerces non-array scope/accepts/handoff-chain to strings or empty', () => {
    const team = {
      id: 't',
      name: 'T',
      focus: 'F',
      scope: 'single-scope-string',
      accepts: 'just-string',
      'handoff-chain': 'one-step',
    };
    const out = buildTeamVars(team, {}, { teams: [] }, { agents: {} });
    expect(out.teamScope).toBe('single-scope-string');
    expect(out.teamAccepts).toBe('just-string');
    expect(out.teamHandoffChain).toBe('one-step');
  });

  it('emits agent summaries when the team has explicit agents', () => {
    const agentsSpec = {
      agents: {
        engineering: [
          { id: 'be', name: 'Backend Eng', role: '  Develops APIs.  ' },
          { id: 'fe', name: 'Frontend Eng', role: 'Builds UI' },
        ],
      },
    };
    const team = { id: 'team-x', name: 'TEAM X', focus: 'F', agents: ['be', 'fe'] };
    const out = buildTeamVars(team, {}, { teams: [] }, agentsSpec);

    expect(out.teamHasAgents).toBe(true);
    expect(out.teamAgentSummaries).toContain('Backend Eng');
    expect(out.teamAgentSummaries).toContain('Frontend Eng');
    // role should be trimmed
    expect(out.teamAgentSummaries).toContain('Develops APIs.');
  });

  it('handles non-string role on agents gracefully', () => {
    const agentsSpec = {
      agents: { x: [{ id: 'a1', name: 'A1', role: { type: 'object' } }] },
    };
    const team = { id: 'x', name: 'X', focus: '', agents: ['a1'] };
    const out = buildTeamVars(team, {}, { teams: [] }, agentsSpec);
    expect(out.teamHasAgents).toBe(true);
  });

  it('falls back to team.id when name is missing', () => {
    const team = { id: 'lonely' };
    const out = buildTeamVars(team, {}, { teams: [] }, { agents: {} });
    expect(out.teamName).toBe('lonely');
  });
});

// ---------------------------------------------------------------------------
// buildAgentVars
// ---------------------------------------------------------------------------
describe('buildAgentVars', () => {
  const baseVars = { projectName: 'demo' };

  it('builds full agent vars with all sub-sections populated', () => {
    const agent = {
      id: 'arch',
      name: 'Architect',
      role: '  Designs systems.  ',
      focus: ['scalability'],
      responsibilities: ['design APIs'],
      'preferred-tools': ['miro'],
      conventions: ['Use ADRs'],
      examples: [{ title: 'ADR-001', code: '  some example code  ' }],
      'anti-patterns': ['big-bang releases'],
      'domain-rules': ['Document trade-offs'],
      'decision-model': {
        type: 'hybrid',
        'hybrid-of': ['MCDA', 'BDI'],
        description: '  blended  ',
      },
      'retry-policy': {
        'max-retries': 3,
        'failure-classification': { transient: 'retry', logic: 'escalate', permanent: 'fail' },
        backoff: 'exponential',
        'escalate-to': 'lead',
      },
      'belief-system': {
        'state-reads': ['AGENT_BACKLOG.md'],
        'task-reads': true,
        'update-on': ['merge'],
        'revision-strategy': 'reactive',
      },
      confidence: {
        'output-threshold': 0.8,
        'requires-validation': true,
        'validation-agent': 'reviewer',
        'low-confidence-action': 'escalate',
      },
      negotiation: {
        'conflict-scope': 'team',
        'resolution-strategy': 'voting',
        'can-negotiate-with': ['be', 'fe'],
      },
      lookahead: { enabled: true, depth: 3, 'simulation-budget': 5 },
    };

    const out = buildAgentVars(agent, 'engineering', baseVars, new Map());

    expect(out.agentId).toBe('arch');
    expect(out.agentName).toBe('Architect');
    expect(out.agentCategory).toBe('engineering');
    expect(out.agentRole).toBe('Designs systems.');
    expect(out.agentFocusList).toBe('- scalability');
    expect(out.agentResponsibilitiesList).toBe('- design APIs');
    expect(out.agentToolsList).toBe('- miro');
    expect(out.agentConventions).toBe('- Use ADRs');
    expect(out.agentExamples).toContain('### ADR-001');
    expect(out.agentExamples).toContain('some example code');
    expect(out.agentAntiPatterns).toBe('- big-bang releases');
    expect(out.agentDomainRules).toBe('- Document trade-offs');

    expect(out.agentDecisionModel).toContain('hybrid');
    expect(out.agentDecisionModel).toContain('MCDA, BDI');
    expect(out.agentDecisionModel).toContain('blended');

    expect(out.agentRetryPolicy).toContain('Max retries:** 3');
    expect(out.agentRetryPolicy).toContain('transient→retry');
    expect(out.agentRetryPolicy).toContain('logic→escalate');
    expect(out.agentRetryPolicy).toContain('permanent→fail');
    expect(out.agentRetryPolicy).toContain('Backoff:** exponential');
    expect(out.agentRetryPolicy).toContain('Escalate to:** lead');

    expect(out.agentBeliefSystem).toContain('State reads:** AGENT_BACKLOG.md');
    expect(out.agentBeliefSystem).toContain('Task reads:** true');
    expect(out.agentBeliefSystem).toContain('Update on:** merge');
    expect(out.agentBeliefSystem).toContain('Revision strategy:** reactive');

    expect(out.agentConfidence).toContain('Output threshold:** 0.8');
    expect(out.agentConfidence).toContain('Requires validation:** true');
    expect(out.agentConfidence).toContain('Validation agent:** reviewer');
    expect(out.agentConfidence).toContain('Low confidence action:** escalate');

    expect(out.agentNegotiation).toContain('Conflict scope:** team');
    expect(out.agentNegotiation).toContain('Resolution strategy:** voting');
    expect(out.agentNegotiation).toContain('Can negotiate with:** be, fe');

    expect(out.agentLookahead).toContain('Enabled:** true');
    expect(out.agentLookahead).toContain('Depth:** 3');
    expect(out.agentLookahead).toContain('Simulation budget:** 5 tool calls');

    // collaborators is empty when registry is empty
    expect(out.agentCollaborators).toBe('');
  });

  it('returns empty strings for missing optional sub-sections', () => {
    const agent = { id: 'minimal', name: 'Minimal', role: 'Does little' };
    const out = buildAgentVars(agent, 'misc', baseVars);

    expect(out.agentFocusList).toBe('');
    expect(out.agentResponsibilitiesList).toBe('');
    expect(out.agentToolsList).toBe('');
    expect(out.agentConventions).toBe('');
    expect(out.agentExamples).toBe('');
    expect(out.agentAntiPatterns).toBe('');
    expect(out.agentDomainRules).toBe('');
    expect(out.agentDecisionModel).toBe('');
    expect(out.agentRetryPolicy).toBe('');
    expect(out.agentBeliefSystem).toBe('');
    expect(out.agentConfidence).toBe('');
    expect(out.agentNegotiation).toBe('');
    expect(out.agentLookahead).toBe('');
  });

  it('omits lookahead block when not enabled', () => {
    const agent = {
      id: 'a',
      name: 'A',
      role: '',
      lookahead: { enabled: false, depth: 5 },
    };
    const out = buildAgentVars(agent, 'cat', {});
    expect(out.agentLookahead).toBe('');
  });

  it('omits lookahead depth/budget when zero', () => {
    const agent = {
      id: 'a',
      name: 'A',
      role: '',
      lookahead: { enabled: true, depth: 0, 'simulation-budget': 0 },
    };
    const out = buildAgentVars(agent, 'cat', {});
    expect(out.agentLookahead).toContain('Enabled:** true');
    expect(out.agentLookahead).not.toContain('Depth:**');
    expect(out.agentLookahead).not.toContain('Simulation budget:**');
  });

  it("falls back to 'preferred-tools' over 'tools' (legacy field)", () => {
    const agent = { id: 'a', name: 'A', role: '', tools: ['legacy'] };
    const out = buildAgentVars(agent, 'cat', {});
    expect(out.agentToolsList).toBe('- legacy');
  });

  it('handles non-string agent role gracefully', () => {
    const out = buildAgentVars({ id: 'a', name: 'A', role: null }, 'c', {});
    expect(out.agentRole).toBe('');

    const out2 = buildAgentVars({ id: 'a', name: 'A', role: { x: 1 } }, 'c', {});
    expect(out2.agentRole).toEqual({ x: 1 });
  });

  it('renders examples without title using the default heading', () => {
    const agent = {
      id: 'a',
      name: 'A',
      role: '',
      examples: [{ code: 'code1' }],
    };
    const out = buildAgentVars(agent, 'cat', {});
    expect(out.agentExamples).toContain('### Example');
  });

  it('uses agentRegistry to populate collaborators', () => {
    const registry = buildAgentRegistry({
      agents: {
        x: [{ id: 'mate', name: 'Mate', role: 'Helps out.', accepts: ['review'] }],
      },
    });
    const agent = {
      id: 'lead',
      name: 'Lead',
      role: 'Leads',
      'depends-on': ['mate'],
    };
    const out = buildAgentVars(agent, 'x', {}, registry);
    expect(out.agentCollaborators).toContain('mate');
    expect(out.agentCollaborators).toContain('Mate');
  });

  it('preserves base vars in output', () => {
    const out = buildAgentVars({ id: 'a', name: 'A', role: '' }, 'cat', { projectName: 'demo' });
    expect(out.projectName).toBe('demo');
  });
});

// ---------------------------------------------------------------------------
// buildAgentRegistry edge cases (string role with multiple sentences, no role)
// ---------------------------------------------------------------------------
describe('buildAgentRegistry edge cases', () => {
  it('treats non-string role as empty role summary', () => {
    const registry = buildAgentRegistry({
      agents: { x: [{ id: 'a', name: 'A', role: 12345 }] },
    });
    expect(registry.get('a').roleSummary).toBe('');
  });

  it('falls back to id when name is missing', () => {
    const registry = buildAgentRegistry({
      agents: { x: [{ id: 'a', role: 'Some role.' }] },
    });
    expect(registry.get('a').name).toBe('a');
  });

  it('treats non-array accepts as empty array', () => {
    const registry = buildAgentRegistry({
      agents: { x: [{ id: 'a', name: 'A', role: '', accepts: 'review' }] },
    });
    expect(registry.get('a').accepts).toEqual([]);
  });

  it('handles multiple categories', () => {
    const registry = buildAgentRegistry({
      agents: {
        engineering: [{ id: 'be', name: 'BE', role: 'Backend' }],
        testing: [{ id: 'qa', name: 'QA', role: 'Testing' }],
      },
    });
    expect(registry.size).toBe(2);
    expect(registry.get('be').category).toBe('engineering');
    expect(registry.get('qa').category).toBe('testing');
  });
});
