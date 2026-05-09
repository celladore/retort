/**
 * Retort — Platform Syncer
 * Per-tool sync functions that render templates and write output files.
 * Extracted from synchronize.mjs (Step 6 of modularization).
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { cp, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path, { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'path';
import {
  filterByTier,
  mergeThemeIntoSettings,
  resolveThemeMapping,
  validateBrandSpec,
  validateThemeSpec,
} from './brand-resolver.mjs';

import { readYaml } from './spec-loader.mjs';
import { insertHeader, parseTemplateFrontmatter, renderTemplate } from './template-utils.mjs';
import {
  buildAgentRegistry,
  buildAgentVars,
  buildCommandVars,
  buildRuleVars,
  buildTeamVars,
  getTeamCommandStem,
  isFeatureEnabled,
  isItemFeatureEnabled,
  resolveCommandPath,
} from './var-builders.mjs';
import { setTemplateMeta } from './scaffold-engine.mjs';

// ---------------------------------------------------------------------------
// Local utilities (avoid circular import — these helpers live here)
// ---------------------------------------------------------------------------

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function writeOutput(filePath, content) {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

async function* walkDir(dir) {
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

async function runConcurrent(items, fn, concurrency = 50) {
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(fn));
  }
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
  // Import collectTemplateFiles lazily to avoid top-level circular dep
  const { collectTemplateFiles } = await import('./overlay-resolver.mjs');
  const { readTemplateText } = await import('./spec-loader.mjs');

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
      setTemplateMeta(destRelPath, meta);
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
export async function syncAgentsMd(templatesDir, tmpDir, vars, version, repoName) {
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
export async function syncRootDocs(_templatesDir, _tmpDir, _vars, _version, _repoName) {
  // Intentionally empty — templates/root is fully handled by syncAgentsMd.
  // Reserved for future overlay-specific root-doc generation.
}

/**
 * Copies templates/github to tmpDir/.github.
 */
