/**
 * Retort — Template Utilities
 * Pure, synchronous helper functions for template rendering, data transformation,
 * header generation, and project-spec flattening. No file I/O.
 */
import { extname } from 'path';
import { PROJECT_MAPPING, get, transform, check } from './project-mapping.mjs';
import { computeProjectCompleteness as computeProjectCompletenessBase } from './project-completeness.mjs';

// ---------------------------------------------------------------------------
// Per-sync report collector
// Accumulates warnings/errors during a sync run for sync-report.json.
// Module-level so template helpers can push without threading a context object.
// ---------------------------------------------------------------------------

/** @type {{ unresolvedPlaceholders: Array<{file:string,vars:string[]}>, renderErrors: Array<{file:string,error:string}> }|null} */
let _syncReportCollector = null;

/** Call once at the start of each sync run to enable collection. */
export function startSyncReport() {
  _syncReportCollector = { unresolvedPlaceholders: [], renderErrors: [] };
}

/** Returns the collected data. Returns null if startSyncReport was not called. */
export function getSyncReportData() {
  return _syncReportCollector;
}

/** Resets the collector (called at the start of each sync run to clear prior state). */
export function resetSyncReport() {
  _syncReportCollector = null;
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

const RAW_TEMPLATE_VARS = new Set([
  'commandFlags',
  'agentConventions',
  'agentExamples',
  'teamAgentSummaries',
]);

/**
 * Checks whether a template variable should bypass shell sanitization.
 * Variables in the explicit set or ending with 'Json' are treated as raw
 * (they contain precomputed JSON that must not be escaped).
 */
function isRawTemplateVar(key) {
  return RAW_TEMPLATE_VARS.has(key) || key.endsWith('Json') || key.startsWith('shared_');
}

function isShellScriptTarget(targetPath) {
  const ext = extname(targetPath || '').toLowerCase();
  return ext === '.sh' || ext === '.ps1';
}

/**
 * Renders a template by:
 * 1. Resolving {{#if var}}...{{/if}} conditional blocks
 * 2. Resolving {{#each var}}...{{/each}} iteration blocks
 * 3. Replacing {{key}} placeholders with values from vars
 *
 * - Replaces longest keys first to prevent partial matches (e.g., {{versionInfo}} before {{version}})
 * - Sanitizes string values to prevent shell metacharacter injection
 * - Warns on unresolved placeholders
 */
/**
 * Applies Handlebars-style whitespace control (~) to template tags.
 *
 * A tilde inside a tag strips adjacent whitespace (including newlines):
 *   ~}} — strips all whitespace AFTER the tag (trailing spaces + one newline)
 *   {{~ — strips all whitespace BEFORE the tag (one newline + leading spaces)
 *
 * Supports all block tags: {{#if}}, {{/if}}, {{#unless}}, {{/unless}},
 * {{#each}}, {{/each}}, {{else}}.
 *
 * This runs as Phase 0 before any template resolution, converting tilde-
 * annotated tags into standard tags with whitespace already stripped.
 */
export function applyWhitespaceControl(template) {
  // Pattern matching the "body" of any block tag (openers with var, closers, else)
  const bodyPat = '(?:#(?:if|unless|each)\\s+[a-zA-Z_][a-zA-Z0-9_]*|\\/(?:if|unless|each)|else)';

  let result = template;

  // Pass 1: Right tilde — {{ body ~}} strips trailing whitespace + newline
  result = result.replace(
    new RegExp(`\\{\\{\\s*(${bodyPat})\\s*~\\}\\}[ \\t]*\\r?\\n?`, 'g'),
    (_, body) => `{{${body.trim()}}}`
  );

  // Pass 2: Left tilde — {{~ body }} strips preceding newline + whitespace
  result = result.replace(
    new RegExp(`\\r?\\n[ \\t]*\\{\\{~\\s*(${bodyPat})\\s*\\}\\}`, 'g'),
    (_, body) => `{{${body.trim()}}}`
  );

  return result;
}

export function renderTemplate(template, vars, targetPath = '') {
  // Phase 0: Apply whitespace control (Handlebars ~ syntax)
  let result = applyWhitespaceControl(template);
  const sanitizeStrings = isShellScriptTarget(targetPath);

  // Phase 1: Resolve {{#if var}}...{{/if}} blocks (supports nesting)
  result = resolveConditionals(result, vars);

  // Phase 2: Resolve {{#each var}}...{{/each}} blocks
  result = resolveEachBlocks(result, vars, sanitizeStrings);

  // Phase 3: Replace {{key}} placeholders
  result = replacePlaceholders(result, vars, sanitizeStrings, { filePath: targetPath });

  // Phase 4: Collapse excessive blank lines left by removed conditionals
  result = collapseBlankLines(result);

  return result;
}

/**
 * Collapses runs of 3+ consecutive blank lines down to a single blank line.
 * Preserves one blank line between sections (standard Markdown paragraph break).
 */
export function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, '\n\n');
}

/**
 * Replaces {{key}} placeholders with values from vars.
 * - Replaces longest keys first to prevent partial matches
 * - Sanitizes string values to prevent shell metacharacter injection
 * - Allows raw values for keys in RAW_TEMPLATE_VARS when allowRawVars is true
 * - Warns on unresolved placeholders
 */
