/**
 * Tests for var-builders.mjs helpers that aren't directly covered by the
 * higher-level synchronize-agents/teams-list/build-command-vars/rule-vars/
 * branch-protection-json suites. Focuses on small inferring helpers, command
 * path resolution, feature gating, and the area-routing builder.
 */
import { describe, expect, it } from 'vitest';

import {
  buildAgentVars,
  buildAreaRoutingTable,
  buildBrowserTestingVars,
  buildTeamVars,
  formatConventionLine,
  getTeamCommandStem,
  inferMaxHandoffChainDepth,
  inferMaxStagnationTurns,
  inferMaxTaskTurns,
  inferTestingCoverage,
  isFeatureEnabled,
  isItemFeatureEnabled,
  resolveCommandPath,
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
  it('returns 25 for unknown / undefined team size', () => {
    expect(inferMaxTaskTurns(undefined)).toBe(25);
    expect(inferMaxTaskTurns('totally-bogus')).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// inferMaxHandoffChainDepth
// ---------------------------------------------------------------------------

describe('inferMaxHandoffChainDepth', () => {
  it('returns 3 for tiny team counts', () => {
    expect(inferMaxHandoffChainDepth(1)).toBe(3);
    expect(inferMaxHandoffChainDepth(3)).toBe(3);
  });
  it('returns 5 for medium team counts', () => {
    expect(inferMaxHandoffChainDepth(4)).toBe(5);
    expect(inferMaxHandoffChainDepth(6)).toBe(5);
  });
  it('returns 7 for large team counts', () => {
    expect(inferMaxHandoffChainDepth(7)).toBe(7);
    expect(inferMaxHandoffChainDepth(20)).toBe(7);
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
  it('returns 10 by default for unknown phase', () => {
    expect(inferMaxStagnationTurns(undefined)).toBe(10);
    expect(inferMaxStagnationTurns('mystery')).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// inferTestingCoverage
// ---------------------------------------------------------------------------

describe('inferTestingCoverage', () => {
  it('returns "60" for greenfield', () => {
    expect(inferTestingCoverage('greenfield')).toBe('60');
  });
  it('returns "80" for active', () => {
    expect(inferTestingCoverage('active')).toBe('80');
  });
  it('returns "90" for maintenance and legacy', () => {
    expect(inferTestingCoverage('maintenance')).toBe('90');
    expect(inferTestingCoverage('legacy')).toBe('90');
  });
  it('returns "80" by default for unknown phase', () => {
    expect(inferTestingCoverage(undefined)).toBe('80');
    expect(inferTestingCoverage('xyz')).toBe('80');
  });
});

// ---------------------------------------------------------------------------
// buildBrowserTestingVars
// ---------------------------------------------------------------------------

describe('buildBrowserTestingVars', () => {
  it('returns false flags for an empty/missing spec', () => {
    expect(buildBrowserTestingVars(undefined)).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
    expect(buildBrowserTestingVars({})).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
  });

  it('returns false flags when testing.e2e is not an array', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: 'playwright' } })).toEqual({
      usesPlaywright: false,
      usesBrowser: false,
    });
  });

  it('detects playwright', () => {
    const vars = buildBrowserTestingVars({ testing: { e2e: ['playwright'] } });
    expect(vars.usesPlaywright).toBe(true);
    expect(vars.usesBrowser).toBe(false);
  });

  it('is case-insensitive for tool names', () => {
    const vars = buildBrowserTestingVars({ testing: { e2e: ['Playwright'] } });
    expect(vars.usesPlaywright).toBe(true);
  });

  it('detects browser tools (cypress) without playwright', () => {
    const vars = buildBrowserTestingVars({ testing: { e2e: ['cypress'] } });
    expect(vars.usesBrowser).toBe(true);
    expect(vars.usesPlaywright).toBe(false);
  });

  it('detects puppeteer and webdriverio as browser tools', () => {
    expect(buildBrowserTestingVars({ testing: { e2e: ['puppeteer'] } }).usesBrowser).toBe(true);
    expect(buildBrowserTestingVars({ testing: { e2e: ['webdriverio'] } }).usesBrowser).toBe(true);
  });

  it('prefers playwright when both playwright and browser tools are listed', () => {
    const vars = buildBrowserTestingVars({
      testing: { e2e: ['playwright', 'cypress'] },
    });
    expect(vars.usesPlaywright).toBe(true);
    expect(vars.usesBrowser).toBe(false);
  });

  it('skips non-string entries gracefully', () => {
    const vars = buildBrowserTestingVars({
      testing: { e2e: [null, 123, 'cypress'] },
    });
    expect(vars.usesBrowser).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTeamCommandStem
// ---------------------------------------------------------------------------

describe('getTeamCommandStem', () => {
  it('prefixes raw team IDs with team-', () => {
    expect(getTeamCommandStem('backend')).toBe('team-backend');
    expect(getTeamCommandStem('quality')).toBe('team-quality');
  });
  it('keeps already-prefixed team IDs unchanged', () => {
    expect(getTeamCommandStem('team-backend')).toBe('team-backend');
  });
});

// ---------------------------------------------------------------------------
// resolveCommandPath
// ---------------------------------------------------------------------------

describe('resolveCommandPath', () => {
  it('returns the bare name when no prefix is supplied', () => {
    expect(resolveCommandPath('check', null)).toEqual({ dir: '', stem: 'check' });
    expect(resolveCommandPath('check', undefined)).toEqual({ dir: '', stem: 'check' });
    expect(resolveCommandPath('check', '')).toEqual({ dir: '', stem: 'check' });
  });

  it('uses subdirectory strategy', () => {
    expect(resolveCommandPath('check', 'kits', 'subdirectory')).toEqual({
      dir: 'kits',
      stem: 'check',
    });
  });

  it('uses filename strategy by default', () => {
    expect(resolveCommandPath('check', 'kits')).toEqual({ dir: '', stem: 'kits-check' });
    expect(resolveCommandPath('check', 'kits', 'filename')).toEqual({
      dir: '',
      stem: 'kits-check',
    });
  });
});

// ---------------------------------------------------------------------------
// isFeatureEnabled / isItemFeatureEnabled
// ---------------------------------------------------------------------------

describe('isFeatureEnabled', () => {
  it('returns true when feature var is true', () => {
    expect(isFeatureEnabled('cost-tracking', { feature_cost_tracking: true })).toBe(true);
  });

  it('returns false when feature var is explicitly false', () => {
    expect(isFeatureEnabled('cost-tracking', { feature_cost_tracking: false })).toBe(false);
  });

  it('defaults to enabled when var is absent (graceful degradation)', () => {
    expect(isFeatureEnabled('cost-tracking', {})).toBe(true);
  });

  it('translates hyphens to underscores in the var name', () => {
    expect(isFeatureEnabled('multi-word-feature', { feature_multi_word_feature: false })).toBe(
      false
    );
  });

  it('treats truthy non-true values (e.g. "yes") as enabled', () => {
    expect(isFeatureEnabled('foo', { feature_foo: 'yes' })).toBe(true);
  });
});

describe('isItemFeatureEnabled', () => {
  it('returns true for items without a requiredFeature', () => {
    expect(isItemFeatureEnabled({}, {})).toBe(true);
    expect(isItemFeatureEnabled({ id: 'foo' }, {})).toBe(true);
  });

  it('delegates to isFeatureEnabled when requiredFeature is set', () => {
    expect(
      isItemFeatureEnabled({ requiredFeature: 'cost-tracking' }, { feature_cost_tracking: false })
    ).toBe(false);
    expect(
      isItemFeatureEnabled({ requiredFeature: 'cost-tracking' }, { feature_cost_tracking: true })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildAreaRoutingTable
// ---------------------------------------------------------------------------

describe('buildAreaRoutingTable', () => {
  it('builds a default routing table when no overrides are supplied', () => {
    const table = buildAreaRoutingTable(undefined);
    // Defaults include backend, frontend, etc.
    expect(table).toContain('`backend`→backend');
    expect(table).toContain('`frontend`→frontend');
    expect(table).toContain('`cli`→backend');
    expect(table).toContain('`sync-engine`→devops');
  });

  it('merges custom routing on top of defaults', () => {
    const table = buildAreaRoutingTable({
      routing: { backend: 'platform', custom: 'quality' },
    });
    expect(table).toContain('`backend`→platform');
    expect(table).toContain('`custom`→quality');
    // Defaults still present for areas not overridden
    expect(table).toContain('`frontend`→frontend');
  });

  it('handles an empty routing object', () => {
    const table = buildAreaRoutingTable({ routing: {} });
    expect(table).toContain('`backend`→backend');
  });
});

// ---------------------------------------------------------------------------
// formatConventionLine
// ---------------------------------------------------------------------------

describe('formatConventionLine', () => {
  it('renders a string convention as a bullet', () => {
    expect(formatConventionLine('Always validate input')).toBe('- Always validate input');
  });

  it('renders an object convention with id and rule', () => {
    expect(formatConventionLine({ id: 'no-eval', rule: 'Disallow eval' })).toContain(
      '**[no-eval]** Disallow eval'
    );
  });

  it('appends type and phase badges', () => {
    const line = formatConventionLine({
      id: 'r1',
      rule: 'Do thing',
      type: 'enforcement',
      phase: 'planning',
    });
    expect(line).toContain('enforcement');
    expect(line).toContain('phase: planning');
  });

  it('joins multiple phases', () => {
    const line = formatConventionLine({
      id: 'r1',
      rule: 'Do thing',
      phase: ['planning', 'review'],
    });
    expect(line).toContain('phase: planning, review');
  });

  it('omits the badge suffix when type and phase are missing', () => {
    expect(formatConventionLine({ id: 'r1', rule: 'Do thing' })).toBe('- **[r1]** Do thing');
  });

  it('handles missing id and rule gracefully', () => {
    expect(formatConventionLine({})).toBe('- **[]** ');
  });
});

// ---------------------------------------------------------------------------
// buildTeamVars — exercises agent persona resolution + inferred limits
// ---------------------------------------------------------------------------

describe('buildTeamVars', () => {
  it('uses team values when provided and infers when absent', () => {
    const team = {
      id: 'backend',
      name: 'Backend',
      focus: 'API',
      scope: ['apps/api/**'],
      accepts: ['implement'],
      'handoff-chain': ['testing'],
    };
    const teamsSpec = { teams: [team] };
    const agentsSpec = { agents: { backend: [{ id: 'be1', name: 'Backend One', role: 'API' }] } };
    const vars = { teamSize: 'small', projectPhase: 'active' };

    const result = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    expect(result.teamId).toBe('backend');
    expect(result.teamName).toBe('Backend');
    expect(result.teamFocus).toBe('API');
    expect(result.teamScope).toBe('apps/api/**');
    expect(result.teamAccepts).toBe('implement');
    expect(result.teamHandoffChain).toBe('testing');
    expect(result.maxTaskTurns).toBe(25); // small
    expect(result.maxHandoffChainDepth).toBe(3); // 1 team
    expect(result.maxStagnationTurns).toBe(10); // active
    expect(result.teamHasAgents).toBe(true);
    expect(result.teamAgentSummaries).toContain('Backend One');
  });

  it('uses team-supplied overrides for max-task-turns / max-handoff-chain-depth / max-stagnation-turns', () => {
    const team = {
      id: 'q',
      name: 'Quality',
      'max-task-turns': 99,
      'max-handoff-chain-depth': 8,
      'max-stagnation-turns': 4,
    };
    const teamsSpec = { teams: [team] };
    const agentsSpec = { agents: {} };
    const vars = { teamSize: 'large', projectPhase: 'greenfield' };

    const result = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    expect(result.maxTaskTurns).toBe(99);
    expect(result.maxHandoffChainDepth).toBe(8);
    expect(result.maxStagnationTurns).toBe(4);
    expect(result.teamHasAgents).toBe(false);
    expect(result.teamAgentSummaries).toBe('');
  });

  it('handles non-array scope/accepts/handoff-chain values', () => {
    const team = {
      id: 't',
      name: 'T',
      scope: 'src/**',
      accepts: 'implement',
      'handoff-chain': 'docs',
    };
    const result = buildTeamVars(team, {}, { teams: [] }, { agents: {} });
    expect(result.teamScope).toBe('src/**');
    expect(result.teamAccepts).toBe('implement');
    expect(result.teamHandoffChain).toBe('docs');
  });

  it('falls back to id when name is missing', () => {
    const team = { id: 'no-name' };
    const result = buildTeamVars(team, {}, { teams: [] }, { agents: {} });
    expect(result.teamName).toBe('no-name');
  });
});

// ---------------------------------------------------------------------------
// buildAgentVars — exercises the small section helpers (negotiation, lookahead, etc.)
// ---------------------------------------------------------------------------

describe('buildAgentVars', () => {
  it('renders all agent fields including decision model, retry, beliefs, confidence, negotiation, lookahead', () => {
    const agent = {
      id: 'a1',
      name: 'Agent One',
      role: ' API engineer ',
      focus: ['api', 'auth'],
      responsibilities: ['design endpoints'],
      'preferred-tools': ['rest'],
      conventions: ['use TLS'],
      examples: [{ title: 'Hello', code: 'console.log()' }],
      'anti-patterns': ['no-eval'],
      'domain-rules': ['validate-input'],
      'decision-model': {
        type: 'hybrid',
        'hybrid-of': ['heuristic', 'llm'],
        description: ' Trades off speed and accuracy. ',
      },
      'retry-policy': {
        'max-retries': 3,
        'failure-classification': { transient: 'retry', logic: 'fix', permanent: 'escalate' },
        backoff: 'exponential',
        'escalate-to': 'human',
      },
      'belief-system': {
        'state-reads': ['orchestrator'],
        'task-reads': true,
        'update-on': ['task-complete'],
        'revision-strategy': 'overwrite',
      },
      confidence: {
        'output-threshold': 0.8,
        'requires-validation': true,
        'validation-agent': 'reviewer',
        'low-confidence-action': 'escalate',
      },
      negotiation: {
        'conflict-scope': 'team',
        'resolution-strategy': 'majority',
        'can-negotiate-with': ['a2', 'a3'],
      },
      lookahead: { enabled: true, depth: 3, 'simulation-budget': 10 },
    };

    const result = buildAgentVars(agent, 'engineering', { foo: 'bar' });

    expect(result.foo).toBe('bar'); // vars passthrough
    expect(result.agentId).toBe('a1');
    expect(result.agentName).toBe('Agent One');
    expect(result.agentRole).toBe('API engineer'); // trimmed
    expect(result.agentCategory).toBe('engineering');
    expect(result.agentFocusList).toContain('- api');
    expect(result.agentResponsibilitiesList).toContain('- design endpoints');
    expect(result.agentToolsList).toContain('- rest');
    expect(result.agentConventions).toContain('- use TLS');
    expect(result.agentExamples).toContain('Hello');
    expect(result.agentExamples).toContain('console.log()');
    expect(result.agentAntiPatterns).toContain('- no-eval');
    expect(result.agentDomainRules).toContain('- validate-input');

    // Decision model
    expect(result.agentDecisionModel).toContain('hybrid');
    expect(result.agentDecisionModel).toContain('Hybrid of:');
    expect(result.agentDecisionModel).toContain('Trades off speed and accuracy.');

    // Retry policy
    expect(result.agentRetryPolicy).toContain('Max retries:');
    expect(result.agentRetryPolicy).toContain('transient→retry');
    expect(result.agentRetryPolicy).toContain('**Backoff:** exponential');
    expect(result.agentRetryPolicy).toContain('**Escalate to:** human');

    // Belief system
    expect(result.agentBeliefSystem).toContain('**State reads:**');
    expect(result.agentBeliefSystem).toContain('**Task reads:** true');
    expect(result.agentBeliefSystem).toContain('**Update on:**');
    expect(result.agentBeliefSystem).toContain('**Revision strategy:** overwrite');

    // Confidence
    expect(result.agentConfidence).toContain('**Output threshold:** 0.8');
    expect(result.agentConfidence).toContain('**Requires validation:** true');
    expect(result.agentConfidence).toContain('**Validation agent:** reviewer');
    expect(result.agentConfidence).toContain('**Low confidence action:** escalate');

    // Negotiation
    expect(result.agentNegotiation).toContain('**Conflict scope:** team');
    expect(result.agentNegotiation).toContain('**Resolution strategy:** majority');
    expect(result.agentNegotiation).toContain('**Can negotiate with:** a2, a3');

    // Lookahead
    expect(result.agentLookahead).toContain('**Enabled:** true');
    expect(result.agentLookahead).toContain('**Depth:** 3');
    expect(result.agentLookahead).toContain('**Simulation budget:** 10');
  });

  it('returns empty section strings when subsections are absent', () => {
    const agent = { id: 'bare', name: 'Bare', role: 'Minimal' };
    const result = buildAgentVars(agent, 'engineering', {});
    expect(result.agentDecisionModel).toBe('');
    expect(result.agentRetryPolicy).toBe('');
    expect(result.agentBeliefSystem).toBe('');
    expect(result.agentConfidence).toBe('');
    expect(result.agentNegotiation).toBe('');
    expect(result.agentLookahead).toBe('');
    expect(result.agentConventions).toBe('');
    expect(result.agentExamples).toBe('');
    expect(result.agentAntiPatterns).toBe('');
    expect(result.agentDomainRules).toBe('');
  });

  it('omits backoff entry when set to "none"', () => {
    const result = buildAgentVars(
      { id: 'r', name: 'R', 'retry-policy': { backoff: 'none', 'max-retries': 1 } },
      'engineering',
      {}
    );
    expect(result.agentRetryPolicy).toContain('**Max retries:** 1');
    expect(result.agentRetryPolicy).not.toContain('Backoff:');
  });

  it('omits failure-classification when none of its keys are present', () => {
    const result = buildAgentVars(
      { id: 'r', name: 'R', 'retry-policy': { 'failure-classification': {}, 'max-retries': 2 } },
      'engineering',
      {}
    );
    expect(result.agentRetryPolicy).toContain('**Max retries:** 2');
    expect(result.agentRetryPolicy).not.toContain('Failure handling:');
  });

  it('omits lookahead entirely when not enabled', () => {
    const result = buildAgentVars(
      { id: 'r', name: 'R', lookahead: { enabled: false, depth: 5 } },
      'engineering',
      {}
    );
    expect(result.agentLookahead).toBe('');
  });

  it('omits depth and simulation-budget when zero or undefined', () => {
    const result = buildAgentVars(
      { id: 'r', name: 'R', lookahead: { enabled: true, depth: 0, 'simulation-budget': 0 } },
      'engineering',
      {}
    );
    expect(result.agentLookahead).toContain('**Enabled:** true');
    expect(result.agentLookahead).not.toContain('Depth:');
    expect(result.agentLookahead).not.toContain('Simulation budget:');
  });

  it('omits negotiation peers when can-negotiate-with is empty', () => {
    const result = buildAgentVars(
      {
        id: 'r',
        name: 'R',
        negotiation: { 'conflict-scope': 'self', 'can-negotiate-with': [] },
      },
      'engineering',
      {}
    );
    expect(result.agentNegotiation).toContain('**Conflict scope:** self');
    expect(result.agentNegotiation).not.toContain('Can negotiate with:');
  });

  it('handles role as a non-string value gracefully', () => {
    const result = buildAgentVars({ id: 'r', name: 'R', role: null }, 'engineering', {});
    expect(result.agentRole).toBe('');
  });
});
