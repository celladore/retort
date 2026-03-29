/**
 * Retort — Synchronize Command
 * Reads spec + overlay → renders templates → writes generated AI-tool configuration outputs.
 * Main file operations (mkdir, writeFile, readdir, cp) use async fs/promises.
 * readYaml/readText use synchronous fs APIs for simplicity at startup.
 * Pure template helpers live in template-utils.mjs.
 *
 * Modularization (Steps 3–6):
 *   spec-loader.mjs     — readYaml, readText, loadAgentsSpec, loadSpecDefaults, readTemplateText
 *   overlay-resolver.mjs — resolveOverlaySelection, collectTemplateFiles
 *   var-builders.mjs    — all template variable builder functions
 *   platform-syncer.mjs — all per-tool sync functions
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, extname, join, relative, resolve, sep } from 'path';
import { resolveColor } from './brand-resolver.mjs';
import {
  buildFeatureVars,
  buildHookFeatureMap,
  loadFeatureSpec,
  resolveFeatures,
} from './feature-manager.mjs';
import {
  categorizeFile,
  computeProjectCompleteness,
  filterDomainsByStack,
  flattenProjectYaml,
  isScaffoldOnce,
  mergePermissions,
  printSyncSummary,
  resolveRenderTargets,
  resolveScaffoldAction,
  simpleDiff,
} from './template-utils.mjs';

// ---------------------------------------------------------------------------
// Step 3 — spec-loader.mjs re-exports
// ---------------------------------------------------------------------------
export { readYaml, readText, loadAgentsSpec, loadSpecDefaults } from './spec-loader.mjs';
import {
  readYaml,
  readText,
  loadAgentsSpec,
  loadSpecDefaults,
  clearTemplateTextCache,
} from './spec-loader.mjs';

// ---------------------------------------------------------------------------
// Step 4 — overlay-resolver.mjs re-exports
// ---------------------------------------------------------------------------
export { resolveOverlaySelection, collectTemplateFiles } from './overlay-resolver.mjs';
import { resolveOverlaySelection } from './overlay-resolver.mjs';

// ---------------------------------------------------------------------------
// Step 5 — var-builders.mjs re-exports
// ---------------------------------------------------------------------------
export {
  buildTeamsList,
  resolveTeamAgents,
  buildAgentRegistry,
  buildCollaboratorsSection,
  buildBranchProtectionJson,
  formatConventionLine,
  buildRuleVars,
  resolveCommandPath,
  getTeamCommandStem,
} from './var-builders.mjs';
import {
  buildTeamsList,
  buildAgentRegistry,
  buildBranchProtectionJson,
  buildAreaRoutingTable,
  inferTestingCoverage,
  isFeatureEnabled,
} from './var-builders.mjs';

// ---------------------------------------------------------------------------
// Step 6 — platform-syncer.mjs re-exports
// ---------------------------------------------------------------------------
export { syncDirectCopy } from './platform-syncer.mjs';
import {
  syncDirectCopy,
  syncAgentsMd,
  syncRootDocs,
  syncGitHub,
  syncEditorConfigs,
  syncScripts,
  syncGitattributes,
  syncEditorTheme,
  syncClaudeSettings,
  syncClaudeHooks,
  syncClaudeCommands,
  syncClaudeAgents,
  syncAgentRegistry,
  syncClaudeMd,
  syncClaudeSkills,
  syncCursorTeams,
  syncCursorCommands,
  syncWindsurfTeams,
  syncWindsurfCommands,
  syncCopilot,
  syncCopilotPrompts,
  syncCopilotAgents,
  syncCopilotChatModes,
  syncLanguageInstructions,
  syncGemini,
  syncCodexSkills,
  syncOrgMetaSkills,
  syncUnknownSkillsReport,
  syncWarp,
  syncClineRules,
  syncRooRules,
  syncA2aConfig,
  syncAgentAnalysis,
  getTemplateMetaMap,
  clearTemplateMetaMap,
} from './platform-syncer.mjs';

// ---------------------------------------------------------------------------
// Scaffold metadata map — populated during template rendering, consumed in Step 7
// ---------------------------------------------------------------------------

/**
 * Retrieve parsed frontmatter metadata for a generated file.
 * Delegates to platform-syncer's templateMetaMap.
 * @param {string} relPath - Relative path from project root
 * @returns {object|null}
 */