export function replacePlaceholders(template, vars, sanitizeStrings = false, opts = {}) {
  let result = template;
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const value = vars[key];
    const placeholder = `{{${key}}}`;
    const safeValue =
      typeof value === 'string'
        ? sanitizeStrings && !isRawTemplateVar(key)
          ? sanitizeTemplateValue(value)
          : value
        : JSON.stringify(value);
    result = result.split(placeholder).join(safeValue);
  }

  // Resolve {{helperName varName}} helper syntax (e.g., {{escapeYamlString commandDescription}})
  result = resolveHelpers(result, vars);

  // Resolve {{var|default}} pipe syntax — uses the default value when var is unresolved
  result = result.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\|([^}]*)\}\}/g, (_match, key, fallback) => {
    const value = vars[key];
    let resolved;
    if (value === undefined || value === null) {
      resolved = fallback;
    } else if (typeof value === 'string') {
      resolved = value;
    } else {
      resolved = JSON.stringify(value);
    }
    if (sanitizeStrings && !isRawTemplateVar(key)) {
      return sanitizeTemplateValue(resolved);
    }
    return resolved;
  });

  // Warn about unresolved placeholders (ignore block syntax remnants, including {{else}})
  const unresolved = result.match(/\{\{(?!#|\/|else\}\})([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
  if (unresolved) {
    const unique = [...new Set(unresolved)];
    const loc = opts?.filePath ? ` in ${opts.filePath}` : '';
    console.warn(`[agentkit:sync] Warning: unresolved placeholders${loc}: ${unique.join(', ')}`);
    if (_syncReportCollector) {
      _syncReportCollector.unresolvedPlaceholders.push({
        file: opts?.filePath || '',
        vars: unique,
      });
    }
  }
  return result;
}

/**
 * Escapes a string for safe embedding in a YAML single-quoted value.
 * Single quotes are escaped by doubling them per the YAML spec.
 */
export function escapeYamlString(value) {
  if (value === undefined || value === null) return "''";
  const str = String(value);
  // Wrap in single quotes, escaping internal single quotes by doubling them
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Registry of template helpers. Each helper takes a string value and returns a transformed string.
 */
const TEMPLATE_HELPERS = {
  escapeYamlString,
};

/**
 * Resolves {{helperName varName}} helper expressions.
 * Matches patterns like {{escapeYamlString commandDescription}} where the helper
 * is a known function and the var is resolved from the vars object.
 */
export function resolveHelpers(template, vars) {
  const helperNames = Object.keys(TEMPLATE_HELPERS).join('|');
  if (!helperNames) return template;
  const regex = new RegExp(`\\{\\{(${helperNames})\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\}\\}`, 'g');
  const result = template.replace(regex, (_match, helperName, varName) => {
    const value = vars[varName];
    const helper = TEMPLATE_HELPERS[helperName];
    return helper(value);
  });

  // Warn about remaining helper-like syntax with unknown helper names
  const unknownHelperRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  let match;
  while ((match = unknownHelperRegex.exec(result)) !== null) {
    const [, candidateHelper] = match;
    // Skip built-in block helpers (if, each, else, etc.)
    if (['if', 'else', 'each', 'unless'].includes(candidateHelper)) continue;
    console.warn(
      `[template] Unknown helper '${candidateHelper}' in expression '${match[0]}' — did you mean one of: ${Object.keys(TEMPLATE_HELPERS).join(', ')}?`
    );
  }

  return result;
}

/**
 * Resolves {{#if var}}...{{/if}} conditional blocks.
 * A var is truthy if it exists in vars and is not null, undefined, false, empty string, or empty array.
 * Supports {{#if var}}...{{else}}...{{/if}} syntax.
 * Handles nested conditionals via innermost-first resolution.
 */
export function resolveConditionals(template, vars) {
  let result = template;
  // Process innermost #if blocks first (no nested #if inside)
  const ifRegex =
    /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}((?:(?!\{\{#if\s)(?!\{\{\/if\}\})[\s\S])*?)\{\{\/if\}\}/g;
  let safety = 50; // prevent infinite loops on malformed templates
  while (ifRegex.test(result) && safety-- > 0) {
    result = result.replace(ifRegex, (_, varName, body) => {
      const isTruthy = evalTruthy(vars[varName]);
      // Split only on the first {{else}} to avoid matching multiple occurrences
      const elseMarker = '{{else}}';
      const elseIndex = body.indexOf(elseMarker);
      if (elseIndex === -1) {
        return isTruthy ? body : '';
      }
      return isTruthy ? body.slice(0, elseIndex) : body.slice(elseIndex + elseMarker.length);
    });
    ifRegex.lastIndex = 0;
  }
  // Warn if safety limit was hit and there are still unresolved {{#if}} blocks
  if (safety <= 0) {
    ifRegex.lastIndex = 0;
    if (ifRegex.test(result)) {
      console.warn(
        'resolveConditionals: safety limit reached while processing template. ' +
          'Template may contain malformed or deeply nested {{#if}} blocks; output may be partially rendered.'
      );
    }
  }

  // Process {{#unless var}}...{{/unless}} blocks (inverted #if).
  // Supports nesting via innermost-first resolution (same strategy as #if above).
  const unlessRegex =
    /\{\{#unless\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}((?:(?!\{\{#unless\s)(?!\{\{\/unless\}\})[\s\S])*?)\{\{\/unless\}\}/g;
  let unlessSafety = 50;
  while (unlessRegex.test(result) && unlessSafety-- > 0) {
    result = result.replace(unlessRegex, (_, varName, body) => {
      const isTruthy = evalTruthy(vars[varName]);
      const elseMarker = '{{else}}';
      const elseIndex = body.indexOf(elseMarker);
      if (elseIndex === -1) {
        return isTruthy ? '' : body;
      }
      return isTruthy ? body.slice(elseIndex + elseMarker.length) : body.slice(0, elseIndex);
    });
    unlessRegex.lastIndex = 0;
  }

  return result;
}

/**
 * Resolves {{#each var}}...{{/each}} iteration blocks.
 * Inside the block, {{.}} refers to the current item (for string arrays).
 * For object arrays, {{.name}}, {{.purpose}} etc. access properties.
 */
export function resolveEachBlocks(template, vars, sanitizeStrings = false) {
  const eachRegex = /\{\{#each\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  return template.replace(eachRegex, (_, varName, body) => {
    const arr = vars[varName];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr
      .map((item, index) => {
        let rendered = body;
        // Replace {{.}} with the item itself (for string arrays)
        if (typeof item === 'string') {
          rendered = rendered
            .split('{{.}}')
            .join(sanitizeStrings ? sanitizeTemplateValue(item) : item);
        } else if (typeof item === 'object' && item !== null) {
          // Replace {{.prop}} with item.prop
          rendered = rendered.replace(/\{\{\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (__, prop) => {
            const val = item[prop];
            if (val === undefined || val === null) return '';
            return typeof val === 'string'
              ? sanitizeStrings
                ? sanitizeTemplateValue(val)
                : val
              : JSON.stringify(val);
          });
        }
        // Replace {{@index}} with current index
        rendered = rendered.split('{{@index}}').join(String(index));
        return rendered;
      })
      .join('');
  });
}

/**
 * Evaluates whether a template variable is "truthy" for {{#if}} blocks.
 * Falsy: undefined, null, false, '', 0, empty array []
 * Truthy: everything else (including 'none' — use explicit checks in templates)
 */
export function evalTruthy(value) {
  if (value === undefined || value === null || value === false || value === '' || value === 0)
    return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Flattens a project.yaml object into a flat key→value map suitable for template rendering.
 * Uses a declarative mapping configuration for cleaner code.
 */
export function flattenProjectYaml(project, docsSpec = null) {
  if (!project || typeof project !== 'object') return {};
  const vars = {};

  // Apply declarative mappings
  for (const mapping of PROJECT_MAPPING) {
    const value = get(project, mapping.src);
    if (check(value, mapping.check)) {
      const transformed = transform(value, mapping.type);
      if (transformed !== undefined) {
        vars[mapping.dest] = transformed;
      }
    }
  }

  // --- Post-processing / Complex derivations ---

  // githubOwner — org or user from githubSlug (e.g. "JustAGhosT/repo" → "JustAGhosT")
  if (vars.githubSlug && typeof vars.githubSlug === 'string' && vars.githubSlug.includes('/')) {
    vars.githubOwner = vars.githubSlug.split('/')[0];
  }

  // hasAnyPattern
  vars.hasAnyPattern =
    vars.hasPatternRepository ||
    vars.hasPatternCqrs ||
    vars.hasPatternEventSourcing ||
    vars.hasPatternMediator ||
    vars.hasPatternUnitOfWork;

  // docsSpec overlay for PRD
  const prdSpec = docsSpec?.specialDirectories?.find((d) => d.id === 'prd');
  if (prdSpec) {
    vars.hasPrd = true;
    if (!vars.prdPath) vars.prdPath = prdSpec.path;
  }

  // hasAnyInfraConfig
  vars.hasAnyInfraConfig =
    !!vars.infraNamingConvention ||
    !!vars.infraDefaultRegion ||
    !!vars.infraOrg ||
    !!vars.infraIacToolchain ||
    !!vars.infraStateBackend ||
    !!vars.infraMandatoryTags;

  // hasAnyMonitoring
  vars.hasAnyMonitoring =
    !!vars.monitoringProvider ||
    !!vars.alertingProvider ||
    !!vars.tracingProvider ||
    !!vars.hasCentralisedLogging;

  // hasDr
  vars.hasDr =
    !!vars.drRpoHours || !!vars.drRtoHours || !!vars.drBackupSchedule || vars.hasGeoRedundancy;

  // hasAnyComplianceConfig
  vars.hasAnyComplianceConfig =
    !!vars.complianceFramework ||
    !!vars.drRpoHours ||
    !!vars.drRtoHours ||
    !!vars.drBackupSchedule ||
    !!vars.auditEventBus;

  // Integrations (kept as array for {{#each}})
  if (Array.isArray(project.integrations)) {
    vars.integrations = project.integrations;
    vars.hasIntegrations = project.integrations.length > 0;
  }

  // Infrastructure tags (kept as arrays for {{#each}} in IaC templates)
  const normaliseTags = (arr) =>
    [
      ...new Set(
        arr
          .filter((t) => typeof t === 'string')
          .map((t) => t.trim())
          .filter(Boolean)
      ),
    ].sort();
  const mandatoryTags = project?.infrastructure?.tagging?.mandatory;
  if (Array.isArray(mandatoryTags) && mandatoryTags.length > 0) {
    vars.infraMandatoryTagsList = normaliseTags(mandatoryTags);
  }
  const optionalTags = project?.infrastructure?.tagging?.optional;
  if (Array.isArray(optionalTags) && optionalTags.length > 0) {
    vars.infraOptionalTagsList = normaliseTags(optionalTags);
  }

  // Language detection booleans (derived from stack.languages array)
  const langs = Array.isArray(project?.stack?.languages)
    ? project.stack.languages
        .filter((l) => typeof l === 'string')
        .map((l) => l.trim().toLowerCase())
    : [];
  const frontendFrameworks = Array.isArray(project?.stack?.frameworks?.frontend)
    ? project.stack.frameworks.frontend
        .filter((f) => typeof f === 'string')
        .map((f) => f.trim().toLowerCase())
    : [];
  const backendFrameworks = Array.isArray(project?.stack?.frameworks?.backend)
    ? project.stack.frameworks.backend
        .filter((f) => typeof f === 'string')
        .map((f) => f.trim().toLowerCase())
    : [];
  const unitTestTools = Array.isArray(project?.testing?.unit)
    ? project.testing.unit.filter((t) => typeof t === 'string').map((t) => t.trim().toLowerCase())
    : [];

  vars.hasLanguageTypeScript = langs.some((l) => l === 'typescript' || l === 'ts');
  vars.hasLanguageJavaScript = langs.some((l) => l === 'javascript' || l === 'js');
  vars.hasLanguageJsLike = vars.hasLanguageTypeScript || vars.hasLanguageJavaScript;
  vars.hasLanguageRust = langs.includes('rust');
  vars.hasLanguagePython = langs.includes('python');
  vars.hasLanguageDotnet = langs.some((l) => ['csharp', 'c#', 'dotnet', '.net'].includes(l));
  vars.hasLanguageBlockchain = langs.some((l) => ['solidity', 'blockchain'].includes(l));
  vars.hasLanguageGo = langs.some((l) => l === 'go' || l === 'golang');
  vars.hasLanguageJava = langs.includes('java');

  // Package manager — derived helper variables
  const pm = (vars.packageManager || 'pnpm').toLowerCase();
  vars.packageManager = pm;
  vars.pmInstall =
    pm === 'yarn'
      ? 'yarn install --frozen-lockfile'
      : pm === 'npm'
        ? 'npm ci'
        : 'pnpm install --frozen-lockfile';
  vars.pmRun = pm === 'yarn' ? 'yarn' : pm === 'npm' ? 'npm run' : 'pnpm';
  vars.pmExec = pm === 'yarn' ? 'yarn' : pm === 'npm' ? 'npx' : 'pnpm';
  vars.pmLockfile =
    pm === 'yarn' ? 'yarn.lock' : pm === 'npm' ? 'package-lock.json' : 'pnpm-lock.yaml';
  vars.pmCacheKey = pm === 'yarn' ? 'yarn' : pm === 'npm' ? 'npm' : 'pnpm';
  vars.isPnpm = pm === 'pnpm';
  vars.isNpm = pm === 'npm';
  vars.isYarn = pm === 'yarn';

  const languageProfileMode = (project?.automation?.languageProfile?.mode || 'hybrid')
    .trim()
    .toLowerCase();
  vars.languageProfileMode = ['configured', 'hybrid', 'heuristic'].includes(languageProfileMode)
    ? languageProfileMode
    : 'hybrid';

  const languageProfileDiagnostics = (
    project?.automation?.languageProfile?.diagnostics || 'verbose'
  )
    .trim()
    .toLowerCase();
  vars.languageProfileDiagnostics = ['off', 'minimal', 'verbose'].includes(
    languageProfileDiagnostics
  )
    ? languageProfileDiagnostics
    : 'verbose';
  vars.showLanguageProfileDiagnostics = vars.languageProfileDiagnostics !== 'off';
  vars.showLanguageProfileDiagnosticsVerbose = vars.languageProfileDiagnostics === 'verbose';

  vars.languageInferenceFromFrameworks =
    project?.automation?.languageProfile?.inferFrom?.frameworks !== false;
  vars.languageInferenceFromTests =
    project?.automation?.languageProfile?.inferFrom?.tests !== false;
  vars.hasLanguageInferenceSignalsEnabled =
    vars.languageInferenceFromFrameworks || vars.languageInferenceFromTests;

  const normalizeRelativePathList = (value) => {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value
          .filter((item) => typeof item === 'string')
          .map((item) => item.trim().replace(/\\/g, '/'))
          .filter(Boolean)
      ),
    ];
  };

  vars.languageProfileScaffoldAlwaysRegenerateList = normalizeRelativePathList(
    project?.automation?.languageProfile?.scaffoldOverrides?.alwaysRegenerate
  );
  vars.languageProfileScaffoldOnceList = normalizeRelativePathList(
    project?.automation?.languageProfile?.scaffoldOverrides?.scaffoldOnce
  );

  // Test suite scaffolding opt-in: disabled by default to prevent retort from
  // writing test files into adopter repos (GH#422).
  vars.testingExamplesEnabled = project?.automation?.testingExamples === true;

  const hasConfiguredLanguages = langs.length > 0;
  vars.hasConfiguredLanguages = hasConfiguredLanguages;

  const hasNodeFrameworkSignalRaw = [...frontendFrameworks, ...backendFrameworks].some((f) =>
    ['node.js', 'express', 'next.js', 'next', 'react', 'nestjs'].includes(f)
  );
  const hasPythonFrameworkSignalRaw = [...frontendFrameworks, ...backendFrameworks].some((f) =>
    ['fastapi', 'flask', 'django'].includes(f)
  );
  const hasDotnetFrameworkSignalRaw = [...frontendFrameworks, ...backendFrameworks].some((f) =>
    ['asp.net-core', '.net', 'dotnet'].includes(f)
  );
  const hasRustFrameworkSignalRaw = [...frontendFrameworks, ...backendFrameworks].some((f) =>
    ['actix', 'rocket', 'axum'].includes(f)
  );

  const hasJsTestSignalRaw = unitTestTools.some((t) => ['vitest', 'jest', 'mocha'].includes(t));
  const hasPythonTestSignalRaw = unitTestTools.some((t) => ['pytest'].includes(t));
  const hasDotnetTestSignalRaw = unitTestTools.some((t) =>
    ['xunit', 'nunit', 'mstest'].includes(t)
  );
  const hasRustTestSignalRaw = unitTestTools.some((t) => ['cargo-test'].includes(t));

  const hasNodeFrameworkSignal = vars.languageInferenceFromFrameworks && hasNodeFrameworkSignalRaw;
  const hasPythonFrameworkSignal =
    vars.languageInferenceFromFrameworks && hasPythonFrameworkSignalRaw;
  const hasDotnetFrameworkSignal =
    vars.languageInferenceFromFrameworks && hasDotnetFrameworkSignalRaw;
  const hasRustFrameworkSignal = vars.languageInferenceFromFrameworks && hasRustFrameworkSignalRaw;

  const hasJsTestSignal = vars.languageInferenceFromTests && hasJsTestSignalRaw;
  const hasPythonTestSignal = vars.languageInferenceFromTests && hasPythonTestSignalRaw;
  const hasDotnetTestSignal = vars.languageInferenceFromTests && hasDotnetTestSignalRaw;
  const hasRustTestSignal = vars.languageInferenceFromTests && hasRustTestSignalRaw;

  vars.hasLanguageJsLikeInferred = hasNodeFrameworkSignal || hasJsTestSignal;
  vars.hasLanguagePythonInferred = hasPythonFrameworkSignal || hasPythonTestSignal;
  vars.hasLanguageDotnetInferred = hasDotnetFrameworkSignal || hasDotnetTestSignal;
  vars.hasLanguageRustInferred = hasRustFrameworkSignal || hasRustTestSignal;

  if (vars.languageProfileMode === 'configured') {
    vars.hasLanguageJsLikeEffective = hasConfiguredLanguages && vars.hasLanguageJsLike;
    vars.hasLanguagePythonEffective = hasConfiguredLanguages && vars.hasLanguagePython;
    vars.hasLanguageDotnetEffective = hasConfiguredLanguages && vars.hasLanguageDotnet;
    vars.hasLanguageRustEffective = hasConfiguredLanguages && vars.hasLanguageRust;
  } else if (vars.languageProfileMode === 'heuristic') {
    vars.hasLanguageJsLikeEffective = vars.hasLanguageJsLikeInferred;
    vars.hasLanguagePythonEffective = vars.hasLanguagePythonInferred;
    vars.hasLanguageDotnetEffective = vars.hasLanguageDotnetInferred;
    vars.hasLanguageRustEffective = vars.hasLanguageRustInferred;
  } else {
    vars.hasLanguageJsLikeEffective = hasConfiguredLanguages
      ? vars.hasLanguageJsLike
      : vars.hasLanguageJsLikeInferred;
    vars.hasLanguagePythonEffective = hasConfiguredLanguages
      ? vars.hasLanguagePython
      : vars.hasLanguagePythonInferred;
    vars.hasLanguageDotnetEffective = hasConfiguredLanguages
      ? vars.hasLanguageDotnet
      : vars.hasLanguageDotnetInferred;
    vars.hasLanguageRustEffective = hasConfiguredLanguages
      ? vars.hasLanguageRust
      : vars.hasLanguageRustInferred;
  }

  const hasAnyInferredLanguage =
    vars.hasLanguageJsLikeInferred ||
    vars.hasLanguagePythonInferred ||
    vars.hasLanguageDotnetInferred ||
    vars.hasLanguageRustInferred;

  const hasInferenceMismatch =
    vars.hasLanguageJsLikeInferred !== vars.hasLanguageJsLike ||
    vars.hasLanguagePythonInferred !== vars.hasLanguagePython ||
    vars.hasLanguageDotnetInferred !== vars.hasLanguageDotnet ||
    vars.hasLanguageRustInferred !== vars.hasLanguageRust;

  const hasLanguageInferenceMismatchRaw = hasConfiguredLanguages && hasInferenceMismatch;
  const hasLanguageInferenceUsedRaw =
    vars.languageProfileMode === 'configured'
      ? false
      : vars.languageProfileMode === 'heuristic'
        ? hasAnyInferredLanguage
        : !hasConfiguredLanguages && hasAnyInferredLanguage;

  vars.hasLanguageInferenceMismatchRaw = hasLanguageInferenceMismatchRaw;
  vars.hasLanguageInferenceUsedRaw = hasLanguageInferenceUsedRaw;
  vars.hasLanguageInferenceMismatch = vars.showLanguageProfileDiagnostics
    ? hasLanguageInferenceMismatchRaw
    : false;
  vars.hasLanguageInferenceUsed = vars.showLanguageProfileDiagnostics
    ? hasLanguageInferenceUsedRaw
    : false;

  if (vars.languageProfileMode === 'configured') {
    vars.languageInferenceSource = hasConfiguredLanguages ? 'configured' : 'none';
    vars.languageInferenceConfidence = hasConfiguredLanguages ? 'high' : 'low';
  } else if (vars.languageProfileMode === 'heuristic') {
    vars.languageInferenceSource = hasAnyInferredLanguage ? 'heuristic' : 'none';
    vars.languageInferenceConfidence = hasAnyInferredLanguage ? 'medium' : 'low';
  } else if (hasConfiguredLanguages) {
    vars.languageInferenceSource = hasAnyInferredLanguage ? 'mixed' : 'configured';
    vars.languageInferenceConfidence = 'high';
  } else if (hasAnyInferredLanguage) {
    vars.languageInferenceSource = 'heuristic';
    vars.languageInferenceConfidence = 'medium';
  } else {
    vars.languageInferenceSource = 'none';
    vars.languageInferenceConfidence = 'low';
  }

  // --- Defaults for workflow-critical placeholders ---
  // Prevents unresolved {{placeholders}} from producing invalid YAML in generated workflows.
  if (!vars.nodeVersion) vars.nodeVersion = '22';
  if (!vars.pythonVersion) vars.pythonVersion = '3.12';
  if (!vars.docsHistoryPath) vars.docsHistoryPath = 'docs/history';

  return vars;
}

/**
 * Flattens the crosscutting section of project.yaml into template vars.
 * @deprecated - Merged into flattenProjectYaml via declarative mappings.
 * Kept exported for test compatibility if any tests import it directly.
 */
export function flattenCrosscutting(cc, vars) {
  // Delegate to main flatten function by wrapping cc in a project-like structure
  // This is a backward compatibility shim.
  const tempProject = { crosscutting: cc };
  const mapped = flattenProjectYaml(tempProject);

  // Copy mapped crosscutting vars into the target vars object
  // Filter out keys that don't belong to crosscutting to avoid noise
  for (const [key, val] of Object.entries(mapped)) {
    if (
      key !== 'hasAnyPattern' &&
      key !== 'hasAnyInfraConfig' &&
      key !== 'hasAnyMonitoring' &&
      key !== 'hasDr' &&
      key !== 'hasAnyComplianceConfig'
    ) {
      vars[key] = val;
    }
  }
}

/**
 * Sanitizes a template variable value to prevent injection.
 * Strips shell metacharacters that could cause command injection if the
 * rendered output is executed in a shell context (e.g., hook scripts).
 */
export function sanitizeTemplateValue(value) {
  let s = value;
  s = s.replace(/\$\([^)]*\)/g, (m) => m.slice(2, -1));
  s = s.replace(/[`$\\;|&<>!{}]/g, '');
  return s;
}

export function formatCommandFlags(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return '';
  const rows = flags.map(
    (f) =>
      `| \`${f.name || ''}\` | ${(f.description || '').replace(/\|/g, '\\|')} | ${f.default !== undefined && f.default !== null ? String(f.default) : '—'} |`
  );
  return ['| Flag | Description | Default |', '|------|-------------|---------|', ...rows].join(
    '\n'
  );
}

// ---------------------------------------------------------------------------
// Header generation
// ---------------------------------------------------------------------------

export function getGeneratedHeader(version, repoName, ext, vars = {}) {
  const comment = getCommentStyle(ext);
  if (!comment) return '';
  const suffix = comment.end ? ` ${comment.end}` : '';
  const pm = vars.packageManager || 'pnpm';
  const syncCmd =
    pm === 'npm' ? 'npm run --prefix .agentkit retort:sync' : `${pm} --dir .agentkit retort:sync`;
  return [
    `${comment.start} GENERATED by Retort v${version} — DO NOT EDIT${suffix}`,
    `${comment.start} Source: .agentkit/spec + .agentkit/overlays/${repoName}${suffix}`,
    `${comment.start} Regenerate: ${syncCmd}${suffix}`,
    '',
  ].join('\n');
}

export function getCommentStyle(ext) {
  switch (ext) {
    case '.md':
    case '.mdc':
      return { start: '<!--', end: '-->' };
    case '.json':
    case '.template':
      return null; // JSON / template files don't support comments
    case '.yml':
    case '.yaml':
      return { start: '#', end: '' };
    case '.sh':
      return { start: '#', end: '' };
    case '.ps1':
      return { start: '#', end: '' };
    case '':
      return { start: '#', end: '' }; // files like "cursorrules"
    default:
      return { start: '#', end: '' };
  }
}

/**
 * Returns true only if the legacy "GENERATED by AgentKit Forge" header
 * appears AT THE START of the file (after an optional shebang and blank
 * lines). This avoids false positives on files that merely reference
 * the string in their body text (e.g. rules docs), which would cause
 * infinite recursion in insertHeader.
 */
function startsWithLegacyHeader(content) {
  const lines = content.split('\n');
  let i = 0;
  if (lines[i] && lines[i].startsWith('#!')) i++; // skip shebang
  while (i < lines.length && lines[i].trim() === '') i++; // skip blank lines
  return i < lines.length && lines[i].includes('GENERATED by AgentKit Forge');
}

/**
 * Inserts a generated header into file content.
 * - Skip if already has header
 * - Insert after shebang for .sh/.ps1 files
 * - Insert after frontmatter (---...---) for .md/.mdc files
 * - Return unchanged for .json/.template files
 */
export function insertHeader(content, ext, version, repoName) {
  const header = getGeneratedHeader(version, repoName, ext);
  if (!header) return content; // JSON / template — no comment syntax
  if (content.includes('GENERATED by Retort')) return content; // already present (current)

  // Replace legacy AgentKit Forge header with current Retort header rather than
  // prepending a second header — keeps generated files clean after the rename.
  //
  // IMPORTANT: check that the legacy header is at the START of the file, not
  // merely mentioned in body text (e.g. rules docs that reference the string).
  // Using content.includes() would trigger on body references and cause
  // infinite recursion because the stripped content still contains the string.
  if (startsWithLegacyHeader(content)) {
    const lines = content.split('\n');
    const commentPrefixes = ['<!--', '# ', '// ', '/* '];
    let i = 0;
    let shebangLine = null;
    // Shebang lines (#!) start with '#!' not '# ', so skip them before
    // the comment-stripping loop to avoid stopping at i=0.
    if (lines[0] && lines[0].startsWith('#!')) {
      shebangLine = lines[0];
      i = 1;
    }
    while (i < lines.length && commentPrefixes.some((p) => lines[i].startsWith(p))) {
      i++;
    }
    const strippedBody = lines.slice(i).join('\n').replace(/^\n+/, '');
    const strippedContent = shebangLine ? shebangLine + '\n' + strippedBody : strippedBody;
    // Re-run insertHeader on the stripped content to get the correct insertion point
    return insertHeader(strippedContent, ext, version, repoName);
  }

  const normalizedExt = ext.toLowerCase();

  if (normalizedExt === '.sh' || normalizedExt === '.ps1') {
    // Insert after shebang line
    if (content.startsWith('#!')) {
      const newlineIdx = content.indexOf('\n');
      if (newlineIdx !== -1) {
        return content.slice(0, newlineIdx + 1) + header + content.slice(newlineIdx + 1);
      }
    }
    return header + content;
  }

  if (normalizedExt === '.md' || normalizedExt === '.mdc') {
    // Insert after frontmatter if present
    if (content.startsWith('---')) {
      const closingMarker = '\n---';
      const endFrontmatter = content.indexOf(closingMarker, 3);
      if (endFrontmatter !== -1) {
        const afterClose = endFrontmatter + closingMarker.length;
        // Include the trailing newline after --- so header is on its own line,
        // then add a blank line to separate front-matter from the generated comment.
        const insertPos = content[afterClose] === '\n' ? afterClose + 1 : afterClose;
        return content.slice(0, insertPos) + '\n' + header + content.slice(insertPos);
      }
    }
    return header + content;
  }

  return header + content;
}

// ---------------------------------------------------------------------------
// Template frontmatter parsing
// ---------------------------------------------------------------------------

/**
 * Parses optional YAML frontmatter from a template string.
 * Supports the `agentkit.scaffold` directive: always | managed | once.
 * Frontmatter is stripped from the content before rendering so it never
 * appears in generated output.
 *
 * @param {string} template - Raw template content
 * @returns {{ meta: object|null, content: string }}
 */
export function parseTemplateFrontmatter(template) {
  if (!template.startsWith('---')) return { meta: null, content: template };

  const closingIdx = template.indexOf('\n---', 3);
  if (closingIdx === -1) return { meta: null, content: template };

  const yamlBlock = template.slice(4, closingIdx).trim();
  const afterClose = closingIdx + 4; // past "\n---"
  const content =
    afterClose < template.length && template[afterClose] === '\n'
      ? template.slice(afterClose + 1)
      : template.slice(afterClose);

  // Simple nested key-value parser (no YAML dependency).
  // Supports one level of nesting: `agentkit:\n  scaffold: always`
  const meta = {};
  let currentSection = null;
  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (!val) {
        currentSection = key;
        meta[currentSection] = {};
      } else {
        meta[key] = val;
        currentSection = null;
      }
    } else if (currentSection && trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      meta[currentSection][key] = val;
    }
  }

  return { meta, content };
}

// ---------------------------------------------------------------------------
// Scaffold-once file detection
// ---------------------------------------------------------------------------

// Project-owned files: generated once as scaffolds, then owned by the consuming repo.
// Sync will NOT overwrite these if they already exist at the destination.
const SCAFFOLD_ONCE_ROOT_FILES = new Set([
  'AGENT_BACKLOG.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'MIGRATIONS.md',
  'SECURITY.md',
  '.editorconfig',
  '.prettierrc',
  '.markdownlint.json',
]);

const SCAFFOLD_ONCE_DIRS = [
  'docs/',
  '.vscode/',
  '.github/ISSUE_TEMPLATE/',
  '.github/instructions/',
];

// GitHub root files that are scaffold-once (matched by full relative path)
const SCAFFOLD_ONCE_GITHUB_FILES = new Set([
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/CODEOWNERS',
]);

// Test suite paths that are never scaffolded into adopter repos unless
// `automation.testingExamples: true` is set in project.yaml.
// Matches directory prefixes and common test config file names.
const SCAFFOLD_NEVER_TEST_DIRS = [
  'tests/',
  '__tests__/',
  'test/',
  'cypress/',
  'playwright/',
  'e2e/',
  'spec/',
];

const SCAFFOLD_NEVER_TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.[jt]sx?$/,
  /\.test\.py$/,
  /_test\.py$/,
  /\.test\.rs$/,
  /vitest\.config\.[jt]sx?$/,
  /jest\.config\.[jt]sx?$/,
  /playwright\.config\.[jt]sx?$/,
  /cypress\.config\.[jt]sx?$/,
];

/**
 * Returns true if the relative path looks like a test suite file that should
 * not be scaffolded into adopter repos by default.
 */
export function isTestSuitePath(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  for (const dir of SCAFFOLD_NEVER_TEST_DIRS) {
    if (normalized.startsWith(dir) || normalized.includes(`/${dir}`)) return true;
  }
  for (const pattern of SCAFFOLD_NEVER_TEST_FILE_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}

/**
 * Check if a relative path is a scaffold-once file (project-owned content).
 * These are only written on first sync; subsequent syncs skip them if they exist.
 */
export function isScaffoldOnce(relPath, vars = {}) {
  // Normalize Windows backslashes to forward slashes for consistent matching
  const normalized = relPath.replace(/\\/g, '/');

  const alwaysRegenerate = new Set(vars.languageProfileScaffoldAlwaysRegenerateList || []);
  const forceScaffoldOnce = new Set(vars.languageProfileScaffoldOnceList || []);

  if (alwaysRegenerate.has(normalized)) return false;
  if (forceScaffoldOnce.has(normalized)) return true;

  if (SCAFFOLD_ONCE_ROOT_FILES.has(normalized)) return true;
  if (SCAFFOLD_ONCE_GITHUB_FILES.has(normalized)) return true;
  for (const dir of SCAFFOLD_ONCE_DIRS) {
    if (normalized.startsWith(dir)) return true;
  }
  return false;
}

/**
 * Determines the write action for a file during sync, combining template-level
 * frontmatter directives with directory-level scaffold-once rules.
 *
 * @param {string} relPath - Relative path from project root
 * @param {object} vars - Template variables (may contain override lists)
 * @param {object|null} templateMeta - Parsed frontmatter from the template
 * @returns {'write'|'skip'|'check-hash'} The action to take during atomic swap
 */
export function resolveScaffoldAction(relPath, vars = {}, templateMeta = null) {
  const scaffold = templateMeta?.agentkit?.scaffold;

  // Template-level directives take highest priority
  if (scaffold === 'always') return 'write';
  if (scaffold === 'managed') return 'check-hash';
  if (scaffold === 'once') return 'skip';
  // adopt-if-missing: write only when the destination does not yet exist.
  // Same runtime behaviour as 'skip' but tracked separately in scaffoldResults
  // so the sync report can distinguish intentional adoption from path-derived once.
  if (scaffold === 'adopt-if-missing') return 'adopt-if-missing';

  // Test suite guard: skip test files unless the adopter has opted in.
  // Set `automation.testingExamples: true` in project.yaml to allow scaffolding.
  if (isTestSuitePath(relPath) && !vars.testingExamplesEnabled) return 'skip';

  // Fall through to existing isScaffoldOnce logic
  if (isScaffoldOnce(relPath, vars)) return 'skip';
  return 'write';
}

// ---------------------------------------------------------------------------
// Diff and output helpers
// ---------------------------------------------------------------------------

export function simpleDiff(a, b) {
  const aLines = a.split(/\r?\n/);
  const bLines = b.split(/\r?\n/);
  const out = [];
  const maxLen = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < maxLen; i++) {
    const al = aLines[i];
    const bl = bLines[i];
    if (al === undefined) out.push(`+ ${bl || ''}`);
    else if (bl === undefined) out.push(`- ${al}`);
    else if (al !== bl) {
      out.push(`- ${al}`);
      out.push(`+ ${bl}`);
    }
  }
  return out.slice(0, 20).join('\n') + (out.length > 20 ? '\n...' : '');
}

/**
 * Merges two permissions objects. Each has `allow` and `deny` arrays.
 * Union both lists with deduplication.
 */
export function mergePermissions(base, overlay) {
  const allow = [...new Set([...(base.allow || []), ...(overlay.allow || [])])];
  const deny = [...new Set([...(base.deny || []), ...(overlay.deny || [])])];
  return { allow, deny };
}

// ---------------------------------------------------------------------------
// Render target resolution
// ---------------------------------------------------------------------------

/**
 * All available render targets.
 */
export const ALL_RENDER_TARGETS = [
  'claude',
  'cursor',
  'windsurf',
  'ai',
  'copilot',
  'gemini',
  'codex',
  'warp',
  'cline',
  'roo',
  'mcp',
];

/**
 * Resolves which render targets to generate.
 * - If flags?.only is set, split by comma, trim, filter empty.
 * - If overlayTargets is a non-empty array, return Set(overlayTargets).
 * - Otherwise return Set(ALL_RENDER_TARGETS).
 */
export function resolveRenderTargets(overlayTargets, flags) {
  if (flags?.only) {
    return new Set(
      flags.only
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    );
  }
  if (Array.isArray(overlayTargets) && overlayTargets.length > 0) {
    return new Set(overlayTargets);
  }
  return new Set(ALL_RENDER_TARGETS);
}

/**
 * Categorizes a file by its path prefix.
 */
export function categorizeFile(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm.startsWith('.claude/')) return 'claude';
  if (norm.startsWith('.cursor/')) return 'cursor';
  if (norm.startsWith('.windsurf/')) return 'windsurf';
  if (norm.startsWith('.github/')) return 'github';
  if (norm.startsWith('.gemini/')) return 'gemini';
  if (norm.startsWith('.agents/')) return 'codex';
  if (norm.startsWith('.clinerules/')) return 'cline';
  if (norm.startsWith('.roo/')) return 'roo';
  if (norm.startsWith('.ai/')) return 'ai';
  if (norm.startsWith('.mcp/')) return 'mcp';
  if (norm.startsWith('docs/')) return 'docs';
  if (norm.startsWith('.vscode/')) return 'vscode';
  if (norm === 'GEMINI.md') return 'gemini';
  if (norm === 'WARP.md') return 'warp';
  if (norm === 'CLAUDE.md') return 'claude';
  return 'root';
}

/**
 * Prints a sync summary to console. Skip if opts.quiet.
 */
export function printSyncSummary(fileSummary, targets, opts) {
  if (opts?.quiet) return;
  const total = Object.values(fileSummary).reduce((s, c) => s + c, 0);
  console.log(`[agentkit:sync] Summary: ${total} file(s) across ${[...targets].join(', ')}`);
  for (const [cat, count] of Object.entries(fileSummary).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
}

/**
 * Computes project.yaml completeness.
 * Returns { total, present, percent, missing }.
 */
export function computeProjectCompleteness(projectSpec) {
  return computeProjectCompletenessBase(projectSpec, { profile: 'generation' });
}

// ---------------------------------------------------------------------------
// Domain filtering — kit-based selection
// ---------------------------------------------------------------------------

/**
 * Rule domains that are always included regardless of stack.
 * These are cross-cutting concerns relevant to every project.
 */
const UNIVERSAL_DOMAINS = new Set([
  'security',
  'testing',
  'git-workflow',
  'documentation',
  'ci-cd',
  'dependency-management',
  'agent-conduct',
  'template-protection',
]);

/**
 * Maps effective language vars (from template-utils vars) to rule domain IDs.
 * Only domains that require a specific language presence are listed here;
 * UNIVERSAL_DOMAINS are always included.
 */
const LANGUAGE_DOMAIN_MAP = [
  ['hasLanguageJsLikeEffective', 'typescript'],
  ['hasLanguageDotnetEffective', 'dotnet'],
  ['hasLanguagePythonEffective', 'python'],
  ['hasLanguageRustEffective', 'rust'],
  ['hasLanguageBlockchain', 'blockchain'],
  ['hasInfra', 'iac'],
];

/**
 * Filters the rule domains from rules.yaml based on the project's active
 * language stack and optional explicit override in project.yaml.
 *
 * Resolution order (highest priority first):
 *   1. `domains.rules` in project.yaml — explicit list, overrides everything
 *   2. `languageProfile.mode === 'heuristic'` — include all (legacy behaviour)
 *   3. Language-based auto-filter using effective language vars
 *      + opt-in features (aiCostOps, finops)
 *
 * @param {object[]} rules - Array of rule domain objects from rules.yaml
 * @param {object}   vars  - Flattened template vars (from flattenProjectYaml)
 * @param {object}   project - Raw project.yaml spec
 * @returns {object[]} Filtered array of rule domain objects
 */
export function filterDomainsByStack(rules, vars, project) {
  if (!Array.isArray(rules)) return [];

  // 1. Explicit override: domains.rules in project.yaml takes precedence
  const explicit = project?.domains?.rules;
  if (Array.isArray(explicit)) {
    const allowed = new Set(explicit);
    return rules.filter((r) => allowed.has(r.domain));
  }

  // 2. Heuristic mode: include all domains (backward-compatible legacy behaviour)
  if (vars.languageProfileMode === 'heuristic') {
    return rules;
  }

  // 3. Auto-filter: start with universal domains, add language-specific ones
  const activeDomains = new Set(UNIVERSAL_DOMAINS);
  for (const [varName, domain] of LANGUAGE_DOMAIN_MAP) {
    if (vars[varName]) activeDomains.add(domain);
  }

  // Opt-in via project.yaml features block
  if (project?.features?.aiCostOps) activeDomains.add('ai-cost-ops');
  if (project?.features?.finops) activeDomains.add('finops');

  return rules.filter((r) => activeDomains.has(r.domain));
}

/**
 * Filters tech stacks to those whose primary language is active in the project.
 * Unknown/unrecognised stacks are kept to avoid silently dropping future stacks.
 *
 * @param {object[]} stacks - Array of tech stack objects (each with a `name` field)
 * @param {object}   vars   - Flattened template vars
 * @returns {object[]} Filtered array of tech stack objects
 */
export function filterTechStacks(stacks, vars) {
  if (!Array.isArray(stacks)) return [];
  // In heuristic mode keep everything (legacy behaviour)
  if (vars.languageProfileMode === 'heuristic') return stacks;
  return stacks.filter((s) => {
    const name = (s.name || '').toLowerCase();
    if (name === 'node' || name === 'typescript' || name === 'javascript') {
      return vars.hasLanguageJsLikeEffective;
    }
    if (name === 'dotnet' || name === '.net' || name === 'csharp') {
      return vars.hasLanguageDotnetEffective;
    }
    if (name === 'rust') return vars.hasLanguageRustEffective;
    if (name === 'python') return vars.hasLanguagePythonEffective;
    return true; // unknown stack — keep by default
  });
}
