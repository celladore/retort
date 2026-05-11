/**
 * Retort — Synchronize Command
 * Reads spec + overlay → renders templates → writes generated AI-tool configuration outputs.
 * Main file operations (mkdir, writeFile, readdir, cp) use async fs/promises.
 * readYaml/readText use synchronous fs APIs for simplicity at startup.
 * Pure template helpers live in template-utils.mjs.
 */
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import { tmpdir } from 'os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'path';
import {
  filterByTier,
  mergeThemeIntoSettings,
  resolveColor,
  resolveThemeMapping,
  validateBrandSpec,
  validateThemeSpec,
} from './brand-resolver.mjs';
import {
  buildFeatureVars,
  buildHookFeatureMap,
  loadFeatureSpec,
  resolveFeatures,
} from './feature-manager.mjs';
import { ensureDir, runConcurrent, walkDir, writeOutput } from './fs-utils.mjs';
import {
  cleanStaleFiles,
  clearTemplateMeta,
  runPostSyncPrettier,
  setTemplateMeta,
  writeManifest,
  writeScaffoldOutputs,
} from './scaffold-engine.mjs';
import {
  categorizeFile,
  computeProjectCompleteness,
  filterDomainsByStack,
  flattenProjectYaml,
  insertHeader,
  isScaffoldOnce,
  mergePermissions,
  parseTemplateFrontmatter,
  printSyncSummary,
  renderTemplate,
  resolveRenderTargets,
  simpleDiff,
  getSyncReportData,
  startSyncReport,
} from './template-utils.mjs';
import { applyRetortConfig, loadRetortConfig } from './retort-config.mjs';
import {
  buildAgentRegistry,
  buildAgentVars,
  buildAreaRoutingTable,
  buildBranchProtectionJson,
  buildBrowserTestingVars,
  buildCollaboratorsSection,
  buildCommandVars,
  buildRuleVars,
  buildTeamsList,
  buildTeamVars,
  formatConventionLine,
  getTeamCommandStem,
  inferTestingCoverage,
  isFeatureEnabled,
  isItemFeatureEnabled,
  resolveCommandPath,
  resolveTeamAgents,
} from './var-builders.mjs';
import { clearTemplateTextCache } from './spec-loader.mjs';
import { resolveOverlaySelection } from './overlay-resolver.mjs';
import {
  syncA2aConfig,
  syncAgentAnalysis,
  syncAgentRegistry,
  syncAgentsMd,
  syncClineRules,
  syncClaudeAgents,
  syncClaudeCommands,
  syncClaudeHooks,
  syncClaudeMd,
  syncClaudeSettings,
  syncClaudeSkills,
  syncCodexSkills,
  syncCopilot,
  syncCopilotAgents,
  syncCopilotChatModes,
  syncCopilotPrompts,
  syncCursorCommands,
  syncCursorTeams,
  syncDirectCopy,
  syncEditorConfigs,
  syncEditorTheme,
  syncGemini,
  syncJunie,
  syncGitattributes,
  syncGitHub,
  syncLanguageInstructions,
  syncOrgMetaSkills,
  syncRooRules,
  syncRootDocs,
  syncScripts,
  syncUnknownSkillsReport,
  syncWarp,
  syncWindsurfCommands,
  syncWindsurfTeams,
} from './platform-syncer.mjs';

// templateMetaMap, getTemplateMeta, setTemplateMeta, clearTemplateMeta
// live in scaffold-engine.mjs (imported above).

// getTeamCommandStem, resolveCommandPath, buildTeamVars, buildAgentVars, and all
// variable-builder helpers live in var-builders.mjs (imported above).
// Re-export the previously public names for backward compatibility with external callers.
export {
  buildAgentRegistry,
  buildBranchProtectionJson,
  buildCollaboratorsSection,
  buildRuleVars,
  buildTeamsList,
  formatConventionLine,
  resolveCommandPath,
  resolveTeamAgents,
} from './var-builders.mjs';

// threeWayMerge and normalizeForComparison live in scaffold-merge.mjs (used by scaffold-engine.mjs)

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

export function readYaml(filePath) {
  if (!existsSync(filePath)) return null;
  return yaml.load(readFileSync(filePath, 'utf-8'));
}

export function readText(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf-8');
}

/**
 * Loads the agents spec from either a directory of per-category YAML files
 * (.agentkit/spec/agents/) or the monolithic agents.yaml fallback.
 *
 * Directory format: each file is a map { <categoryKey>: [...agents] }.
 * The filename stem is used as the category key and must match the top-level key.
 */