export async function syncGitHub(templatesDir, tmpDir, vars, version, repoName) {
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
export async function syncEditorConfigs(templatesDir, tmpDir, vars, version, repoName) {
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
export async function syncScripts(templatesDir, tmpDir, vars, version, repoName) {
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
 * Appends (or updates) the Retort merge-driver section in .gitattributes.
 * Preserves all user-authored content outside the markers. Writes the result
 * to tmpDir so the standard manifest/diff/swap pipeline handles it.
 */
export async function syncGitattributes(tmpDir, projectRoot, version) {
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
 * @param {Set<string>} [skipOutputs] - Output paths to skip (scaffold-once)
 */
export async function syncEditorTheme(agentkitRoot, tmpDir, vars, log, flags, skipOutputs) {
  if (!vars.editorThemeEnabled) return;

  const brandSpec = readYaml(resolve(agentkitRoot, 'spec', 'brand.yaml'));
  if (!brandSpec) {
    log('[retort:sync] Editor theme enabled but no brand.yaml found — skipping');
    return;
  }

  // Validate brand spec
  const validation = validateBrandSpec(brandSpec);
  for (const err of validation.errors) {
    log(`[retort:sync] Brand error: ${err}`);
  }
  for (const warn of validation.warnings) {
    if (process.env.DEBUG) log(`[retort:sync] Brand warning: ${warn}`);
  }
  if (validation.errors.length > 0) {
    log('[retort:sync] Brand validation failed — skipping editor theme');
    return;
  }

  const themeSpec = readYaml(resolve(agentkitRoot, 'spec', 'editor-theme.yaml'));
  if (!themeSpec || !themeSpec.enabled) {
    log('[retort:sync] Editor theme spec not found or disabled — skipping');
    return;
  }

  // Validate tier/scheme values
  const themeValidation = validateThemeSpec(themeSpec);
  for (const warn of themeValidation.warnings) {
    log(`[retort:sync] Theme config warning: ${warn}`);
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
      log(`[retort:sync] Theme warning (light): ${warn}`);
    }
  }
  if (mode === 'both' || mode === 'dark') {
    const darkMapping = themeSpec.dark || {};
    const { resolved, warnings } = resolveThemeMapping(darkMapping, brandSpec);
    darkColors = resolved;
    for (const warn of warnings) {
      log(`[retort:sync] Theme warning (dark): ${warn}`);
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
      `[retort:sync] Brand tier "${tier}" — filtered to ${Object.keys(colorCustomizations).length} color slots`
    );
  }

  if (Object.keys(colorCustomizations).length === 0) {
    log('[retort:sync] No colors resolved from editor theme — skipping');
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
  const { sep } = await import('path');
  const resolvedTmpDir = resolve(tmpDir);
  const writePromises = [];
  for (const [tool, outputPath] of Object.entries(outputs)) {
    if (!outputPath) continue; // null = skip this target

    // Scaffold-once: skip targets that already exist in projectRoot (unless --overwrite/--force)
    if (skipOutputs && skipOutputs.has(outputPath)) {
      log(`[retort:sync] Editor theme: ${outputPath} exists (scaffold-once) — skipping`);
      continue;
    }

    // Path traversal protection — resolve and verify the output stays inside tmpDir
    const normalizedPath = String(outputPath).replace(/^\/+/, ''); // strip leading slashes
    const settingsPath = resolve(tmpDir, normalizedPath);
    if (!settingsPath.startsWith(resolvedTmpDir + sep) && settingsPath !== resolvedTmpDir) {
      log(`[retort:sync] BLOCKED: editor theme output path traversal detected — ${outputPath}`);
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
          `[retort:sync] Editor theme → ${outputPath}: ${Object.keys(toolColors).length} color(s) from "${meta.brand}" (${mode} mode)`
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
export async function syncClaudeSettings(
  templatesDir,
  tmpDir,
  vars,
  version,
  mergedPermissions,
  _settingsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncClaudeHooks(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  hookFeatureMap
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncClaudeCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  commandsSpec,
  agentsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncClaudeAgents(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  agentsSpec,
  _rulesSpec,
  registry = new Map()
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
  if (!isFeatureEnabled('agent-personas', vars)) return;
  const tplPath = join(templatesDir, 'claude', 'agents', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  const disabledAgents = vars.retortDisabledAgents || new Set();
  const agentMap = vars.retortAgentMap || {};

  for (const [category, agents] of Object.entries(agentsSpec.agents || {})) {
    for (const agent of agents) {
      // Skip agents disabled in .retortconfig
      if (disabledAgents.has(agent.id)) continue;

      const agentVars = buildAgentVars(agent, category, vars, registry);

      // Inject remapping note if this agent has been remapped in .retortconfig
      const remapTarget = agentMap[agent.id];
      agentVars.retortRemapTarget = remapTarget || '';

      const rendered = renderTemplate(template, agentVars, tplPath);
      const withHeader = insertHeader(rendered, '.md', version, repoName);
      await writeOutput(join(tmpDir, '.claude', 'agents', `${agent.id}.md`), withHeader);
    }
  }
}

/**
 * Generates .claude/agents/REGISTRY.md and .claude/agents/REGISTRY.json —
 * always-regenerated agent directory files for orchestrator and peer lookup.
 */
export async function syncAgentRegistry(tmpDir, agentsSpec, version, repoName) {
  const registry = buildAgentRegistry(agentsSpec);
  const allAgents = [...registry.values()];

  if (allAgents.length === 0) return;

  // REGISTRY.md — markdown table
  const rows = allAgents
    .map(
      (a) =>
        `| \`${a.id}\` | ${a.name} | ${a.category} | ${a.accepts.join(', ')} | ${a.roleSummary} |`
    )
    .join('\n');
  // Use a content hash of the rows so the header is stable between syncs and only
  // changes when agent definitions actually change (not just because the date rolled over).
  const contentHash = createHash('sha256').update(rows).digest('hex').slice(0, 8);
  const header = `<!-- generated_by: retort | last_model: sync-engine | content_hash: ${contentHash} -->\n# Agent Registry\n\n| ID | Name | Category | Accepts | Role |\n|---|---|---|---|---|\n`;
  await writeOutput(join(tmpDir, '.claude', 'agents', 'REGISTRY.md'), header + rows + '\n');

  // REGISTRY.json — machine-readable
  const json = JSON.stringify({ version, agents: allAgents }, null, 2);
  await writeOutput(join(tmpDir, '.claude', 'agents', 'REGISTRY.json'), json + '\n');
}

/**
 * Copies templates/claude/CLAUDE.md to tmpDir/CLAUDE.md.
 */
export async function syncClaudeMd(templatesDir, tmpDir, vars, version, repoName) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncClaudeSkills(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
    const segments = vars.skillsCategorised
      ? ['.claude', 'skills', cmdVars.commandCategory, stem, 'SKILL.md']
      : ['.claude', 'skills', stem, 'SKILL.md'];
    await writeOutput(join(tmpDir, ...segments), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Cursor sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .cursor/rules/team-<id>.mdc for each team.
 */
export async function syncCursorTeams(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  agentsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncCursorCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncWindsurfTeams(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  agentsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncWindsurfCommands(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncCopilot(templatesDir, tmpDir, vars, version, repoName) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncCopilotPrompts(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  commandsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncCopilotAgents(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  agentsSpec,
  _rulesSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncCopilotChatModes(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  teamsSpec,
  agentsSpec
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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

// ---------------------------------------------------------------------------
// Language instruction helpers (shared across platforms)
// ---------------------------------------------------------------------------

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
 * @param {string} templatesDir - Root templates directory
 * @param {string} tmpDir - Output root directory
 * @param {object} vars - Flattened project template variables
 * @param {string} version - Retort version string
 * @param {string} repoName - Repository name for header injection
 * @param {object} rulesSpec - Parsed rules.yaml spec
 * @param {string} outputSubDir - Output path relative to tmpDir
 * @param {string|null} [platform=null] - Platform key for overlay lookup
 */
export async function syncLanguageInstructions(
  templatesDir,
  tmpDir,
  vars,
  version,
  repoName,
  rulesSpec,
  outputSubDir,
  platform = null
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
  const sharedLangDir = join(templatesDir, 'language-instructions');
  if (!existsSync(sharedLangDir)) return;

  const overlayDir = platform ? join(templatesDir, platform, 'language-instructions') : null;
  const fallbackTplPath = join(sharedLangDir, 'TEMPLATE.md');
  const rules = rulesSpec?.rules || [];
  const SAFE_DOMAIN_PATTERN = /^[a-zA-Z0-9_-]+$/;

  for (const rule of rules) {
    const domain = rule.domain;
    if (typeof domain !== 'string' || !SAFE_DOMAIN_PATTERN.test(domain)) {
      console.warn(`[retort:sync] Skipping rule with invalid domain: ${JSON.stringify(domain)}`);
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
export async function syncGemini(templatesDir, tmpDir, vars, version, repoName) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
// Junie sync helper (JetBrains AI)
// ---------------------------------------------------------------------------

/**
 * Copies templates/junie/* -> tmpDir/.junie/
 * Junie reads .junie/guidelines.md as project-level agent instructions.
 */
export async function syncJunie(templatesDir, tmpDir, vars, version, repoName) {
  const { readTemplateText } = await import('./spec-loader.mjs');
  const junieDir = join(templatesDir, 'junie');
  if (!existsSync(junieDir)) return;

  for await (const srcFile of walkDir(junieDir)) {
    const ext = extname(srcFile).toLowerCase();
    const content = await readTemplateText(srcFile);
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    const relPath = relative(junieDir, srcFile);
    await writeOutput(join(tmpDir, '.junie', relPath), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Codex sync helper
// ---------------------------------------------------------------------------

/**
 * Generates .agents/skills/<name>/SKILL.md for each non-team command.
 */
export async function syncCodexSkills(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
    const segments = vars.skillsCategorised
      ? ['.agents', 'skills', cmdVars.commandCategory, stem, 'SKILL.md']
      : ['.agents', 'skills', stem, 'SKILL.md'];
    await writeOutput(join(tmpDir, ...segments), withHeader);
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
 * Copies an org-meta skill file (SKILL.md or companion) into tmpDir.
 * Returns true if the file was written, false if skipped (missing source, or
 * local divergence preserved).
 *
 * @param {object} args
 * @param {string} args.srcPath - Absolute path to the source file in org-meta
 * @param {string} args.destRelPath - Path relative to projectRoot
 * @param {string} args.tmpDir
 * @param {string} args.projectRoot
 * @param {string} args.label - Human label for log messages (e.g. "skill 'tdd'" or "companion 'tdd/tests.md'")
 * @param {function} args.log
 */
async function copyOrgMetaFile({ srcPath, destRelPath, tmpDir, projectRoot, label, log }) {
  if (!existsSync(srcPath)) {
    log(`[agentkit:sync] org-meta ${label} not found at ${srcPath} — skipping`);
    return false;
  }

  const destProjectPath = join(projectRoot, destRelPath);
  if (existsSync(destProjectPath)) {
    const localContent = readFileSync(destProjectPath, 'utf-8');
    const srcContent = readFileSync(srcPath, 'utf-8');
    if (localContent !== srcContent) {
      log(`[agentkit:sync] org-meta ${label} differs from local — preserving local copy`);
      return false;
    }
  }

  const content = readFileSync(srcPath, 'utf-8');
  await writeOutput(join(tmpDir, destRelPath), content);
  return true;
}

/**
 * Returns the lifecycle of a skill spec entry, defaulting to 'active'.
 * Recognised values: 'active' | 'in-progress' | 'deprecated'.
 */
function skillLifecycle(skill) {
  const value = skill?.lifecycle;
  if (value === 'in-progress' || value === 'deprecated') return value;
  return 'active';
}

/**
 * Copies org-meta skills (source: org-meta) into tmpDir/.agents/skills/.
 * - SKILL.md is always copied (subject to non-destructive divergence preservation).
 * - companions: [...] entries listed on the skill spec are copied alongside.
 * - lifecycle: deprecated suppresses emission entirely.
 * - lifecycle: in-progress emits with a warning log line.
 * - When opts.categorised is true, output goes to .agents/skills/<category>/<name>/
 *   instead of .agents/skills/<name>/. Default category is 'meta'.
 *
 * @param {string} tmpDir - Temp directory for sync output
 * @param {string} projectRoot - Actual project root (for diffing existing files)
 * @param {object} skillsSpec - Parsed skills.yaml
 * @param {function} log - Logger
 * @param {object} [opts]
 * @param {boolean} [opts.categorised=false] - Layered layout flag
 */
export async function syncOrgMetaSkills(tmpDir, projectRoot, skillsSpec, log, opts = {}) {
  const categorised = opts.categorised === true;
  const orgMetaSkillsDir = resolveOrgMetaSkillsDir();
  if (!existsSync(orgMetaSkillsDir)) {
    log(`[agentkit:sync] org-meta skills: directory not found at ${orgMetaSkillsDir} — skipping`);
    return;
  }

  const orgMetaSkills = (skillsSpec.skills || []).filter((s) => s.source === 'org-meta');

  for (const skill of orgMetaSkills) {
    const lifecycle = skillLifecycle(skill);
    if (lifecycle === 'deprecated') {
      log(`[agentkit:sync] org-meta skill '${skill.name}' is deprecated — skipping emission`);
      continue;
    }
    if (lifecycle === 'in-progress') {
      log(`[agentkit:sync] org-meta skill '${skill.name}' is in-progress — emitting unstable copy`);
    }

    // Validate category: reject values containing path separators or traversal sequences.
    // This prevents a crafted skills.yaml from writing outside .agents/skills/.
    const rawCategory =
      typeof skill.category === 'string' && skill.category.length > 0 ? skill.category : 'meta';
    const categoryUnsafe =
      rawCategory.includes('/') ||
      rawCategory.includes('\\') ||
      rawCategory.includes('..') ||
      rawCategory === '.';
    if (categoryUnsafe) {
      log(
        `[agentkit:sync] org-meta skill '${skill.name}' has unsafe category '${rawCategory}' — using 'meta'`
      );
    }
    const category = categoryUnsafe ? 'meta' : rawCategory;
    const baseSegments = categorised
      ? ['.agents', 'skills', category, skill.name]
      : ['.agents', 'skills', skill.name];

    await copyOrgMetaFile({
      srcPath: join(orgMetaSkillsDir, skill.name, 'SKILL.md'),
      destRelPath: join(...baseSegments, 'SKILL.md'),
      tmpDir,
      projectRoot,
      label: `skill '${skill.name}'`,
      log,
    });

    const skillSrcDir = resolve(orgMetaSkillsDir, skill.name);
    const companions = Array.isArray(skill.companions) ? skill.companions : [];
    for (const companion of companions) {
      if (typeof companion !== 'string' || companion.length === 0) continue;
      // Reject anything that escapes the skill directory. Check both POSIX and
      // win32 isAbsolute so a Windows drive-letter path (e.g. "C:\\evil.md") is
      // caught even when the engine runs on Linux CI, then verify the resolved
      // companion is strictly inside the skill source directory.
      if (isAbsolute(companion) || path.win32.isAbsolute(companion)) {
        log(
          `[agentkit:sync] org-meta skill '${skill.name}' companion '${companion}' rejected (path escapes skill dir)`
        );
        continue;
      }
      const resolvedCompanion = resolve(skillSrcDir, companion);
      const rel = relative(skillSrcDir, resolvedCompanion);
      if (rel.startsWith('..') || rel === '' || isAbsolute(rel)) {
        log(
          `[agentkit:sync] org-meta skill '${skill.name}' companion '${companion}' rejected (path escapes skill dir)`
        );
        continue;
      }
      await copyOrgMetaFile({
        srcPath: join(orgMetaSkillsDir, skill.name, companion),
        destRelPath: join(...baseSegments, companion),
        tmpDir,
        projectRoot,
        label: `companion '${skill.name}/${companion}'`,
        log,
      });
    }
  }
}

/**
 * Scans projectRoot/.agents/skills/ for skill directories not listed in skills.yaml.
 * Appends unknown skill names to .agents/skills/_unknown/report.md in tmpDir.
 * This is the non-destructive uptake mechanism — unknown skills are never overwritten,
 * only reported. Use `pnpm ak:propose-skill <name>` to promote them to org-meta.
 *
 * When opts.categorised is true the layout is .agents/skills/<category>/<name>/, so
 * first-level directories are category buckets rather than skill directories. The scan
 * descends one level deeper in that case.
 *
 * @param {string} tmpDir - Temp directory for sync output
 * @param {string} projectRoot - Actual project root (for reading existing skills)
 * @param {object} skillsSpec - Parsed skills.yaml
 * @param {string} syncDate - ISO date string (YYYY-MM-DD)
 * @param {function} log - Logger
 * @param {object} [opts]
 * @param {boolean} [opts.categorised=false] - Whether the categorised layout is active
 */
export async function syncUnknownSkillsReport(
  tmpDir,
  projectRoot,
  skillsSpec,
  syncDate,
  log,
  opts = {}
) {
  const categorised = opts.categorised === true;
  const localSkillsDir = join(projectRoot, '.agents', 'skills');
  if (!existsSync(localSkillsDir)) return;

  const knownNames = new Set((skillsSpec.skills || []).map((s) => s.name));
  let entries;
  try {
    entries = await readdir(localSkillsDir, { withFileTypes: true });
  } catch {
    return;
  }

  let unknownSkills;

  if (categorised) {
    // In categorised mode the first level contains category dirs (e.g. "meta/", "engineering/").
    // Descend one level deeper to find the actual skill directories.
    unknownSkills = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '_unknown') continue;
      const catDir = join(localSkillsDir, entry.name);
      let catEntries;
      try {
        catEntries = await readdir(catDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const catEntry of catEntries) {
        if (catEntry.isDirectory() && !knownNames.has(catEntry.name)) {
          unknownSkills.push(catEntry.name);
        }
      }
    }
  } else {
    unknownSkills = entries
      .filter((e) => e.isDirectory() && e.name !== '_unknown' && !knownNames.has(e.name))
      .map((e) => e.name);
  }

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
export async function syncWarp(templatesDir, tmpDir, vars, version, repoName) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncClineRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncRooRules(templatesDir, tmpDir, vars, version, repoName, rulesSpec) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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
export async function syncA2aConfig(
  tmpDir,
  vars,
  version,
  repoName,
  _agentsSpec,
  _teamsSpec,
  templatesDir
) {
  const { readTemplateText } = await import('./spec-loader.mjs');
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

export async function syncAgentAnalysis(agentkitRoot, tmpDir) {
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
