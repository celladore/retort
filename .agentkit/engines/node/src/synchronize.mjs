/**
 * Retort — Synchronize Command
 * Reads spec + overlay → renders templates → writes generated AI-tool configuration outputs.
 * Main file operations (mkdir, writeFile, readdir, cp) use async fs/promises.
 * readYaml/readText use synchronous fs APIs for simplicity at startup.
 * Pure template helpers live in template-utils.mjs.
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'fs/promises';
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
import {
  categorizeFile,
  computeProjectCompleteness,
  filterDomainsByStack,
  flattenProjectYaml,
  formatCommandFlags,
  insertHeader,
  isScaffoldOnce,
  mergePermissions,
  parseTemplateFrontmatter,
  printSyncSummary,
  renderTemplate,
  resolveRenderTargets,
  resolveScaffoldAction,
  simpleDiff,
} from './template-utils.mjs';

// ---------------------------------------------------------------------------
// Scaffold metadata map — populated during template rendering, consumed in Step 7
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} relPath → parsed template frontmatter */
const templateMetaMap = new Map();

/**
 * Retrieve parsed frontmatter metadata for a generated file.
 * @param {string} relPath - Relative path from project root
 * @returns {object|null}
 */
export function getTemplateMeta(relPath) {
  return templateMetaMap.get(relPath.replace(/\\/g, '/')) || null;
}

function getTeamCommandStem(teamId) {
  return teamId.startsWith('team-') ? teamId : `team-${teamId}`;
}

/**
 * Resolves the output path components for a command, applying the optional
 * command prefix. Two strategies:
 *  - 'subdirectory': puts commands in a prefix-named subfolder (Claude Code)
 *  - 'filename':     prepends prefix with hyphen to the filename (all others)
 *
 * @param {string} cmdName - Original command name (e.g. 'check')
 * @param {string|null} prefix - Command prefix (e.g. 'kits') or null/undefined
 * @param {'subdirectory'|'filename'} [strategy='filename'] - Platform strategy
 * @returns {{ dir: string, stem: string }}
 */
export function resolveCommandPath(cmdName, prefix, strategy = 'filename') {
  if (!prefix) return { dir: '', stem: cmdName };
  if (strategy === 'subdirectory') return { dir: prefix, stem: cmdName };
  return { dir: '', stem: `${prefix}-${cmdName}` };
}

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

const templateTextCache = new Map();

async function readTemplateText(filePath) {
  if (templateTextCache.has(filePath)) {
    return templateTextCache.get(filePath);
  }
  const content = await readFile(filePath, 'utf-8');
  templateTextCache.set(filePath, content);
  return content;
}

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

function inferOverlayFromProjectRoot(agentkitRoot, projectRoot) {
  const inferredName = basename(resolve(projectRoot));
  if (!inferredName) return null;
  const settingsPath = resolve(agentkitRoot, 'overlays', inferredName, 'settings.yaml');
  return existsSync(settingsPath) ? inferredName : null;
}

function resolveOverlaySelection(agentkitRoot, projectRoot, flags) {
  if (flags?.overlay) {
    return {
      repoName: flags.overlay,
      reason: '--overlay flag',
    };
  }

  const markerPath = resolve(projectRoot, '.agentkit-repo');
  if (existsSync(markerPath)) {
    return {
      repoName: readText(markerPath).trim(),
      reason: '.agentkit-repo marker',
    };
  }

  const inferredOverlay = inferOverlayFromProjectRoot(agentkitRoot, projectRoot);
  if (inferredOverlay) {
    return {
      repoName: inferredOverlay,
      reason: `inferred from project root name "${basename(resolve(projectRoot))}"`,
    };
  }

  return {
    repoName: '__TEMPLATE__',
    reason: 'fallback to __TEMPLATE__ (no --overlay, no .agentkit-repo, no inferred overlay)',
  };
}

async function collectTemplateFiles(baseDir, overlayDir = null) {
  const filesByRelativePath = new Map();

  for (const dir of [baseDir, overlayDir]) {
    if (!dir || !existsSync(dir)) continue;
    for await (const srcFile of walkDir(dir)) {
      const relPath = relative(dir, srcFile);
      filesByRelativePath.set(relPath, srcFile);
    }
  }

  return filesByRelativePath;
}

// ---------------------------------------------------------------------------
// Sync helper — generic directory copy with template rendering
// ---------------------------------------------------------------------------

/**
 * Copies template files from templatesDir/sourceSubdir to tmpDir/destSubdir.
 * Renders each file as a template and inserts a generated header.
 * If source dir does not exist, returns without error (no-op).
 */
