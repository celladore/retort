import { describe, it, expect } from 'vitest';
import {
  validate,
  validateCrossReferences,
  validateSpec,
  validateProjectYaml,
  validateMappingCoverage,
  validateOverlaySettings,
  PROJECT_ENUMS,
  VALID_PHASES,
} from '../spec-validator.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');

/**
 * Writes a minimal but valid spec tree to a temp dir. `overrides` replaces whole
 * spec objects (`teams`, `agents`) so a test can introduce exactly one defect.
 */
function writeTempSpecRoot(commandsObj, overrides = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'agentkit-spec-validator-'));
  const specDir = resolve(root, 'spec');
  mkdirSync(specDir, { recursive: true });

  const teams = overrides.teams ?? {
    teams: [{ id: 'backend', name: 'BACKEND', focus: 'API', scope: ['src/**'] }],
    techStacks: [
      {
        name: 'node',
        buildCommand: 'pnpm build',
        testCommand: 'pnpm test',
        detect: ['package.json'],
      },
    ],
  };
  const agents = overrides.agents ?? {
    agents: {
      engineering: [
        {
          id: 'backend',
          name: 'Backend Engineer',
          role: 'backend role',
          focus: ['src/**'],
          responsibilities: ['build api'],
        },
      ],
    },
  };
  const rules = {
    rules: [
      {
        domain: 'typescript',
        description: 'ts conventions',
        'applies-to': ['**/*.ts'],
        conventions: [{ id: 'ts-1', rule: 'Use strict mode', severity: 'warning' }],
      },
    ],
  };
  const settings = { permissions: { allow: [], deny: [] }, hooks: {} };
  const aliases = { aliases: { '/o': '/orchestrate' } };
  const docs = { categories: [] };

  writeFileSync(resolve(specDir, 'teams.yaml'), JSON.stringify(teams, null, 2));
  writeFileSync(resolve(specDir, 'agents.yaml'), JSON.stringify(agents, null, 2));
  writeFileSync(resolve(specDir, 'commands.yaml'), JSON.stringify(commandsObj, null, 2));
  writeFileSync(resolve(specDir, 'rules.yaml'), JSON.stringify(rules, null, 2));
  writeFileSync(resolve(specDir, 'settings.yaml'), JSON.stringify(settings, null, 2));
  writeFileSync(resolve(specDir, 'aliases.yaml'), JSON.stringify(aliases, null, 2));
  writeFileSync(resolve(specDir, 'docs.yaml'), JSON.stringify(docs, null, 2));

  return root;
}

