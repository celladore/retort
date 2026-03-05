/**
 * AgentKit Forge — Synchronize Command
 * Reads spec + overlay → renders templates → writes generated AI-tool configuration outputs.
 * Main file operations (mkdir, writeFile, readdir, cp) use async fs/promises.
 * readYaml/readText use synchronous fs APIs for simplicity at startup.
 * Pure template helpers live in template-utils.mjs.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import { tmpdir } from 'os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'path';
import {
  categorizeFile,
  computeProjectCompleteness,
  flattenProjectYaml,
  formatCommandFlags,
  insertHeader,
  isScaffoldOnce,
  mergePermissions,
  printSyncSummary,
  renderTemplate,
  resolveRenderTargets,
  simpleDiff,
} from './template-utils.mjs';
import {
  mergeThemeIntoSettings,
  resolveColor,
  resolveThemeMapping,
  validateBrandSpec,
} from './brand-resolver.mjs';

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
    const rendered = renderTemplate(content, vars, srcFile);
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
 * Copies templates/renovate to tmpDir root.
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

// ---------------------------------------------------------------------------
// Git merge driver sync
// ---------------------------------------------------------------------------

/** Marker comments delimiting the managed section in .gitattributes */
const GITATTR_START = '# >>> AgentKit Forge merge drivers — DO NOT EDIT below this line';
const GITATTR_END = '# <<< AgentKit Forge merge drivers — DO NOT EDIT above this line';

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
# GENERATED by AgentKit Forge v${version} — regenerated on every sync.
# These custom merge drivers auto-resolve conflicts on framework-managed files.
# Driver "agentkit-generated" accepts the incoming (upstream/theirs) version.
#
# To activate locally, run:
#   git config merge.agentkit-generated.name "Accept upstream for generated files"
#   git config merge.agentkit-generated.driver "cp %B %A"
#
# Or use: scripts/resolve-merge.sh <target-branch>

# --- Generated agent/skill/prompt packs (always accept upstream) ---
.agents/skills/**/SKILL.md           merge=agentkit-generated
.github/agents/*.agent.md            merge=agentkit-generated
.github/chatmodes/*.chatmode.md      merge=agentkit-generated
.github/prompts/*.prompt.md          merge=agentkit-generated

# --- Generated doc indexes (always accept upstream) ---
docs/*/README.md                     merge=agentkit-generated

# --- Generated config files (always accept upstream) ---
.github/copilot-instructions.md      merge=agentkit-generated
.github/PULL_REQUEST_TEMPLATE.md     merge=agentkit-generated

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

  // Determine which mode mapping(s) to resolve
  const mode = themeSpec.mode || 'dark';
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

  // Build final color customizations — for 'both', dark wins on conflict
  let colorCustomizations;
  if (mode === 'both') {
    colorCustomizations = { ...lightColors, ...darkColors };
  } else if (mode === 'light') {
    colorCustomizations = lightColors;
  } else {
    colorCustomizations = darkColors;
  }

  if (Object.keys(colorCustomizations).length === 0) {
    log('[agentkit:sync] No colors resolved from editor theme — skipping');
    return;
  }

  // Build metadata sentinel
  const meta = {
    brand: brandSpec.identity?.name || 'unknown',
    mode,
    version: brandSpec.version || '1.0.0',
  };

  // Honor baseTheme — sets workbench.colorTheme per workspace
  if (themeSpec.baseTheme) {
    const baseThemeValue = mode === 'light' ? themeSpec.baseTheme.light : themeSpec.baseTheme.dark;
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
  commandsSpec
) {
  const commandsDir = join(templatesDir, 'claude', 'commands');
  if (!existsSync(commandsDir)) return;

  // Copy non-template command files
  for await (const srcFile of walkDir(commandsDir)) {
    const fname = basename(srcFile);
    if (fname === 'team-TEMPLATE.md') continue; // skip template
    const ext = extname(srcFile).toLowerCase();
    const content = await readTemplateText(srcFile);
    const rendered = renderTemplate(content, vars, srcFile);
    const withHeader = insertHeader(rendered, ext, version, repoName);
    await writeOutput(join(tmpDir, '.claude', 'commands', fname), withHeader);
  }

  // Generate team commands from team-TEMPLATE.md
  const teamTemplatePath = join(commandsDir, 'team-TEMPLATE.md');
  if (!existsSync(teamTemplatePath)) return;
  const teamTemplate = await readTemplateText(teamTemplatePath);
  for (const team of teamsSpec.teams || []) {
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '',
      teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : team.accepts || '',
      teamHandoffChain: Array.isArray(team['handoff-chain']) ? team['handoff-chain'].join(' \u2192 ') : team['handoff-chain'] || '',
    };
    const rendered = renderTemplate(teamTemplate, teamVars, teamTemplatePath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.claude', 'commands', `team-${team.id}.md`), withHeader);
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

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.claude', 'skills', cmd.name, 'SKILL.md'), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Cursor sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .cursor/rules/team-<id>.mdc for each team.
 */
async function syncCursorTeams(templatesDir, tmpDir, vars, version, repoName, teamsSpec) {
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
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '',
      teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : team.accepts || '',
      teamHandoffChain: Array.isArray(team['handoff-chain']) ? team['handoff-chain'].join(' \u2192 ') : team['handoff-chain'] || '',
    };
    const rendered = renderTemplate(teamTemplate, teamVars, tplPath);
    const withHeader = insertHeader(rendered, '.mdc', version, repoName);
    await writeOutput(join(tmpDir, '.cursor', 'rules', `team-${team.id}.mdc`), withHeader);
  }
}

