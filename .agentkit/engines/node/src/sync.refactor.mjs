export const PROJECT_MAPPING = [
  // Top-level
  { src: 'name', dest: 'projectName' },
  { src: 'description', dest: 'projectDescription' },
  { src: 'phase', dest: 'projectPhase' },

  // Stack
  { src: 'stack.languages', dest: 'stackLanguages', type: 'array-join' },
  { src: 'stack.frameworks.frontend', dest: 'stackFrontendFrameworks', type: 'array-join' },
  { src: 'stack.frameworks.backend', dest: 'stackBackendFrameworks', type: 'array-join' },
  { src: 'stack.frameworks.css', dest: 'stackCssFrameworks', type: 'array-join' },
  { src: 'stack.orm', dest: 'stackOrm', type: 'string' },
  { src: 'stack.database', dest: 'stackDatabase', type: 'array-or-string' },
  { src: 'stack.search', dest: 'stackSearch', type: 'string' },
  { src: 'stack.messaging', dest: 'stackMessaging', type: 'array-or-string' },

  // Architecture
  { src: 'architecture.pattern', dest: 'architecturePattern' },
  { src: 'architecture.apiStyle', dest: 'architectureApiStyle' },
  { src: 'architecture.monorepo', dest: 'monorepo', type: 'boolean' },
  { src: 'architecture.monorepo', dest: 'hasMonorepo', type: 'boolean' },
  { src: 'architecture.monorepoTool', dest: 'monorepoTool' },

  // Patterns
  { src: 'patterns.repository', dest: 'hasPatternRepository', type: 'boolean' },
  { src: 'patterns.cqrs', dest: 'hasPatternCqrs', type: 'boolean' },
  { src: 'patterns.eventSourcing', dest: 'hasPatternEventSourcing', type: 'boolean' },
  { src: 'patterns.mediator', dest: 'hasPatternMediator', type: 'boolean' },
  { src: 'patterns.unitOfWork', dest: 'hasPatternUnitOfWork', type: 'boolean' },

  // Documentation
  { src: 'documentation.hasPrd', dest: 'hasPrd', type: 'boolean' },
  { src: 'documentation.prdPath', dest: 'prdPath' },
  { src: 'documentation.hasAdr', dest: 'hasAdr', type: 'boolean' },
  { src: 'documentation.adrPath', dest: 'adrPath' },
  { src: 'documentation.hasApiSpec', dest: 'hasApiSpec', type: 'boolean' },
  { src: 'documentation.apiSpecPath', dest: 'apiSpecPath' },
  { src: 'documentation.hasTechnicalSpec', dest: 'hasTechnicalSpec', type: 'boolean' },
  { src: 'documentation.technicalSpecPath', dest: 'technicalSpecPath' },
  { src: 'documentation.hasDesignSystem', dest: 'hasDesignSystem', type: 'boolean' },
  { src: 'documentation.designSystemPath', dest: 'designSystemPath' },
  { src: 'documentation.storybook', dest: 'hasStorybook', type: 'boolean' },
  { src: 'documentation.designTokensPath', dest: 'designTokensPath' },

  // Deployment
  { src: 'deployment.cloudProvider', dest: 'cloudProvider' },
  { src: 'deployment.containerized', dest: 'containerized', type: 'boolean' },
  { src: 'deployment.containerized', dest: 'hasContainerized', type: 'boolean' },
  { src: 'deployment.environments', dest: 'environments', type: 'array-join' },
  { src: 'deployment.iacTool', dest: 'iacTool' },

  // Infrastructure
  { src: 'infrastructure.namingConvention', dest: 'infraNamingConvention' },
  { src: 'infrastructure.defaultRegion', dest: 'infraDefaultRegion' },
  { src: 'infrastructure.org', dest: 'infraOrg' },
  { src: 'infrastructure.iacToolchain', dest: 'infraIacToolchain', type: 'array-join' },
  { src: 'infrastructure.stateBackend', dest: 'infraStateBackend', check: 'not-none' },
  { src: 'infrastructure.stateBackend', dest: 'hasStateBackend', type: 'boolean', check: 'not-none' },
  { src: 'infrastructure.modulesRepo', dest: 'infraModulesRepo' },
  { src: 'infrastructure.lockProvider', dest: 'infraLockProvider', check: 'not-none' },
  { src: 'infrastructure.tagging.mandatory', dest: 'infraMandatoryTags', type: 'array-join' },
  { src: 'infrastructure.tagging.mandatory', dest: 'hasInfraTags', type: 'boolean-array-length' },
  { src: 'infrastructure.tagging.optional', dest: 'infraOptionalTags', type: 'array-join' },

  // Observability
  { src: 'observability.monitoring.provider', dest: 'monitoringProvider', check: 'not-none' },
  { src: 'observability.monitoring.provider', dest: 'hasMonitoring', type: 'boolean', check: 'not-none' },
  { src: 'observability.monitoring.dashboards', dest: 'hasMonitoringDashboards', type: 'boolean' },
  { src: 'observability.alerting.provider', dest: 'alertingProvider', check: 'not-none' },
  { src: 'observability.alerting.provider', dest: 'hasAlerting', type: 'boolean', check: 'not-none' },
  { src: 'observability.alerting.channels', dest: 'alertingChannels', type: 'array-join' },
  { src: 'observability.tracing.provider', dest: 'tracingProvider', check: 'not-none' },
  { src: 'observability.tracing.provider', dest: 'hasTracing', type: 'boolean', check: 'not-none' },
  { src: 'observability.tracing.samplingRate', dest: 'tracingSamplingRate', type: 'string' },
  { src: 'observability.logging.centralised', dest: 'hasCentralisedLogging', type: 'boolean' },
  { src: 'observability.logging.retentionDays', dest: 'logRetentionDays', type: 'string' },

  // Compliance
  { src: 'compliance.framework', dest: 'complianceFramework', check: 'not-none' },
  { src: 'compliance.framework', dest: 'hasCompliance', type: 'boolean', check: 'not-none' },
  { src: 'compliance.disasterRecovery.rpoHours', dest: 'drRpoHours', type: 'string' },
  { src: 'compliance.disasterRecovery.rtoHours', dest: 'drRtoHours', type: 'string' },
  { src: 'compliance.disasterRecovery.backupSchedule', dest: 'drBackupSchedule', check: 'not-none' },
  { src: 'compliance.disasterRecovery.testSchedule', dest: 'drTestSchedule', check: 'not-none' },
  { src: 'compliance.disasterRecovery.geoRedundancy', dest: 'hasGeoRedundancy', type: 'boolean' },
  { src: 'compliance.audit.enabled', dest: 'hasAudit', type: 'boolean' },
  { src: 'compliance.audit.appendOnly', dest: 'hasAppendOnlyAudit', type: 'boolean' },
  { src: 'compliance.audit.eventBus', dest: 'auditEventBus', check: 'not-none' },

  // Process
  { src: 'process.branchStrategy', dest: 'branchStrategy' },
  { src: 'process.commitConvention', dest: 'commitConvention' },
  { src: 'process.codeReview', dest: 'codeReview' },
  { src: 'process.teamSize', dest: 'teamSize' },

  // Testing
  { src: 'testing.unit', dest: 'testingUnit', type: 'array-join' },
  { src: 'testing.integration', dest: 'testingIntegration', type: 'array-join' },
  { src: 'testing.e2e', dest: 'testingE2e', type: 'array-join' },
  { src: 'testing.coverage', dest: 'testingCoverage', type: 'string' },

  // Cross-cutting (formerly flattenCrosscutting)
  // Logging
  { src: 'crosscutting.logging.framework', dest: 'loggingFramework', check: 'not-none' },
  { src: 'crosscutting.logging.framework', dest: 'hasLogging', type: 'boolean', check: 'not-none' },
  { src: 'crosscutting.logging.structured', dest: 'hasStructuredLogging', type: 'boolean' },
  { src: 'crosscutting.logging.correlationId', dest: 'hasCorrelationId', type: 'boolean' },
  { src: 'crosscutting.logging.level', dest: 'loggingLevel' },
  { src: 'crosscutting.logging.sink', dest: 'loggingSinks', type: 'array-join' },

  // Error Handling
  { src: 'crosscutting.errorHandling.strategy', dest: 'errorStrategy', check: 'not-none' },
  { src: 'crosscutting.errorHandling.strategy', dest: 'hasErrorHandling', type: 'boolean', check: 'not-none' },
  { src: 'crosscutting.errorHandling.globalHandler', dest: 'hasGlobalHandler', type: 'boolean' },
  { src: 'crosscutting.errorHandling.customExceptions', dest: 'hasCustomExceptions', type: 'boolean' },

  // Authentication
  { src: 'crosscutting.authentication.provider', dest: 'authProvider', check: 'not-none' },
  { src: 'crosscutting.authentication.provider', dest: 'hasAuth', type: 'boolean', check: 'not-none' },
  { src: 'crosscutting.authentication.strategy', dest: 'authStrategy' },
  { src: 'crosscutting.authentication.rbac', dest: 'hasRbac', type: 'boolean' },
  { src: 'crosscutting.authentication.multiTenant', dest: 'hasMultiTenant', type: 'boolean' },

  // Caching
  { src: 'crosscutting.caching.provider', dest: 'cachingProvider', check: 'not-none' },
  { src: 'crosscutting.caching.provider', dest: 'hasCaching', type: 'boolean', check: 'not-none' },
  { src: 'crosscutting.caching.patterns', dest: 'cachingPatterns', type: 'array-join' },
  { src: 'crosscutting.caching.distributedCache', dest: 'hasDistributedCache', type: 'boolean' },

  // API
  { src: 'crosscutting.api.versioning', dest: 'apiVersioning', check: 'not-none' },
  { src: 'crosscutting.api.versioning', dest: 'hasApiVersioning', type: 'boolean', check: 'not-none' },
  { src: 'crosscutting.api.pagination', dest: 'apiPagination', check: 'not-none' },
  { src: 'crosscutting.api.pagination', dest: 'hasApiPagination', type: 'boolean', check: 'not-none' },
  { src: 'crosscutting.api.responseFormat', dest: 'apiResponseFormat' },
  { src: 'crosscutting.api.rateLimiting', dest: 'hasRateLimiting', type: 'boolean' },

  // Database
  { src: 'crosscutting.database.migrations', dest: 'dbMigrations', check: 'not-none' },
  { src: 'crosscutting.database.migrations', dest: 'hasDbMigrations', type: 'boolean', check: 'not-none' },
  { src: 'crosscutting.database.seeding', dest: 'hasDbSeeding', type: 'boolean' },
  { src: 'crosscutting.database.transactionStrategy', dest: 'dbTransactionStrategy', check: 'not-none' },
  { src: 'crosscutting.database.connectionPooling', dest: 'hasConnectionPooling', type: 'boolean' },

  // Performance
  { src: 'crosscutting.performance.lazyLoading', dest: 'hasLazyLoading', type: 'boolean' },
  { src: 'crosscutting.performance.imageOptimization', dest: 'hasImageOptimization', type: 'boolean' },
  { src: 'crosscutting.performance.bundleBudget', dest: 'bundleBudget', type: 'string' },

  // Feature Flags
  { src: 'crosscutting.featureFlags.provider', dest: 'featureFlagProvider', check: 'not-none' },
  { src: 'crosscutting.featureFlags.provider', dest: 'hasFeatureFlags', type: 'boolean', check: 'not-none' },

  // Environments
  { src: 'crosscutting.environments.naming', dest: 'envNames', type: 'array-join' },
  { src: 'crosscutting.environments.configStrategy', dest: 'envConfigStrategy', check: 'not-none' },
  { src: 'crosscutting.environments.envFilePattern', dest: 'envFilePattern' },
];

/**
 * Safely accesses a property from an object using a dot-notation path.
 */
export function get(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

/**
 * Transforms a value based on the configuration type.
 */
export function transform(value, type) {
  if (value === undefined || value === null) return undefined;

  switch (type) {
    case 'string':
      return String(value);
    case 'boolean':
      return !!value;
    case 'array-join':
      return Array.isArray(value) ? value.join(', ') : undefined;
    case 'array-or-string':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'boolean-array-length':
      return Array.isArray(value) && value.length > 0;
    default:
      return value;
  }
}

/**
 * Checks if a value passes the configuration check.
 */
export function check(value, checkType) {
  if (checkType === 'not-none') {
    return value !== 'none' && value !== undefined && value !== null;
  }
  return value !== undefined && value !== null;
}