export async function syncDirectCopy(
  templatesDir,
  overlayTemplatesDir,
  sourceSubdir,
  tmpDir,
  destSubdir,
  vars,
  version,
  repoName
) {
  const sourceDir = join(templatesDir, sourceSubdir);
  const overlaySourceDir = overlayTemplatesDir ? join(overlayTemplatesDir, sourceSubdir) : null;
  const sourceFiles = await collectTemplateFiles(sourceDir, overlaySourceDir);
  if (sourceFiles.size === 0) return;

  await runConcurrent([...sourceFiles.entries()], async ([relPath, srcFile]) => {
    const destFile = destSubdir === '.' ? join(tmpDir, relPath) : join(tmpDir, destSubdir, relPath);
    const destRelPath = destSubdir === '.' ? relPath : join(destSubdir, relPath);
    const ext = extname(srcFile).toLowerCase();
    let content;
    try {
      content = await readTemplateText(srcFile);
    } catch {
      // Binary or unreadable — copy as-is
      await ensureDir(dirname(destFile));
      try {
        await cp(srcFile, destFile, { force: true });
      } catch {
        /* ignore */
      }
      return;
    }

    // Parse and strip template frontmatter (agentkit scaffold directives)
    const { meta, content: stripped } = parseTemplateFrontmatter(content);
    if (meta) {
      const normalizedRel = destRelPath.replace(/\\/g, '/');
      templateMetaMap.set(normalizedRel, meta);
    }

    const rendered = renderTemplate(stripped, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    await writeOutput(destFile, withHeader);
  });
}

// ---------------------------------------------------------------------------
// Always-on sync helpers
// ---------------------------------------------------------------------------

/**
 * Copies templates/root to tmpDir root — AGENTS.md and other always-on files.
 */
async function syncAgentsMd(templatesDir, tmpDir, vars, version, repoName) {
  await syncDirectCopy(
    templatesDir,
    vars.overlayTemplatesDir,
    'root',
    tmpDir,
    '.',
    vars,
    version,
    repoName
  );
}

/**
 * Root-level docs sync.
 * All templates/root files are already handled by syncAgentsMd.
 * This function exists as a named hook for future per-overlay root-doc customisation.
 */
async function syncRootDocs(_templatesDir, _tmpDir, _vars, _version, _repoName) {
  // Intentionally empty — templates/root is fully handled by syncAgentsMd.
  // Reserved for future overlay-specific root-doc generation.
}

/**
 * Copies templates/github to tmpDir/.github.
 */
async function syncGitHub(templatesDir, tmpDir, vars, version, repoName) {
  await syncDirectCopy(
    templatesDir,
    vars.overlayTemplatesDir,
    'github',
    tmpDir,
    '.github',
    vars,
    version,
    repoName
  );
}

/**
 * Copies templates/renovate to tmpDir root (renovate.json) and other editor configs.
 */
async function syncEditorConfigs(templatesDir, tmpDir, vars, version, repoName) {
  await syncDirectCopy(
    templatesDir,
    vars.overlayTemplatesDir,
    'renovate',
    tmpDir,
    '.',
    vars,
    version,
    repoName
  );
}

/**
 * Copies templates/scripts to tmpDir/scripts — managed-mode utility scripts.
 * Each template uses frontmatter `agentkit: scaffold: managed` so downstream
 * repos receive updates via three-way merge while preserving local customizations.
 */
async function syncScripts(templatesDir, tmpDir, vars, version, repoName) {
  await syncDirectCopy(
    templatesDir,
    vars.overlayTemplatesDir,
    'scripts',
    tmpDir,
    'scripts',
    vars,
    version,
    repoName
  );
}

// ---------------------------------------------------------------------------
// Git merge driver sync
// ---------------------------------------------------------------------------

/** Marker comments delimiting the managed section in .gitattributes */
const GITATTR_START = '# >>> Retort merge drivers — DO NOT EDIT below this line';
const GITATTR_END = '# <<< Retort merge drivers — DO NOT EDIT above this line';

/**
 * Appends (or updates) the AgentKit merge-driver section in .gitattributes.
 * Preserves all user-authored content outside the markers. Writes the result
 * to tmpDir so the standard manifest/diff/swap pipeline handles it.
 */
async function syncGitattributes(tmpDir, projectRoot, version) {
  const destRelPath = '.gitattributes';
  const existingPath = join(projectRoot, destRelPath);
  const tmpPath = join(tmpDir, destRelPath);

  // Read existing .gitattributes (may not exist yet)
  let existing = '';
  if (existsSync(existingPath)) {
    existing = readFileSync(existingPath, 'utf-8');
  }

  // Strip any previous managed section
  const startIdx = existing.indexOf(GITATTR_START);
  const endIdx = existing.indexOf(GITATTR_END);
  if (startIdx !== -1 && endIdx !== -1) {
    existing =
      existing.slice(0, startIdx).trimEnd() +
      '\n' +
      existing.slice(endIdx + GITATTR_END.length).trimStart();
  }

  // Build the managed merge-driver section
  const managedSection = `
${GITATTR_START}
# GENERATED by Retort v${version} — regenerated on every sync.
# These custom merge drivers auto-resolve conflicts on framework-managed files.
# Driver "agentkit-generated" accepts the incoming (upstream/theirs) version.
# Only scaffold:always files are listed — scaffold:managed files (CLAUDE.md,
# settings.json, etc.) are intentionally excluded so user edits are preserved.
#
# To activate locally, run:
#   git config merge.agentkit-generated.name "Accept upstream for generated files"
#   git config merge.agentkit-generated.driver "cp %B %A"
#
# Or use: scripts/resolve-merge.sh <target-branch>

# --- Claude Code: agents, commands, rules, hooks, skills ---
.claude/agents/*.md                  merge=agentkit-generated
.claude/commands/*.md                merge=agentkit-generated
.claude/rules/**/*.md                merge=agentkit-generated
.claude/hooks/*.sh                   merge=agentkit-generated
.claude/hooks/*.ps1                  merge=agentkit-generated
.claude/skills/**/SKILL.md           merge=agentkit-generated

# --- Cursor: commands and rules ---
.cursor/commands/*.md                merge=agentkit-generated
.cursor/rules/**/*.md                merge=agentkit-generated

# --- Windsurf: commands, rules, and workflows ---
.windsurf/commands/*.md              merge=agentkit-generated
.windsurf/rules/**/*.md              merge=agentkit-generated
.windsurf/workflows/*.yml            merge=agentkit-generated

# --- Cline rules ---
.clinerules/**/*.md                  merge=agentkit-generated

# --- Roo rules ---
.roo/rules/**/*.md                   merge=agentkit-generated

# --- GitHub Copilot: instructions, agents, chatmodes, prompts ---
.github/instructions/**/*.md         merge=agentkit-generated
.github/agents/*.agent.md            merge=agentkit-generated
.github/chatmodes/*.chatmode.md      merge=agentkit-generated
.github/prompts/*.prompt.md          merge=agentkit-generated
.github/copilot-instructions.md      merge=agentkit-generated
.github/PULL_REQUEST_TEMPLATE.md     merge=agentkit-generated

# --- Agent skills packs ---
.agents/skills/**/SKILL.md           merge=agentkit-generated

# --- Generated doc indexes ---
docs/*/README.md                     merge=agentkit-generated

# --- Lock files (accept upstream, regenerate after merge) ---
pnpm-lock.yaml                       merge=agentkit-generated
.agentkit/pnpm-lock.yaml             merge=agentkit-generated
${GITATTR_END}
`;

  const result = existing.trimEnd() + '\n' + managedSection.trimEnd() + '\n';

  await mkdir(dirname(tmpPath), { recursive: true });
  await writeFile(tmpPath, result, 'utf-8');
}

// ---------------------------------------------------------------------------
// Editor theme sync — brand-driven .vscode/settings.json color customizations
// ---------------------------------------------------------------------------

/**
 * Generates workbench.colorCustomizations in editor settings files
 * by resolving editor-theme.yaml mappings against brand.yaml colors.
 *
 * Supports multiple output targets (VS Code, Cursor, Windsurf) and
 * per-tool overlay overrides. Runs after syncDirectCopy('vscode', ...)
 * so it can merge into the base settings.
 *
 * @param {string} agentkitRoot - Path to the .agentkit directory
 * @param {string} tmpDir - Temporary directory for rendered output
 * @param {object} vars - Flattened template variables (must include editorThemeEnabled)
 * @param {Function} log - Logging function
 * @param {{ force?: boolean }} [flags] - Optional flags (force skips scaffold-once check)
 */
async function syncEditorTheme(agentkitRoot, tmpDir, vars, log, flags, skipOutputs) {
  if (!vars.editorThemeEnabled) return;

  const brandSpec = readYaml(resolve(agentkitRoot, 'spec', 'brand.yaml'));
  if (!brandSpec) {
    log('[agentkit:sync] Editor theme enabled but no brand.yaml found — skipping');
    return;
  }

  // Validate brand spec
  const validation = validateBrandSpec(brandSpec);
  for (const err of validation.errors) {
    log(`[agentkit:sync] Brand error: ${err}`);
  }
  for (const warn of validation.warnings) {
    if (process.env.DEBUG) log(`[agentkit:sync] Brand warning: ${warn}`);
  }
  if (validation.errors.length > 0) {
    log('[agentkit:sync] Brand validation failed — skipping editor theme');
    return;
  }

  const themeSpec = readYaml(resolve(agentkitRoot, 'spec', 'editor-theme.yaml'));
  if (!themeSpec || !themeSpec.enabled) {
    log('[agentkit:sync] Editor theme spec not found or disabled — skipping');
    return;
  }

  // Validate tier/scheme values
  const themeValidation = validateThemeSpec(themeSpec);
  for (const warn of themeValidation.warnings) {
    log(`[agentkit:sync] Theme config warning: ${warn}`);
  }

  // Determine which mode mapping(s) to resolve
  const mode = themeSpec.mode || 'dark';
  const scheme = themeSpec.scheme || 'dark'; // light | dark — preference when mode is 'both'
  const tier = themeSpec.tier || 'full'; // full | medium | minimal
  let lightColors = {};
  let darkColors = {};

  if (mode === 'both' || mode === 'light') {
    const lightMapping = themeSpec.light || {};
    const { resolved, warnings } = resolveThemeMapping(lightMapping, brandSpec);
    lightColors = resolved;
    for (const warn of warnings) {
      log(`[agentkit:sync] Theme warning (light): ${warn}`);
    }
  }
  if (mode === 'both' || mode === 'dark') {
    const darkMapping = themeSpec.dark || {};
    const { resolved, warnings } = resolveThemeMapping(darkMapping, brandSpec);
    darkColors = resolved;
    for (const warn of warnings) {
      log(`[agentkit:sync] Theme warning (dark): ${warn}`);
    }
  }

  // Build final color customizations — scheme controls which wins on conflict
  let colorCustomizations;
  if (mode === 'both') {
    // Scheme preference: the preferred scheme's colors win on conflict
    if (scheme === 'light') {
      colorCustomizations = { ...darkColors, ...lightColors };
    } else {
      colorCustomizations = { ...lightColors, ...darkColors };
    }
  } else if (mode === 'light') {
    colorCustomizations = lightColors;
  } else {
    colorCustomizations = darkColors;
  }

  // Apply brand density tier — filter to only the configured surface level
  colorCustomizations = filterByTier(colorCustomizations, tier);
  if (tier !== 'full') {
    log(
      `[agentkit:sync] Brand tier "${tier}" — filtered to ${Object.keys(colorCustomizations).length} color slots`
    );
  }

  if (Object.keys(colorCustomizations).length === 0) {
    log('[agentkit:sync] No colors resolved from editor theme — skipping');
    return;
  }

  // Build metadata sentinel
  const meta = {
    brand: brandSpec.identity?.name || 'unknown',
    mode,
    scheme,
    tier,
    version: brandSpec.version || '1.0.0',
  };

  // Honor baseTheme — sets workbench.colorTheme per workspace
  if (themeSpec.baseTheme) {
    const preferLight = mode === 'light' || (mode === 'both' && scheme === 'light');
    const baseThemeValue = preferLight ? themeSpec.baseTheme.light : themeSpec.baseTheme.dark;
    if (baseThemeValue) {
      meta.baseTheme = baseThemeValue;
    }
  }

  // Honor fontFromBrand — sets editor.fontFamily from brand typography
  let fontFamily = null;
  if (themeSpec.fontFromBrand && brandSpec.typography?.mono) {
    fontFamily = `'${brandSpec.typography.mono}', monospace`;
    meta.font = brandSpec.typography.mono;
  }

  // Determine output targets — default to vscode only
  const defaultOutputs = { vscode: '.vscode/settings.json' };
  const outputs = themeSpec.outputs || defaultOutputs;

  // Reserved keys are top-level theme config — never treated as tool names
  const RESERVED_THEME_KEYS = new Set([
    'light',
    'dark',
    'enabled',
    'mode',
    'outputs',
    'baseTheme',
    'fontFromBrand',
    'tier',
    'scheme',
  ]);

  // Write theme into each output target
  const resolvedTmpDir = resolve(tmpDir);
  const writePromises = [];
  for (const [tool, outputPath] of Object.entries(outputs)) {
    if (!outputPath) continue; // null = skip this target

    // Scaffold-once: skip targets that already exist in projectRoot (unless --overwrite/--force)
    if (skipOutputs && skipOutputs.has(outputPath)) {
      log(`[agentkit:sync] Editor theme: ${outputPath} exists (scaffold-once) — skipping`);
      continue;
    }

    // Path traversal protection — resolve and verify the output stays inside tmpDir
    const normalizedPath = String(outputPath).replace(/^\/+/, ''); // strip leading slashes
    const settingsPath = resolve(tmpDir, normalizedPath);
    if (!settingsPath.startsWith(resolvedTmpDir + sep) && settingsPath !== resolvedTmpDir) {
      log(`[agentkit:sync] BLOCKED: editor theme output path traversal detected — ${outputPath}`);
      continue;
    }

    writePromises.push(
      (async () => {
        // Read existing settings if already rendered by prior sync step
        let existingSettings = {};
        if (existsSync(settingsPath)) {
          try {
            const raw = await readFile(settingsPath, 'utf-8');
            existingSettings = JSON.parse(raw);
          } catch {
            existingSettings = {};
          }
        }

        // Check for per-tool overrides in themeSpec (e.g. themeSpec.cursor: { ... })
        let toolColors = colorCustomizations;
        if (
          themeSpec[tool] &&
          typeof themeSpec[tool] === 'object' &&
          !RESERVED_THEME_KEYS.has(tool)
        ) {
          // Tool-specific overrides: resolve and merge on top of base colors
          const { resolved: toolOverrides } = resolveThemeMapping(themeSpec[tool], brandSpec);
          toolColors = { ...colorCustomizations, ...toolOverrides };
        }

        const mergedSettings = mergeThemeIntoSettings(existingSettings, toolColors, meta);

        // Apply baseTheme if present
        if (meta.baseTheme) {
          mergedSettings['workbench.colorTheme'] = meta.baseTheme;
        }

        // Apply font from brand if present
        if (fontFamily) {
          mergedSettings['editor.fontFamily'] = fontFamily;
        }

        await ensureDir(dirname(settingsPath));
        await writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2) + '\n', 'utf-8');

        log(
          `[agentkit:sync] Editor theme → ${outputPath}: ${Object.keys(toolColors).length} color(s) from "${meta.brand}" (${mode} mode)`
        );
      })()
    );
  }

  await Promise.all(writePromises);
}