/**
 * Generates .cursor/commands/<name>.md for each non-team command.
 */
async function syncCursorCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const tplPath = join(templatesDir, 'cursor', 'commands', 'TEMPLATE.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.cursor', 'commands', `${cmd.name}.md`), withHeader);
  }
}

// ---------------------------------------------------------------------------
// Windsurf sync helpers
// ---------------------------------------------------------------------------

/**
 * Generates .windsurf/rules/team-<id>.md for each team.
 */
async function syncWindsurfTeams(templatesDir, tmpDir, vars, version, repoName, teamsSpec) {
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
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '',
      teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : team.accepts || '',
      teamHandoffChain: Array.isArray(team['handoff-chain']) ? team['handoff-chain'].join(' \u2192 ') : team['handoff-chain'] || '',
    };
    const rendered = renderTemplate(teamTemplate, teamVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.windsurf', 'rules', `team-${team.id}.md`), withHeader);
  }
}

/**
 * Generates .windsurf/commands/<name>.md for each non-team command.
 */
async function syncWindsurfCommands(templatesDir, tmpDir, vars, version, repoName, commandsSpec) {
  const tplPath = join(templatesDir, 'windsurf', 'templates', 'command.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.windsurf', 'commands', `${cmd.name}.md`), withHeader);
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

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.github', 'prompts', `${cmd.name}.prompt.md`), withHeader);
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
async function syncCopilotChatModes(templatesDir, tmpDir, vars, version, repoName, teamsSpec) {
  const tplPath = join(templatesDir, 'copilot', 'chatmodes', 'TEMPLATE.chatmode.md');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);

  for (const team of teamsSpec.teams || []) {
    const teamVars = {
      ...vars,
      teamName: team.name || team.id,
      teamId: team.id,
      teamFocus: team.focus || '',
      teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '',
      teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : team.accepts || '',
      teamHandoffChain: Array.isArray(team['handoff-chain']) ? team['handoff-chain'].join(' \u2192 ') : team['handoff-chain'] || '',
    };
    const rendered = renderTemplate(template, teamVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(
      join(tmpDir, '.github', 'chatmodes', `team-${team.id}.chatmode.md`),
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

  for (const cmd of commandsSpec.commands || []) {
    if (cmd.type === 'team') continue;
    const cmdVars = buildCommandVars(cmd, vars);
    const rendered = renderTemplate(template, cmdVars, tplPath);
    const withHeader = insertHeader(rendered, '.md', version, repoName);
    await writeOutput(join(tmpDir, '.agents', 'skills', cmd.name, 'SKILL.md'), withHeader);
  }
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
// Variable builder helpers (private — used by tool-specific sync functions)
// ---------------------------------------------------------------------------

function buildCommandVars(cmd, vars) {
  return {
    ...vars,
    commandName: cmd.name,
    isSyncBacklog: cmd.name === 'sync-backlog',
    commandDescription:
      typeof cmd.description === 'string' ? cmd.description.trim() : cmd.description || '',
    commandFlags: formatCommandFlags(cmd.flags),
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

function buildRuleVars(rule, vars) {
  const appliesTo = rule['applies-to'] || [];
  const conventions = rule.conventions || [];
  return {
    ...vars,
    ruleDomain: rule.domain,
    ruleDescription:
      typeof rule.description === 'string' ? rule.description.trim() : rule.description || '',
    ruleAppliesTo: appliesTo.join('\n'),
    ruleConventions: conventions
      .map((c) => (typeof c === 'string' ? `- ${c}` : `- **[${c.id || ''}]** ${c.rule || ''}`))
      .join('\n'),
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

  const log = (...args) => {
    if (!quiet) console.log(...args);
  };
  const logVerbose = (...args) => {
    if (verbose && !quiet) console.log(...args);
  };

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
  const docsSpec = readYaml(resolve(agentkitRoot, 'spec', 'docs.yaml')) || {};
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
  const teamsIntake = teamsSpec?.intake || {};
  const processIntake = projectSpec?.process?.intake || {};
  const intakeEscalation = processIntake.escalation || teamsIntake.escalation || {};
  const securityEscalationTeams = Array.isArray(intakeEscalation.securityCritical)
    ? intakeEscalation.securityCritical.join(', ')
    : '';
  const blockedEscalationTeams = Array.isArray(intakeEscalation.blockedCrossTeam)
    ? intakeEscalation.blockedCrossTeam.join(', ')
    : '';
  const vars = {
    ...projectVars,
    issueTracker: projectVars.issueTracker || 'github',
    intakeOwnerTeam: projectVars.intakeOwnerTeam || processIntake.ownerTeam || teamsIntake.ownerTeam || 'product',
    intakeOperationsTeam:
      projectVars.intakeOperationsTeam ||
      processIntake.operationsTeam ||
      teamsIntake.operationsTeam ||
      'quality',
    intakeCadence: projectVars.intakeCadence || processIntake.cadence || 'daily',
    intakeSecurityEscalationTeams: securityEscalationTeams,
    intakeBlockedEscalationTeams: blockedEscalationTeams,
    version,
    overlayTemplatesDir: resolve(overlayDir, 'templates'),
    repoName:
      (overlaySettings.repoName === '__TEMPLATE__' && projectSpec?.name) ||
      overlaySettings.repoName ||
      repoName,
    defaultBranch: overlaySettings.defaultBranch || 'main',
    primaryStack: overlaySettings.primaryStack || 'auto',
    syncDate: new Date().toISOString().slice(0, 10),
    lastModel: process.env.AGENTKIT_LAST_MODEL || 'sync-engine',
    lastAgent: process.env.AGENTKIT_LAST_AGENT || 'agentkit-forge',
  };

  // Inject brand identity into template vars when brand guide exists
  if (vars.hasBrandGuide) {
    const brandSpec = readYaml(resolve(agentkitRoot, 'spec', 'brand.yaml'));
    if (brandSpec) {
      vars.brandName = brandSpec.identity?.name || '';
      vars.brandPrimaryColor = resolveColor(brandSpec.colors?.primary?.brand) || '';
      vars.brandMono = brandSpec.typography?.mono || '';
    }
  }

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
    // - AGENTS.md, root docs, .github/ — always needed regardless of tool target
    // - .gitattributes merge drivers — repo-wide, not tool-specific
    // - .vscode/settings.json, editor configs — workspace-level, not tool-specific
    await Promise.all([
      syncAgentsMd(templatesDir, tmpDir, vars, version, headerRepoName),
      syncRootDocs(templatesDir, tmpDir, vars, version, headerRepoName),
      syncGitHub(templatesDir, tmpDir, vars, version, headerRepoName),
      syncGitattributes(tmpDir, projectRoot, version),
      syncDirectCopy(
        templatesDir,
        vars.overlayTemplatesDir,
        'docs',
        tmpDir,
        'docs',
        vars,
        version,
        headerRepoName
      ),
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
      syncEditorConfigs(templatesDir, tmpDir, vars, version, headerRepoName),
    ]);

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
        syncDirectCopy(
          templatesDir,
          vars.overlayTemplatesDir,
          'claude/hooks',
          tmpDir,
          '.claude/hooks',
          vars,
          version,
          headerRepoName
        ),
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
          commandsSpec
        ),
        syncClaudeAgents(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          agentsSpec,
          rulesSpec
        ),
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
        syncDirectCopy(
          templatesDir,
          vars.overlayTemplatesDir,
          'claude/state',
          tmpDir,
          '.claude/state',
          vars,
          version,
          headerRepoName
        ),
        syncClaudeMd(templatesDir, tmpDir, vars, version, headerRepoName),
        syncClaudeSkills(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec),
        syncLanguageInstructions(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          rulesSpec,
          '.claude/rules/languages',
          'claude'
        )
      );
    }

    if (targets.has('cursor')) {
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
        syncCursorTeams(templatesDir, tmpDir, vars, version, headerRepoName, teamsSpec),
        syncCursorCommands(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec),
        syncLanguageInstructions(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          rulesSpec,
          '.cursor/rules/languages',
          'cursor'
        )
      );
    }

    if (targets.has('windsurf')) {
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
        syncWindsurfTeams(templatesDir, tmpDir, vars, version, headerRepoName, teamsSpec),
        syncLanguageInstructions(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          rulesSpec,
          '.windsurf/rules/languages',
          'windsurf'
        )
      );
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
          rulesSpec
        ),
        syncCopilotChatModes(templatesDir, tmpDir, vars, version, headerRepoName, teamsSpec),
        syncLanguageInstructions(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          rulesSpec,
          '.github/instructions/languages',
          'copilot'
        )
      );
    }

    if (targets.has('gemini')) {
      gatedTasks.push(syncGemini(templatesDir, tmpDir, vars, version, headerRepoName));
    }

    if (targets.has('codex')) {
      gatedTasks.push(
        syncCodexSkills(templatesDir, tmpDir, vars, version, headerRepoName, commandsSpec)
      );
    }

    if (targets.has('warp')) {
      gatedTasks.push(syncWarp(templatesDir, tmpDir, vars, version, headerRepoName));
    }

    if (targets.has('cline')) {
      gatedTasks.push(
        syncClineRules(templatesDir, tmpDir, vars, version, headerRepoName, rulesSpec),
        syncLanguageInstructions(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          rulesSpec,
          '.clinerules/languages',
          'cline'
        )
      );
    }

    if (targets.has('roo')) {
      gatedTasks.push(
        syncRooRules(templatesDir, tmpDir, vars, version, headerRepoName, rulesSpec),
        syncLanguageInstructions(
          templatesDir,
          tmpDir,
          vars,
          version,
          headerRepoName,
          rulesSpec,
          '.roo/rules/languages',
          'roo'
        )
      );
    }

    if (targets.has('mcp')) {
      gatedTasks.push(
        syncA2aConfig(tmpDir, vars, version, headerRepoName, agentsSpec, teamsSpec, templatesDir)
      );
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

    // Use a shared counter and error list
    let count = 0;
    let skippedScaffold = 0;
    const failedFiles = [];

    await runConcurrent(allTmpFiles, async (srcFile) => {
      if (!existsSync(srcFile)) return;
      const relPath = relative(tmpDir, srcFile);
      const destFile = resolve(projectRoot, relPath);

      // Path traversal protection: ensure all output stays within project root
      if (
        !resolve(destFile).startsWith(resolvedRoot) &&
        resolve(destFile) !== resolve(projectRoot)
      ) {
        console.error(`[agentkit:sync] BLOCKED: path traversal detected — ${relPath}`);
        failedFiles.push({ file: relPath, error: 'path traversal blocked' });
        return;
      }

      // Scaffold-once: skip project-owned files that already exist (unless --overwrite)
      const overwrite = flags?.overwrite || flags?.force;
      if (!overwrite && isScaffoldOnce(relPath, vars) && existsSync(destFile)) {
        skippedScaffold++;
        return;
      }

      try {
        await ensureDir(dirname(destFile));
        await cp(srcFile, destFile, { force: true, recursive: false });

        // Make .sh files executable
        if (extname(srcFile) === '.sh') {
          try {
            await chmod(destFile, 0o755);
          } catch {
            /* ignore on Windows */
          }
        }
        count++;
        logVerbose(`  wrote ${relPath.replace(/\\/g, '/')}`);
      } catch (err) {
        failedFiles.push({ file: relPath, error: err.message });
        console.error(`[agentkit:sync] Failed to write: ${relPath} — ${err.message}`);
      }
    });

    if (failedFiles.length > 0) {
      console.error(`[agentkit:sync] Error: ${failedFiles.length} file(s) failed to write:`);
      for (const f of failedFiles) {
        console.error(`  - ${f.file}: ${f.error}`);
      }
      throw new Error(`Sync completed with ${failedFiles.length} write failure(s)`);
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
        if (!orphanPath.startsWith(resolvedRoot) && orphanPath !== resolve(projectRoot)) {
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