// ---------------------------------------------------------------------------
// validate() — schema validation engine
// ---------------------------------------------------------------------------
describe('validate()', () => {
  it('passes for valid string', () => {
    expect(validate('hello', { type: 'string', required: true }, 'x')).toEqual([]);
  });

  it('fails for missing required field', () => {
    const errors = validate(undefined, { type: 'string', required: true }, 'x');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('required but missing');
  });

  it('passes for missing optional field', () => {
    expect(validate(undefined, { type: 'string' }, 'x')).toEqual([]);
  });

  it('fails for wrong type', () => {
    expect(validate(42, { type: 'string' }, 'x')).toHaveLength(1);
  });

  it('validates array items', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(validate(['a', 'b'], schema, 'x')).toEqual([]);
    expect(validate(['a', 42], schema, 'x')).toHaveLength(1);
  });

  it('validates object properties', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
      },
    };
    expect(validate({ id: 'a', name: 'b' }, schema, 'x')).toEqual([]);
    expect(validate({ id: 'a' }, schema, 'x')).toHaveLength(1); // missing name
    expect(validate({}, schema, 'x')).toHaveLength(2); // missing both
  });

  it('validates enum', () => {
    const schema = { type: 'string', enum: ['a', 'b', 'c'] };
    expect(validate('a', schema, 'x')).toEqual([]);
    expect(validate('z', schema, 'x')).toHaveLength(1);
  });

  it('rejects empty string for enum fields', () => {
    const schema = { type: 'string', enum: ['a', 'b', 'c'] };
    expect(validate('', schema, 'x')).toHaveLength(1);
  });

  it('validates minLength', () => {
    const schema = { type: 'string', minLength: 3 };
    expect(validate('abc', schema, 'x')).toEqual([]);
    expect(validate('ab', schema, 'x')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// validateCrossReferences()
// ---------------------------------------------------------------------------
describe('validateCrossReferences()', () => {
  it('catches command referencing unknown team', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'backend' }] },
      commands: { commands: [{ name: 'team-ghost', type: 'team', team: 'ghost' }] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some((e) => e.includes('ghost'))).toBe(true);
  });

  it('catches duplicate team IDs', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'dup' }, { id: 'dup' }] },
      commands: { commands: [] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some((e) => e.includes('duplicate team id'))).toBe(true);
  });

  it('catches duplicate command names', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: {
        commands: [
          { name: 'build', type: 'utility' },
          { name: 'build', type: 'utility' },
        ],
      },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some((e) => e.includes('duplicate command name'))).toBe(true);
  });

  it('catches unknown tools in allowed-tools', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [{ name: 'x', type: 'utility', 'allowed-tools': ['FakeToolXyz'] }] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some((e) => e.includes('unknown tool'))).toBe(true);
  });

  it('accepts Bash with restricted glob pattern', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: {
        commands: [
          {
            name: 'review',
            type: 'utility',
            'allowed-tools': ['Bash(git *)', 'Bash(gh issue create*)', 'Read'],
          },
        ],
      },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.filter((e) => e.includes('unknown tool'))).toEqual([]);
  });

  it('accepts AskUserQuestion, TodoWrite, Agent, and NotebookEdit as valid tools', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: {
        commands: [
          {
            name: 'interactive-cmd',
            type: 'utility',
            'allowed-tools': ['Read', 'AskUserQuestion', 'TodoWrite', 'Agent', 'NotebookEdit'],
          },
        ],
      },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.filter((e) => e.includes('unknown tool'))).toEqual([]);
  });

  it('rejects non-Bash decorated tool patterns', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: {
        commands: [{ name: 'x', type: 'utility', 'allowed-tools': ['Foo(bar)'] }],
      },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some((e) => e.includes('unknown tool "Foo(bar)"'))).toBe(true);
  });

  it('validates domain-rules entries are strings', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [
            {
              id: 'be',
              'domain-rules': [
                'Follow git-workflow domain rules [gw-conventional-commits] — use conventional commits',
                { 'bad key': 'not a string' },
              ],
            },
          ],
        },
      },
      rules: {
        rules: [{ domain: 'git-workflow', conventions: [{ id: 'gw-conventional-commits' }] }],
      },
    });
    expect(errors.some((e) => e.includes('must be a string'))).toBe(true);
  });

  it('catches unknown rule IDs in domain-rules brackets', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [
            {
              id: 'be',
              'domain-rules': [
                'Follow git-workflow domain rules [gw-fake-rule, gw-conventional-commits] — test',
              ],
            },
          ],
        },
      },
      rules: {
        rules: [{ domain: 'git-workflow', conventions: [{ id: 'gw-conventional-commits' }] }],
      },
    });
    expect(errors.some((e) => e.includes('unknown rule id "gw-fake-rule"'))).toBe(true);
    expect(errors.some((e) => e.includes('gw-conventional-commits'))).toBe(false);
  });

  it('handles domain-rules set to a non-array value', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [{ id: 'be', 'domain-rules': 'not an array' }],
        },
      },
      rules: { rules: [] },
    });
    expect(errors.some((e) => e.includes('must be an array'))).toBe(true);
  });

  it('handles domain-rules set to null or undefined gracefully', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [
            { id: 'be', 'domain-rules': null },
            { id: 'fe', 'domain-rules': undefined },
            { id: 'da' },
          ],
        },
      },
      rules: { rules: [] },
    });
    expect(errors.filter((e) => e.includes('domain-rules'))).toEqual([]);
  });

  it('handles empty domain-rules array without errors', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [{ id: 'be', 'domain-rules': [] }],
        },
      },
      rules: { rules: [] },
    });
    expect(errors.filter((e) => e.includes('domain-rules'))).toEqual([]);
  });

  it('handles empty or whitespace-only bracket IDs gracefully', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [
            {
              id: 'be',
              'domain-rules': [
                'Follow rules [, ,] — test with empty IDs',
                'Follow rules [  ] — test with whitespace only',
              ],
            },
          ],
        },
      },
      rules: { rules: [] },
    });
    // Empty/whitespace IDs should not produce "unknown rule id" errors
    expect(errors.filter((e) => e.includes('unknown rule id'))).toEqual([]);
  });

  it('validates multiple bracketed groups in a single domain-rules entry', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [
            {
              id: 'be',
              'domain-rules': ['Follow rules [gw-valid] and also [gw-missing] — two groups'],
            },
          ],
        },
      },
      rules: { rules: [{ domain: 'git-workflow', conventions: [{ id: 'gw-valid' }] }] },
    });
    expect(errors.some((e) => e.includes('unknown rule id "gw-missing"'))).toBe(true);
    expect(errors.some((e) => e.includes('gw-valid'))).toBe(false);
  });

  it('rejects empty Bash() pattern in allowed-tools', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: {
        commands: [
          {
            name: 'bad-cmd',
            type: 'team',
            team: 'backend',
            'allowed-tools': ['Bash()'],
          },
        ],
      },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some((e) => e.includes('empty Bash() pattern'))).toBe(true);
  });

  it('passes domain-rules with all valid rule IDs', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [] },
      agents: {
        agents: {
          engineering: [
            {
              id: 'be',
              'domain-rules': [
                'Follow git-workflow domain rules [gw-conventional-commits, gw-atomic-commits] — test',
                'Follow security domain rules [sec-no-secrets] — test',
              ],
            },
          ],
        },
      },
      rules: {
        rules: [
          {
            domain: 'git-workflow',
            conventions: [{ id: 'gw-conventional-commits' }, { id: 'gw-atomic-commits' }],
          },
          { domain: 'security', conventions: [{ id: 'sec-no-secrets' }] },
        ],
      },
    });
    expect(errors.filter((e) => e.includes('domain-rules'))).toEqual([]);
  });

  it('passes for valid cross-references', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'backend' }] },
      commands: {
        commands: [
          {
            name: 'team-backend',
            type: 'team',
            team: 'backend',
            'allowed-tools': ['Read', 'Bash'],
          },
        ],
      },
      agents: { agents: { engineering: [{ id: 'be' }] } },
      rules: { rules: [{ domain: 'ts', conventions: [{ id: 'ts-lint' }] }] },
    });
    expect(errors).toEqual([]);
  });
});