export function getTemplateMeta(relPath) {
  return getTemplateMetaMap().get(relPath.replace(/\\/g, '/')) || null;
}

// getTeamCommandStem and resolveCommandPath imported from var-builders.mjs above

// ---------------------------------------------------------------------------
// Three-way merge for managed scaffold files
// ---------------------------------------------------------------------------

/**
 * Performs a three-way merge using git merge-file.
 * @param {string} oursContent - User's current version (disk)
 * @param {string} baseContent - Last generated version (scaffold cache)
 * @param {string} theirsContent - Newly generated version (template)
 * @returns {{ merged: string, hasConflicts: boolean }|null} null if git unavailable
 */
function threeWayMerge(oursContent, baseContent, theirsContent) {
  const prefix = join(
    tmpdir(),
    `agentkit-merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const oursFile = `${prefix}-ours`;
  const baseFile = `${prefix}-base`;
  const theirsFile = `${prefix}-theirs`;

  writeFileSync(oursFile, oursContent);
  writeFileSync(baseFile, baseContent);
  writeFileSync(theirsFile, theirsContent);

  try {
    const merged = execFileSync(
      'git',
      [
        'merge-file',
        '-p',
        '--diff3',
        '-L',
        'YOUR_EDITS',
        '-L',
        'LAST_SYNC',
        '-L',
        'NEW_TEMPLATE',
        oursFile,
        baseFile,
        theirsFile,
      ],
      { encoding: 'utf-8' }
    );
    return { merged, hasConflicts: false };
  } catch (err) {
    if (err.status === 1) {
      // Merge completed but has conflicts
      return {
        merged: typeof err.stdout === 'string' ? err.stdout : oursContent,
        hasConflicts: true,
      };
    }
    // git merge-file not available or other error
    return null;
  } finally {
    try {
      unlinkSync(oursFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(baseFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(theirsFile);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Normalize content for semantic comparison (ignores table-cell padding)
// ---------------------------------------------------------------------------

/**
 * Strips trailing whitespace and normalises markdown table-cell padding so
 * that a Prettier-aligned table and a compact table compare as equal when
 * the cell *values* are identical.  Used to detect whether a disk file
 * differs from the scaffold cache for reasons other than whitespace.
 *
 * @param {string} content
 * @returns {string}
 */
export function normalizeForComparison(content) {
  return content
    .split('\n')
    .map((line) => {
      if (/^\s*\|/.test(line)) {
        // Separator rows (|---|---| or | --- | --- |) — collapse to |---| canonical form
        if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) {
          const cols = line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
          return '|' + cols.map((c) => c.trim().replace(/^(:?)-+(:?)$/, '$1-$2')).join('|') + '|';
        }
        // Data rows — normalise cell padding to a single space either side
        return line
          .split('|')
          .map((cell, i, arr) =>
            i === 0 || i === arr.length - 1 ? cell.trimEnd() : ` ${cell.trim()} `
          )
          .join('|');
      }
      return line.trimEnd();
    })
    .join('\n')
    .trimEnd();
}

// ---------------------------------------------------------------------------
// I/O helpers — implementations in spec-loader.mjs; re-exported above
// ---------------------------------------------------------------------------

export async function runConcurrent(items, fn, concurrency = 50) {
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(fn));
  }
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeOutput(filePath, content) {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

export async function* walkDir(dir) {
  if (!existsSync(dir)) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Overlay helpers — implementations in overlay-resolver.mjs; re-exported above
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sync helper — generic directory copy with template rendering
// (implementation in platform-syncer.mjs; re-exported above)
// ---------------------------------------------------------------------------

// Platform sync helpers live in platform-syncer.mjs (re-exported above, Step 6).
// Var-builder helpers live in var-builders.mjs (re-exported above, Step 5).

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
  clearTemplateMetaMap();
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

    if (targets.has('codex')) {
      gatedTasks.push(
        syncCodexSkills(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec),
        syncOrgMetaSkills(tmpDir, projectRoot, skillsSpec, log),
        syncUnknownSkillsReport(tmpDir, projectRoot, skillsSpec, vars.syncDate, log)
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

    // 7. Atomic swap: move temp outputs to project root & build new manifest
    log('[retort:sync] Writing outputs...');
    const resolvedRoot = resolve(projectRoot) + sep;
    const scaffoldCacheDir = resolve(agentkitRoot, '.scaffold-cache');

    // Use shared counters and tracking lists
    let count = 0;
    let skippedScaffold = 0;
    const failedFiles = [];
    // NOTE: Safe for single-threaded async (Array.push is synchronous in V8).
    // If runConcurrent ever uses worker threads, this needs synchronization.
    const writtenFiles = []; // absolute paths of files written, for post-sync formatting
    const scaffoldResults = {
      alwaysRegenerated: [],
      managedRegenerated: [],
      managedMerged: [],
      managedConflicts: [],
      managedPreserved: [],
      managedNoCache: [],
    };

    await runConcurrent(allTmpFiles, async (srcFile) => {
      if (!existsSync(srcFile)) return;
      const relPath = relative(tmpDir, srcFile);
      const normalizedRel = relPath.replace(/\\/g, '/');
      const destFile = resolve(projectRoot, relPath);

      // Interactive skip: user chose to skip this file in "prompt each" mode
      if (flags?._skipPaths?.has(normalizedRel)) {
        logVerbose(`  skipped ${normalizedRel} (user chose to skip)`);
        return;
      }

      // Path traversal protection: ensure all output stays within project root
      if (
        !resolve(destFile).startsWith(resolvedRoot) &&
        resolve(destFile) !== resolve(projectRoot)
      ) {
        console.error(`[retort:sync] BLOCKED: path traversal detected — ${normalizedRel}`);
        failedFiles.push({ file: normalizedRel, error: 'path traversal blocked' });
        return;
      }

      // Scaffold action resolution: always | managed (check-hash) | once (skip)
      const meta = getTemplateMeta(normalizedRel);
      const overwrite = flags?.overwrite || flags?.force;
      if (!overwrite && existsSync(destFile)) {
        const action = resolveScaffoldAction(normalizedRel, vars, meta);

        if (action === 'skip') {
          skippedScaffold++;
          return;
        }

        if (action === 'check-hash') {
          const diskContent = await readFile(destFile);
          const diskHash = createHash('sha256').update(diskContent).digest('hex').slice(0, 12);
          const prevHash = previousManifest?.files?.[normalizedRel]?.hash;

          if (prevHash && diskHash !== prevHash) {
            const cachePath = resolve(scaffoldCacheDir, relPath);
            const newContent = await readFile(srcFile, 'utf-8');

            if (existsSync(cachePath)) {
              const baseContent = readFileSync(cachePath, 'utf-8');
              const diskText = diskContent.toString('utf-8');

              // Check whether the disk differs from the cache for reasons other
              // than table-cell padding (Prettier alignment).  If the normalised
              // forms are identical the file contains no real user edits — fall
              // through to the pristine overwrite path below.
              if (normalizeForComparison(diskText) !== normalizeForComparison(baseContent)) {
                // Real user edit.  Only attempt a three-way merge when the template
                // has actually changed since the last sync (base ≠ theirs after
                // normalisation).  When the template is unchanged the merge would
                // be a no-op (result === disk) — skip it to stop the churn loop.
                if (normalizeForComparison(baseContent) === normalizeForComparison(newContent)) {
                  // Template unchanged — preserve user edits, no write needed
                  skippedScaffold++;
                  scaffoldResults.managedPreserved.push(normalizedRel);
                  logVerbose(
                    `  skipped ${normalizedRel} (user edits preserved, template unchanged)`
                  );
                  return;
                }

                const result = threeWayMerge(diskText, baseContent, newContent);

                if (result) {
                  // Write merged result
                  await ensureDir(dirname(destFile));
                  await writeFile(destFile, result.merged, 'utf-8');
                  // Update scaffold cache with new generated content
                  await ensureDir(dirname(cachePath));
                  await writeFile(cachePath, newContent, 'utf-8');
                  count++;

                  writtenFiles.push(destFile);
                  if (result.hasConflicts) {
                    scaffoldResults.managedConflicts.push(normalizedRel);
                    console.warn(
                      `[retort:sync] CONFLICT in ${normalizedRel} — resolve <<<< markers manually`
                    );
                  } else {
                    scaffoldResults.managedMerged.push(normalizedRel);
                    logVerbose(
                      `  merged ${normalizedRel} (user edits + template changes combined)`
                    );
                  }
                  return;
                }
                // git merge-file unavailable — skip and preserve user edits
                skippedScaffold++;
                scaffoldResults.managedPreserved.push(normalizedRel);
                logVerbose(
                  `  skipped ${normalizedRel} (user edits detected, hash: ${prevHash} → ${diskHash})`
                );
                return;
              }
              // Formatting-only diff — fall through to pristine overwrite
            } else {
              // No cache — skip and preserve user edits
              skippedScaffold++;
              scaffoldResults.managedPreserved.push(normalizedRel);
              scaffoldResults.managedNoCache.push(normalizedRel);
              logVerbose(
                `  skipped ${normalizedRel} (user edits detected, hash: ${prevHash} → ${diskHash})`
              );
              return;
            }
          }
          // Hash matches, no previous hash, or formatting-only diff — safe to overwrite (pristine)
          scaffoldResults.managedRegenerated.push(normalizedRel);
        } else {
          // action === 'write' for scaffold: always
          if (meta?.agentkit?.scaffold === 'always') {
            scaffoldResults.alwaysRegenerated.push(normalizedRel);
          }
        }
      }

      // Content-hash guard: skip write if content is identical to the existing file.
      // This prevents mtime churn on generated files that haven't logically changed,
      // reducing adopter merge-conflict counts on framework-update merges.
      // Also skips when the only difference is markdown table-cell padding (Prettier
      // alignment vs compact template output) so formatted files are not reverted each run.
      if (existsSync(destFile)) {
        const existingContent = await readFile(destFile);
        const newHash = newManifestFiles[normalizedRel]?.hash;
        if (newHash) {
          const existingHash = createHash('sha256')
            .update(existingContent)
            .digest('hex')
            .slice(0, 12);
          if (existingHash === newHash) {
            logVerbose(`  unchanged ${normalizedRel} (content identical, skipping write)`);
            return;
          }
        }
        // Slower path: skip write when the only difference is table-cell padding.
        const newContent = await readFile(srcFile, 'utf-8');
        if (
          normalizeForComparison(existingContent.toString('utf-8')) ===
          normalizeForComparison(newContent)
        ) {
          logVerbose(`  unchanged ${normalizedRel} (formatting-only diff, skipping write)`);
          return;
        }
      }

      try {
        await ensureDir(dirname(destFile));
        await cp(srcFile, destFile, { force: true, recursive: false });

        // Update scaffold cache for managed files
        if (meta?.agentkit?.scaffold === 'managed' || meta?.agentkit?.scaffold === 'always') {
          const cachePath = resolve(scaffoldCacheDir, relPath);
          try {
            await ensureDir(dirname(cachePath));
            const content = await readFile(srcFile, 'utf-8');
            await writeFile(cachePath, content, 'utf-8');
          } catch {
            /* ignore cache write failures */
          }
        }

        // Make .sh files executable
        if (extname(srcFile) === '.sh') {
          try {
            await chmod(destFile, 0o755);
          } catch {
            /* ignore on Windows */
          }
        }
        count++;
        writtenFiles.push(destFile);
        logVerbose(`  wrote ${normalizedRel}`);
      } catch (err) {
        failedFiles.push({ file: normalizedRel, error: err.message });
        console.error(`[retort:sync] Failed to write: ${normalizedRel} — ${err.message}`);
      }
    });

    if (failedFiles.length > 0) {
      console.error(`[retort:sync] Error: ${failedFiles.length} file(s) failed to write:`);
      for (const f of failedFiles) {
        console.error(`  - ${f.file}: ${f.error}`);
      }
      throw new Error(`Sync completed with ${failedFiles.length} write failure(s)`);
    }

    // 7b. Scaffold summary
    const hasManagedActivity =
      scaffoldResults.alwaysRegenerated.length > 0 ||
      scaffoldResults.managedRegenerated.length > 0 ||
      scaffoldResults.managedMerged.length > 0 ||
      scaffoldResults.managedConflicts.length > 0 ||
      scaffoldResults.managedPreserved.length > 0;

    if (hasManagedActivity) {
      log('[retort:sync] Scaffold summary:');
      if (scaffoldResults.alwaysRegenerated.length > 0) {
        log(`  ${scaffoldResults.alwaysRegenerated.length} file(s) always-regenerated`);
      }
      if (scaffoldResults.managedRegenerated.length > 0) {
        log(
          `  ${scaffoldResults.managedRegenerated.length} managed file(s) regenerated (pristine)`
        );
      }
      if (scaffoldResults.managedMerged.length > 0) {
        log(
          `  ${scaffoldResults.managedMerged.length} managed file(s) merged (user edits + template changes)`
        );
      }
      if (scaffoldResults.managedConflicts.length > 0) {
        console.warn(
          `  ${scaffoldResults.managedConflicts.length} managed file(s) with CONFLICTS — resolve manually:`
        );
        for (const f of scaffoldResults.managedConflicts) {
          console.warn(`    - ${f}`);
        }
      }
      if (scaffoldResults.managedPreserved.length > 0) {
        log(
          `  ${scaffoldResults.managedPreserved.length} managed file(s) preserved (user edits detected)`
        );
        for (const f of scaffoldResults.managedPreserved) {
          logVerbose(`    - ${f}`);
        }
      }
    }
    const scaffoldOnceSkipped = skippedScaffold - scaffoldResults.managedPreserved.length;
    if (scaffoldOnceSkipped > 0) {
      logVerbose(`  ${scaffoldOnceSkipped} scaffold-once file(s) skipped`);
    }

    // 7b. Carry forward scaffold-once files from previous manifest.
    // When a file was generated in a previous sync but skipped this time (scaffold-once),
    // it must remain in the new manifest so orphan cleanup does not delete it.
    if (previousManifest?.files) {
      for (const [prevFile, prevMeta] of Object.entries(previousManifest.files)) {
        if (!newManifestFiles[prevFile]) {
          const prevPath = resolve(projectRoot, prevFile);
          if (existsSync(prevPath)) {
            // File exists on disk but was not regenerated — carry forward its manifest entry
            newManifestFiles[prevFile] = prevMeta;
          }
        }
      }
    }

    // 8. Stale file cleanup: delete orphaned files from previous sync (unless --no-clean)
    let cleanedCount = 0;
    if (!noClean && previousManifest?.files) {
      const staleFiles = [];
      for (const prevFile of Object.keys(previousManifest.files)) {
        if (!newManifestFiles[prevFile]) {
          staleFiles.push(prevFile);
        }
      }

      await runConcurrent(staleFiles, async (prevFile) => {
        const orphanPath = resolve(projectRoot, prevFile);
        // Path traversal protection: ensure orphan path stays within project root
        if (!orphanPath.startsWith(resolvedRoot)) {
          console.warn(`[retort:sync] BLOCKED: path traversal in manifest — ${prevFile}`);
          return;
        }
        if (existsSync(orphanPath)) {
          try {
            await unlink(orphanPath);
            cleanedCount++;
            logVerbose(`[retort:sync] Cleaned stale file: ${prevFile}`);
          } catch (err) {
            console.warn(
              `[retort:sync] Warning: could not clean stale file ${prevFile} — ${err.message}`
            );
          }
        }
      });
    }

    // 9. Write new manifest
    const newManifest = {
      generatedAt: new Date().toISOString(),
      version,
      repoName: vars.repoName,
      files: newManifestFiles,
    };
    try {
      await writeFile(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf-8');
    } catch (err) {
      console.warn(`[retort:sync] Warning: could not write manifest — ${err.message}`);
    }

    // 10. Post-sync prettier formatting — ensure generated files are formatted
    const prettierBin = resolve(agentkitRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
    if (existsSync(prettierBin) && writtenFiles.length > 0) {
      try {
        // Format in batches to avoid argument length limits
        const BATCH_SIZE = 50;
        let formattedCount = 0;
        for (let i = 0; i < writtenFiles.length; i += BATCH_SIZE) {
          const batch = writtenFiles.slice(i, i + BATCH_SIZE);
          try {
            execFileSync(process.execPath, [prettierBin, '--write', ...batch], {
              cwd: projectRoot,
              encoding: 'utf-8',
              stdio: 'pipe',
              timeout: 60_000,
            });
            formattedCount += batch.length;
          } catch (err) {
            if (err?.killed) {
              logVerbose(`[retort:sync] Prettier batch timed out, continuing...`);
            }
            // prettier may fail on some files (e.g. non-parseable) — continue
          }
        }
        if (formattedCount > 0) {
          logVerbose(`[retort:sync] Formatted ${formattedCount} generated file(s) with Prettier.`);
        }
      } catch {
        // If prettier is not available or fails entirely, just continue
      }
    }

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

    // 12. First-sync hint (when not called from init)
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
