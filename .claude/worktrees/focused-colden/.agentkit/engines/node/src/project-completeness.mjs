/**
 * AgentKit Forge — Project Completeness Scoring
 * Centralized scoring profiles for project.yaml completeness checks.
 */

const COMPLETENESS_PROFILES = {
  core: [
    'name',
    'description',
    'phase',
    'stack.languages',
    'stack.database',
    'architecture.pattern',
    'architecture.apiStyle',
    'deployment.cloudProvider',
    'deployment.iacTool',
    'deployment.environments',
    'testing.coverage',
    'testing.unit',
    'testing.integration',
    'infrastructure.namingConvention',
    'infrastructure.org',
    'infrastructure.defaultRegion',
    'infrastructure.stateBackend',
    'observability.monitoring.provider',
    'observability.alerting.provider',
    'observability.alerting.channels',
    'crosscutting.authentication.provider',
    'crosscutting.authentication.strategy',
    'crosscutting.authentication.rbac',
    'crosscutting.api.versioning',
    'crosscutting.api.pagination',
    'crosscutting.api.responseFormat',
    'crosscutting.api.rateLimiting',
    'process.branchStrategy',
    'process.commitConvention',
    'process.codeReview',
  ],
  advanced: [
    'documentation.hasPrd',
    'documentation.hasAdr',
    'documentation.hasApiSpec',
    'stack.orm',
    'stack.messaging',
    'infrastructure.iacToolchain',
    'compliance.audit.enabled',
  ],
  diagnostics: [
    'name',
    'description',
    'phase',
    'stack.languages',
    'stack.database',
    'architecture.pattern',
    'architecture.apiStyle',
    'deployment.cloudProvider',
    'deployment.iacTool',
    'deployment.environments',
    'testing.coverage',
    'testing.unit',
    'testing.integration',
    'infrastructure.namingConvention',
    'infrastructure.defaultRegion',
    'infrastructure.org',
    'infrastructure.stateBackend',
    'observability.monitoring.provider',
    'observability.alerting.provider',
    'observability.alerting.channels',
    'observability.tracing.provider',
    'crosscutting.authentication.provider',
    'crosscutting.authentication.strategy',
    'crosscutting.authentication.rbac',
    'crosscutting.api.versioning',
    'crosscutting.api.pagination',
    'crosscutting.api.responseFormat',
    'crosscutting.api.rateLimiting',
    'process.branchStrategy',
    'process.commitConvention',
    'process.codeReview',
    'compliance.framework',
    'compliance.disasterRecovery.rpoHours',
    'compliance.disasterRecovery.rtoHours',
    'compliance.audit.eventBus',
  ],
};

const PROFILE_WEIGHTS = {
  core: 1,
  advanced: 0.5,
};

function getValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    current = current?.[part];
  }
  return current;
}

function isPresent(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function getCompletenessFields(profile = 'generation') {
  if (profile === 'generation') {
    return [...COMPLETENESS_PROFILES.core, ...COMPLETENESS_PROFILES.advanced];
  }
  return (
    COMPLETENESS_PROFILES[profile] || [
      ...COMPLETENESS_PROFILES.core,
      ...COMPLETENESS_PROFILES.advanced,
    ]
  );
}

function computeGenerationCompleteness(projectSpec) {
  const weighted = {
    totalWeight: 0,
    presentWeight: 0,
    missing: [],
  };

  for (const profileName of ['core', 'advanced']) {
    const profileWeight = PROFILE_WEIGHTS[profileName] || 1;
    const fields = COMPLETENESS_PROFILES[profileName] || [];

    for (const field of fields) {
      weighted.totalWeight += profileWeight;
      const value = getValue(projectSpec, field);
      if (isPresent(value)) {
        weighted.presentWeight += profileWeight;
      } else {
        weighted.missing.push(field);
      }
    }
  }

  const allFields = getCompletenessFields('generation');
  const present = allFields.length - weighted.missing.length;
  const percent =
    weighted.totalWeight === 0
      ? 0
      : Math.round((weighted.presentWeight / weighted.totalWeight) * 100);

  return {
    total: allFields.length,
    present,
    percent,
    missing: weighted.missing,
    profile: 'generation',
    weighting: PROFILE_WEIGHTS,
  };
}

export function computeProjectCompleteness(projectSpec, options = {}) {
  if (!projectSpec || typeof projectSpec !== 'object') {
    return {
      total: 0,
      present: 0,
      percent: 0,
      missing: [],
      profile: options.profile || 'generation',
    };
  }

  const profile = options.profile || 'generation';
  if (profile === 'generation') {
    return computeGenerationCompleteness(projectSpec);
  }

  const fields = getCompletenessFields(profile);
  const missing = [];
  let present = 0;

  for (const field of fields) {
    const value = getValue(projectSpec, field);
    if (isPresent(value)) {
      present++;
    } else {
      missing.push(field);
    }
  }

  const percent = Math.round((present / fields.length) * 100);
  return {
    total: fields.length,
    present,
    percent,
    missing,
    profile,
  };
}
