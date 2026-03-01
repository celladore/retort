import { describe, it, expect } from 'vitest';
import { validate, validateCrossReferences, validateSpec, validateProjectYaml, PROJECT_ENUMS } from '../spec-validator.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');

function writeTempSpecRoot(commandsObj) {
  const root = mkdtempSync(resolve(tmpdir(), 'agentkit-spec-validator-'));
  const specDir = resolve(root, 'spec');
  mkdirSync(specDir, { recursive: true });

  const teams = {
    teams: [{ id: 'backend', name: 'BACKEND', focus: 'API', scope: ['src/**'] }],
    techStacks: [{ name: 'node', buildCommand: 'pnpm build', testCommand: 'pnpm test', detect: ['package.json'] }],
  };
  const agents = {
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
    expect(errors.some(e => e.includes('ghost'))).toBe(true);
  });

  it('catches duplicate team IDs', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'dup' }, { id: 'dup' }] },
      commands: { commands: [] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some(e => e.includes('duplicate team id'))).toBe(true);
  });

  it('catches duplicate command names', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [{ name: 'build', type: 'utility' }, { name: 'build', type: 'utility' }] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some(e => e.includes('duplicate command name'))).toBe(true);
  });

  it('catches unknown tools in allowed-tools', () => {
    const errors = validateCrossReferences({
      teams: { teams: [] },
      commands: { commands: [{ name: 'x', type: 'utility', 'allowed-tools': ['FakeToolXyz'] }] },
      agents: { agents: {} },
      rules: { rules: [] },
    });
    expect(errors.some(e => e.includes('unknown tool'))).toBe(true);
  });

  it('passes for valid cross-references', () => {
    const errors = validateCrossReferences({
      teams: { teams: [{ id: 'backend' }] },
      commands: { commands: [{ name: 'team-backend', type: 'team', team: 'backend', 'allowed-tools': ['Read', 'Bash'] }] },
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
      expect(result.errors.some((e) => e.includes('required flag cannot have null/undefined default'))).toBe(true);
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
      expect(result.errors.some((e) => e.includes('.default: must be one of enum values'))).toBe(true);
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
      expect(result.errors.some((e) => e.includes('required for workflow routing flag'))).toBe(true);
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
    expect(errors.some(e => e.includes('phase'))).toBe(true);
  });

  it('validates architecture.monorepoTool enum', () => {
    const { errors: ok } = validateProjectYaml({ architecture: { monorepoTool: 'nx' } });
    expect(ok).toEqual([]);

    const { errors: bad } = validateProjectYaml({ architecture: { monorepoTool: 'invalid' } });
    expect(bad.some(e => e.includes('monorepoTool'))).toBe(true);
  });

  it('validates architecture.apiStyle enum', () => {
    const { errors: ok } = validateProjectYaml({ architecture: { apiStyle: 'rest' } });
    expect(ok).toEqual([]);

    const { errors: bad } = validateProjectYaml({ architecture: { apiStyle: 'soap' } });
    expect(bad.some(e => e.includes('apiStyle'))).toBe(true);
  });

  it('validates testing.coverage boundary values', () => {
    expect(validateProjectYaml({ testing: { coverage: 0 } }).errors).toEqual([]);
    expect(validateProjectYaml({ testing: { coverage: 100 } }).errors).toEqual([]);

    const { errors: neg } = validateProjectYaml({ testing: { coverage: -1 } });
    expect(neg.some(e => e.includes('coverage'))).toBe(true);
  });
});