export function loadAgentsSpec(agentkitRoot) {
  const agentsDir = resolve(agentkitRoot, 'spec', 'agents');
  if (existsSync(agentsDir)) {
    const merged = { agents: {} };
    const files = readdirSync(agentsDir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      .sort();
    for (const file of files) {
      const parsed = readYaml(resolve(agentsDir, file));
      if (!parsed || typeof parsed !== 'object') continue;
      for (const [category, agents] of Object.entries(parsed)) {
        if (!Array.isArray(agents)) continue;
        merged.agents[category] = (merged.agents[category] || []).concat(agents);
      }
    }
    return merged;
  }
  return readYaml(resolve(agentkitRoot, 'spec', 'agents.yaml')) || {};
}

/**
 * Loads spec-defaults.yaml from the given agentkit root and returns a merged
 * defaults object based on the current phase and teamSize.
 *
 * Merge precedence within spec-defaults (highest → lowest):
 *   teamSize block > phase block > static defaults
 *
 * Returns an empty object when spec-defaults.yaml is not present (backward-compatible).
 *
 * @param {string} agentkitRoot
 * @param {{ phase?: string, teamSize?: string }} context
 * @returns {Record<string, unknown>}
 */
export function loadSpecDefaults(agentkitRoot, context = {}) {
  const specDefaultsPath = resolve(agentkitRoot, 'spec', 'spec-defaults.yaml');
  const raw = readYaml(specDefaultsPath);
  if (!raw) return {};

  // Start with static defaults (omit the conditional blocks)
  const { phase: phaseBlock, teamSize: teamSizeBlock, ...staticDefaults } = raw;

  let merged = { ...staticDefaults };

  // Apply phase-conditional overrides
  const phase = context.phase;
  if (phase && phaseBlock?.[phase]) {
    merged = { ...merged, ...phaseBlock[phase] };
  }

  // Apply teamSize-conditional overrides (highest priority within spec-defaults)
  const teamSize = context.teamSize;
  if (teamSize && teamSizeBlock?.[teamSize]) {
    merged = { ...merged, ...teamSizeBlock[teamSize] };
  }

  return merged;
}

// runConcurrent, ensureDir, writeOutput, walkDir live in fs-utils.mjs (imported above)
// Re-export for any external callers that imported from synchronize.mjs directly.
export { ensureDir, runConcurrent, walkDir, writeOutput };
export { syncDirectCopy } from './platform-syncer.mjs';

// HOOK_FEATURE_MAP is derived at sync time from features.yaml affectsTemplates
// via buildHookFeatureMap(). See syncClaudeHooks() for usage.

// ---------------------------------------------------------------------------
// Main sync orchestration
// ---------------------------------------------------------------------------

export async function runSync({ agentkitRoot, projectRoot, flags }) {
  const dryRun = flags?.['dry-run'] || false;
  const diff = flags?.diff || false;
  const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  const quiet = flags?.quiet ?? (isTestEnv && !diff);
  const verbose = flags?.verbose || false;
  const noClean = flags?.['no-clean'] || false;

  // Clear module-level state from any previous run (e.g. in tests)
  clearTemplateMeta();
  clearTemplateTextCache();

  const log = (...args) => {
    if (!quiet) console.log(...args);
  };
  const logVerbose = (...args) => {
    if (verbose && !quiet) console.log(...args);
  };

  // --- Pre-sync commit guard ---
  // Warns or blocks when protected directories have uncommitted changes.
  // Skipped for --force, --dry-run, --diff, and test environments.
  if (!flags?.force && !dryRun && !diff && !isTestEnv) {
    let checkDirtyProtectedFiles, promptDirtyFileAction;
    try {
      ({ checkDirtyProtectedFiles, promptDirtyFileAction } = await import('./sync-guard.mjs'));
    } catch (err) {
      log(`[retort:sync] Warning: could not load sync-guard: ${err?.message ?? err}`);
    }
    const { dirty, files } = checkDirtyProtectedFiles
      ? checkDirtyProtectedFiles(projectRoot, [
          '.agentkit/engines',
          '.agentkit/overlays',
          '.agentkit/bin',
        ])
      : { dirty: false, files: [] };
    if (dirty) {
      const isTTY = process.stdout.isTTY && process.stdin.isTTY;
      if (isTTY) {
        const action = await promptDirtyFileAction(files);
        if (action === 'abort') {
          log('[retort:sync] Aborted — commit or stash your changes first.');
          return;
        }
        // 'stash' handled inside promptDirtyFileAction; 'continue' falls through
      } else {
        console.warn('[retort:sync] Warning: uncommitted changes in protected directories:');
        for (const f of files) console.warn(`  ${f}`);
      }
    }
  }

  if (dryRun) {
    log('[retort:sync] Dry-run mode — no files will be written.');
  }
  if (diff) {
    log('[retort:sync] Diff mode — showing what would change.');
  }
  log('[retort:sync] Starting sync...');

  // 1. Load spec — version from package.json (primary) with VERSION file as fallback
  let version = '0.0.0';
  try {
    const pkg = JSON.parse(readFileSync(resolve(agentkitRoot, 'package.json'), 'utf-8'));
    version = pkg.version || version;
  } catch {
    version = readText(resolve(agentkitRoot, 'spec', 'VERSION'))?.trim() || version;
  }
  const teamsSpec = readYaml(resolve(agentkitRoot, 'spec', 'teams.yaml')) || {};
  const commandsSpec = readYaml(resolve(agentkitRoot, 'spec', 'commands.yaml')) || {};
  const rulesSpec = readYaml(resolve(agentkitRoot, 'spec', 'rules.yaml')) || {};
  const settingsSpec = readYaml(resolve(agentkitRoot, 'spec', 'settings.yaml')) || {};
  const agentsSpec = loadAgentsSpec(agentkitRoot);
  const skillsSpec = readYaml(resolve(agentkitRoot, 'spec', 'skills.yaml')) || {};
  const docsSpec = readYaml(resolve(agentkitRoot, 'spec', 'docs.yaml')) || {};
  const sectionsSpec = readYaml(resolve(agentkitRoot, 'spec', 'sections.yaml')) || {};
  const projectSpec = readYaml(resolve(agentkitRoot, 'spec', 'project.yaml'));

  // 2. Detect overlay
  const overlaySelection = resolveOverlaySelection(agentkitRoot, projectRoot, flags);
  const repoName = overlaySelection.repoName;
  log(`[retort:sync] Using overlay: ${repoName} (${overlaySelection.reason})`);

  // 3. Load overlay
  const overlayDir = resolve(agentkitRoot, 'overlays', repoName);
  const overlaySettings = readYaml(resolve(overlayDir, 'settings.yaml')) || {};

  // Merge settings (data-level: union allow, union deny, deny wins)
  const mergedPermissionsResult = mergePermissions(
    settingsSpec.permissions || {},
    overlaySettings.permissions || {}
  );

  // Template variables — start with project.yaml flat vars, then overlay with core vars
  const projectVars = projectSpec ? flattenProjectYaml(projectSpec, docsSpec) : {};

  // Resolve enabled features from spec + overlay settings
  let featureVars = {};
  let hookFeatureMap = { specific: {}, defaultFeature: null };
  try {
    const { features, presets } = loadFeatureSpec(agentkitRoot, { log });
    const enabledFeatures = resolveFeatures(features, overlaySettings, presets, { log });
    featureVars = buildFeatureVars(features, enabledFeatures);
    hookFeatureMap = buildHookFeatureMap(features);
    log(`[retort:sync] Features: ${enabledFeatures.size} / ${features.length} enabled`);
  } catch {
    // features.yaml may not exist yet in older repos — degrade gracefully
    log('[retort:sync] Features: spec not found, all features assumed enabled');
  }

  const teamsIntake = teamsSpec?.intake || {};
  const processIntake = projectSpec?.process?.intake || {};
  const intakeEscalation = processIntake.escalation || teamsIntake.escalation || {};
  const securityEscalationTeams = Array.isArray(intakeEscalation.securityCritical)
    ? intakeEscalation.securityCritical.join(', ')
    : '';
  const blockedEscalationTeams = Array.isArray(intakeEscalation.blockedCrossTeam)
    ? intakeEscalation.blockedCrossTeam.join(', ')
    : '';

  // Load spec-defaults.yaml (lowest-priority defaults; project.yaml always wins)
  const specDefaultVars = loadSpecDefaults(agentkitRoot, {
    phase: projectSpec?.process?.phase,
    teamSize: projectSpec?.process?.teamSize,
  });

  // Merge spec-defaults with project vars — project.yaml wins, but fall back to
  // spec-defaults for any variable that is undefined, null, or empty string.
  // Boolean false and 0 are valid values and must not be dropped.
  const mergedDefaults = { ...specDefaultVars };
  for (const [key, value] of Object.entries(projectVars)) {
    if (value !== undefined && value !== null && value !== '') {
      mergedDefaults[key] = value;
    }
  }

  const vars = {
    ...mergedDefaults,
    ...featureVars,
    intakeOwnerTeam:
      projectVars.intakeOwnerTeam || processIntake.ownerTeam || teamsIntake.ownerTeam || 'product',
    intakeOperationsTeam:
      projectVars.intakeOperationsTeam ||
      processIntake.operationsTeam ||
      teamsIntake.operationsTeam ||
      'quality',
    intakeCadence: projectVars.intakeCadence || processIntake.cadence || 'daily',
    intakeSecurityEscalationTeams: securityEscalationTeams,
    intakeBlockedEscalationTeams: blockedEscalationTeams,
    intakeAreaRoutingTable: buildAreaRoutingTable(teamsIntake),
    version,
    overlayTemplatesDir: resolve(overlayDir, 'templates'),
    repoName:
      (overlaySettings.repoName === '__TEMPLATE__' && projectSpec?.name) ||
      overlaySettings.repoName ||
      repoName,
    defaultBranch: overlaySettings.defaultBranch || 'main',
    integrationBranch: overlaySettings.integrationBranch || overlaySettings.defaultBranch || 'main',
    primaryStack: overlaySettings.primaryStack || 'auto',
    commandPrefix: overlaySettings.commandPrefix || null,
    // syncDateMode controls {{syncDate}} in generated headers (issue #417).
    // 'run' (default) — today's date; causes churn on every sync
    // 'version'       — the spec VERSION; stable until the spec changes
    // 'none'          — empty string; removes the date field entirely
    syncDate: (() => {
      const mode = overlaySettings.syncDateMode ?? settingsSpec.sync?.dateMode ?? 'run';
      if (mode === 'none') return '';
      if (mode === 'version') return version || '';
      return new Date().toISOString().slice(0, 10);
    })(),
    // autoSyncOnPush controls whether the pre-push hook runs agentkit sync
    // before every push (issue #410). Defaults to false; opt-in per repo.
    autoSyncOnPush: overlaySettings.autoSyncOnPush ?? settingsSpec.sync?.autoSyncOnPush ?? false,
    // skillsCategorised opts the repo into the layered skills layout:
    //   .claude/skills/<category>/<name>/SKILL.md
    //   .agents/skills/<category>/<name>/SKILL.md
    // Default false for backwards compatibility — flat layout under the skills/ dir.
    skillsCategorised:
      overlaySettings.skills?.categorised ?? settingsSpec.skills?.categorised ?? false,
    lastModel: process.env.AGENTKIT_LAST_MODEL || 'sync-engine',
    lastAgent: process.env.AGENTKIT_LAST_AGENT || 'retort',
    // Branch protection defaults — ensure generated scripts produce valid
    // JSON even when project.yaml omits the branchProtection section.
    bpRequiredReviewCount: projectVars.bpRequiredReviewCount ?? '1',
    bpDismissStaleReviews: projectVars.bpDismissStaleReviews ?? true,
    bpRequireCodeOwnerReviews: projectVars.bpRequireCodeOwnerReviews ?? true,
    bpRequireLastPushApproval: projectVars.bpRequireLastPushApproval ?? false,
    bpStrictStatusChecks: projectVars.bpStrictStatusChecks ?? true,
    bpEnforceAdmins: projectVars.bpEnforceAdmins ?? false,
    bpRequiredLinearHistory: projectVars.bpRequiredLinearHistory ?? true,
    bpRequireSignedCommits: projectVars.bpRequireSignedCommits ?? false,
    bpAllowForcePushes: projectVars.bpAllowForcePushes ?? false,
    bpAllowDeletions: projectVars.bpAllowDeletions ?? false,
    bpBlockCreations: projectVars.bpBlockCreations ?? false,
    bpRequiredConversationResolution: projectVars.bpRequiredConversationResolution ?? true,
    bpCodeScanningEnabled: projectVars.bpCodeScanningEnabled ?? false,
    bpCopilotReviewEnabled: projectVars.bpCopilotReviewEnabled ?? false,
    bpCopilotReviewNewPushes: projectVars.bpCopilotReviewNewPushes ?? false,
    bpCopilotReviewDraftPRs: projectVars.bpCopilotReviewDraftPRs ?? false,
    bpAllowMergeCommits: projectVars.bpAllowMergeCommits ?? false,
    bpAllowSquashMerge: projectVars.bpAllowSquashMerge ?? true,
    bpAllowRebaseMerge: projectVars.bpAllowRebaseMerge ?? false,
    bpDeleteBranchOnMerge: projectVars.bpDeleteBranchOnMerge ?? true,
    bpAllowAutoMerge: projectVars.bpAllowAutoMerge ?? false,
    bpMergeQueueEnabled: projectVars.bpMergeQueueEnabled ?? false,
    bpMergeQueueMethod: projectVars.bpMergeQueueMethod || 'squash',
    bpMergeQueueMinGroupSize: projectVars.bpMergeQueueMinGroupSize ?? '1',
    bpMergeQueueMaxGroupSize: projectVars.bpMergeQueueMaxGroupSize ?? '5',
  };

  // Heuristic fallbacks for commonly-used variables that lack {{#if}} guards
  if (!vars.testingCoverage && projectSpec?.phase) {
    vars.testingCoverage = inferTestingCoverage(projectSpec.phase);
  }

  // Browser/crawler MCP server flags — derived from testing.e2e in project.yaml.
  // Injected here so all templates (including mcp/servers.json) can use {{#if usesPlaywright}}
  // and {{#if usesBrowser}} to conditionally include the right MCP server entry.
  const browserVars = buildBrowserTestingVars(projectSpec);
  vars.usesPlaywright = browserVars.usesPlaywright;
  vars.usesBrowser = browserVars.usesBrowser;

  // Precomputed JSON strings for branch protection — avoids {{#each}} comma
  // issues inside JSON heredocs. These render as valid JSON array literals.
  const bpJson = buildBranchProtectionJson(vars);
  vars.bpRequiredStatusChecksJson = bpJson.statusChecksJson;
  vars.bpCodeScanningToolsJson = bpJson.scanningToolsJson;

  // Inject brand identity into template vars when brand guide exists
  if (vars.hasBrandGuide) {
    const brandSpec = readYaml(resolve(agentkitRoot, 'spec', 'brand.yaml'));
    if (brandSpec) {
      vars.brandName = brandSpec.identity?.name || '';
      vars.brandPrimaryColor = resolveColor(brandSpec.colors?.primary?.brand) || '';
      vars.brandCoralColor = resolveColor(brandSpec.colors?.primary?.coral) || '';
      vars.brandTealColor = resolveColor(brandSpec.colors?.primary?.teal) || '';
      vars.brandAccentColor = resolveColor(brandSpec.colors?.primary?.accent) || '';
      vars.brandDarkColor = resolveColor(brandSpec.colors?.primary?.dark) || '';
      vars.brandSurfaceColor = resolveColor(brandSpec.colors?.primary?.surface) || '';
      vars.brandMono = brandSpec.typography?.mono || '';
    }
  }

  // Inject shared sections from sections.yaml — feature-gated reusable blocks.
  // Each section key becomes a template var: shared_<key>.
  // If the section has a `gate` field, the var is populated only when that
  // feature is enabled; otherwise the var is set to empty string.
  for (const [key, section] of Object.entries(sectionsSpec.sections || {})) {
    const gate = section.gate;
    const isGateEnabled = !gate || vars[gate];
    vars[`shared_${key}`] = isGateEnabled ? section.content || '' : '';
  }

  // Load .retortconfig from the project root and apply overrides into vars.
  // This must happen after the base vars are assembled so that .retortconfig
  // can selectively override feature flags without replacing the full feature set.
  try {
    const retortConfig = loadRetortConfig(projectRoot);
    if (retortConfig) {
      // Collect known agent IDs so we can warn on unmapped entries
      const knownAgentIds = Object.values(agentsSpec.agents || {})
        .flat()
        .map((a) => a.id)
        .filter(Boolean);
      applyRetortConfig(vars, retortConfig, { log, warn: log, agentIds: knownAgentIds });

      // Apply feature flag overrides from .retortconfig into the feature vars.
      // disabledFeatures: re-resolve after adding .retortconfig exclusions.
      if (vars.retortDisabledFeatures?.size || vars.retortEnabledFeatures?.size) {
        try {
          const { features: featureList, presets } = loadFeatureSpec(agentkitRoot, { log });
          // Build merged overlay settings with .retortconfig feature adjustments
          const mergedOverlaySettings = { ...overlaySettings };
          if (vars.retortDisabledFeatures?.size) {
            const existingDisabled = new Set(overlaySettings.disabledFeatures || []);
            for (const id of vars.retortDisabledFeatures) existingDisabled.add(id);
            mergedOverlaySettings.disabledFeatures = [...existingDisabled];
          }
          if (vars.retortEnabledFeatures?.size) {
            const existingEnabled = new Set(overlaySettings.enabledFeatures || []);
            for (const id of vars.retortEnabledFeatures) existingEnabled.add(id);
            mergedOverlaySettings.enabledFeatures = [...existingEnabled];
          }
          const enabledFeaturesWithOverrides = resolveFeatures(
            featureList,
            mergedOverlaySettings,
            presets,
            { log }
          );
          const updatedFeatureVars = buildFeatureVars(featureList, enabledFeaturesWithOverrides);
          // Merge updated feature vars back into vars (feature vars start with 'has')
          Object.assign(vars, updatedFeatureVars);
          log(
            `[retort] .retortconfig feature overrides applied (${vars.retortDisabledFeatures?.size ?? 0} disabled, ${vars.retortEnabledFeatures?.size ?? 0} force-enabled)`
          );
        } catch (featErr) {
          log(
            `[retort] Warning: could not apply .retortconfig feature overrides: ${featErr.message}`
          );
        }
      }

      if (vars.retortAgentMap && Object.keys(vars.retortAgentMap).length > 0) {
        log(`[retort] .retortconfig agent remaps: ${Object.keys(vars.retortAgentMap).join(', ')}`);
      }
      if (vars.retortDisabledAgents?.size) {
        log(`[retort] .retortconfig disabled agents: ${[...vars.retortDisabledAgents].join(', ')}`);
      }
    }
  } catch (configErr) {
    // Surface validation errors as fatal — a malformed .retortconfig is a user error
    throw configErr;
  }

  // Teams list for root templates (AGENT_TEAMS.md {{#each}} iteration)
  const rawTeams = teamsSpec?.teams || [];
  vars.teamsList = buildTeamsList(rawTeams);
  vars.hasTeams = rawTeams.length > 0;

  // Filter rule domains to those matching the active language stack.
  // Universal domains (security, testing, git-workflow, etc.) are always included.
  // heuristic mode keeps all domains for backward compatibility.
  // An explicit `domains.rules` list in project.yaml overrides auto-detection.
  const filteredRulesSpec = {
    ...rulesSpec,
    rules: filterDomainsByStack(rulesSpec.rules, vars, projectSpec),
  };

  // Resolve render targets — determines which tool outputs to generate
  let targets = resolveRenderTargets(overlaySettings.renderTargets, flags);

  log(`[retort:sync] Repo: ${vars.repoName}, Version: ${version}`);
  if (flags?.only) {
    log(`[retort:sync] Syncing only: ${[...targets].join(', ')}`);
  }

  // 4. Render templates to temp directory
  const tmpDir = await mkdtemp(join(tmpdir(), 'agentkit-sync-'));

  const templatesDir = resolve(agentkitRoot, 'templates');

  try {
    // Use vars.repoName for file headers (resolved project name, e.g. "agentkit-forge")
    // rather than the raw overlay dir name which may be "__TEMPLATE__".
    const headerRepoName = vars.repoName;

    // --- Always-on outputs (not gated by renderTargets) ---
    // These run even with --only because they're framework-level infrastructure:
    // - AGENTS.md, root docs — always needed regardless of tool target
    // - .gitattributes merge drivers — repo-wide, not tool-specific
    // - .vscode/settings.json, editor configs — workspace-level, not tool-specific
    const alwaysOnTasks = [
      syncAgentsMd(templatesDir, tmpDir, vars, version, headerRepoName),
      syncRootDocs(templatesDir, tmpDir, vars, version, headerRepoName),
      syncGitattributes(tmpDir, projectRoot, version),
      syncDirectCopy(
        templatesDir,
        vars.overlayTemplatesDir,
        'vscode',
        tmpDir,
        '.vscode',
        vars,
        version,
        headerRepoName
      ),
    ];

    // Feature-gated always-on outputs (no render-target gate, but feature-gated)
    if (isFeatureEnabled('ci-automation', vars)) {
      alwaysOnTasks.push(syncGitHub(templatesDir, tmpDir, vars, version, headerRepoName));
    }
    if (isFeatureEnabled('doc-scaffolding', vars)) {
      alwaysOnTasks.push(
        syncDirectCopy(
          templatesDir,
          vars.overlayTemplatesDir,
          'docs',
          tmpDir,
          'docs',
          vars,
          version,
          headerRepoName
        )
      );
    }
    if (isFeatureEnabled('dependency-management', vars)) {
      alwaysOnTasks.push(syncEditorConfigs(templatesDir, tmpDir, vars, version, headerRepoName));
    }
    if (isFeatureEnabled('doc-scaffolding', vars)) {
      alwaysOnTasks.push(syncScripts(templatesDir, tmpDir, vars, version, headerRepoName));
    }

    await Promise.all(alwaysOnTasks);

    // --- Editor theme (must run after vscode template copy to merge into settings) ---
    // Scaffold-once: per-output target — only skip targets that already exist in projectRoot
    const forceTheme = flags?.overwrite || flags?.force;
    if (forceTheme) {
      await syncEditorTheme(agentkitRoot, tmpDir, vars, log, flags);
    } else {
      const themeSpec = readYaml(resolve(agentkitRoot, 'spec', 'editor-theme.yaml'));
      const outputs = themeSpec?.outputs || { vscode: '.vscode/settings.json' };
      const existingOutputs = new Set();
      for (const [, outputPath] of Object.entries(outputs)) {
        if (outputPath && existsSync(resolve(projectRoot, outputPath))) {
          existingOutputs.add(outputPath);
        }
      }
      if (existingOutputs.size < Object.keys(outputs).length) {
        await syncEditorTheme(agentkitRoot, tmpDir, vars, log, flags, existingOutputs);
      } else {
        log(
          '[retort:sync] Editor theme: all output targets exist (scaffold-once) — skipping. Use --overwrite to regenerate.'
        );
      }
    }

    // --- Build agent registry (used by persona collaborators + REGISTRY files) ---
    const agentRegistry = buildAgentRegistry(agentsSpec);

    // --- Gated by renderTargets ---
    const gatedTasks = [];

    if (targets.has('claude')) {
      gatedTasks.push(
        syncClaudeHooks(templatesDir, tmpDir, vars, version, headerRepoName, hookFeatureMap),
        syncClaudeSettings(
          templatesDir,
          tmpDir,
          vars,
          version,
          mergedPermissionsResult,
          settingsSpec
        ),
        syncClaudeCommands(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          teamsSpec,
          commandsSpec,
          agentsSpec
        ),
        syncClaudeAgents(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          agentsSpec,
          filteredRulesSpec,
          agentRegistry
        ),
        syncAgentRegistry(tmpDir, agentsSpec, version, headerRepoName),
        syncDirectCopy(
          templatesDir,
          vars.overlayTemplatesDir,
          'claude/state',
          tmpDir,
          '.agentkit/state',
          vars,
          version,
          headerRepoName
        ),
        syncClaudeMd(templatesDir, tmpDir, vars, version, headerRepoName),
        syncClaudeSkills(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec)
      );
      if (isFeatureEnabled('coding-rules', vars)) {
        gatedTasks.push(
          syncDirectCopy(
            templatesDir,
            vars.overlayTemplatesDir,
            'claude/rules',
            tmpDir,
            '.claude/rules',
            vars,
            version,
            headerRepoName
          ),
          syncLanguageInstructions(
            templatesDir,
            tmpDir,
            vars,
            version,
            headerRepoName,
            filteredRulesSpec,
            '.claude/rules/languages',
            'claude'
          )
        );
      }
    }

    if (targets.has('cursor')) {
      gatedTasks.push(
        syncCursorTeams(templatesDir, tmpDir, vars, version, headerRepoName, teamsSpec, agentsSpec),
        syncCursorCommands(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec)
      );
      if (isFeatureEnabled('coding-rules', vars)) {
        gatedTasks.push(
          syncDirectCopy(
            templatesDir,
            vars.overlayTemplatesDir,
            'cursor/rules',
            tmpDir,
            '.cursor/rules',
            vars,
            version,
            headerRepoName
          ),
          syncLanguageInstructions(
            templatesDir,
            tmpDir,
            vars,
            version,
            headerRepoName,
            filteredRulesSpec,
            '.cursor/rules/languages',
            'cursor'
          )
        );
      }
    }

    if (targets.has('windsurf')) {
      gatedTasks.push(
        syncWindsurfCommands(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec),
        syncDirectCopy(
          templatesDir,
          vars.overlayTemplatesDir,
          'windsurf/workflows',
          tmpDir,
          '.windsurf/workflows',
          vars,
          version,
          headerRepoName
        ),
        syncWindsurfTeams(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          teamsSpec,
          agentsSpec
        )
      );
      if (isFeatureEnabled('coding-rules', vars)) {
        gatedTasks.push(
          syncDirectCopy(
            templatesDir,
            vars.overlayTemplatesDir,
            'windsurf/rules',
            tmpDir,
            '.windsurf/rules',
            vars,
            version,
            headerRepoName
          ),
          syncLanguageInstructions(
            templatesDir,
            tmpDir,
            vars,
            version,
            headerRepoName,
            filteredRulesSpec,
            '.windsurf/rules/languages',
            'windsurf'
          )
        );
      }
    }

    if (targets.has('ai')) {
      gatedTasks.push(
        syncDirectCopy(
          templatesDir,
          vars.overlayTemplatesDir,
          'ai',
          tmpDir,
          '.ai',
          vars,
          version,
          headerRepoName
        )
      );
    }

    if (targets.has('copilot')) {
      gatedTasks.push(
        syncCopilot(templatesDir, tmpDir, vars, version, headerRepoName),
        syncCopilotPrompts(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec),
        syncCopilotAgents(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          agentsSpec,
          filteredRulesSpec
        ),
        syncCopilotChatModes(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          teamsSpec,
          agentsSpec
        )
      );
      if (isFeatureEnabled('coding-rules', vars)) {
        gatedTasks.push(
          syncLanguageInstructions(
            templatesDir,
            tmpDir,
            vars,
            version,
            headerRepoName,
            filteredRulesSpec,
            '.github/instructions/languages',
            'copilot'
          )
        );
      }
    }

    if (targets.has('gemini')) {
      gatedTasks.push(syncGemini(templatesDir, tmpDir, vars, version, headerRepoName));
    }

    if (targets.has('junie')) {
      gatedTasks.push(syncJunie(templatesDir, tmpDir, vars, version, headerRepoName));
    }

    if (targets.has('codex')) {
      gatedTasks.push(
        syncCodexSkills(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec),
        syncOrgMetaSkills(tmpDir, projectRoot, skillsSpec, log, {
          categorised: vars.skillsCategorised,
          agentkitRoot,
        }),
        syncUnknownSkillsReport(tmpDir, projectRoot, skillsSpec, vars.syncDate, log, {
          categorised: vars.skillsCategorised,
        })
      );
    }

    if (targets.has('warp')) {
      gatedTasks.push(syncWarp(templatesDir, tmpDir, vars, version, headerRepoName));
    }

    if (targets.has('cline')) {
      if (isFeatureEnabled('coding-rules', vars)) {
        gatedTasks.push(
          syncClineRules(templatesDir, tmpDir, vars, version, headerRepoName, filteredRulesSpec),
          syncLanguageInstructions(
            templatesDir,
            tmpDir,
            vars,
            version,
            headerRepoName,
            filteredRulesSpec,
            '.clinerules/languages',
            'cline'
          )
        );
      }
    }

    if (targets.has('roo')) {
      if (isFeatureEnabled('coding-rules', vars)) {
        gatedTasks.push(
          syncRooRules(templatesDir, tmpDir, vars, version, headerRepoName, filteredRulesSpec),
          syncLanguageInstructions(
            templatesDir,
            tmpDir,
            vars,
            version,
            headerRepoName,
            filteredRulesSpec,
            '.roo/rules/languages',
            'roo'
          )
        );
      }
    }

    if (targets.has('mcp') && isFeatureEnabled('mcp-integration', vars)) {
      gatedTasks.push(
        syncA2aConfig(tmpDir, vars, version, headerRepoName, agentsSpec, teamsSpec, templatesDir)
      );
    }

    // Agent/team relationship matrix (auto-generated during sync)
    if (isFeatureEnabled('agent-personas', vars)) {
      gatedTasks.push(syncAgentAnalysis(agentkitRoot, tmpDir));
    }

    await Promise.all(gatedTasks);

    // 5. Build file list from temp and compute summary
    const newManifestFiles = {};
    const fileSummary = {}; // category → count
    const allTmpFiles = [];

    for await (const srcFile of walkDir(tmpDir)) {
      allTmpFiles.push(srcFile);
    }

    // Process files concurrently
    await runConcurrent(allTmpFiles, async (srcFile) => {
      if (!existsSync(srcFile)) return; // Should exist, but safety check
      const relPath = relative(tmpDir, srcFile);
      const manifestKey = relPath.replace(/\\/g, '/');
      let fileContent;
      try {
        fileContent = await readFile(srcFile);
      } catch (err) {
        if (err?.code === 'ENOENT') return;
        throw err;
      }
      const hash = createHash('sha256').update(fileContent).digest('hex').slice(0, 12);

      // JS object assignment is atomic enough for keys
      newManifestFiles[manifestKey] = { hash };
    });

    // Re-compute summary sequentially to avoid race condition on counters
    for (const manifestKey of Object.keys(newManifestFiles)) {
      const cat = categorizeFile(manifestKey);
      fileSummary[cat] = (fileSummary[cat] || 0) + 1;
    }

    // --- Dry-run: print summary and exit without writing ---
    if (dryRun) {
      const total = Object.keys(newManifestFiles).length;
      log(`[retort:sync] Dry-run: would generate ${total} file(s):`);
      printSyncSummary(fileSummary, targets, { quiet });
      return;
    }

    // --- Diff: show what would change and exit without writing ---
    if (diff) {
      const resolvedRoot = resolve(projectRoot) + sep;
      const overwrite = flags?.overwrite || flags?.force;
      let createCount = 0;
      let updateCount = 0;
      let skipCount = 0;

      // Sequential to avoid interleaved console output
      for (const srcFile of allTmpFiles) {
        if (!existsSync(srcFile)) continue;
        const relPath = relative(tmpDir, srcFile);
        const destFile = resolve(projectRoot, relPath);
        const normPath = relPath.replace(/\\/g, '/');
        if (
          !resolve(destFile).startsWith(resolvedRoot) &&
          resolve(destFile) !== resolve(projectRoot)
        )
          continue;
        const wouldSkip = !overwrite && isScaffoldOnce(normPath, vars) && existsSync(destFile);
        if (wouldSkip) {
          skipCount++;
          logVerbose(`  skip ${normPath} (project-owned, exists)`);
          continue;
        }
        let newContent;
        try {
          newContent = await readFile(srcFile, 'utf-8');
        } catch (err) {
          if (err?.code === 'ENOENT') continue;
          throw err;
        }
        if (!existsSync(destFile)) {
          createCount++;
          log(`  create ${normPath}`);
        } else {
          const oldContent = await readFile(destFile, 'utf-8');
          if (oldContent !== newContent) {
            updateCount++;
            log(`  update ${normPath}`);
            const diffOut = simpleDiff(oldContent, newContent);
            if (diffOut)
              log(
                diffOut
                  .split('\n')
                  .map((l) => `    ${l}`)
                  .join('\n')
              );
          } else {
            skipCount++;
            logVerbose(`  unchanged ${normPath}`);
          }
        }
      }
      log(
        `[retort:sync] Diff: ${createCount} create, ${updateCount} update, ${skipCount} unchanged/skip`
      );
      return;
    }

    // --- Interactive apply mode ---
    // In TTY mode (unless --yes/--no-prompt/--force), show what would change
    // and let the user choose: apply all / skip all / prompt each.
    const noPrompt = flags?.yes || flags?.['no-prompt'] || flags?.force || false;
    const isInteractive = !noPrompt && !isTestEnv && process.stdout.isTTY && process.stdin.isTTY;

    if (isInteractive) {
      const resolvedRootForDiff = resolve(projectRoot) + sep;
      const overwriteForDiff = flags?.overwrite || flags?.force;
      const changeList = [];

      for (const srcFile of allTmpFiles) {
        if (!existsSync(srcFile)) continue;
        const relPath = relative(tmpDir, srcFile);
        const destFile = resolve(projectRoot, relPath);
        const normPath = relPath.replace(/\\/g, '/');
        if (
          !resolve(destFile).startsWith(resolvedRootForDiff) &&
          resolve(destFile) !== resolve(projectRoot)
        )
          continue;
        const wouldSkip =
          !overwriteForDiff && isScaffoldOnce(normPath, vars) && existsSync(destFile);
        if (wouldSkip) continue;

        let newContent;
        try {
          newContent = await readFile(srcFile, 'utf-8');
        } catch (err) {
          if (err?.code === 'ENOENT') continue;
          throw err;
        }

        if (!existsSync(destFile)) {
          changeList.push({ relPath: normPath, action: 'create', newContent });
        } else {
          const oldContent = await readFile(destFile, 'utf-8');
          if (oldContent !== newContent) {
            changeList.push({ relPath: normPath, action: 'update', oldContent, newContent });
          }
        }
      }

      if (changeList.length > 0) {
        const { promptApplyMode, promptSingleFile } = await import('./sync-guard.mjs');

        const creates = changeList.filter((c) => c.action === 'create').length;
        const updates = changeList.filter((c) => c.action === 'update').length;

        const mode = await promptApplyMode({ creates, updates });

        if (mode === 'none') {
          log('[retort:sync] Skipped — no files written.');
          return;
        }

        if (mode === 'each') {
          const skipSet = new Set();
          let applyRest = false;
          for (const change of changeList) {
            if (applyRest) continue;
            const decision = await promptSingleFile(
              change,
              simpleDiff,
              change.oldContent || null,
              change.newContent
            );
            if (decision === 'skip') skipSet.add(change.relPath);
            else if (decision === 'apply-rest') applyRest = true;
          }
          if (skipSet.size > 0) {
            flags._skipPaths = skipSet;
            log(`[retort:sync] Skipping ${skipSet.size} file(s) by user choice.`);
          }
        }
        // mode === 'all' falls through to normal swap
      }
    }

    // 6. Load previous manifest for stale file cleanup
    const manifestPath = resolve(agentkitRoot, '.manifest.json');
    let previousManifest = null;
    try {
      if (existsSync(manifestPath)) {
        previousManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      }
    } catch {
      /* ignore corrupt manifest */
    }

    // 7. Write scaffold outputs (scaffold-once / managed / always)
    log('[retort:sync] Writing outputs...');
    const { count, skippedScaffold, writtenFiles } = await writeScaffoldOutputs({
      projectRoot,
      agentkitRoot,
      tmpDir,
      allTmpFiles,
      flags,
      newManifestFiles,
      previousManifest,
      vars,
      log,
      logVerbose,
    });

    // 8. Stale file cleanup: delete orphaned files from previous sync (unless --no-clean)
    const cleanedCount = await cleanStaleFiles({
      projectRoot,
      previousManifest,
      newManifestFiles,
      noClean,
      logVerbose,
    });

    // 9. Post-sync prettier formatting — format before hashing so manifest hashes
    //    reflect on-disk content. Without this, managed-file hash checks on the next
    //    sync treat Prettier output as a "user edit" and skip regeneration.
    await runPostSyncPrettier({ agentkitRoot, projectRoot, writtenFiles, logVerbose });

    // Refresh manifest hashes for files that Prettier may have reformatted.
    for (const absPath of writtenFiles) {
      const relPath = relative(projectRoot, absPath).replace(/\\/g, '/');
      if (newManifestFiles[relPath]) {
        try {
          const diskContent = await readFile(absPath);
          newManifestFiles[relPath].hash = createHash('sha256')
            .update(diskContent)
            .digest('hex')
            .slice(0, 12);
        } catch {
          // file may have been deleted or be unreadable — leave hash as-is
        }
      }
    }

    // 10. Write new manifest with post-format hashes
    await writeManifest(manifestPath, {
      generatedAt: new Date().toISOString(),
      version,
      repoName: vars.repoName,
      files: newManifestFiles,
    });

    if (skippedScaffold > 0) {
      log(`[retort:sync] Skipped ${skippedScaffold} project-owned file(s) (already exist).`);
    }
    if (cleanedCount > 0) {
      log(`[retort:sync] Cleaned ${cleanedCount} stale file(s) from previous sync.`);
    }

    // 11. Post-sync summary
    printSyncSummary(fileSummary, targets, { quiet });
    const completeness = computeProjectCompleteness(projectSpec);
    if (completeness.total > 0) {
      log(
        `[retort:sync] project.yaml completeness: ${completeness.percent}% (${completeness.present}/${completeness.total} fields populated)`
      );
      if (completeness.missing.length > 0) {
        log(`[retort:sync] Top missing fields: ${completeness.missing.slice(0, 5).join(', ')}`);
      }
    }
    log(`[retort:sync] Done! Generated ${count} files.`);

    // 12. Write sync-report.json
    if (!dryRun && !diff) {
      const failedFiles = [];
      const scaffoldResults = {
        alwaysRegenerated: [],
        managedRegenerated: [],
        managedMerged: [],
        managedConflicts: [],
        managedPreserved: [],
        managedNoCache: [],
      };
      const reportCollector = getSyncReportData();
      let gitAutocrlf = null;
      let hasGitattributes = false;
      try {
        gitAutocrlf = execFileSync('git', ['-C', projectRoot, 'config', 'core.autocrlf'], {
          encoding: 'utf-8',
          stdio: 'pipe',
        }).trim();
      } catch {
        // git not available or not a repo
      }
      try {
        hasGitattributes = existsSync(resolve(projectRoot, '.gitattributes'));
      } catch {
        // ignore
      }
      const syncReport = {
        version,
        generatedAt: new Date().toISOString(),
        command: 'retort sync',
        argv: process.argv.slice(2),
        os: { platform: process.platform, arch: process.arch, nodeVersion: process.version },
        git: { autocrlf: gitAutocrlf, hasGitattributes },
        counts: {
          generated: count,
          skipped: skippedScaffold,
          cleaned: cleanedCount,
          failed: failedFiles.length,
        },
        fileSummary,
        scaffoldResults,
        unresolvedPlaceholders: reportCollector?.unresolvedPlaceholders ?? [],
        errors: failedFiles,
      };
      const reportPath = resolve(agentkitRoot, 'sync-report.json');
      try {
        await writeFile(reportPath, JSON.stringify(syncReport, null, 2) + '\n', 'utf-8');
      } catch (err) {
        console.warn(`[retort:sync] Warning: could not write sync-report.json — ${err.message}`);
      }
    }

    // 13. First-sync hint (when not called from init)
    if (!flags?.overlay) {
      const markerPath = resolve(projectRoot, '.agentkit-repo');
      if (!existsSync(markerPath)) {
        log('');
        log('  Tip: Run "agentkit init" to customize which AI tools you generate configs for.');
        log('       Run "agentkit add <tool>" to add tools incrementally.');
      }
    }
  } finally {
    // Wrap cleanup so it cannot mask the primary sync error.
    // maxRetries handles transient ENOTEMPTY on tmpfs/overlayfs (Node.js
    // fs.rm defaults to maxRetries:0, so the first failed rmdir throws).
    try {
      await rm(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (cleanupErr) {
      if (process.env.DEBUG) {
        console.error(`[retort:sync] Warning: tmpDir cleanup failed — ${cleanupErr.message}`);
      }
    }
  }
}
