import { describe, it, expect } from 'vitest';
import { formatConventionLine, buildRuleVars } from '../var-builders.mjs';

// ---------------------------------------------------------------------------
// formatConventionLine()
// ---------------------------------------------------------------------------
describe('formatConventionLine()', () => {
  it('formats a plain string convention', () => {
    expect(formatConventionLine('Use strict mode')).toBe('- Use strict mode');
  });

  it('formats an object convention with id and rule', () => {
    const result = formatConventionLine({ id: 'ts-lint', rule: 'Run ESLint' });
    expect(result).toBe('- **[ts-lint]** Run ESLint');
  });

  it('includes type badge for enforcement', () => {
    const result = formatConventionLine({ id: 'ts-lint', rule: 'Run ESLint', type: 'enforcement' });
    expect(result).toContain('enforcement');
    expect(result).not.toContain('advisory');
  });

  it('includes type badge for advisory', () => {
    const result = formatConventionLine({ id: 'ts-any', rule: 'Avoid any', type: 'advisory' });
    expect(result).toContain('advisory');
    expect(result).not.toContain('enforcement');
  });

  it('includes single phase', () => {
    const result = formatConventionLine({ id: 'r1', rule: 'A rule', phase: 'validation' });
    expect(result).toContain('phase: validation');
  });

  it('includes multi-phase as comma-separated', () => {
    const result = formatConventionLine({
      id: 'r1',
      rule: 'A rule',
      phase: ['planning', 'implementation'],
    });
    expect(result).toContain('phase: planning, implementation');
  });

  it('includes both type and phase badges', () => {
    const result = formatConventionLine({
      id: 'ts-lint',
      rule: 'Run ESLint',
      type: 'enforcement',
      phase: 'validation',
    });
    expect(result).toContain('enforcement');
    expect(result).toContain('phase: validation');
    // Badges should be inside _()_ italic markers separated by " · "
    expect(result).toMatch(/_\(enforcement · phase: validation\)_/);
  });

  it('omits badges when type and phase are absent', () => {
    const result = formatConventionLine({ id: 'r1', rule: 'A rule' });
    expect(result).toBe('- **[r1]** A rule');
    expect(result).not.toContain('_(');
  });

  it('handles missing id and rule gracefully', () => {
    const result = formatConventionLine({});
    expect(result).toBe('- **[]** ');
  });

  it('uses plain text badges, not emoji', () => {
    const result = formatConventionLine({ id: 'r1', rule: 'A rule', type: 'enforcement' });
    // Should not contain emoji characters
    expect(result).not.toMatch(/[\u{1F512}\u{1F4A1}]/u);
  });
});

// ---------------------------------------------------------------------------
// buildRuleVars()
// ---------------------------------------------------------------------------
describe('buildRuleVars()', () => {
  const baseVars = { projectName: 'test', version: '1.0.0' };

  it('partitions conventions into enforcement and advisory', () => {
    const rule = {
      domain: 'typescript',
      description: 'TS rules',
      'applies-to': ['**/*.ts'],
      conventions: [
        { id: 'ts-lint', rule: 'Run ESLint', severity: 'error', type: 'enforcement' },
        { id: 'ts-any', rule: 'Avoid any', severity: 'warning', type: 'advisory' },
        { id: 'ts-fmt', rule: 'Use Prettier', severity: 'error', type: 'enforcement' },
      ],
    };
    const vars = buildRuleVars(rule, baseVars);

    expect(vars.ruleHasEnforcement).toBe('true');
    expect(vars.ruleHasAdvisory).toBe('true');
    expect(vars.ruleEnforcementConventions).toContain('ts-lint');
    expect(vars.ruleEnforcementConventions).toContain('ts-fmt');
    expect(vars.ruleEnforcementConventions).not.toContain('ts-any');
    expect(vars.ruleAdvisoryConventions).toContain('ts-any');
    expect(vars.ruleAdvisoryConventions).not.toContain('ts-lint');
  });

  it('treats conventions without type as advisory (implicit default)', () => {
    const rule = {
      domain: 'security',
      description: 'Security rules',
      'applies-to': ['**/*'],
      conventions: [
        { id: 'sec-1', rule: 'No secrets', severity: 'critical' },
        { id: 'sec-2', rule: 'Least privilege', severity: 'error' },
      ],
    };
    const vars = buildRuleVars(rule, baseVars);

    expect(vars.ruleHasEnforcement).toBe('');
    expect(vars.ruleHasAdvisory).toBe('true');
    expect(vars.ruleAdvisoryConventions).toContain('sec-1');
    expect(vars.ruleAdvisoryConventions).toContain('sec-2');
    expect(vars.ruleEnforcementConventions).toBe('');
  });

  it('returns empty strings when no conventions exist', () => {
    const rule = {
      domain: 'empty',
      description: 'Empty domain',
      'applies-to': [],
      conventions: [],
    };
    const vars = buildRuleVars(rule, baseVars);

    expect(vars.ruleConventions).toBe('');
    expect(vars.ruleEnforcementConventions).toBe('');
    expect(vars.ruleAdvisoryConventions).toBe('');
    expect(vars.ruleHasEnforcement).toBe('');
    expect(vars.ruleHasAdvisory).toBe('');
  });

  it('preserves base vars in output', () => {
    const rule = {
      domain: 'test',
      description: 'Test',
      'applies-to': [],
      conventions: [],
    };
    const vars = buildRuleVars(rule, baseVars);

    expect(vars.projectName).toBe('test');
    expect(vars.version).toBe('1.0.0');
  });

  it('trims description strings', () => {
    const rule = {
      domain: 'test',
      description: '  Leading and trailing whitespace  ',
      'applies-to': [],
      conventions: [],
    };
    const vars = buildRuleVars(rule, baseVars);
    expect(vars.ruleDescription).toBe('Leading and trailing whitespace');
  });

  it('joins applies-to with newlines', () => {
    const rule = {
      domain: 'test',
      description: 'Test',
      'applies-to': ['**/*.ts', '**/*.tsx'],
      conventions: [],
    };
    const vars = buildRuleVars(rule, baseVars);
    expect(vars.ruleAppliesTo).toBe('**/*.ts\n**/*.tsx');
  });

  it('handles enforcement-only domain', () => {
    const rule = {
      domain: 'ci',
      description: 'CI rules',
      'applies-to': ['**/*'],
      conventions: [{ id: 'ci-1', rule: 'Must pass', severity: 'error', type: 'enforcement' }],
    };
    const vars = buildRuleVars(rule, baseVars);

    expect(vars.ruleHasEnforcement).toBe('true');
    expect(vars.ruleHasAdvisory).toBe('');
  });
});