// ---------------------------------------------------------------------------
// Claude sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .claude/settings.json from templates/claude/settings.json
 * merged with the resolved permissions.
 */
async function syncClaudeSettings(
  templatesDir,
  tmpDir,
  vars,
  version,
  mergedPermissions,
  _settingsSpec
) {
  const tplPath = join(templatesDir, 'claude', 'settings.json');
  if (!existsSync(tplPath)) return;
  let settings;
  try {
    settings = JSON.parse(await readTemplateText(tplPath));
  } catch {
    return;
  }
  // Override permissions with merged set
  settings.permissions = mergedPermissions;
  const destFile = join(tmpDir, '.claude', 'settings.json');
  await writeOutput(destFile, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Copies hook files from templates/claude/hooks, skipping hooks whose
 * owning feature is disabled. The hook→feature mapping is derived from
 * features.yaml affectsTemplates via buildHookFeatureMap().
 */
async function syncClaudeHooks(templatesDir, tmpDir, vars, version, repoName, hookFeatureMap) {
  const hooksDir = join(templatesDir, 'claude', 'hooks');
  if (!existsSync(hooksDir)) return;

  const { specific, defaultFeature } = hookFeatureMap;

  for await (const srcFile of walkDir(hooksDir)) {
    const fname = basename(srcFile);
    // Strip extension(s) to get the hook name stem (e.g. 'protect-sensitive' from 'protect-sensitive.sh')
    const stem = fname.replace(/\.(sh|ps1)$/i, '');
    // Check specific mapping first, then fall back to directory-level default feature
    const requiredFeature = specific[stem] || defaultFeature;
    if (requiredFeature && !isFeatureEnabled(requiredFeature, vars)) continue;

    const ext = extname(srcFile).toLowerCase();
    const content = await readTemplateText(srcFile);
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    await writeOutput(join(tmpDir, '.claude', 'hooks', fname), withHeader);
  }
}

/**
 * Copies individual command templates and generates team commands.
 * Skips team-TEMPLATE.md; uses it as the generator for team commands.
 */
async function syncClaudeCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  commandsSpec,
  agentsSpec
) {
  const commandsDir = join(templatesDir, 'claude', 'commands');
  if (!existsSync(commandsDir)) return;

  // Build lookup: command-name → command spec (for requiredFeature gating)
  const cmdByName = new Map();
  for (const cmd of commandsSpec?.commands || []) {
    cmdByName.set(cmd.name, cmd);
  }

  // Copy non-template command files, skipping feature-gated commands.
  // NOTE: All files in the commands directory (including non-spec files not
  // declared in commands.yaml) are subject to prefix namespacing when set.
  const prefix = vars.commandPrefix || null;
  for await (const srcFile of walkDir(commandsDir)) {
    const fname = basename(srcFile);
    if (fname === 'team-TEMPLATE.md') continue; // skip template
    // Check if this file corresponds to a feature-gated command
    const cmdName = fname.replace(/\.md$/i, '');
    const cmdSpec = cmdByName.get(cmdName);
    if (cmdSpec && !isItemFeatureEnabled(cmdSpec, vars)) continue;
    const ext = extname(srcFile).toLowerCase();
    const content = await readTemplateText(srcFile);
    const cmdVars = cmdSpec ? buildCommandVars(cmdSpec, vars) : vars;
    const rendered = renderTemplate(content, cmdVars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    // Claude Code: use subdirectory strategy for prefix (e.g. kits/check.md)
    const { dir, stem } = resolveCommandPath(cmdName, prefix, 'subdirectory');
    await writeOutput(join(tmpDir, '.claude', 'commands', dir, `${stem}${ext}`), withHeader);
  }

  // Generate team commands from team-TEMPLATE.md (gated by team-orchestration)
  // Team commands are NOT prefixed — they already have a team- namespace
  if (!isFeatureEnabled('team-orchestration', vars)) return;
  const teamTemplatePath = join(commandsDir, 'team-TEMPLATE.md');
  if (!existsSync(teamTemplatePath)) return;
  const teamTemplate = await readTemplateText(teamTemplatePath);
  for (const team of teamsSpec.teams || []) {
    const teamVars = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    const rendered = renderTemplate(teamTemplate, teamVars, teamTemplatePath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(
      join(tmpDir, '.claude', 'commands', `${getTeamCommandStem(team.id)}.md`),
      withHeader
    );
  }
}

/**
 * Generates .claude/agents/<id>.md for each agent in agentsSpec.
 */
async function syncClaudeAgents(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  agentsSpec,
  _rulesSpec
) {
  if (!isFeatureEnabled('agent-personas', vars)) return;
  const tplPath = join(templatesDir, 'claude', 'agents', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const [category, agents] of Object.entries(agentsSpec.agents || {})) {
    for (const agent of agents) {
      const agentVars = buildAgentVars(agent, category, vars);
      const rendered = renderTemplate(template, agentVars, tplPath);
      const withHeader = insertHeader(rendered, '.md', version, repoName);
      await writeOutput(join(tmpDir, '.claude', 'agents', `${agent.id}.md`), withHeader);
    }
  }
}

/**
 * Copies templates/claude/CLAUDE.md to tmpDir/CLAUDE.md.
 */
async function syncClaudeMd(templatesDir, tmpDir, vars, version, repoName) {
  const tplPath = join(templatesDir, 'claude', 'CLAUDE.md');
  if (!existsSync(tplPath)) return;
  const content = await readTemplateText(tplPath);
  const rendered = renderTemplate(content, vars, tplPath);
  const withHeader = insertHeader(rendered, '.md', version, repoName);
  await writeOutput(join(tmpDir, 'CLAUDE.md'), withHeader);
}

/**
 * Generates .claude/skills/<name>/SKILL.md for each non-team command.
 */
async function syncClaudeSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const tplPath = join(templatesDir, 'claude', 'skills', 'TEMPLATE', 'SKILL.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  const prefix = vars.commandPrefix || null;
  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    if (!isItemFeatureEnabled(cmd, vars)) continue;
    const cmdVars = buildCommandVars(cmd, vars, '.claude/state');
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    // Skills use filename prefix strategy (directory-per-skill)
    const { stem } = resolveCommandPath(cmd.name, prefix, 'filename');
    await writeOutput(join(tmpDir, '.claude', 'skills', stem, 'SKILL.md'), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Cursor sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .cursor/rules/team-<id>.mdc for each team.
 */
async function syncCursorTeams(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  agentsSpec
) {
  if (!isFeatureEnabled('team-orchestration', vars)) return;
  const tplPath = join(templatesDir, 'cursor', 'teams', 'TEMPLATE.mdc');
  const fallbackTemplate = `---
description: "Team {{teamName}} — {{teamFocus}}"
globs: []
alwaysApply: false
---
# Team: {{teamName}}

**Focus**: {{teamFocus}}
**Scope**: {{teamScope}}

## Persona

You are a member of the {{teamName}} team. Your expertise is {{teamFocus}}.
Scope all operations to the team's owned paths.

## Scope

{{teamScope}}
`;
  const teamTemplate = existsSync(tplPath) ? await readTemplateText(tplPath) : fallbackTemplate;
  for (const team of teamsSpec.teams || []) {
    const teamVars = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    const rendered = renderTemplate(teamTemplate, teamVars, tplPath);
    const withHeader = insertHeader(rendered, '.mdc', version, repoName);
    await writeOutput(
      join(tmpDir, '.cursor', 'rules', `${getTeamCommandStem(team.id)}.mdc`),
      withHeader
    );
  }
}

/**
 * Generates .cursor/commands/<name>.md for each non-team command.
 */
async function syncCursorCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const tplPath = join(templatesDir, 'cursor', 'commands', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);
  const prefix = vars.commandPrefix || null;

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    if (!isItemFeatureEnabled(cmd, vars)) continue;
    const cmdVars = buildCommandVars(cmd, vars, '.cursor/state');
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    const { stem } = resolveCommandPath(cmd.name, prefix, 'filename');
    await writeOutput(join(tmpDir, '.cursor', 'commands', `${stem}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Windsurf sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .windsurf/rules/team-<id>.md for each team.
 */
async function syncWindsurfTeams(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  agentsSpec
) {
  if (!isFeatureEnabled('team-orchestration', vars)) return;
  const tplPath = join(templatesDir, 'windsurf', 'teams', 'TEMPLATE.md');
  const fallbackTemplate = `# Team: {{teamName}}

**Focus**: {{teamFocus}}
**Scope**: {{teamScope}}

## Persona

You are a member of the {{teamName}} team. Your expertise is {{teamFocus}}.
Scope all operations to the team's owned paths.
`;
  const teamTemplate = existsSync(tplPath) ? await readTemplateText(tplPath) : fallbackTemplate;
  for (const team of teamsSpec.teams || []) {
    const teamVars = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    const rendered = renderTemplate(teamTemplate, teamVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(
      join(tmpDir, '.windsurf', 'rules', `${getTeamCommandStem(team.id)}.md`),
      withHeader
    );
  }
}

/**
 * Generates .windsurf/commands/<name>.md for each non-team command.
 */
async function syncWindsurfCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const tplPath = join(templatesDir, 'windsurf', 'templates', 'command.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);
  const prefix = vars.commandPrefix || null;

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    if (!isItemFeatureEnabled(cmd, vars)) continue;
    const cmdVars = buildCommandVars(cmd, vars, '.windsurf/state');
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    const { stem } = resolveCommandPath(cmd.name, prefix, 'filename');
    await writeOutput(join(tmpDir, '.windsurf', 'commands', `${stem}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Copilot sync helpers
// ---------------------------------------------------------------------------

/**
 * Copies copilot-instructions.md and instructions/ directory.
 */
async function syncCopilot(templatesDir, tmpDir, vars, version, repoName) {
  // copilot-instructions.md → .github/copilot-instructions.md
  const instrPath = join(templatesDir, 'copilot', 'copilot-instructions.md');
  if (existsSync(instrPath)) {
    const content = await readTemplateText(instrPath);
    const rendered = renderTemplate(content, vars, instrPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.github', 'copilot-instructions.md'), withHeader);
  }
  // instructions/ → .github/instructions/
  await syncDirectCopy(
    templatesDir,
    vars.overlayTemplatesDir,
    'copilot/instructions',
    tmpDir,
    '.github/instructions',
    vars,
    version,
    repoName
  );
}

/**
 * Generates .github/prompts/<name>.prompt.md for each non-team command.
 */
async function syncCopilotPrompts(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const tplPath = join(templatesDir, 'copilot', 'prompts', 'TEMPLATE.prompt.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);
  const prefix = vars.commandPrefix || null;

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    if (!isItemFeatureEnabled(cmd, vars)) continue;
    const cmdVars = buildCommandVars(cmd, vars, '.github/state');
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    const { stem } = resolveCommandPath(cmd.name, prefix, 'filename');
    await writeOutput(join(tmpDir, '.github', 'prompts', `${stem}.prompt.md`), withHeader);
  }
}

/**
 * Generates .github/agents/<id>.agent.md from agents in agentsSpec.
 */
async function syncCopilotAgents(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  agentsSpec,
  _rulesSpec
) {
  if (!isFeatureEnabled('agent-personas', vars)) return;
  const tplPath = join(templatesDir, 'copilot', 'agents', 'TEMPLATE.agent.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const [category, agents] of Object.entries(agentsSpec.agents || {})) {
    for (const agent of agents) {
      const agentVars = buildAgentVars(agent, category, vars);
      const rendered = renderTemplate(template, agentVars, tplPath);
      const withHeader = insertHeader(rendered, '.md', version, repoName);
      await writeOutput(join(tmpDir, '.github', 'agents', `${agent.id}.agent.md`), withHeader);
    }
  }
}

/**
 * Generates .github/chatmodes/team-<id>.chatmode.md for each team.
 */
async function syncCopilotChatModes(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  agentsSpec
) {
  if (!isFeatureEnabled('team-orchestration', vars)) return;
  const tplPath = join(templatesDir, 'copilot', 'chatmodes', 'TEMPLATE.chatmode.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const team of teamsSpec.teams || []) {
    const teamVars = buildTeamVars(team, vars, teamsSpec, agentsSpec);
    const rendered = renderTemplate(template, teamVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(
      join(tmpDir, '.github', 'chatmodes', `${getTeamCommandStem(team.id)}.chatmode.md`),
      withHeader
    );
  }
}

/**
 * Resolves the template path for a given language domain using priority:
 *   1. Platform overlay: <overlayDir>/<name>.md
 *   2. Shared domain template: <sharedDir>/<name>.md
 *   3. Generic fallback (provided by caller)
 * Returns null if none of the candidates exist.
 */
function resolveLanguageTemplate(overlayDir, sharedDir, name, fallback) {
  if (overlayDir) {
    const overlayPath = join(overlayDir, `${name}.md`);
    if (existsSync(overlayPath)) return overlayPath;
  }
  const sharedPath = join(sharedDir, `${name}.md`);
  if (existsSync(sharedPath)) return sharedPath;
  if (fallback && existsSync(fallback)) return fallback;
  return null;
}

/**
 * Generates per-domain language instruction files for a target platform.
 *
 * For each domain in rulesSpec.rules, the function renders a Markdown file
 * using this priority order:
 *   1. Platform overlay: <templatesDir>/<platform>/language-instructions/<domain>.md
 *   2. Shared template:  <templatesDir>/language-instructions/<domain>.md
 *   3. Generic fallback: <templatesDir>/language-instructions/TEMPLATE.md
 *
 * Rendered files are written to <tmpDir>/<outputSubDir>/<domain>.md.
 * A README.md is also generated into the same directory if a README template exists.
 *
 * Template vars include both project-level vars and per-domain rule vars
 * (ruleDomain, ruleDescription, ruleAppliesTo, ruleConventions).
 *
 * @param {string} templatesDir - Root templates directory
 * @param {string} tmpDir - Output root directory
 * @param {object} vars - Flattened project template variables
 * @param {string} version - AgentKit version string
 * @param {string} repoName - Repository name for header injection
 * @param {object} rulesSpec - Parsed rules.yaml spec
 * @param {string} outputSubDir - Output path relative to tmpDir (e.g. '.github/instructions/languages')
 * @param {string|null} [platform=null] - Platform key for overlay lookup (e.g. 'copilot', 'claude')
 */
async function syncLanguageInstructions(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  rulesSpec,
  outputSubDir,
  platform = null
) {
  const sharedLangDir = join(templatesDir, 'language-instructions');
  if (!existsSync(sharedLangDir)) return;

  const overlayDir = platform ? join(templatesDir, platform, 'language-instructions') : null;
  const fallbackTplPath = join(sharedLangDir, 'TEMPLATE.md');
  const rules = rulesSpec?.rules || [];
  const SAFE_DOMAIN_PATTERN = /^[a-zA-Z0-9_-]+$/;

  for (const rule of rules) {
    const domain = rule.domain;
    if (typeof domain !== 'string' || !SAFE_DOMAIN_PATTERN.test(domain)) {
      console.warn(`[agentkit:sync] Skipping rule with invalid domain: ${JSON.stringify(domain)}`);
      continue;
    }

    // Resolve template: overlay first, then shared domain-specific, then generic fallback
    const tplPath = resolveLanguageTemplate(overlayDir, sharedLangDir, domain, fallbackTplPath);
    if (!tplPath) continue;

    const template = await readTemplateText(tplPath);
    const ruleVars = buildRuleVars(rule, vars);
    const rendered = renderTemplate(template, ruleVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, outputSubDir, `${domain}.md`), withHeader);
  }

  // Generate README from shared template (overlay README takes precedence if present)
  const readmeTplPath = resolveLanguageTemplate(overlayDir, sharedLangDir, 'README', null);
  if (readmeTplPath) {
    const readmeTemplate = await readTemplateText(readmeTplPath);
    const rendered = renderTemplate(readmeTemplate, vars, readmeTplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, outputSubDir, 'README.md'), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Gemini sync helper
// ---------------------------------------------------------------------------

/**
 * Copies templates/gemini/GEMINI.md → tmpDir/GEMINI.md
 * and templates/gemini/* → tmpDir/.gemini/
 */
async function syncGemini(templatesDir, tmpDir, vars, version, repoName) {
  const geminiDir = join(templatesDir, 'gemini');
  if (!existsSync(geminiDir)) return;

  for await (const srcFile of walkDir(geminiDir)) {
    const fname = basename(srcFile);
    const ext = extname(srcFile).toLowerCase();
    const content = await readTemplateText(srcFile);
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);

    if (fname === 'GEMINI.md') {
      // Root-level GEMINI.md
      await writeOutput(join(tmpDir, 'GEMINI.md'), withHeader);
    } else {
      // All other files go into .gemini/
      const relPath = relative(geminiDir, srcFile);
      await writeOutput(join(tmpDir, '.gemini', relPath), withHeader);
    }
  }
}

// ---------------------------------------------------------------------------
// Codex sync helper
// ---------------------------------------------------------------------------

/**
 * Generates .agents/skills/<name>/SKILL.md for each non-team command.
 */
async function syncCodexSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const tplPath = join(templatesDir, 'codex', 'skills', 'TEMPLATE', 'SKILL.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);
  const prefix = vars.commandPrefix || null;

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    if (!isItemFeatureEnabled(cmd, vars)) continue;
    const cmdVars = buildCommandVars(cmd, vars, '.agents/state');
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    const { stem } = resolveCommandPath(cmd.name, prefix, 'filename');
    await writeOutput(join(tmpDir, '.agents', 'skills', stem, 'SKILL.md'), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Org-meta skill distribution + uptake detection
// ---------------------------------------------------------------------------

/**
 * Resolves the path to the org-meta skills directory.
 * Priority: ORG_META_PATH env var → ~/repos/org-meta (default)
 *
 * @returns {string}
 */
function resolveOrgMetaSkillsDir() {
  const base = process.env.ORG_META_PATH
    ? resolve(process.env.ORG_META_PATH)
    : resolve(process.env.HOME || process.env.USERPROFILE || '~', 'repos', 'org-meta');
  return join(base, 'skills');
}

/**
 * Copies org-meta skills (source: org-meta) into tmpDir/.agents/skills/<name>/SKILL.md.
 * Non-destructive: if the skill already exists in projectRoot with different content,
 * the file is NOT written to tmpDir — the local version is preserved.
 *
 * @param {string} tmpDir - Temp directory for sync output
 * @param {string} projectRoot - Actual project root (for diffing existing files)
 * @param {object} skillsSpec - Parsed skills.yaml
 * @param {function} log - Logger
 */
async function syncOrgMetaSkills(tmpDir, projectRoot, skillsSpec, log) {
  const orgMetaSkillsDir = resolveOrgMetaSkillsDir();
  if (!existsSync(orgMetaSkillsDir)) {
    log(`[agentkit:sync] org-meta skills: directory not found at ${orgMetaSkillsDir} — skipping`);
    return;
  }

  const orgMetaSkills = (skillsSpec.skills || []).filter((s) => s.source === 'org-meta');

  for (const skill of orgMetaSkills) {
    const srcPath = join(orgMetaSkillsDir, skill.name, 'SKILL.md');
    if (!existsSync(srcPath)) {
      log(`[agentkit:sync] org-meta skill '${skill.name}' not found at ${srcPath} — skipping`);
      continue;
    }

    const destRelPath = join('.agents', 'skills', skill.name, 'SKILL.md');
    const destProjectPath = join(projectRoot, destRelPath);

    // If local version exists and differs, preserve it (non-destructive)
    if (existsSync(destProjectPath)) {
      const localContent = readFileSync(destProjectPath, 'utf-8');
      const srcContent = readFileSync(srcPath, 'utf-8');
      if (localContent !== srcContent) {
        log(
          `[agentkit:sync] org-meta skill '${skill.name}' differs from local — preserving local copy`
        );
        continue;
      }
    }

    const content = readFileSync(srcPath, 'utf-8');
    await writeOutput(join(tmpDir, destRelPath), content);
  }
}

/**
 * Scans projectRoot/.agents/skills/ for skill directories not listed in skills.yaml.
 * Appends unknown skill names to .agents/skills/_unknown/report.md in tmpDir.
 * This is the non-destructive uptake mechanism — unknown skills are never overwritten,
 * only reported. Use `pnpm ak:propose-skill <name>` to promote them to org-meta.
 *
 * @param {string} tmpDir - Temp directory for sync output
 * @param {string} projectRoot - Actual project root (for reading existing skills)
 * @param {object} skillsSpec - Parsed skills.yaml
 * @param {string} syncDate - ISO date string (YYYY-MM-DD)
 * @param {function} log - Logger
 */
async function syncUnknownSkillsReport(tmpDir, projectRoot, skillsSpec, syncDate, log) {
  const localSkillsDir = join(projectRoot, '.agents', 'skills');
  if (!existsSync(localSkillsDir)) return;

  const knownNames = new Set((skillsSpec.skills || []).map((s) => s.name));
  let entries;
  try {
    entries = await readdir(localSkillsDir, { withFileTypes: true });
  } catch {
    return;
  }

  const unknownSkills = entries
    .filter((e) => e.isDirectory() && e.name !== '_unknown' && !knownNames.has(e.name))
    .map((e) => e.name);

  if (unknownSkills.length === 0) return;

  log(
    `[agentkit:sync] Found ${unknownSkills.length} local skill(s) not in skills.yaml: ${unknownSkills.join(', ')}`
  );

  const reportPath = join(tmpDir, '.agents', 'skills', '_unknown', 'report.md');

  // Read existing report from projectRoot (if any) to append rather than replace
  const existingReportPath = join(projectRoot, '.agents', 'skills', '_unknown', 'report.md');
  let existingContent = '';
  if (existsSync(existingReportPath)) {
    existingContent = readFileSync(existingReportPath, 'utf-8');
  }

  // Build new entries (only skills not already listed in the report)
  const newEntries = unknownSkills.filter((name) => !existingContent.includes(`| \`${name}\``));
  if (newEntries.length === 0) return;

  const header = existingContent
    ? ''
    : `# Unknown Skills — Uptake Candidates\n\nSkills found in \`.agents/skills/\` that are not in \`skills.yaml\`.\n\nTo promote a skill: \`pnpm ak:propose-skill <name>\`\n\n| Skill | First Seen | Action |\n|-------|------------|--------|\n`;

  const rows = newEntries.map((name) => `| \`${name}\` | ${syncDate} | pending |\n`).join('');
  await writeOutput(reportPath, existingContent + header + rows);
}

// ---------------------------------------------------------------------------
// Warp sync helper
// ---------------------------------------------------------------------------

/**
 * Copies templates/warp/WARP.md → tmpDir/WARP.md.
 */
async function syncWarp(templatesDir, tmpDir, vars, version, repoName) {
  const tplPath = join(templatesDir, 'warp', 'WARP.md');
  if (!existsSync(tplPath)) return;
  const content = await readTemplateText(tplPath);
  const rendered = renderTemplate(content, vars, tplPath);
  const withHeader = insertHeader(rendered, '.md', version, repoName);
  await writeOutput(join(tmpDir, 'WARP.md'), withHeader);
}

// ---------------------------------------------------------------------------
// Cline sync helper
// ---------------------------------------------------------------------------

/**
 * Generates .clinerules/<domain>.md for each rule domain.
 */
async function syncClineRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec) {
  const tplPath = join(templatesDir, 'cline', 'clinerules', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const rule of rulesSpec.rules || []) {
    const ruleVars = buildRuleVars(rule, vars);
    const rendered = renderTemplate(template, ruleVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.clinerules', `${rule.domain}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Roo sync helper
// ---------------------------------------------------------------------------

/**
 * Generates .roo/rules/<domain>.md for each rule domain.
 */
async function syncRooRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec) {
  const tplPath = join(templatesDir, 'roo', 'rules', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const rule of rulesSpec.rules || []) {
    const ruleVars = buildRuleVars(rule, vars);
    const rendered = renderTemplate(template, ruleVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.roo', 'rules', `${rule.domain}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// MCP / A2A sync helper
// ---------------------------------------------------------------------------

/**
 * Copies templates/mcp/ → tmpDir/.mcp/
 * agentsSpec and teamsSpec are accepted for API symmetry and future use.
 */
async function syncAgentAnalysis(agentkitRoot, tmpDir) {
  try {
    const { loadFullAgentGraph, renderAllMatrices } = await import('./agent-analysis.mjs');
    const graph = loadFullAgentGraph(agentkitRoot);
    if (graph.agents.length === 0) return;
    const content = renderAllMatrices(graph);
    await writeOutput(join(tmpDir, 'docs', 'agents', 'agent-team-matrix.md'), content);
  } catch {
    // Agent analysis is non-critical — skip silently if it fails
  }
}

async function syncA2aConfig(
  tmpDir,
  vars,
  version,
  repoName,
  _agentsSpec,
  _teamsSpec,
  templatesDir
) {
  const mcpDir = join(templatesDir, 'mcp');
  if (!existsSync(mcpDir)) return;
  for await (const srcFile of walkDir(mcpDir)) {
    const relPath = relative(mcpDir, srcFile);
    const ext = extname(srcFile).toLowerCase();
    let content;
    try {
      content = await readTemplateText(srcFile);
    } catch {
      const destFile = join(tmpDir, '.mcp', relPath);
      await ensureDir(dirname(destFile));
      await cp(srcFile, destFile, { force: true });
      continue;
    }
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    await writeOutput(join(tmpDir, '.mcp', relPath), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Heuristic defaults — infer sensible values from project/team context
// ---------------------------------------------------------------------------

/**
 * Infers maxTaskTurns based on team size from project spec.
 * Larger teams tend to have broader tasks requiring more turns.
 */
function inferMaxTaskTurns(teamSize) {
  switch (teamSize) {
    case 'solo':
      return 15;
    case 'small':
      return 25;
    case 'medium':
    case 'large':
      return 35;
    default:
      return 25;
  }
}

/**
 * Infers maxHandoffChainDepth based on the number of teams.
 * More teams = more legitimate handoff paths.
 */
function inferMaxHandoffChainDepth(teamCount) {
  if (teamCount <= 3) return 3;
  if (teamCount <= 6) return 5;
  return 7;
}

/**
 * Infers maxStagnationTurns based on project phase.
 * Greenfield work involves more exploration; maintenance should be tighter.
 */
function inferMaxStagnationTurns(projectPhase) {
  switch (projectPhase) {
    case 'greenfield':
      return 15;
    case 'active':
      return 10;
    case 'maintenance':
    case 'legacy':
      return 5;
    default:
      return 10;
  }
}

/**
 * Infers testingCoverage target based on project phase.
 */
function inferTestingCoverage(projectPhase) {
  switch (projectPhase) {
    case 'greenfield':
      return '60';
    case 'active':
      return '80';
    case 'maintenance':
    case 'legacy':
      return '90';
    default:
      return '80';
  }
}

// Variable builder helpers (private — used by tool-specific sync functions)
// ---------------------------------------------------------------------------

/**
 * Resolves which agent personas should be loaded for a given team.
 * Priority: 1) explicit `agents` list in teams.yaml, 2) category match.
 * Returns an array of { id, name, role, category } objects.
 */
/**
 * Maps raw team objects from teams.yaml into display-ready objects for templates.
 */
export function buildTeamsList(rawTeams) {
  return (rawTeams || []).map((t) => ({
    id: t.id || '',
    name: t.name || '',
    focus: t.focus || '',
    scopeDisplay: Array.isArray(t.scope) ? t.scope.map((s) => `\`${s}\``).join(', ') : '',
    acceptsDisplay: Array.isArray(t.accepts) ? t.accepts.join(', ') : '',
    handoffDisplay:
      Array.isArray(t['handoff-chain']) && t['handoff-chain'].length > 0
        ? t['handoff-chain'].join(' → ')
        : '—',
  }));
}

export function resolveTeamAgents(teamId, team, agentsSpec) {
  const allAgents = agentsSpec?.agents || {};
  const result = [];

  // If the team has an explicit agents list, use it
  if (Array.isArray(team.agents) && team.agents.length > 0) {
    for (const agentId of team.agents) {
      // Search across all categories for this agent ID
      for (const [category, agents] of Object.entries(allAgents)) {
        if (!Array.isArray(agents)) continue;
        const found = agents.find((a) => a.id === agentId);
        if (found) {
          result.push({ id: found.id, name: found.name, role: found.role, category });
          break;
        }
      }
    }
    return result;
  }

  // Fallback: match agents whose category === teamId
  if (Array.isArray(allAgents[teamId])) {
    for (const agent of allAgents[teamId]) {
      result.push({ id: agent.id, name: agent.name, role: agent.role, category: teamId });
    }
  }

  return result;
}

function buildTeamVars(team, vars, teamsSpec, agentsSpec) {
  // Resolve agent personas for this team
  const teamAgents = resolveTeamAgents(team.id, team, agentsSpec);
  const teamHasAgents = teamAgents.length > 0;
  const teamAgentSummaries = teamHasAgents
    ? teamAgents
        .map(
          (a) =>
            `### ${a.name}\n\n**Role:** ${typeof a.role === 'string' ? a.role.trim() : a.role || 'N/A'}\n`
        )
        .join('\n')
    : '';

  return {
    ...vars,
    teamName: team.name || team.id,
    teamId: team.id,
    teamFocus: team.focus || '',
    teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '',
    teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : team.accepts || '',
    teamHandoffChain: Array.isArray(team['handoff-chain'])
      ? team['handoff-chain'].join(' → ')
      : team['handoff-chain'] || '',
    maxTaskTurns: team['max-task-turns'] ?? inferMaxTaskTurns(vars.teamSize),
    maxHandoffChainDepth:
      team['max-handoff-chain-depth'] ?? inferMaxHandoffChainDepth(teamsSpec?.teams?.length || 5),
    maxStagnationTurns: team['max-stagnation-turns'] ?? inferMaxStagnationTurns(vars.projectPhase),
    teamHasAgents,
    teamAgentSummaries,
  };
}

/**
 * Build a compact area→team routing string from teams.yaml intake config.
 * Used as a template variable so all platform templates share the same routing.
 */
function buildAreaRoutingTable(teamsIntake) {
  const defaultRouting = {
    backend: 'backend',
    frontend: 'frontend',
    data: 'data',
    infra: 'infra',
    devops: 'devops',
    testing: 'testing',
    security: 'security',
    docs: 'docs',
    product: 'product',
    quality: 'quality',
    cli: 'backend',
    'sync-engine': 'devops',
  };
  const routing = teamsIntake?.routing || {};
  const merged = { ...defaultRouting };
  for (const [area, team] of Object.entries(routing)) {
    merged[area] = team; // Use bare team IDs consistently
  }
  return Object.entries(merged)
    .map(([area, team]) => `\`${area}\`→${team}`)
    .join(', ');
}

/**
 * Returns true if the item's requiredFeature is enabled (or if it has no requiredFeature).
 * Items without a requiredFeature are always enabled.
 */
function isItemFeatureEnabled(item, vars) {
  if (!item.requiredFeature) return true;
  return isFeatureEnabled(item.requiredFeature, vars);
}

/**
 * Returns true if a feature is enabled (or if feature vars are not loaded).
 * Uses the canonical `feature_<id>` var. Missing vars default to enabled
 * (graceful degradation for repos without features.yaml).
 */
function isFeatureEnabled(featureId, vars) {
  const featureVar = `feature_${featureId.replace(/-/g, '_')}`;
  return vars[featureVar] !== false;
}

// HOOK_FEATURE_MAP is derived at sync time from features.yaml affectsTemplates
// via buildHookFeatureMap(). See syncClaudeHooks() for usage.

function buildCommandVars(cmd, vars, stateDir = '.claude/state') {
  let prompt = typeof cmd.prompt === 'string' ? cmd.prompt.trim() : '';
  if (prompt) {
    prompt = prompt.replaceAll('{{stateDir}}', stateDir);
  }
  const prefix = vars.commandPrefix || null;
  const prefixedName = prefix ? `${prefix}-${cmd.name}` : cmd.name;
  return {
    ...vars,
    commandName: cmd.name,
    commandPrefixedName: prefixedName,
    isSyncBacklog: cmd.name === 'sync-backlog',
    commandDescription:
      typeof cmd.description === 'string' ? cmd.description.trim() : cmd.description || '',
    commandFlags: formatCommandFlags(cmd.flags),
    commandPrompt: prompt,
  };
}

function buildAgentVars(agent, category, vars) {
  const focus = agent.focus || [];
  const responsibilities = agent.responsibilities || [];
  const tools = agent['preferred-tools'] || agent.tools || [];
  const conventions = agent.conventions || [];
  const examples = agent.examples || [];
  const antiPatterns = agent['anti-patterns'] || [];
  const domainRules = agent['domain-rules'] || [];

  return {
    ...vars,
    agentName: agent.name,
    agentId: agent.id,
    agentCategory: category,
    agentRole: typeof agent.role === 'string' ? agent.role.trim() : agent.role || '',
    agentFocusList: focus.map((f) => `- ${f}`).join('\n'),
    agentResponsibilitiesList: responsibilities.map((r) => `- ${r}`).join('\n'),
    agentToolsList: tools.map((t) => `- ${t}`).join('\n'),
    agentConventions: conventions.length > 0 ? conventions.map((c) => `- ${c}`).join('\n') : '',
    agentExamples:
      examples.length > 0
        ? examples
            .map((e) => `### ${e.title || 'Example'}\n\`\`\`\n${(e.code || '').trim()}\n\`\`\``)
            .join('\n\n')
        : '',
    agentAntiPatterns: antiPatterns.length > 0 ? antiPatterns.map((a) => `- ${a}`).join('\n') : '',
    agentDomainRules: domainRules.length > 0 ? domainRules.map((r) => `- ${r}`).join('\n') : '',
  };
}

/**
 * Builds precomputed JSON strings for branch protection template variables.
 * Filters invalid entries and returns valid JSON array literals for use in
 * heredoc payloads sent to the GitHub API.
 */
export function buildBranchProtectionJson(vars) {
  const statusChecks = vars.bpRequiredStatusChecks ?? [];
  const statusChecksJson = JSON.stringify(
    Array.isArray(statusChecks) ? statusChecks.filter((s) => typeof s === 'string') : []
  );
  const scanningToolsRaw = vars.bpCodeScanningTools ?? [];
  const scanningTools = Array.isArray(scanningToolsRaw)
    ? scanningToolsRaw.filter(
        (t) => t && typeof t === 'object' && typeof t.name === 'string' && t.name.trim() !== ''
      )
    : [];
  const scanningToolsJson = JSON.stringify(
    scanningTools.map((t) => ({
      tool: t.name.trim(),
      security_alerts_threshold:
        typeof t.securityAlertThreshold === 'string' ? t.securityAlertThreshold : 'none',
      alerts_threshold: typeof t.alertThreshold === 'string' ? t.alertThreshold : 'none',
    }))
  );
  return { statusChecksJson, scanningToolsJson };
}

export function formatConventionLine(c) {
  if (typeof c === 'string') return `- ${c}`;
  const id = c.id || '';
  const rule = c.rule || '';
  const badges = [];
  if (c.type) badges.push(c.type);
  if (c.phase) {
    const phases = Array.isArray(c.phase) ? c.phase : [c.phase];
    badges.push(`phase: ${phases.join(', ')}`);
  }
  const suffix = badges.length > 0 ? ` _(${badges.join(' · ')})_` : '';
  return `- **[${id}]** ${rule}${suffix}`;
}

export function buildRuleVars(rule, vars) {
  const appliesTo = rule['applies-to'] || [];
  const conventions = rule.conventions || [];
  const enforcement = conventions.filter((c) => c.type === 'enforcement');
  // Conventions without an explicit type default to advisory (see ADR-08)
  const advisory = conventions.filter((c) => c.type !== 'enforcement');
  return {
    ...vars,
    ruleDomain: rule.domain,
    ruleDescription:
      typeof rule.description === 'string' ? rule.description.trim() : rule.description || '',
    ruleAppliesTo: appliesTo.join('\n'),
    ruleConventions: conventions.map(formatConventionLine).join('\n'),
    ruleEnforcementConventions: enforcement.map(formatConventionLine).join('\n'),
    ruleAdvisoryConventions: advisory.map(formatConventionLine).join('\n'),
    ruleHasEnforcement: enforcement.length > 0 ? 'true' : '',
    ruleHasAdvisory: advisory.length > 0 ? 'true' : '',
  };
}

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
  templateMetaMap.clear();
  templateTextCache.clear();

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
      log(`[agentkit:sync] Warning: could not load sync-guard: ${err?.message ?? err}`);
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
          log('[agentkit:sync] Aborted — commit or stash your changes first.');
          return;
        }
        // 'stash' handled inside promptDirtyFileAction; 'continue' falls through
      } else {
        console.warn('[agentkit:sync] Warning: uncommitted changes in protected directories:');
        for (const f of files) console.warn(`  ${f}`);
      }
    }
  }

  if (dryRun) {
    log('[agentkit:sync] Dry-run mode — no files will be written.');
  }
  if (diff) {
    log('[agentkit:sync] Diff mode — showing what would change.');
  }
  log('[agentkit:sync] Starting sync...');

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
  const agentsSpec = readYaml(resolve(agentkitRoot, 'spec', 'agents.yaml')) || {};
  const skillsSpec = readYaml(resolve(agentkitRoot, 'spec', 'skills.yaml')) || {};
  const docsSpec = readYaml(resolve(agentkitRoot, 'spec', 'docs.yaml')) || {};
  const sectionsSpec = readYaml(resolve(agentkitRoot, 'spec', 'sections.yaml')) || {};
  const projectSpec = readYaml(resolve(agentkitRoot, 'spec', 'project.yaml'));

  // 2. Detect overlay
  const overlaySelection = resolveOverlaySelection(agentkitRoot, projectRoot, flags);
  const repoName = overlaySelection.repoName;
  log(`[agentkit:sync] Using overlay: ${repoName} (${overlaySelection.reason})`);

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
    log(`[agentkit:sync] Features: ${enabledFeatures.size} / ${features.length} enabled`);
  } catch {
    // features.yaml may not exist yet in older repos — degrade gracefully
    log('[agentkit:sync] Features: spec not found, all features assumed enabled');
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
    primaryStack: overlaySettings.primaryStack || 'auto',
    commandPrefix: overlaySettings.commandPrefix || null,
    syncDate: new Date().toISOString().slice(0, 10),
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

  log(`[agentkit:sync] Repo: ${vars.repoName}, Version: ${version}`);
  if (flags?.only) {
    log(`[agentkit:sync] Syncing only: ${[...targets].join(', ')}`);
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
          '[agentkit:sync] Editor theme: all output targets exist (scaffold-once) — skipping. Use --overwrite to regenerate.'
        );
      }
    }

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
          filteredRulesSpec
        ),
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
      log(`[agentkit:sync] Dry-run: would generate ${total} file(s):`);
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
        `[agentkit:sync] Diff: ${createCount} create, ${updateCount} update, ${skipCount} unchanged/skip`
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
          log('[agentkit:sync] Skipped — no files written.');
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
            log(`[agentkit:sync] Skipping ${skipSet.size} file(s) by user choice.`);
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
    log('[agentkit:sync] Writing outputs...');
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
        console.error(`[agentkit:sync] BLOCKED: path traversal detected — ${normalizedRel}`);
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
            // User edited this file — attempt three-way merge
            const cachePath = resolve(scaffoldCacheDir, relPath);
            const newContent = await readFile(srcFile, 'utf-8');

            if (existsSync(cachePath)) {
              const baseContent = readFileSync(cachePath, 'utf-8');
              const diskText = diskContent.toString('utf-8');
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
                    `[agentkit:sync] CONFLICT in ${normalizedRel} — resolve <<<< markers manually`
                  );
                } else {
                  scaffoldResults.managedMerged.push(normalizedRel);
                  logVerbose(`  merged ${normalizedRel} (user edits + template changes combined)`);
                }
                return;
              }
              // git merge-file unavailable — fall back to skip
            }

            // No cache or git unavailable — skip and preserve user edits
            skippedScaffold++;
            scaffoldResults.managedPreserved.push(normalizedRel);
            if (!existsSync(resolve(scaffoldCacheDir, relPath))) {
              scaffoldResults.managedNoCache.push(normalizedRel);
            }
            logVerbose(
              `  skipped ${normalizedRel} (user edits detected, hash: ${prevHash} → ${diskHash})`
            );
            return;
          }
          // Hash matches or no previous hash — safe to overwrite (pristine)
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
      if (existsSync(destFile)) {
        const newHash = newManifestFiles[normalizedRel]?.hash;
        if (newHash) {
          const existingContent = await readFile(destFile);
          const existingHash = createHash('sha256')
            .update(existingContent)
            .digest('hex')
            .slice(0, 12);
          if (existingHash === newHash) {
            logVerbose(`  unchanged ${normalizedRel} (content identical, skipping write)`);
            return;
          }
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
        console.error(`[agentkit:sync] Failed to write: ${normalizedRel} — ${err.message}`);
      }
    });

    if (failedFiles.length > 0) {
      console.error(`[agentkit:sync] Error: ${failedFiles.length} file(s) failed to write:`);
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
      log('[agentkit:sync] Scaffold summary:');
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
          console.warn(`[agentkit:sync] BLOCKED: path traversal in manifest — ${prevFile}`);
          return;
        }
        if (existsSync(orphanPath)) {
          try {
            await unlink(orphanPath);
            cleanedCount++;
            logVerbose(`[agentkit:sync] Cleaned stale file: ${prevFile}`);
          } catch (err) {
            console.warn(
              `[agentkit:sync] Warning: could not clean stale file ${prevFile} — ${err.message}`
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
      console.warn(`[agentkit:sync] Warning: could not write manifest — ${err.message}`);
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
              logVerbose(`[agentkit:sync] Prettier batch timed out, continuing...`);
            }
            // prettier may fail on some files (e.g. non-parseable) — continue
          }
        }
        if (formattedCount > 0) {
          logVerbose(
            `[agentkit:sync] Formatted ${formattedCount} generated file(s) with Prettier.`
          );
        }
      } catch {
        // If prettier is not available or fails entirely, just continue
      }
    }

    if (skippedScaffold > 0) {
      log(`[agentkit:sync] Skipped ${skippedScaffold} project-owned file(s) (already exist).`);
    }
    if (cleanedCount > 0) {
      log(`[agentkit:sync] Cleaned ${cleanedCount} stale file(s) from previous sync.`);
    }

    // 11. Post-sync summary
    printSyncSummary(fileSummary, targets, { quiet });
    const completeness = computeProjectCompleteness(projectSpec);
    if (completeness.total > 0) {
      log(
        `[agentkit:sync] project.yaml completeness: ${completeness.percent}% (${completeness.present}/${completeness.total} fields populated)`
      );
      if (completeness.missing.length > 0) {
        log(`[agentkit:sync] Top missing fields: ${completeness.missing.slice(0, 5).join(', ')}`);
      }
    }
    log(`[agentkit:sync] Done! Generated ${count} files.`);

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
    await rm(tmpDir, { recursive: true, force: true });
  }
}
