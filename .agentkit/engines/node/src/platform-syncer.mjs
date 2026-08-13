/**
 * Retort — Platform Syncer
 * Per-tool sync functions that render templates and write output files.
 * Extracted from synchronize.mjs (Step 6 of modularization).
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { cp, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import path, { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'path';
import {
  filterByTier,
  mergeThemeIntoSettings,
  resolveThemeMapping,
  validateBrandSpec,
  validateThemeSpec,
} from './brand-resolver.mjs';

import { applyUtf8Bom, isUnsafePathSegment, SAFE_HOOK_STEM } from './fs-utils.mjs';
import { normalizeForComparison, threeWayMerge } from './scaffold-merge.mjs';
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
  await writeFile(filePath, applyUtf8Bom(filePath, content), 'utf-8');
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
# GENERATED by Retort — regenerated on every sync.
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
 * @param {string} [projectRoot] - When provided, scaffold-once-skipped outputs are
 *   copied byte-identical from projectRoot into tmpDir so they appear in the new
 *   manifest. Without this, the second sync run would orphan-delete them — see
 *   the editor-theme oscillation bug.
 */
export async function syncEditorTheme(
  agentkitRoot,
  tmpDir,
  vars,
  log,
  flags,
  skipOutputs,
  projectRoot
) {
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

    // Path traversal protection — resolve and verify the output stays inside tmpDir.
    // This runs BEFORE the scaffold-once carry-forward below, which also resolves a
    // destination and writes to it. Guarding only the render path left that branch
    // able to read a tracked project file and write it outside tmpDir.
    const normalizedPath = String(outputPath).replace(/^\/+/, ''); // strip leading slashes
    const settingsPath = resolve(tmpDir, normalizedPath);
    if (!settingsPath.startsWith(resolvedTmpDir + sep) && settingsPath !== resolvedTmpDir) {
      log(`[retort:sync] BLOCKED: editor theme output path traversal detected — ${outputPath}`);
      continue;
    }

    // Scaffold-once: target already exists in projectRoot (unless --overwrite/--force).
    // Copy the existing content into tmpDir so it appears in the new manifest and
    // survives orphan cleanup. Without this carry-forward, the second sync run
    // sees the file in previousManifest, never in newManifestFiles, and deletes it.
    if (skipOutputs && skipOutputs.has(outputPath)) {
      if (projectRoot) {
        const resolvedProjectRoot = resolve(projectRoot);
        const existingPath = resolve(projectRoot, normalizedPath);
        // The source side needs the same containment check: without it a crafted
        // path reads a file from outside projectRoot.
        if (
          !existingPath.startsWith(resolvedProjectRoot + sep) &&
          existingPath !== resolvedProjectRoot
        ) {
          log(`[retort:sync] BLOCKED: editor theme source path traversal detected — ${outputPath}`);
          continue;
        }
        const destFile = settingsPath;
        if (existsSync(existingPath)) {
          writePromises.push(
            (async () => {
              const content = await readFile(existingPath, 'utf-8');
              await ensureDir(dirname(destFile));
              await writeFile(destFile, content, 'utf-8');
              log(`[retort:sync] Editor theme: ${outputPath} preserved (scaffold-once)`);
            })()
          );
        } else {
          log(
            `[retort:sync] Editor theme: ${outputPath} marked existing but missing on disk — skipping`
          );
        }
      } else {
        // Legacy callers that don't pass projectRoot: log and skip, matching prior
        // behaviour. The oscillation bug will reappear on next sync — pass
        // projectRoot to opt into the fix.
        log(`[retort:sync] Editor theme: ${outputPath} exists (scaffold-once) — skipping`);
      }
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
 * Extracts the hook script file names (with extension) a settings.json hook
 * command invokes, e.g. `session-start.ps1`. A command may name several — the
 * SessionStart entry runs a `.ps1` with a `.sh` fallback.
 *
 * This is the single parser for hook references in a command string; both the
 * sync-side gating below and `validate.mjs` Phase 5 use it, so the two cannot
 * disagree about what a command refers to.
 */
export function extractHookFiles(command) {
  const files = new Set();
  for (const m of String(command || '').matchAll(/\.claude\/hooks\/([\w.-]+?\.(?:sh|ps1))\b/g)) {
    files.add(m[1]);
  }
  return files;
}

/**
 * Extracts the hook file stems a settings.json hook command invokes. A single
 * command may name the same stem twice (e.g. a `.ps1` with a `.sh` fallback),
 * which collapses to one entry here.
 */
export function extractHookStems(command) {
  return new Set([...extractHookFiles(command)].map((f) => f.replace(/\.(sh|ps1)$/i, '')));
}

/**
 * Reports whether a hook stem survives feature gating — i.e. whether
 * syncClaudeHooks() will actually write it. Deliberately mirrors the gate in
 * syncClaudeHooks so the wiring in settings.json cannot drift from the files
 * on disk.
 */
export function isHookEmitted(stem, hookFeatureMap, vars) {
  const { specific = {}, defaultFeature = null } = hookFeatureMap || {};
  const requiredFeature = specific[stem] || defaultFeature;
  if (!requiredFeature) return true;
  return isFeatureEnabled(requiredFeature, vars);
}

/**
 * Drops hook entries whose scripts feature gating will not emit, then prunes
 * matcher groups and events left empty.
 *
 * Without this, disabling a feature such as `quality-gates` leaves
 * settings.json pointing at a hook file sync never writes, and Claude Code
 * errors when that lifecycle event fires. An entry is kept only when *every*
 * script it names is emitted — a partially-resolvable command is still broken.
 * Commands naming no hook script (plain inline shell) are always kept.
 */
export function filterHooksToEmitted(hooks, hookFeatureMap, vars) {
  if (!hooks || !hookFeatureMap) return hooks;
  const filtered = {};
  for (const [event, matchers] of Object.entries(hooks)) {
    if (!Array.isArray(matchers)) continue;
    const keptMatchers = [];
    for (const matcher of matchers) {
      // Skip structurally malformed entries rather than throwing — a bad
      // hand-edited settings.json must not abort the whole sync
      if (!matcher || !Array.isArray(matcher.hooks)) continue;
      const kept = matcher.hooks.filter(
        (h) =>
          h &&
          [...extractHookStems(h.command)].every((stem) =>
            isHookEmitted(stem, hookFeatureMap, vars)
          )
      );
      if (kept.length) keptMatchers.push({ ...matcher, hooks: kept });
    }
    if (keptMatchers.length) filtered[event] = keptMatchers;
  }
  return filtered;
}

/**
 * Whether this repo emits the PowerShell variant of a hook.
 *
 * `.sh` is the universal baseline and always ships; `.ps1` is additive — the
 * native variant on Windows, invoked in preference to the `.sh` when both are
 * present, with the `.sh` as the fallback for machines without pwsh. A repo
 * that never runs on Windows sets `windowsFirst: false` to stop emitting
 * PowerShell files it would never execute.
 *
 * The filter is deliberately one-directional. Dropping the `.sh` instead would
 * strip the fallback that lets a Windows-authored repo still run its hooks on a
 * Linux CI runner, and would delete outright the hooks that ship no `.ps1` at
 * all (budget-guard-check, pre-push-validate) — silently removing a guard.
 *
 * Defaults to true, so an overlay that never sets the key is unaffected.
 */
export function isWindowsFirst(vars) {
  return vars?.windowsFirst !== false;
}

/**
 * Indexes the hook templates by stem, recording which extensions ship for each
 * (e.g. `session-start` → {'ps1','sh'}).
 *
 * Wiring is derived from this rather than hardcoded, so a hook that ships a
 * `.ps1` is actually invoked as one. Five `.ps1` hooks previously shipped and
 * were wired nowhere because only `session-start` was special-cased.
 *
 * A template whose name is not a safe stem is left out of the index rather than
 * wired, so it can never reach a command string. Sync still writes the file, so
 * it surfaces as an orphan and fails the wiring test instead of silently
 * generating a command that does not parse.
 *
 * `vars` is optional and only supplies `windowsFirst`. It must be the same
 * `vars` syncClaudeHooks() gates emission on: the index decides what settings.json
 * *invokes*, so indexing a variant this repo does not emit would wire a command
 * pointing at a file that was never written.
 */
export async function collectHookExtensions(hooksDir, vars) {
  const byStem = new Map();
  if (!existsSync(hooksDir)) return byStem;
  const withPowerShell = isWindowsFirst(vars);
  for (const fname of await readdir(hooksDir)) {
    const m = fname.match(/^(.+)\.(sh|ps1)$/i);
    if (!m || !SAFE_HOOK_STEM.test(m[1])) continue;
    const ext = m[2].toLowerCase();
    if (ext === 'ps1' && !withPowerShell) continue;
    if (!byStem.has(m[1])) byStem.set(m[1], new Set());
    byStem.get(m[1]).add(ext);
  }
  return byStem;
}

/**
 * Builds the `settings.json` hooks tree from the `hooks:` block in
 * settings.yaml, so hook wiring is declared in exactly one place.
 *
 * `sessionStart` and `stop` name a single hook; `preToolUse` and `postToolUse`
 * are lists of `{ matcher, hook }`. Entries without a hook name are skipped.
 * Returns null when the spec declares no hooks, leaving the caller's existing
 * wiring untouched.
 *
 * `hookExtensions` is the optional index from `collectHookExtensions()`. When
 * supplied it decides which variant each entry invokes; when omitted the
 * caller-declared form is used, preserving the single-argument contract.
 */
export function buildHooksFromSpec(hooksSpec, hookExtensions) {
  if (!hooksSpec || typeof hooksSpec !== 'object') return null;

  // The spec names a hook by stem. Tolerate an extension being written anyway
  // — `session-start.sh` must not become `session-start.sh.sh`, which would
  // both break the command and defeat extractHookFiles()/gating downstream.
  const stemOf = (name) => name.trim().replace(/\.(sh|ps1)$/i, '');

  // Which variants a hook actually ships decides how it is invoked. When both
  // exist the .ps1 runs with the .sh as a fallback for machines without pwsh.
  // That is safe precisely because every hook signals its decision as JSON on
  // stdout and exits 0 — a *blocking* .ps1 still exits 0, so the `||` never
  // double-runs the .sh; the fallback fires only when pwsh cannot launch. Do
  // not switch these scripts to exit-code signalling without revisiting this.
  //
  // Without an index of the hook templates, fall back to the caller-declared
  // form so existing single-argument callers keep their behaviour.
  const command = (name, crossPlatform) => {
    const stem = stemOf(name);
    const base = `"$CLAUDE_PROJECT_DIR"/.claude/hooks/${stem}`;
    const pwsh = `pwsh -NoLogo -NoProfile -NonInteractive -File ${base}.ps1`;
    const exts = hookExtensions?.get(stem);
    if (!exts) {
      return crossPlatform ? `${pwsh} || ${base}.sh` : `${base}.sh`;
    }
    if (!exts.has('ps1')) return `${base}.sh`;
    return exts.has('sh') ? `${pwsh} || ${base}.sh` : pwsh;
  };

  const hooks = {};

  // A value that is nothing but an extension normalises to an empty stem and
  // would yield a path like `.claude/hooks/.sh` — treat it as unnamed
  const named = (value) => typeof value === 'string' && stemOf(value) !== '';

  const addSingle = (key, event, crossPlatform) => {
    const name = hooksSpec[key];
    if (!named(name)) return;
    hooks[event] = [{ hooks: [{ type: 'command', command: command(name, crossPlatform) }] }];
  };

  const addMatched = (key, event) => {
    if (!Array.isArray(hooksSpec[key])) return;
    const entries = [];
    for (const item of hooksSpec[key]) {
      if (!item || !named(item.hook)) continue;
      const entry = { hooks: [{ type: 'command', command: command(item.hook, false) }] };
      // Only carry a matcher when the spec sets one — an undefined value would
      // be dropped by JSON.stringify anyway, so make the omission explicit
      if (typeof item.matcher === 'string' && item.matcher) {
        entries.push({ matcher: item.matcher, ...entry });
      } else {
        entries.push(entry);
      }
    }
    if (entries.length) hooks[event] = entries;
  };

  // Order matters only for readability of the generated file
  addSingle('sessionStart', 'SessionStart', true);
  addMatched('preToolUse', 'PreToolUse');
  addMatched('postToolUse', 'PostToolUse');
  addSingle('stop', 'Stop', false);

  return Object.keys(hooks).length ? hooks : null;
}

/**
 * Generates .claude/settings.json from templates/claude/settings.json
 * merged with the resolved permissions and the hook wiring from settings.yaml.
 *
 * `hookFeatureMap` is optional: when omitted, hook wiring is emitted verbatim
 * (pre-gating behaviour) so older callers keep working.
 */
export async function syncClaudeSettings(
  templatesDir,
  tmpDir,
  vars,
  version,
  mergedPermissions,
  settingsSpec,
  hookFeatureMap
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
  // Hook wiring comes from settings.yaml — the template carries none, so the
  // spec is the only place wiring is declared. The hook template index decides
  // which variant each entry invokes.
  const specHooks = buildHooksFromSpec(
    settingsSpec?.hooks,
    await collectHookExtensions(join(templatesDir, 'claude', 'hooks'), vars)
  );
  if (specHooks) settings.hooks = specHooks;
  // Subagent spawn depth (ADR-15 §4). Emitted here rather than in the template
  // because the template is parsed as JSON, not rendered — a {{placeholder}}
  // would survive verbatim into the generated file. Env values must be strings.
  const spawnDepth = vars?.maxSubagentSpawnDepth;
  if (spawnDepth !== undefined && spawnDepth !== null && spawnDepth !== '') {
    settings.env = {
      ...(settings.env || {}),
      CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: String(spawnDepth),
    };
  }
  // Keep hook wiring in step with the hooks sync actually emits
  if (hookFeatureMap && settings.hooks) {
    settings.hooks = filterHooksToEmitted(settings.hooks, hookFeatureMap, vars);
  }
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

  for await (const srcFile of walkDir(hooksDir)) {
    const fname = basename(srcFile);
    // Strip extension(s) to get the hook name stem (e.g. 'protect-sensitive' from 'protect-sensitive.sh')
    const stem = fname.replace(/\.(sh|ps1)$/i, '');
    // Shared with syncClaudeSettings() so wiring and files stay consistent
    if (!isHookEmitted(stem, hookFeatureMap, vars)) continue;

    const ext = extname(srcFile).toLowerCase();
    // Mirrors collectHookExtensions(), which gates what settings.json invokes.
    // Both read the same `vars`, so a variant is never wired without being written.
    if (ext === '.ps1' && !isWindowsFirst(vars)) continue;
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
      // Claude Code only registers a subagent when YAML frontmatter is the very first
      // thing in the file. insertHeader places the GENERATED comment after the closing
      // `---`; without frontmatter it lands at position 0 instead and the file silently
      // degrades to a prose persona that never becomes a dispatchable agent type.
      if (!rendered.startsWith('---')) {
        console.warn(
          `[agentkit:sync] Warning: agent '${agent.id}' rendered without YAML frontmatter — ` +
            'it will not register as a Claude Code subagent'
        );
      }
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

// isUnsafePathSegment lives in fs-utils.mjs to break a circular dep with
// var-builders.mjs (which is consumed by platform-syncer). Re-exported here
// so external callers that previously imported it from platform-syncer keep
// working.
export { isUnsafePathSegment };

/**
 * Resolves the path to the org-meta skills directory.
 * Priority: ORG_META_PATH env var → ~/repos/org-meta (default)
 *
 * @returns {string}
 */
function resolveOrgMetaSkillsDir() {
  const base = process.env.ORG_META_PATH
    ? resolve(process.env.ORG_META_PATH)
    : resolve(homedir(), 'repos', 'org-meta');
  return join(base, 'skills');
}

/**
 * Writes a cached "last synced upstream" copy of an org-meta file under
 * .scaffold-cache. Used by copyOrgMetaFile as the common-ancestor for the
 * next three-way merge. Failures are non-fatal — a missing cache just falls
 * back to the seed path on subsequent runs.
 *
 * @param {string} agentkitRoot
 * @param {string} destRelPath
 * @param {string} content
 */
async function writeOrgMetaCache(agentkitRoot, destRelPath, content) {
  const cachePath = resolve(agentkitRoot, '.scaffold-cache', destRelPath);
  try {
    await ensureDir(dirname(cachePath));
    await writeFile(cachePath, content, 'utf-8');
  } catch {
    /* cache write failures are non-fatal — next run will seed again */
  }
}

/**
 * Copies an org-meta skill file (SKILL.md or companion) into tmpDir.
 * Returns true if the file was written, false if skipped (missing source).
 *
 * Divergence handling (when agentkitRoot is supplied):
 *   - No local copy → write upstream pristine + seed cache.
 *   - Local matches upstream (modulo formatting) → write upstream + refresh cache.
 *   - Local differs from upstream and no cache yet → preserve local + seed cache
 *     (matches legacy behavior on first run after this change rolls out).
 *   - Local differs, cache exists, upstream unchanged since last sync → preserve
 *     local (template hasn't moved; nothing to merge).
 *   - Local differs, cache exists, upstream also changed → three-way merge via
 *     scaffold-merge.threeWayMerge. On success cache advances to new upstream;
 *     conflicts surface as <<<< markers and a console.warn line.
 *   - Merge unavailable (git missing) → preserve local, leave cache untouched.
 *
 * When agentkitRoot is omitted (older callers / unit tests), behavior degrades
 * to the legacy preserve-on-divergence path so this function stays drop-in
 * compatible.
 *
 * @param {object} args
 * @param {string} args.srcPath - Absolute path to the source file in org-meta
 * @param {string} args.destRelPath - Path relative to projectRoot
 * @param {string} args.tmpDir
 * @param {string} args.projectRoot
 * @param {string} [args.agentkitRoot] - .agentkit root; enables three-way merge when set
 * @param {string} args.label - Human label for log messages (e.g. "skill 'tdd'" or "companion 'tdd/tests.md'")
 * @param {function} args.log
 */
async function copyOrgMetaFile({
  srcPath,
  destRelPath,
  tmpDir,
  projectRoot,
  agentkitRoot,
  label,
  log,
}) {
  if (!existsSync(srcPath)) {
    log(`[agentkit:sync] org-meta ${label} not found at ${srcPath} — skipping`);
    return false;
  }

  const destProjectPath = join(projectRoot, destRelPath);
  const srcContent = readFileSync(srcPath, 'utf-8');

  // No local copy yet — first-time install, write upstream pristine.
  if (!existsSync(destProjectPath)) {
    await writeOutput(join(tmpDir, destRelPath), srcContent);
    if (agentkitRoot) await writeOrgMetaCache(agentkitRoot, destRelPath, srcContent);
    return true;
  }

  const localContent = readFileSync(destProjectPath, 'utf-8');

  // No real divergence (ignoring whitespace / table-cell padding) — propagate
  // upstream so any cosmetic fixes flow through, and refresh the cache.
  if (normalizeForComparison(localContent) === normalizeForComparison(srcContent)) {
    await writeOutput(join(tmpDir, destRelPath), srcContent);
    if (agentkitRoot) await writeOrgMetaCache(agentkitRoot, destRelPath, srcContent);
    return true;
  }

  // Real divergence detected. The file MUST still appear in tmpDir whatever we
  // decide — otherwise newManifestFiles omits it and cleanStaleFiles deletes
  // the local copy as a stale orphan, immediately undoing the preserve.
  if (agentkitRoot) {
    const cachePath = resolve(agentkitRoot, '.scaffold-cache', destRelPath);
    if (existsSync(cachePath)) {
      const baseContent = readFileSync(cachePath, 'utf-8');

      // Template unchanged since last sync — preserve local edits, no merge needed.
      if (normalizeForComparison(baseContent) === normalizeForComparison(srcContent)) {
        log(
          `[agentkit:sync] org-meta ${label} preserved (template unchanged, local edits present)`
        );
        await writeOutput(join(tmpDir, destRelPath), localContent);
        return true;
      }

      // Real upstream change + real local edits — three-way merge.
      const result = threeWayMerge(localContent, baseContent, srcContent);
      if (result) {
        if (result.hasConflicts) {
          console.warn(
            `[agentkit:sync] CONFLICT in ${destRelPath} — resolve <<<< markers manually`
          );
          log(`[agentkit:sync] org-meta ${label} merged with conflicts`);
        } else {
          log(`[agentkit:sync] org-meta ${label} merged (local edits + upstream changes combined)`);
        }
        await writeOutput(join(tmpDir, destRelPath), result.merged);
        await writeOrgMetaCache(agentkitRoot, destRelPath, srcContent);
        return true;
      }
      // git merge-file unavailable — preserve local, leave cache untouched.
      log(
        `[agentkit:sync] org-meta ${label} — git unavailable, merge skipped; preserving local copy`
      );
      await writeOutput(join(tmpDir, destRelPath), localContent);
      return true;
    } else {
      // No cache yet — seed it from current upstream so future runs can merge.
      // This preserves the current observable behavior on the very first run
      // after this change rolls out (local edits are kept intact).
      log(
        `[agentkit:sync] org-meta ${label} differs from local — preserving local copy (seeding cache)`
      );
      await writeOutput(join(tmpDir, destRelPath), localContent);
      await writeOrgMetaCache(agentkitRoot, destRelPath, srcContent);
      return true;
    }
  }

  // Legacy / fallback path: preserve local copy with no caching.
  log(`[agentkit:sync] org-meta ${label} differs from local — preserving local copy`);
  await writeOutput(join(tmpDir, destRelPath), localContent);
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
 * @param {string} [opts.agentkitRoot] - .agentkit root; enables three-way merge of local edits
 */
export async function syncOrgMetaSkills(tmpDir, projectRoot, skillsSpec, log, opts = {}) {
  const categorised = opts.categorised === true;
  const agentkitRoot = typeof opts.agentkitRoot === 'string' ? opts.agentkitRoot : undefined;
  const orgMetaSkillsDir = resolveOrgMetaSkillsDir();
  if (!existsSync(orgMetaSkillsDir)) {
    log(`[agentkit:sync] org-meta skills: directory not found at ${orgMetaSkillsDir} — skipping`);
    return;
  }

  // Guard: skills.yaml may load as a non-array (e.g. `skills: {}` or null).
  // Without this, `.filter` would throw and crash the whole sync.
  const skillsList = Array.isArray(skillsSpec?.skills) ? skillsSpec.skills : [];
  const orgMetaSkills = skillsList.filter((s) => s.source === 'org-meta');

  for (const skill of orgMetaSkills) {
    const lifecycle = skillLifecycle(skill);
    if (lifecycle === 'deprecated') {
      log(`[agentkit:sync] org-meta skill '${skill.name}' is deprecated — skipping emission`);
      continue;
    }
    if (lifecycle === 'in-progress') {
      log(`[agentkit:sync] org-meta skill '${skill.name}' is in-progress — emitting unstable copy`);
    }

    // Validate skill.name: reject values containing path separators or traversal
    // sequences. skills.yaml isn't validated at sync time, so a crafted name
    // could otherwise read or write outside .agents/skills/ via path.join.
    if (isUnsafePathSegment(skill.name)) {
      log(`[agentkit:sync] org-meta skill name '${skill.name}' is unsafe — skipping emission`);
      continue;
    }

    // Validate category: same vector. Fall back to 'meta' rather than skipping
    // the whole skill so a typo in category doesn't lose a legitimate skill.
    const rawCategory =
      typeof skill.category === 'string' && skill.category.length > 0 ? skill.category : 'meta';
    const categoryUnsafe = isUnsafePathSegment(rawCategory);
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
      agentkitRoot,
      label: `skill '${skill.name}'`,
      log,
    });

    const skillSrcDir = resolve(orgMetaSkillsDir, skill.name);
    const companions = Array.isArray(skill.companions) ? skill.companions : [];
    for (const companion of companions) {
      if (typeof companion !== 'string' || companion.length === 0) continue;
      // Companions are documented as additional .md files alongside SKILL.md.
      // Enforce that contract here: must be a .md filename with no path
      // separators (subdirectories aren't supported by the spec).
      if (companion.includes('/') || companion.includes('\\') || !companion.endsWith('.md')) {
        log(
          `[agentkit:sync] org-meta skill '${skill.name}' companion '${companion}' rejected (must be a .md filename, no subdirectories)`
        );
        continue;
      }
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
        agentkitRoot,
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

  const knownSkillsList = Array.isArray(skillsSpec?.skills) ? skillsSpec.skills : [];
  const knownNames = new Set(knownSkillsList.map((s) => s.name));
  let entries;
  try {
    entries = await readdir(localSkillsDir, { withFileTypes: true });
  } catch {
    return;
  }

  let unknownSkills;

  if (categorised) {
    // In categorised mode the first level contains category dirs (e.g. "meta/", "engineering/").
    // Descend one level deeper to find the actual skill directories. Use a Set
    // so a stray duplicate (same skill folder accidentally placed under two
    // categories) is reported once, not twice. Stale flat skill dirs left over
    // from before categorisation (containing SKILL.md directly at the top level)
    // are also surfaced so the user notices and migrates them.
    const unknownSet = new Set();
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '_unknown') continue;
      const topDir = join(localSkillsDir, entry.name);
      // Stale flat skill: the top-level dir itself contains a SKILL.md.
      if (existsSync(join(topDir, 'SKILL.md')) && !knownNames.has(entry.name)) {
        unknownSet.add(entry.name);
        continue;
      }
      let catEntries;
      try {
        catEntries = await readdir(topDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const catEntry of catEntries) {
        if (catEntry.isDirectory() && !knownNames.has(catEntry.name)) {
          unknownSet.add(catEntry.name);
        }
      }
    }
    unknownSkills = [...unknownSet];
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
