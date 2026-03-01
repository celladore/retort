import { describe, expect, it } from 'vitest';
import { computeProjectCompleteness, getCompletenessFields } from '../project-completeness.mjs';

describe('project-completeness', () => {
  it('returns generation profile fields by default', () => {
    const fields = getCompletenessFields();
    expect(Array.isArray(fields)).toBe(true);
    expect(fields.length).toBeGreaterThan(10);
    expect(fields).toContain('infrastructure.namingConvention');
    expect(fields).toContain('crosscutting.api.responseFormat');
    expect(fields).toContain('process.branchStrategy');
    expect(fields).toContain('compliance.audit.enabled');
  });

  it('returns advanced profile fields when requested', () => {
    const fields = getCompletenessFields('advanced');
    expect(fields).toContain('documentation.hasPrd');
    expect(fields).toContain('stack.orm');
  });

  it('returns diagnostics profile fields when requested', () => {
    const fields = getCompletenessFields('diagnostics');
    expect(fields).toContain('compliance.framework');
    expect(fields).toContain('observability.alerting.channels');
    expect(fields).toContain('process.commitConvention');
  });

  it('computes completeness for generation profile', () => {
    const project = {
      name: 'agentkit-forge',
      description: 'desc',
      phase: 'active',
      stack: { languages: ['javascript'], database: ['none'], orm: 'none', messaging: ['none'] },
      architecture: { pattern: 'monolith', apiStyle: 'mixed' },
      deployment: { cloudProvider: 'none', iacTool: 'none', environments: ['local'] },
      testing: { unit: ['vitest'], integration: ['vitest'], coverage: 80 },
      documentation: { hasPrd: true, hasAdr: true, hasApiSpec: true },
      process: { branchStrategy: 'github-flow', commitConvention: 'conventional', codeReview: 'required-pr' },
      infrastructure: {
        namingConvention: '{org}-{env}-{project}-{resourcetype}-{region}',
        org: 'akf',
        defaultRegion: 'global',
        stateBackend: 'none',
        iacToolchain: ['none'],
      },
      observability: {
        monitoring: { provider: 'none' },
        alerting: { provider: 'none', channels: ['none'] },
      },
      compliance: { audit: { enabled: false } },
      crosscutting: {
        authentication: { provider: 'custom-jwt', strategy: 'jwt-bearer', rbac: true },
        api: { versioning: 'url-segment', pagination: 'cursor', responseFormat: 'envelope', rateLimiting: true },
      },
    };

    const result = computeProjectCompleteness(project, { profile: 'generation' });
    expect(result.percent).toBe(100);
    expect(result.present).toBe(result.total);
    expect(result.missing).toEqual([]);
  });

  it('treats empty arrays as missing', () => {
    const project = {
      name: 'agentkit-forge',
      observability: { alerting: { channels: [] } },
    };

    const result = computeProjectCompleteness(project, { profile: 'diagnostics' });
    expect(result.missing).toContain('observability.alerting.channels');
  });
});