describe('commands flag metadata validation', () => {
  it('passes for valid enum and required metadata', () => {
    const root = writeTempSpecRoot({
      commands: [
        {
          name: 'orchestrate',
          type: 'workflow',
          description: 'desc',
          flags: [
            {
              name: '--phase',
              description: 'phase',
              type: 'integer',
              default: null,
              required: false,
              enum: [1, 2, 3, 4, 5],
            },
          ],
          'allowed-tools': ['Read', 'Bash'],
        },
      ],
    });

    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when required flag has null default', () => {
    const root = writeTempSpecRoot({
      commands: [
        {
          name: 'orchestrate',
          type: 'workflow',
          description: 'desc',
          flags: [
            {
              name: '--phase',
              description: 'phase',
              type: 'integer',
              default: null,
              required: true,
              enum: [1, 2, 3],
            },
          ],
          'allowed-tools': ['Read', 'Bash'],
        },
      ],
    });

    try {
      const result = validateSpec(root);
      expect(
        result.errors.some((e) => e.includes('required flag cannot have null/undefined default'))
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when default is not in enum', () => {
    const root = writeTempSpecRoot({
      commands: [
        {
          name: 'review',
          type: 'workflow',
          description: 'desc',
          flags: [
            {
              name: '--severity',
              description: 'severity',
              type: 'string',
              default: 'warn',
              required: false,
              enum: ['info', 'warning', 'error', 'critical'],
            },
          ],
          'allowed-tools': ['Read', 'Bash'],
        },
      ],
    });

    try {
      const result = validateSpec(root);
      expect(result.errors.some((e) => e.includes('.default: must be one of enum values'))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when workflow routing flags are missing enum', () => {
    const root = writeTempSpecRoot({
      commands: [
        {
          name: 'orchestrate',
          type: 'workflow',
          description: 'desc',
          flags: [
            {
              name: '--team',
              description: 'target team',
              type: 'string',
              default: null,
              required: false,
            },
            {
              name: '--phase',
              description: 'target phase',
              type: 'integer',
              default: null,
              required: false,
            },
          ],
          'allowed-tools': ['Read', 'Bash'],
        },
      ],
    });

    try {
      const result = validateSpec(root);
      expect(result.errors.some((e) => e.includes('--team'))).toBe(true);
      expect(result.errors.some((e) => e.includes('--phase'))).toBe(true);
      expect(result.errors.some((e) => e.includes('required for workflow routing flag'))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes when workflow routing flags define enum', () => {
    const root = writeTempSpecRoot({
      commands: [
        {
          name: 'orchestrate',
          type: 'workflow',
          description: 'desc',
          flags: [
            {
              name: '--team',
              description: 'target team',
              type: 'string',
              default: null,
              required: false,
              enum: ['backend', 'frontend'],
            },
            {
              name: '--phase',
              description: 'target phase',
              type: 'integer',
              default: null,
              required: false,
              enum: [1, 2, 3, 4, 5],
            },
          ],
          'allowed-tools': ['Read', 'Bash'],
        },
      ],
    });

    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// validateSpec() — integration test against real spec files
// ---------------------------------------------------------------------------
describe('validateSpec() on real spec files', () => {
  it('validates the actual agentkit spec files without errors', () => {
    const result = validateSpec(AGENTKIT_ROOT);
    // The real spec should pass validation
    if (result.errors.length > 0) {
      console.error('Spec validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PROJECT_ENUMS
// ---------------------------------------------------------------------------
describe('PROJECT_ENUMS', () => {
  it('exports a non-empty object', () => {
    expect(typeof PROJECT_ENUMS).toBe('object');
    expect(Object.keys(PROJECT_ENUMS).length).toBeGreaterThan(0);
  });

  it('phase enum contains expected values', () => {
    expect(PROJECT_ENUMS.phase).toContain('greenfield');
    expect(PROJECT_ENUMS.phase).toContain('active');
    expect(PROJECT_ENUMS.phase).toContain('maintenance');
    expect(PROJECT_ENUMS.phase).toContain('legacy');
  });

  it('authProvider enum contains common providers', () => {
    expect(PROJECT_ENUMS.authProvider).toContain('azure-ad');
    expect(PROJECT_ENUMS.authProvider).toContain('azure-ad-b2c');
    expect(PROJECT_ENUMS.authProvider).toContain('auth0');
    expect(PROJECT_ENUMS.authProvider).toContain('none');
  });

  it('cloudProvider enum contains common cloud providers', () => {
    expect(PROJECT_ENUMS.cloudProvider).toContain('aws');
    expect(PROJECT_ENUMS.cloudProvider).toContain('azure');
    expect(PROJECT_ENUMS.cloudProvider).toContain('gcp');
  });

  it('includes issue tracker and intake cadence enums', () => {
    expect(PROJECT_ENUMS.issueTracker).toEqual(['github', 'linear', 'none']);
    expect(PROJECT_ENUMS.intakeCadence).toEqual(['daily', 'on-demand', 'weekly']);
  });
});

// ---------------------------------------------------------------------------
// validateProjectYaml
// ---------------------------------------------------------------------------
describe('validateProjectYaml', () => {
  it('returns no errors for null input', () => {
    const { errors } = validateProjectYaml(null);
    expect(errors).toEqual([]);
  });

  it('returns no errors for empty object', () => {
    const { errors } = validateProjectYaml({});
    expect(errors).toEqual([]);
  });

  it('passes for a fully valid project.yaml', () => {
    const { errors } = validateProjectYaml({
      phase: 'active',
      stack: {
        languages: ['TypeScript'],
        frameworks: { frontend: ['React'], backend: ['Express'], css: ['Tailwind'] },
        database: ['postgres'],
        messaging: ['redis'],
      },
      architecture: { pattern: 'clean', apiStyle: 'rest' },
      deployment: { cloudProvider: 'azure', environments: ['dev', 'prod'], iacTool: 'bicep' },
      process: {
        branchStrategy: 'trunk-based',
        commitConvention: 'conventional',
        codeReview: 'required-pr',
        teamSize: 'small',
      },
      testing: { unit: ['vitest'], integration: [], e2e: [], coverage: 80 },
      integrations: [{ name: 'Stripe', purpose: 'payments' }],
      crosscutting: {
        logging: { framework: 'serilog', level: 'information', sink: ['console'] },
        authentication: { provider: 'auth0', strategy: 'jwt-bearer' },
        caching: { provider: 'redis', patterns: ['cache-aside'] },
        api: { versioning: 'url-segment', pagination: 'cursor', responseFormat: 'envelope' },
        database: { migrations: 'code-first', transactionStrategy: 'unit-of-work' },
        featureFlags: { provider: 'launchdarkly' },
        environments: { naming: ['dev', 'prod'], configStrategy: 'env-vars' },
      },
    });
    expect(errors).toEqual([]);
  });

  it('returns error for invalid phase enum', () => {
    const { errors } = validateProjectYaml({ phase: 'invalid-phase' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('phase');
  });

  it('returns error for invalid architecture.pattern enum', () => {
    const { errors } = validateProjectYaml({ architecture: { pattern: 'bad-pattern' } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('architecture.pattern');
  });

  it('returns error for invalid cloudProvider enum', () => {
    const { errors } = validateProjectYaml({ deployment: { cloudProvider: 'oracle' } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('deployment.cloudProvider');
  });

  it('returns error when stack.languages is not an array', () => {
    const { errors } = validateProjectYaml({ stack: { languages: 'TypeScript' } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('stack.languages');
  });

  it('returns error for testing.coverage out of range', () => {
    const { errors } = validateProjectYaml({ testing: { coverage: 150 } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('testing.coverage');
  });

  it('returns error for testing.coverage as non-number', () => {
    const { errors } = validateProjectYaml({ testing: { coverage: '80%' } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('testing.coverage');
  });

  it('returns error when integrations is not an array', () => {
    const { errors } = validateProjectYaml({ integrations: 'not-array' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('integrations');
  });

  it('returns error for integration entry missing name', () => {
    const { errors } = validateProjectYaml({ integrations: [{ purpose: 'auth' }] });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('integrations[0].name');
  });

  it('returns error for integration entry missing purpose', () => {
    const { errors } = validateProjectYaml({ integrations: [{ name: 'Auth0' }] });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('integrations[0].purpose');
  });

  it('returns error for invalid crosscutting.logging.framework enum', () => {
    const { errors } = validateProjectYaml({
      crosscutting: { logging: { framework: 'log4j' } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('crosscutting.logging.framework');
  });

  it('returns error for invalid crosscutting.authentication.provider enum', () => {
    const { errors } = validateProjectYaml({
      crosscutting: { authentication: { provider: 'okta' } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('crosscutting.authentication.provider');
  });

  it('returns error for invalid crosscutting.featureFlags.provider enum', () => {
    const { errors } = validateProjectYaml({
      crosscutting: { featureFlags: { provider: 'optimizely' } },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('crosscutting.featureFlags.provider');
  });

  it('does not error on optional fields that are absent', () => {
    const { errors } = validateProjectYaml({ name: 'MyApp' });
    expect(errors).toEqual([]);
  });

  it('accepts all valid enum values for phase', () => {
    for (const v of PROJECT_ENUMS.phase) {
      expect(validateProjectYaml({ phase: v }).errors).toEqual([]);
    }
  });

  it('accepts null/undefined optional enum fields without error', () => {
    const { errors } = validateProjectYaml({ phase: null, architecture: { pattern: null } });
    expect(errors).toEqual([]);
  });

  it('rejects empty string for enum fields', () => {
    const { errors } = validateProjectYaml({ phase: '' });
    expect(errors.some((e) => e.includes('phase'))).toBe(true);
  });

  it('validates architecture.monorepoTool enum', () => {
    const { errors: ok } = validateProjectYaml({ architecture: { monorepoTool: 'nx' } });
    expect(ok).toEqual([]);

    const { errors: bad } = validateProjectYaml({ architecture: { monorepoTool: 'invalid' } });
    expect(bad.some((e) => e.includes('monorepoTool'))).toBe(true);
  });

  it('validates architecture.apiStyle enum', () => {
    const { errors: ok } = validateProjectYaml({ architecture: { apiStyle: 'rest' } });
    expect(ok).toEqual([]);

    const { errors: bad } = validateProjectYaml({ architecture: { apiStyle: 'soap' } });
    expect(bad.some((e) => e.includes('apiStyle'))).toBe(true);
  });

  it('validates testing.coverage boundary values', () => {
    expect(validateProjectYaml({ testing: { coverage: 0 } }).errors).toEqual([]);
    expect(validateProjectYaml({ testing: { coverage: 100 } }).errors).toEqual([]);

    const { errors: neg } = validateProjectYaml({ testing: { coverage: -1 } });
    expect(neg.some((e) => e.includes('coverage'))).toBe(true);
  });

  it('validates process.issueTracker enum values', () => {
    expect(validateProjectYaml({ process: { issueTracker: 'github' } }).errors).toEqual([]);
    expect(validateProjectYaml({ process: { issueTracker: 'linear' } }).errors).toEqual([]);
    expect(validateProjectYaml({ process: { issueTracker: 'none' } }).errors).toEqual([]);

    const { errors } = validateProjectYaml({ process: { issueTracker: 'jira' } });
    expect(errors.some((e) => e.includes('process.issueTracker'))).toBe(true);
  });

  it('validates process.intake.cadence enum values', () => {
    expect(validateProjectYaml({ process: { intake: { cadence: 'daily' } } }).errors).toEqual([]);
    expect(validateProjectYaml({ process: { intake: { cadence: 'on-demand' } } }).errors).toEqual(
      []
    );

    const { errors } = validateProjectYaml({ process: { intake: { cadence: 'hourly' } } });
    expect(errors.some((e) => e.includes('process.intake.cadence'))).toBe(true);
  });

  it('validates automation.languageProfile.mode enum values', () => {
    expect(
      validateProjectYaml({ automation: { languageProfile: { mode: 'configured' } } }).errors
    ).toEqual([]);
    expect(
      validateProjectYaml({ automation: { languageProfile: { mode: 'hybrid' } } }).errors
    ).toEqual([]);
    expect(
      validateProjectYaml({ automation: { languageProfile: { mode: 'heuristic' } } }).errors
    ).toEqual([]);

    const { errors } = validateProjectYaml({
      automation: { languageProfile: { mode: 'invalid-mode' } },
    });
    expect(errors.some((e) => e.includes('automation.languageProfile.mode'))).toBe(true);
  });

  it('validates automation.languageProfile.diagnostics enum values', () => {
    expect(
      validateProjectYaml({ automation: { languageProfile: { diagnostics: 'off' } } }).errors
    ).toEqual([]);
    expect(
      validateProjectYaml({ automation: { languageProfile: { diagnostics: 'minimal' } } }).errors
    ).toEqual([]);
    expect(
      validateProjectYaml({ automation: { languageProfile: { diagnostics: 'verbose' } } }).errors
    ).toEqual([]);

    const { errors } = validateProjectYaml({
      automation: { languageProfile: { diagnostics: 'full' } },
    });
    expect(errors.some((e) => e.includes('automation.languageProfile.diagnostics'))).toBe(true);
  });
});

describe('teams intake cross-references', () => {
  it('fails when intake owner/operations teams are unknown', () => {
    const errors = validateCrossReferences({
      teams: {
        teams: [{ id: 'backend' }, { id: 'product' }, { id: 'quality' }],
        intake: {
          ownerTeam: 'ghost',
          operationsTeam: 'unknown',
          routing: { api: 'backend' },
          escalation: { securityCritical: ['backend'] },
        },
      },
      commands: { commands: [] },
      agents: { agents: {} },
      rules: { rules: [] },
    });

    expect(errors.some((e) => e.includes('intake.ownerTeam'))).toBe(true);
    expect(errors.some((e) => e.includes('intake.operationsTeam'))).toBe(true);
  });

  it('fails when intake routing references unknown team', () => {
    const errors = validateCrossReferences({
      teams: {
        teams: [{ id: 'backend' }, { id: 'product' }, { id: 'quality' }],
        intake: {
          ownerTeam: 'product',
          operationsTeam: 'quality',
          routing: { api: 'ghost' },
        },
      },
      commands: { commands: [] },
      agents: { agents: {} },
      rules: { rules: [] },
    });

    expect(errors.some((e) => e.includes('intake.routing.api'))).toBe(true);
  });
});

describe('validateMappingCoverage', () => {
  it('should warn about mapping src paths that do not exist in project spec', () => {
    const project = { name: 'test' };
    const mapping = [
      { src: 'name', dest: 'projectName' },
      { src: 'nonexistent.field', dest: 'missing' },
    ];

    const warnings = validateMappingCoverage(project, mapping);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('nonexistent.field');
    expect(warnings[0]).toContain('{{missing}}');
  });

  it('should not warn about null fields (they exist but are empty)', () => {
    const project = { stack: { orm: null } };
    const mapping = [{ src: 'stack.orm', dest: 'stackOrm', type: 'string' }];

    const warnings = validateMappingCoverage(project, mapping);
    expect(warnings).toHaveLength(0);
  });

  it('should not warn when all mapping paths exist', () => {
    const project = {
      name: 'test',
      stack: { languages: ['js'] },
    };
    const mapping = [
      { src: 'name', dest: 'projectName' },
      { src: 'stack.languages', dest: 'stackLanguages', type: 'array-join' },
    ];

    const warnings = validateMappingCoverage(project, mapping);
    expect(warnings).toHaveLength(0);
  });

  it('should warn about leaf-level missing fields', () => {
    const project = { stack: { languages: ['js'] } };
    const mapping = [{ src: 'stack.missing', dest: 'x' }];

    const warnings = validateMappingCoverage(project, mapping);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('stack.missing');
  });

  it('should handle empty project gracefully', () => {
    const warnings = validateMappingCoverage(null, [{ src: 'a.b', dest: 'x' }]);
    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// VALID_PHASES export
// ---------------------------------------------------------------------------
describe('VALID_PHASES', () => {
  it('exports the five lifecycle phases', () => {
    expect(VALID_PHASES).toEqual(['discovery', 'planning', 'implementation', 'validation', 'ship']);
  });
});

// ---------------------------------------------------------------------------
// Convention type and phase validation
// ---------------------------------------------------------------------------
describe('convention type and phase validation', () => {
  function makeRulesRoot(conventions) {
    const root = mkdtempSync(resolve(tmpdir(), 'agentkit-phase-test-'));
    const specDir = resolve(root, 'spec');
    mkdirSync(specDir, { recursive: true });

    const teams = {
      teams: [{ id: 'backend', name: 'BACKEND', focus: 'API', scope: ['src/**'] }],
      techStacks: [
        {
          name: 'node',
          buildCommand: 'pnpm build',
          testCommand: 'pnpm test',
          detect: ['package.json'],
        },
      ],
    };
    const agents = {
      agents: {
        engineering: [
          {
            id: 'backend',
            name: 'Backend Engineer',
            role: 'role',
            focus: ['src/**'],
            responsibilities: ['build'],
          },
        ],
      },
    };
    const rules = {
      rules: [
        { domain: 'test', description: 'Test rules', 'applies-to': ['**/*.ts'], conventions },
      ],
    };
    const settings = { permissions: { allow: [], deny: [] }, hooks: {} };
    const aliases = { aliases: {} };
    const docs = { categories: [] };
    const commands = { commands: [] };

    writeFileSync(resolve(specDir, 'teams.yaml'), JSON.stringify(teams, null, 2));
    writeFileSync(resolve(specDir, 'agents.yaml'), JSON.stringify(agents, null, 2));
    writeFileSync(resolve(specDir, 'commands.yaml'), JSON.stringify(commands, null, 2));
    writeFileSync(resolve(specDir, 'rules.yaml'), JSON.stringify(rules, null, 2));
    writeFileSync(resolve(specDir, 'settings.yaml'), JSON.stringify(settings, null, 2));
    writeFileSync(resolve(specDir, 'aliases.yaml'), JSON.stringify(aliases, null, 2));
    writeFileSync(resolve(specDir, 'docs.yaml'), JSON.stringify(docs, null, 2));

    return root;
  }

  it('accepts valid type: advisory', () => {
    const root = makeRulesRoot([
      { id: 'r1', rule: 'A rule', severity: 'warning', type: 'advisory' },
    ]);
    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts valid type: enforcement', () => {
    const root = makeRulesRoot([
      { id: 'r1', rule: 'A rule', severity: 'error', type: 'enforcement' },
    ]);
    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid type value', () => {
    const root = makeRulesRoot([
      { id: 'r1', rule: 'A rule', severity: 'error', type: 'mandatory' },
    ]);
    try {
      const result = validateSpec(root);
      expect(result.errors.some((e) => e.includes('advisory, enforcement'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts omitted type (optional)', () => {
    const root = makeRulesRoot([{ id: 'r1', rule: 'A rule', severity: 'warning' }]);
    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts valid single phase', () => {
    const root = makeRulesRoot([
      { id: 'r1', rule: 'A rule', severity: 'warning', phase: 'validation' },
    ]);
    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts valid phase array', () => {
    const root = makeRulesRoot([
      { id: 'r1', rule: 'A rule', severity: 'warning', phase: ['planning', 'implementation'] },
    ]);
    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid phase string', () => {
    const root = makeRulesRoot([
      { id: 'r1', rule: 'A rule', severity: 'warning', phase: 'coding' },
    ]);
    try {
      const result = validateSpec(root);
      expect(result.errors.some((e) => e.includes('phase') && e.includes('coding'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid phase in array', () => {
    const root = makeRulesRoot([
      { id: 'r1', rule: 'A rule', severity: 'warning', phase: ['validation', 'deploy'] },
    ]);
    try {
      const result = validateSpec(root);
      expect(result.errors.some((e) => e.includes('phase') && e.includes('deploy'))).toBe(true);
      // Only 'deploy' should be flagged — not 'validation'
      expect(result.errors.some((e) => e.includes('got "validation"'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts omitted phase (optional)', () => {
    const root = makeRulesRoot([{ id: 'r1', rule: 'A rule', severity: 'warning' }]);
    try {
      const result = validateSpec(root);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// validate() — pattern and additionalProperties
// ---------------------------------------------------------------------------
describe('validate() pattern', () => {
  const schema = { type: 'string', pattern: /^[a-z-]+$/ };

  it('should accept a string matching the pattern', () => {
    expect(validate('session-start', schema, 'x')).toEqual([]);
  });

  it('should reject a string that does not match, naming the offending value', () => {
    const errors = validate('bad name;rm', schema, 'x');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('bad name;rm');
  });

  it('should ignore the pattern for a non-string value', () => {
    // Type errors are reported by the type check; pattern must not double-report
    expect(validate(42, { type: 'string', pattern: /^[a-z]+$/ }, 'x')).toHaveLength(1);
  });

  it('should skip the pattern for an omitted optional field', () => {
    expect(validate(undefined, schema, 'x')).toEqual([]);
  });
});

describe('validate() additionalProperties', () => {
  const base = {
    type: 'object',
    properties: { known: { type: 'string' } },
  };

  it('should allow undeclared keys by default, so existing schemas are unaffected', () => {
    expect(validate({ known: 'a', extra: 'b' }, base, 'x')).toEqual([]);
  });

  it('should reject an undeclared key when additionalProperties is false', () => {
    const schema = { ...base, additionalProperties: false };
    const errors = validate({ known: 'a', extra: 'b' }, schema, 'x');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('extra');
    expect(errors[0]).toContain('unknown key');
  });

  it('should accept an object using only declared keys', () => {
    const schema = { ...base, additionalProperties: false };
    expect(validate({ known: 'a' }, schema, 'x')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// settings.yaml — hooks block shape
//
// The block was previously `{ type: 'object' }`, so every case below passed
// validation and produced a settings.json missing the affected hook in silence.
// ---------------------------------------------------------------------------
describe('validateSpec() settings.yaml hooks', () => {
  function makeSettingsRoot(hooks) {
    const root = mkdtempSync(resolve(tmpdir(), 'agentkit-spec-hooks-'));
    const specDir = resolve(root, 'spec');
    mkdirSync(specDir, { recursive: true });

    const files = {
      'teams.yaml': {
        teams: [{ id: 'backend', name: 'BACKEND', focus: 'API', scope: ['src/**'] }],
        techStacks: [
          {
            name: 'node',
            buildCommand: 'pnpm build',
            testCommand: 'pnpm test',
            detect: ['package.json'],
          },
        ],
      },
      'agents.yaml': {
        agents: {
          engineering: [
            {
              id: 'backend',
              name: 'Backend Engineer',
              role: 'backend role',
              focus: ['src/**'],
              responsibilities: ['build api'],
            },
          ],
        },
      },
      'commands.yaml': { commands: [] },
      'rules.yaml': {
        rules: [
          {
            domain: 'typescript',
            description: 'ts conventions',
            'applies-to': ['**/*.ts'],
            conventions: [{ id: 'ts-1', rule: 'Use strict mode', severity: 'warning' }],
          },
        ],
      },
      'settings.yaml': { permissions: { allow: [], deny: [] }, hooks },
      'aliases.yaml': { aliases: {} },
      'docs.yaml': { categories: [] },
    };

    for (const [name, body] of Object.entries(files)) {
      writeFileSync(resolve(specDir, name), JSON.stringify(body, null, 2));
    }
    return root;
  }

  function errorsFor(hooks) {
    const root = makeSettingsRoot(hooks);
    try {
      return validateSpec(root).errors.filter((e) => e.includes('settings.yaml'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('should accept the shape the real spec uses', () => {
    expect(
      errorsFor({
        sessionStart: 'session-start',
        preToolUse: [{ matcher: 'Bash|Write|Edit', hook: 'budget-guard-check' }],
        postToolUse: [{ matcher: 'Write|Edit', hook: 'warn-uncommitted' }],
        stop: 'stop-build-check',
      })
    ).toEqual([]);
  });

  it('should accept an empty hooks block', () => {
    expect(errorsFor({})).toEqual([]);
  });

  it('should accept an entry with no matcher, which is optional', () => {
    expect(errorsFor({ preToolUse: [{ hook: 'guard-destructive-commands' }] })).toEqual([]);
  });

  it('should reject a mis-keyed lifecycle event', () => {
    const errors = errorsFor({ preToolUsage: [{ hook: 'budget-guard-check' }] });
    expect(errors.some((e) => e.includes('preToolUsage') && e.includes('unknown key'))).toBe(true);
  });

  it('should reject an entry whose hook key is misspelled', () => {
    const errors = errorsFor({ preToolUse: [{ matcher: 'Bash', hoook: 'budget-guard-check' }] });
    // Both the missing required `hook` and the stray `hoook` are reported
    expect(errors.some((e) => e.includes('hook') && e.includes('required'))).toBe(true);
    expect(errors.some((e) => e.includes('hoook') && e.includes('unknown key'))).toBe(true);
  });

  it('should reject a hook stem that is unsafe to interpolate into a command', () => {
    // Semicolon and space both end the command the stem is spliced into
    const errors = errorsFor({ preToolUse: [{ hook: 'guard;whoami' }] });
    expect(errors.some((e) => e.includes('guard;whoami'))).toBe(true);
  });

  it('should reject a hook stem containing shell expansion characters', () => {
    const errors = errorsFor({ sessionStart: 'start$(whoami)' });
    expect(errors.some((e) => e.includes('start$(whoami)'))).toBe(true);
  });

  it('should reject a non-string sessionStart', () => {
    const errors = errorsFor({ sessionStart: 42 });
    expect(errors.some((e) => e.includes('sessionStart') && e.includes('expected string'))).toBe(
      true
    );
  });

  it('should reject a lifecycle list that is not an array', () => {
    const errors = errorsFor({ preToolUse: { hook: 'budget-guard-check' } });
    expect(errors.some((e) => e.includes('preToolUse') && e.includes('expected array'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ADR-15 native agent dispatch — teams.yaml spawn depth + per-agent dispatch
// ---------------------------------------------------------------------------

describe('validateSpec() — ADR-15 dispatch settings', () => {
  const MINIMAL_COMMANDS = {
    commands: [
      {
        name: 'orchestrate',
        type: 'workflow',
        description: 'desc',
        'allowed-tools': ['Read', 'Bash'],
      },
    ],
  };

  /** The default teams spec plus whatever top-level settings a test needs. */
  const teamsWith = (extra) => ({
    teams: [{ id: 'backend', name: 'BACKEND', focus: 'API', scope: ['src/**'] }],
    techStacks: [
      {
        name: 'node',
        buildCommand: 'pnpm build',
        testCommand: 'pnpm test',
        detect: ['package.json'],
      },
    ],
    ...extra,
  });

  /** The default agents spec with one agent carrying the supplied fields. */
  const agentsWith = (extra) => ({
    agents: {
      engineering: [
        {
          id: 'backend',
          name: 'Backend Engineer',
          role: 'backend role',
          focus: ['src/**'],
          responsibilities: ['build api'],
          ...extra,
        },
      ],
    },
  });

  function expectErrors(overrides, predicate) {
    const root = writeTempSpecRoot(MINIMAL_COMMANDS, overrides);
    try {
      return predicate(validateSpec(root).errors);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it.each([1, 2, 3])('accepts max-subagent-spawn-depth %i', (depth) => {
    expectErrors({ teams: teamsWith({ 'max-subagent-spawn-depth': depth }) }, (errors) =>
      expect(errors.filter((e) => e.includes('max-subagent-spawn-depth'))).toEqual([])
    );
  });

  it('accepts an omitted max-subagent-spawn-depth', () => {
    expectErrors({ teams: teamsWith({}) }, (errors) =>
      expect(errors.filter((e) => e.includes('max-subagent-spawn-depth'))).toEqual([])
    );
  });

  it.each([0, 4, 7])('rejects out-of-range max-subagent-spawn-depth %i', (depth) => {
    // A handoff chain of 7 is legitimate; 7 nested spawn contexts is not (ADR-15 §4)
    expectErrors({ teams: teamsWith({ 'max-subagent-spawn-depth': depth }) }, (errors) =>
      expect(errors.some((e) => e.includes('max-subagent-spawn-depth'))).toBe(true)
    );
  });

  it('rejects a non-integer max-subagent-spawn-depth', () => {
    expectErrors({ teams: teamsWith({ 'max-subagent-spawn-depth': 2.5 }) }, (errors) =>
      expect(errors.some((e) => e.includes('must be an integer'))).toBe(true)
    );
  });

  it('rejects an unknown dispatch.tools-mode', () => {
    expectErrors({ agents: agentsWith({ dispatch: { 'tools-mode': 'denylist' } }) }, (errors) =>
      expect(errors.some((e) => e.includes('tools-mode'))).toBe(true)
    );
  });

  it('rejects an unknown dispatch.isolation', () => {
    expectErrors({ agents: agentsWith({ dispatch: { isolation: 'worktee' } }) }, (errors) =>
      expect(errors.some((e) => e.includes('isolation'))).toBe(true)
    );
  });

  it('rejects a non-boolean dispatch.can-dispatch', () => {
    expectErrors({ agents: agentsWith({ dispatch: { 'can-dispatch': 'yes' } }) }, (errors) =>
      expect(errors.some((e) => e.includes('can-dispatch'))).toBe(true)
    );
  });

  it('rejects tools-mode: allowlist without preferred-tools', () => {
    // An empty allowlist emits `tools:` with nothing in it, and the subagent
    // fails at its first tool call rather than at sync time
    expectErrors({ agents: agentsWith({ dispatch: { 'tools-mode': 'allowlist' } }) }, (errors) =>
      expect(errors.some((e) => e.includes('empty allowlist'))).toBe(true)
    );
  });

  it('accepts tools-mode: allowlist with preferred-tools', () => {
    expectErrors(
      {
        agents: agentsWith({
          'preferred-tools': ['Read', 'Grep'],
          dispatch: { 'tools-mode': 'allowlist' },
        }),
      },
      (errors) => expect(errors.filter((e) => e.includes('allowlist'))).toEqual([])
    );
  });

  it('accepts a fully populated dispatch block', () => {
    expectErrors(
      {
        agents: agentsWith({
          'preferred-tools': ['Read'],
          dispatch: {
            'when-to-use': 'Use for API work.',
            'can-dispatch': true,
            'tools-mode': 'allowlist',
            model: 'opus',
            isolation: 'worktree',
            background: false,
            color: 'blue',
          },
        }),
      },
      (errors) => expect(errors).toEqual([])
    );
  });

  it('rejects an agent id that Claude Code would refuse to register', () => {
    expectErrors({ agents: agentsWith({ id: 'forge:backend' }) }, (errors) =>
      expect(errors.some((e) => e.includes('dispatchable'))).toBe(true)
    );
  });
});

// ---------------------------------------------------------------------------
// validateOverlaySettings() — the one spec surface that was never validated
//
// Type violations are errors because they change behaviour silently; unknown
// keys are warnings so an overlay written for a newer engine still syncs.
// ---------------------------------------------------------------------------
describe('validateOverlaySettings()', () => {
  function withOverlay(yamlText, name = 'demo') {
    const root = mkdtempSync(resolve(tmpdir(), 'agentkit-overlay-'));
    const dir = resolve(root, 'overlays', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'settings.yaml'), yamlText);
    try {
      return validateOverlaySettings(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('should accept a well-formed overlay', () => {
    const r = withOverlay(
      [
        'repoName: demo',
        'defaultBranch: main',
        'integrationBranch: dev',
        'windowsFirst: true',
        'agentBranchPrefix: feat',
        'worktreeIsolation: advisory',
        'syncDateMode: none',
        'featurePreset: standard',
        'renderTargets: [claude, cursor]',
      ].join('\n')
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('should require repoName', () => {
    const r = withOverlay('defaultBranch: main');
    expect(r.errors.some((e) => e.includes('repoName') && e.includes('required'))).toBe(true);
  });

  it('should reject a quoted boolean, which would otherwise be truthy', () => {
    // 'false' is a non-empty string — windowsFirst !== false, so it would have
    // silently enabled the very thing the author was disabling
    const r = withOverlay('repoName: demo\nwindowsFirst: "false"');
    expect(r.errors.some((e) => e.includes('windowsFirst') && e.includes('expected boolean'))).toBe(
      true
    );
  });

  it('should reject an out-of-range enum value', () => {
    const r = withOverlay('repoName: demo\nworktreeIsolation: sorta');
    expect(r.errors.some((e) => e.includes('worktreeIsolation'))).toBe(true);
  });

  it('should reject a branch prefix carrying a separator', () => {
    // `feat/` would render as `feat//agent-<name>/<slug>`
    const r = withOverlay('repoName: demo\nagentBranchPrefix: feat/');
    expect(r.errors.some((e) => e.includes('agentBranchPrefix'))).toBe(true);
  });

  it('should warn rather than error on an unknown setting', () => {
    const r = withOverlay('repoName: demo\nwindowsFrist: false');
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('windowsFrist') && w.includes('unknown'))).toBe(true);
  });

  it('should warn on an unknown render target', () => {
    const r = withOverlay('repoName: demo\nrenderTargets: [claude, emacs]');
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('emacs'))).toBe(true);
  });

  it('should report invalid YAML without throwing', () => {
    const r = withOverlay('repoName: [unclosed');
    expect(r.errors.some((e) => e.includes('invalid YAML'))).toBe(true);
  });

  it('should report a non-mapping overlay without throwing', () => {
    const r = withOverlay('- just\n- a list');
    expect(r.errors.some((e) => e.includes('mapping'))).toBe(true);
  });

  it('should return empty results when no overlays directory exists', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'agentkit-overlay-none-'));
    try {
      expect(validateOverlaySettings(root)).toEqual({ errors: [], warnings: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should accept every setting the shipped overlays actually use', () => {
    // Guards the schema against the real overlays: a key added to an overlay
    // without being declared here shows up as a warning, which is the check
    // that windowsFirst and aiSynthesisLayer both evaded
    const r = validateOverlaySettings(AGENTKIT_ROOT);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
