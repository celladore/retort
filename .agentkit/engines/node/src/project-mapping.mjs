export const PROJECT_MAPPING = [
  // Top-level
  { src: 'name', dest: 'projectName' },
  { src: 'githubSlug', dest: 'githubSlug' },
  { src: 'description', dest: 'projectDescription' },
  { src: 'phase', dest: 'projectPhase' },

  // Stack
  { src: 'stack.languages', dest: 'stackLanguages', type: 'array-join' },
  { src: 'stack.frameworks.frontend', dest: 'stackFrontendFrameworks', type: 'array-join' },
  { src: 'stack.frameworks.backend', dest: 'stackBackendFrameworks', type: 'array-join' },
  { src: 'stack.frameworks.css', dest: 'stackCssFrameworks', type: 'array-join' },
  { src: 'stack.orm', dest: 'stackOrm', type: 'string' },
  { src: 'stack.database', dest: 'stackDatabase', type: 'array-join' },
  { src: 'stack.search', dest: 'stackSearch', type: 'string' },
  { src: 'stack.messaging', dest: 'stackMessaging', type: 'array-join' },
  { src: 'stack.nodeVersion', dest: 'nodeVersion' },
  { src: 'stack.pythonVersion', dest: 'pythonVersion' },

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
  { src: 'documentation.historyPath', dest: 'docsHistoryPath' },
  { src: 'documentation.hasBrandGuide', dest: 'hasBrandGuide', type: 'boolean' },
  { src: 'documentation.brandGuidePath', dest: 'brandGuidePath' },

  // Editor Theme
  { src: 'editorTheme.enabled', dest: 'editorThemeEnabled', type: 'boolean' },
  { src: 'editorTheme.source', dest: 'editorThemeSource', check: 'not-none' },
  { src: 'editorTheme.source', dest: 'hasEditorThemeSource', type: 'boolean', check: 'not-none' },

  // External Knowledge Integration
  { src: 'externalKnowledge.enabled', dest: 'hasExternalKnowledge', type: 'boolean' },
  { src: 'externalKnowledge.mode', dest: 'externalKnowledgeMode' },
  { src: 'externalKnowledge.sources.windsurfDomainGuidesPath', dest: 'windsurfDomainGuidesPath' },
  {
    src: 'externalKnowledge.sources.windsurfDomainGuidesPath',
    dest: 'hasWindsurfDomainGuidesPath',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'externalKnowledge.sources.mystiraDocsPath', dest: 'mystiraDocsPath' },
  {
    src: 'externalKnowledge.sources.mystiraDocsPath',
    dest: 'hasMystiraDocsPath',
    type: 'boolean',
    check: 'not-none',
  },
  {
    src: 'externalKnowledge.sources.markdownFiles',
    dest: 'externalMarkdownFiles',
    type: 'array-join',
  },
  {
    src: 'externalKnowledge.sources.markdownFiles',
    dest: 'hasExternalMarkdownFiles',
    type: 'boolean-array-length',
  },
  { src: 'externalKnowledge.sources.gitRepoUrls', dest: 'externalGitRepoUrls', type: 'array-join' },
  {
    src: 'externalKnowledge.sources.gitRepoUrls',
    dest: 'hasExternalGitRepoUrls',
    type: 'boolean-array-length',
  },
  {
    src: 'externalKnowledge.targetPlatforms',
    dest: 'externalKnowledgeTargetPlatforms',
    type: 'array-join',
  },

  // Deployment
  { src: 'deployment.cloudProvider', dest: 'cloudProvider' },
  { src: 'deployment.containerized', dest: 'containerized', type: 'boolean' },
  { src: 'deployment.containerized', dest: 'hasContainerized', type: 'boolean' },
  { src: 'deployment.containerRuntime', dest: 'containerRuntime', check: 'not-none' },
  { src: 'deployment.environments', dest: 'environments', type: 'array-join' },
  { src: 'deployment.iacTool', dest: 'iacTool' },

  // Infrastructure
  { src: 'infrastructure.namingConvention', dest: 'infraNamingConvention' },
  { src: 'infrastructure.defaultRegion', dest: 'infraDefaultRegion' },
  { src: 'infrastructure.org', dest: 'infraOrg' },
  { src: 'infrastructure.iacToolchain', dest: 'infraIacToolchain', type: 'array-join' },
  { src: 'infrastructure.stateBackend', dest: 'infraStateBackend', check: 'not-none' },
  {
    src: 'infrastructure.stateBackend',
    dest: 'hasStateBackend',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'infrastructure.modulesRepo', dest: 'infraModulesRepo' },
  { src: 'infrastructure.lockProvider', dest: 'infraLockProvider', check: 'not-none' },
  { src: 'infrastructure.tagging.mandatory', dest: 'infraMandatoryTags', type: 'array-join' },
  { src: 'infrastructure.tagging.mandatory', dest: 'hasInfraTags', type: 'boolean-array-length' },
  { src: 'infrastructure.tagging.optional', dest: 'infraOptionalTags', type: 'array-join' },

  // Observability
  { src: 'observability.monitoring.provider', dest: 'monitoringProvider', check: 'not-none' },
  {
    src: 'observability.monitoring.provider',
    dest: 'hasMonitoring',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'observability.monitoring.dashboards', dest: 'hasMonitoringDashboards', type: 'boolean' },
  { src: 'observability.alerting.provider', dest: 'alertingProvider', check: 'not-none' },
  {
    src: 'observability.alerting.provider',
    dest: 'hasAlerting',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'observability.alerting.channels', dest: 'alertingChannels', type: 'array-join' },
  { src: 'observability.tracing.provider', dest: 'tracingProvider', check: 'not-none' },
  { src: 'observability.tracing.provider', dest: 'hasTracing', type: 'boolean', check: 'not-none' },
  { src: 'observability.tracing.samplingRate', dest: 'tracingSamplingRate', type: 'string' },
  { src: 'observability.logging.centralised', dest: 'hasCentralisedLogging', type: 'boolean' },
  { src: 'observability.logging.retentionDays', dest: 'logRetentionDays', type: 'string' },
  { src: 'observability.logging.retentionDays', dest: 'loggingRetentionDays', type: 'string' },

  // Compliance
  { src: 'compliance.framework', dest: 'complianceFramework', check: 'not-none' },
  { src: 'compliance.framework', dest: 'hasCompliance', type: 'boolean', check: 'not-none' },
  { src: 'compliance.disasterRecovery.rpoHours', dest: 'drRpoHours', type: 'string' },
  { src: 'compliance.disasterRecovery.rtoHours', dest: 'drRtoHours', type: 'string' },
  { src: 'compliance.disasterRecovery.testSchedule', dest: 'drTestSchedule', check: 'not-none' },
  {
    src: 'compliance.disasterRecovery.backupSchedule',
    dest: 'drBackupSchedule',
    check: 'not-none',
  },
  { src: 'compliance.disasterRecovery.geoRedundancy', dest: 'hasGeoRedundancy', type: 'boolean' },
  { src: 'compliance.audit.enabled', dest: 'hasAudit', type: 'boolean' },
  { src: 'compliance.audit.appendOnly', dest: 'hasAppendOnlyAudit', type: 'boolean' },
  { src: 'compliance.audit.eventBus', dest: 'auditEventBus', check: 'not-none' },

  // Process
  { src: 'process.branchStrategy', dest: 'branchStrategy' },
  { src: 'process.protectedBranches', dest: 'protectedBranches', type: 'array-join' },
  { src: 'process.commitConvention', dest: 'commitConvention' },
  { src: 'process.codeReview', dest: 'codeReview' },
  { src: 'process.teamSize', dest: 'teamSize' },
  { src: 'process.issueTracker', dest: 'issueTracker', check: 'not-none' },
  { src: 'process.intake.ownerTeam', dest: 'intakeOwnerTeam', check: 'not-none' },
  { src: 'process.intake.operationsTeam', dest: 'intakeOperationsTeam', check: 'not-none' },
  { src: 'process.intake.cadence', dest: 'intakeCadence', check: 'not-none' },
  { src: 'process.intake.autoImport', dest: 'hasAutoImport', type: 'boolean' },

  // Testing
  { src: 'testing.unit', dest: 'testingUnit', type: 'array-join' },
  { src: 'testing.integration', dest: 'testingIntegration', type: 'array-join' },
  { src: 'testing.e2e', dest: 'testingE2e', type: 'array-join' },
  { src: 'testing.coverage', dest: 'testingCoverage', type: 'string' },
  { src: 'testing.mutation', dest: 'testingMutation', check: 'not-none' },
  { src: 'testing.mutation', dest: 'hasMutationTesting', type: 'boolean', check: 'not-none' },
  { src: 'testing.staticAnalysis', dest: 'testingStaticAnalysis', type: 'array-join' },
  { src: 'testing.staticAnalysis', dest: 'hasStaticAnalysis', type: 'boolean-array-length' },
  { src: 'testing.contractTesting', dest: 'testingContractTesting', check: 'not-none' },
  {
    src: 'testing.contractTesting',
    dest: 'hasContractTesting',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'testing.performanceTesting', dest: 'testingPerformanceTesting', check: 'not-none' },
  {
    src: 'testing.performanceTesting',
    dest: 'hasPerformanceTesting',
    type: 'boolean',
    check: 'not-none',
  },

  // Automation
  { src: 'automation.baselineProfile', dest: 'baselineProfile' },
  { src: 'automation.ciProfile', dest: 'ciProfile' },
  { src: 'automation.checks.codeql', dest: 'enableCodeql', type: 'boolean' },
  { src: 'automation.checks.semgrep', dest: 'enableSemgrep', type: 'boolean' },
  { src: 'automation.checks.dependencyAudit', dest: 'enableDependencyAudit', type: 'boolean' },
  { src: 'automation.languageProfile.mode', dest: 'languageProfileMode' },
  { src: 'automation.languageProfile.diagnostics', dest: 'languageProfileDiagnostics' },
  {
    src: 'automation.languageProfile.inferFrom.frameworks',
    dest: 'languageInferenceFromFrameworks',
    type: 'boolean',
  },
  {
    src: 'automation.languageProfile.inferFrom.tests',
    dest: 'languageInferenceFromTests',
    type: 'boolean',
  },
  {
    src: 'automation.languageProfile.scaffoldOverrides.alwaysRegenerate',
    dest: 'languageProfileScaffoldAlwaysRegenerate',
    type: 'array-join',
  },
  {
    src: 'automation.languageProfile.scaffoldOverrides.alwaysRegenerate',
    dest: 'hasLanguageProfileScaffoldAlwaysRegenerate',
    type: 'boolean-array-length',
  },
  {
    src: 'automation.languageProfile.scaffoldOverrides.scaffoldOnce',
    dest: 'languageProfileScaffoldOnce',
    type: 'array-join',
  },
  {
    src: 'automation.languageProfile.scaffoldOverrides.scaffoldOnce',
    dest: 'hasLanguageProfileScaffoldOnce',
    type: 'boolean-array-length',
  },

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
  {
    src: 'crosscutting.errorHandling.strategy',
    dest: 'hasErrorHandling',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'crosscutting.errorHandling.globalHandler', dest: 'hasGlobalHandler', type: 'boolean' },
  {
    src: 'crosscutting.errorHandling.customExceptions',
    dest: 'hasCustomExceptions',
    type: 'boolean',
  },

  // Authentication
  { src: 'crosscutting.authentication.provider', dest: 'authProvider', check: 'not-none' },
  {
    src: 'crosscutting.authentication.provider',
    dest: 'hasAuth',
    type: 'boolean',
    check: 'not-none',
  },
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
  {
    src: 'crosscutting.api.versioning',
    dest: 'hasApiVersioning',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'crosscutting.api.pagination', dest: 'apiPagination', check: 'not-none' },
  {
    src: 'crosscutting.api.pagination',
    dest: 'hasApiPagination',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'crosscutting.api.responseFormat', dest: 'apiResponseFormat' },
  { src: 'crosscutting.api.rateLimiting', dest: 'hasRateLimiting', type: 'boolean' },

  // Database
  { src: 'crosscutting.database.migrations', dest: 'dbMigrations', check: 'not-none' },
  {
    src: 'crosscutting.database.migrations',
    dest: 'hasDbMigrations',
    type: 'boolean',
    check: 'not-none',
  },
  { src: 'crosscutting.database.seeding', dest: 'hasDbSeeding', type: 'boolean' },
  {
    src: 'crosscutting.database.transactionStrategy',
    dest: 'dbTransactionStrategy',
    check: 'not-none',
  },
  { src: 'crosscutting.database.connectionPooling', dest: 'hasConnectionPooling', type: 'boolean' },

  // Performance
  { src: 'crosscutting.performance.lazyLoading', dest: 'hasLazyLoading', type: 'boolean' },
  {
    src: 'crosscutting.performance.imageOptimization',
    dest: 'hasImageOptimization',
    type: 'boolean',
  },
  { src: 'crosscutting.performance.bundleBudget', dest: 'bundleBudget', type: 'string' },

  // Feature Flags
  { src: 'crosscutting.featureFlags.provider', dest: 'featureFlagProvider', check: 'not-none' },
  {
    src: 'crosscutting.featureFlags.provider',
    dest: 'hasFeatureFlags',
    type: 'boolean',
    check: 'not-none',
  },

  // Environments
  { src: 'crosscutting.environments.naming', dest: 'envNames', type: 'array-join' },
  { src: 'crosscutting.environments.configStrategy', dest: 'envConfigStrategy', check: 'not-none' },
  { src: 'crosscutting.environments.envFilePattern', dest: 'envFilePattern' },

  // Branch Protection
  { src: 'branchProtection.requiredReviewCount', dest: 'bpRequiredReviewCount', type: 'string' },
  { src: 'branchProtection.dismissStaleReviews', dest: 'bpDismissStaleReviews', type: 'boolean' },
  {
    src: 'branchProtection.requireCodeOwnerReviews',
    dest: 'bpRequireCodeOwnerReviews',
    type: 'boolean',
  },
  {
    src: 'branchProtection.requireLastPushApproval',
    dest: 'bpRequireLastPushApproval',
    type: 'boolean',
  },
  { src: 'branchProtection.strictStatusChecks', dest: 'bpStrictStatusChecks', type: 'boolean' },
  { src: 'branchProtection.requiredStatusChecks', dest: 'bpRequiredStatusChecks', type: 'array' },
  { src: 'branchProtection.enforceAdmins', dest: 'bpEnforceAdmins', type: 'boolean' },
  {
    src: 'branchProtection.requiredLinearHistory',
    dest: 'bpRequiredLinearHistory',
    type: 'boolean',
  },
  { src: 'branchProtection.requireSignedCommits', dest: 'bpRequireSignedCommits', type: 'boolean' },
  { src: 'branchProtection.allowForcePushes', dest: 'bpAllowForcePushes', type: 'boolean' },
  { src: 'branchProtection.allowDeletions', dest: 'bpAllowDeletions', type: 'boolean' },
  { src: 'branchProtection.blockCreations', dest: 'bpBlockCreations', type: 'boolean' },
  {
    src: 'branchProtection.requiredConversationResolution',
    dest: 'bpRequiredConversationResolution',
    type: 'boolean',
  },
  { src: 'branchProtection.codeScanning.enabled', dest: 'bpCodeScanningEnabled', type: 'boolean' },
  { src: 'branchProtection.codeScanning.tools', dest: 'bpCodeScanningTools', type: 'array' },
  {
    src: 'branchProtection.copilotReview.enabled',
    dest: 'bpCopilotReviewEnabled',
    type: 'boolean',
  },
  {
    src: 'branchProtection.copilotReview.reviewNewPushes',
    dest: 'bpCopilotReviewNewPushes',
    type: 'boolean',
  },
  {
    src: 'branchProtection.copilotReview.reviewDraftPRs',
    dest: 'bpCopilotReviewDraftPRs',
    type: 'boolean',
  },
  {
    src: 'branchProtection.mergeStrategies.allowMergeCommits',
    dest: 'bpAllowMergeCommits',
    type: 'boolean',
  },
  {
    src: 'branchProtection.mergeStrategies.allowSquashMerge',
    dest: 'bpAllowSquashMerge',
    type: 'boolean',
  },
  {
    src: 'branchProtection.mergeStrategies.allowRebaseMerge',
    dest: 'bpAllowRebaseMerge',
    type: 'boolean',
  },
  {
    src: 'branchProtection.mergeStrategies.deleteBranchOnMerge',
    dest: 'bpDeleteBranchOnMerge',
    type: 'boolean',
  },
  {
    src: 'branchProtection.mergeStrategies.allowAutoMerge',
    dest: 'bpAllowAutoMerge',
    type: 'boolean',
  },
  { src: 'branchProtection.mergeQueue.enabled', dest: 'bpMergeQueueEnabled', type: 'boolean' },
  { src: 'branchProtection.mergeQueue.mergeMethod', dest: 'bpMergeQueueMethod', type: 'string' },
  {
    src: 'branchProtection.mergeQueue.minGroupSize',
    dest: 'bpMergeQueueMinGroupSize',
    type: 'string',
  },
  {
    src: 'branchProtection.mergeQueue.maxGroupSize',
    dest: 'bpMergeQueueMaxGroupSize',
    type: 'string',
  },

  // Evaluation
  { src: 'evaluation.infraEval', dest: 'hasInfraEval', type: 'boolean' },
  { src: 'evaluation.weights.reliability', dest: 'evalWeightReliability', type: 'string' },
  { src: 'evaluation.weights.cost', dest: 'evalWeightCost', type: 'string' },
  { src: 'evaluation.weights.security', dest: 'evalWeightSecurity', type: 'string' },
  { src: 'evaluation.weights.infra', dest: 'evalWeightInfra', type: 'string' },
  { src: 'evaluation.weights.scalability', dest: 'evalWeightScale', type: 'string' },
  { src: 'evaluation.weights.architecture', dest: 'evalWeightArch', type: 'string' },
  { src: 'evaluation.weights.code', dest: 'evalWeightCode', type: 'string' },
  { src: 'evaluation.weights.ops', dest: 'evalWeightOps', type: 'string' },
  { src: 'evaluation.customGates', dest: 'evalCustomGates', check: 'not-none' },

  // Scoring
  { src: 'scoring.enabled', dest: 'hasScoringEnabled', type: 'boolean' },
];

/**
 * Safely accesses a property from an object using a dot-notation path.
 */
export function get(obj, path) {
  return path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
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
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'string') return value;
      return undefined;
    case 'array-or-string':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'boolean-array-length':
      return Array.isArray(value) && value.length > 0;
    case 'array':
      return Array.isArray(value) ? value : undefined;
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
