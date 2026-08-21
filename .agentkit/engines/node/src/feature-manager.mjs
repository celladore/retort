/**
 * Retort — Feature Manager
 * Handles feature resolution, validation, enable/disable, and template variable generation.
 *
 * Features are defined in spec/features.yaml and controlled per-repo via overlay settings.yaml.
 * Core features (alwaysOn: true) cannot be disabled.
 * Dependencies are automatically resolved — enabling a feature enables its dependencies.
 *
 * ## Overlay Precedence (resolution order)
 *
 * 1. `enabledFeatures` (explicit list)  — wins if present in overlay settings.yaml
 * 2. `featurePreset`   (named preset)   — used if no explicit list
 * 3. `default: true`   (per-feature)    — fallback when neither is set
 *
 * After the base set:
 * 4. `disabledFeatures` are subtracted (cannot subtract alwaysOn)
 * 5. alwaysOn features are force-added
 * 6. Transitive dependencies are auto-enabled
 *
 * ## Conflict Resolution
 *
 * - enabledFeatures + featurePreset both set → enabledFeatures wins
 * - Feature in both enabledFeatures and disabledFeatures → disabledFeatures wins
 * - `features enable <id>` auto-removes from disabledFeatures
 * - `features disable <id>` auto-removes from enabledFeatures
 * - Disabling a feature that others depend on → blocked with error listing dependents
 * - Disabling a core feature → blocked unconditionally
 *
 * ## Schema Versioning
 *
 * features.yaml includes a `schemaVersion` field. The engine checks this at load time.
 * If the schema version is higher than SUPPORTED_SCHEMA_VERSION, a warning is emitted
 * (but loading continues for forward-compatibility).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolve, join } from 'path';
import { REPO_NAME_PATTERN } from './repo-name.mjs';

/**
 * Maximum schema version this engine knows how to process.
 * Bump this when the engine is updated to handle new feature entry fields.
 */
export const SUPPORTED_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Load feature definitions
// ---------------------------------------------------------------------------

/**
 * Loads and parses the features.yaml spec.
 * Checks schemaVersion for forward-compatibility warnings.
 *
 * @param {string} agentkitRoot - Path to the .agentkit/ directory
 * @param {{ log?: Function }} [options] - Optional logger
 * @returns {{ features: object[], presets: object, schemaVersion: number }}
 */
export function loadFeatureSpec(agentkitRoot, options = {}) {
  const log = options.log || console.warn;
  const featuresPath = resolve(agentkitRoot, 'spec', 'features.yaml');
  if (!existsSync(featuresPath)) {
    throw new Error(`features.yaml not found at ${featuresPath}`);
  }
  const spec = yaml.load(readFileSync(featuresPath, 'utf-8'));
  if (!spec || !Array.isArray(spec.features)) {
    throw new Error('features.yaml: missing or invalid "features" array');
  }

  const schemaVersion = spec.schemaVersion || 1;
  if (schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    log(
      `[agentkit:features] Warning: features.yaml schemaVersion ${schemaVersion} ` +
        `is newer than supported version ${SUPPORTED_SCHEMA_VERSION}. ` +
        `Some feature fields may not be processed correctly. ` +
        `Update the engine to support the latest schema.`
    );
  }

  return {
    features: spec.features,
    presets: spec.presets || {},
    schemaVersion,
  };
}

/**
 * Returns a Map of feature ID → feature definition for fast lookup.
 */
export function buildFeatureIndex(features) {
  const index = new Map();
  for (const feature of features) {
    if (!feature.id) continue;
    index.set(feature.id, feature);
  }
  return index;
}

// ---------------------------------------------------------------------------
// Feature resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the effective set of enabled features for a repo.
 *
 * Resolution order:
 * 1. Start with features marked alwaysOn: true (cannot be disabled)
 * 2. If overlay specifies enabledFeatures → use that list (wins over featurePreset)
 * 3. Else if overlay specifies a featurePreset → expand the preset
 * 4. Otherwise → use features with default: true
 * 5. Apply disabledFeatures exclusions (cannot exclude alwaysOn; wins over enabledFeatures)
 * 6. alwaysOn features are force-added (survives disabledFeatures)
 * 7. Resolve dependencies transitively (auto-enable deps of enabled features)
 *
 * Conflict rules:
 * - enabledFeatures + featurePreset both set → enabledFeatures wins
 * - Feature in both enabledFeatures and disabledFeatures → disabledFeatures wins
 * - alwaysOn features survive all exclusions
 *
 * @param {object[]} features - Feature definitions from features.yaml
 * @param {object} overlaySettings - Overlay settings.yaml content
 * @param {object} presets - Preset definitions from features.yaml
 * @param {{ log?: Function }} [options] - Optional logger
 * @returns {Set<string>} Set of enabled feature IDs
 */
export function resolveFeatures(features, overlaySettings = {}, presets = {}, options = {}) {
  const log = options.log;
  const index = buildFeatureIndex(features);

  // 1. Identify always-on features (survive all exclusions)
  const alwaysOn = new Set(features.filter((f) => f.alwaysOn).map((f) => f.id));

  // 2-4. Determine base enabled set (strict precedence)
  let enabled;
  let resolutionMode;

  if (Array.isArray(overlaySettings.enabledFeatures)) {
    // Precedence 1: Explicit list — wins even if featurePreset is also set
    enabled = new Set(overlaySettings.enabledFeatures.filter((id) => index.has(id)));
    resolutionMode = 'explicit';
  } else if (
    typeof overlaySettings.featurePreset === 'string' &&
    presets[overlaySettings.featurePreset]
  ) {
    // Precedence 2: Preset expansion
    const preset = presets[overlaySettings.featurePreset];
    enabled = new Set((preset.features || []).filter((id) => index.has(id)));
    resolutionMode = 'preset';
  } else {
    // Precedence 3: Default — features with default: true
    enabled = new Set(features.filter((f) => f.default === true).map((f) => f.id));
    resolutionMode = 'default';
  }

  // 5. Apply disabled exclusions (disabledFeatures wins over enabledFeatures)
  if (Array.isArray(overlaySettings.disabledFeatures)) {
    for (const id of overlaySettings.disabledFeatures) {
      if (!alwaysOn.has(id)) {
        enabled.delete(id);
      }
    }
  }

  // 6. Force-add alwaysOn (survives everything)
  for (const id of alwaysOn) {
    enabled.add(id);
  }

  // 7. Resolve dependencies transitively
  //    If feature A is enabled and depends on B, B is auto-enabled.
  //    If B also depends on C, C is auto-enabled too.
  const resolved = new Set(enabled);
  const visited = new Set();
  const disabledSet = new Set(overlaySettings.disabledFeatures || []);
  const resurrected = [];

  function resolveDeps(featureId) {
    if (visited.has(featureId)) return;
    visited.add(featureId);
    const feature = index.get(featureId);
    if (!feature) return;
    for (const dep of feature.dependencies || []) {
      if (index.has(dep)) {
        if (!resolved.has(dep) && disabledSet.has(dep)) {
          resurrected.push({ dep, requiredBy: featureId });
        }
        resolved.add(dep);
        resolveDeps(dep);
      }
    }
  }

  for (const id of enabled) {
    resolveDeps(id);
  }

  // Warn when dependency resolution overrides explicit disables
  for (const { dep, requiredBy } of resurrected) {
    const msg =
      `[agentkit:features] Warning: "${dep}" is in disabledFeatures but was ` +
      `re-enabled because "${requiredBy}" depends on it. ` +
      `Remove "${dep}" from disabledFeatures or disable "${requiredBy}" instead.`;
    if (typeof log === 'function') {
      log(msg);
    } else {
      console.warn(msg);
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Template variable generation
// ---------------------------------------------------------------------------

/**
 * Generates template variables from the resolved feature set.
 *
 * For each feature:
 * - Sets its declared templateVars to true/false
 * - Sets a canonical `feature_<id>` var (hyphens → underscores)
 *
 * Also generates aggregate vars for use in templates and agent prompts:
 * - `enabledFeaturesList`: Comma-separated list of enabled feature IDs
 * - `enabledFeaturesCount`: Number of enabled features
 * - `totalFeaturesCount`: Total number of features
 * - `featureSummary`: Multi-line summary for embedding in agent/command templates
 *
 * @param {object[]} features - Feature definitions from features.yaml
 * @param {Set<string>} enabledFeatures - Resolved set of enabled feature IDs
 * @returns {object} Template variables object
 */
export function buildFeatureVars(features, enabledFeatures) {
  const vars = {};
  for (const feature of features) {
    const isEnabled = enabledFeatures.has(feature.id);
    for (const varName of feature.templateVars || []) {
      vars[varName] = isEnabled;
    }
    // Also set a canonical feature-id-based var: feature_<id> (with hyphens as underscores)
    vars[`feature_${feature.id.replace(/-/g, '_')}`] = isEnabled;
  }

  // Aggregate feature vars for agent/command template consumption
  const enabledList = features.filter((f) => enabledFeatures.has(f.id));
  const disabledList = features.filter((f) => !enabledFeatures.has(f.id) && !f.alwaysOn);

  vars.enabledFeaturesList = enabledList.map((f) => f.id).join(', ');
  vars.enabledFeaturesCount = String(enabledFeatures.size);
  vars.totalFeaturesCount = String(features.length);

  // Build a multi-line summary suitable for embedding in templates
  const summaryLines = [];
  summaryLines.push(`- **Enabled**: ${enabledFeatures.size} / ${features.length} features`);

  // Group by category for the summary
  const categories = {};
  for (const f of features) {
    const cat = f.category || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(f);
  }

  for (const [cat, catFeatures] of Object.entries(categories)) {
    const catEnabled = catFeatures.filter((f) => enabledFeatures.has(f.id));
    const catDisabled = catFeatures.filter((f) => !enabledFeatures.has(f.id) && !f.alwaysOn);
    summaryLines.push(`- **${cat}**: ${catEnabled.map((f) => f.id).join(', ') || 'none'}`);
  }

  if (disabledList.length > 0) {
    summaryLines.push(`- **Disabled**: ${disabledList.map((f) => f.id).join(', ')}`);
  }

  vars.featureSummary = summaryLines.join('\n');

  return vars;
}

/**
 * Returns feature metadata for display/listing purposes.
 */
export function getFeatureListInfo(features, enabledFeatures) {
  const categories = {};
  for (const feature of features) {
    const cat = feature.category || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      id: feature.id,
      name: feature.name,
      enabled: enabledFeatures.has(feature.id),
      alwaysOn: !!feature.alwaysOn,
      description: feature.description,
      dependencies: feature.dependencies || [],
    });
  }
  return categories;
}

// ---------------------------------------------------------------------------
// Hook-to-feature mapping (derived from affectsTemplates)
// ---------------------------------------------------------------------------

/**
 * Builds a mapping of hook file stems to owning feature IDs by scanning
 * each feature's `affectsTemplates` for paths matching `claude/hooks/`.
 *
 * - `claude/hooks/` (directory) → all hooks not claimed by a more specific match
 *   are gated by this feature (stored as `__default__`)
 * - `claude/hooks/<name>.sh` → the specific hook stem is gated by this feature
 *
 * @param {object[]} features - Feature definitions from features.yaml
 * @returns {{ specific: Record<string, string>, defaultFeature: string|null }}
 */
export function buildHookFeatureMap(features) {
  const specific = {};
  let defaultFeature = null;

  for (const feature of features) {
    for (const tplPath of feature.affectsTemplates || []) {
      // Match exact hook file: claude/hooks/<name>.sh or claude/hooks/<name>.ps1
      const fileMatch = tplPath.match(/^claude\/hooks\/([^/]+)\.(sh|ps1)$/);
      if (fileMatch) {
        specific[fileMatch[1]] = feature.id;
        continue;
      }
      // Match directory-level claim: claude/hooks/ (trailing slash)
      if (tplPath === 'claude/hooks/' || tplPath === 'claude/hooks') {
        defaultFeature = feature.id;
      }
    }
  }

  return { specific, defaultFeature };
}

// ---------------------------------------------------------------------------
// Overlay management
// ---------------------------------------------------------------------------

function sanitizeRepoName(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '.' || trimmed === '..') return null;
  if (!trimmed || /\.\.|[/\\]/.test(trimmed)) return null;
  if (!REPO_NAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function loadOverlaySettings(agentkitRoot, projectRoot) {
  const markerPath = resolve(projectRoot, '.agentkit-repo');
  if (!existsSync(markerPath)) {
    throw new Error('No .agentkit-repo marker found. Run "agentkit init" first.');
  }
  const raw = readFileSync(markerPath, 'utf-8').trim();
  const repoName = sanitizeRepoName(raw);
  if (!repoName) {
    throw new Error('.agentkit-repo contains invalid overlay name. Run "agentkit init" to fix.');
  }
  const settingsPath = resolve(agentkitRoot, 'overlays', repoName, 'settings.yaml');
  if (!existsSync(settingsPath)) {
    throw new Error(`Overlay settings not found at ${settingsPath}. Run "agentkit init" first.`);
  }
  const settings = yaml.load(readFileSync(settingsPath, 'utf-8')) || {};
  return { repoName, settingsPath, settings };
}

function saveOverlaySettings(settingsPath, settings) {
  writeFileSync(settingsPath, yaml.dump(settings, { lineWidth: 120 }), 'utf-8');
}

// ---------------------------------------------------------------------------
// CLI Handlers
// ---------------------------------------------------------------------------

/**
 * `agentkit features` — list features and their status.
 */
export async function runFeatures({ agentkitRoot, projectRoot, flags }) {
  const { features, presets } = loadFeatureSpec(agentkitRoot);
  const { settings } = loadOverlaySettings(agentkitRoot, projectRoot);
  const enabled = resolveFeatures(features, settings, presets);
  const categories = getFeatureListInfo(features, enabled);

  // Show current preset/mode
  if (settings.featurePreset) {
    console.log(`  Feature preset: ${settings.featurePreset}`);
  } else if (Array.isArray(settings.enabledFeatures)) {
    console.log(`  Feature mode:   custom (explicit list)`);
  } else {
    console.log(`  Feature mode:   default`);
  }
  console.log(`  Total enabled:  ${enabled.size} / ${features.length}`);
  console.log();

  for (const [category, featureList] of Object.entries(categories)) {
    console.log(`  ${category.toUpperCase()}`);
    for (const f of featureList) {
      const status = f.alwaysOn ? 'always-on' : f.enabled ? 'enabled' : 'disabled';
      const icon = f.alwaysOn ? '*' : f.enabled ? '+' : '-';
      const deps = f.dependencies.length > 0 ? ` (deps: ${f.dependencies.join(', ')})` : '';
      console.log(`    ${icon} ${f.id.padEnd(28)} ${status}${deps}`);
    }
    console.log();
  }

  // Show available presets with feature lists
  if (flags?.verbose) {
    console.log('  AVAILABLE PRESETS');
    for (const [name, preset] of Object.entries(presets)) {
      const featureCount =
        (preset.features || []).length + features.filter((f) => f.alwaysOn).length;
      console.log(`    ${name.padEnd(12)} ${preset.label} (${featureCount} features)`);
      console.log(`    ${' '.repeat(12)} ${preset.description}`);
      const featureIds = (preset.features || []).join(', ');
      console.log(`    ${' '.repeat(12)} Features: ${featureIds}`);
      console.log();
    }

    // Show dependency graph
    console.log('  DEPENDENCY GRAPH');
    for (const f of features) {
      if ((f.dependencies || []).length > 0) {
        console.log(`    ${f.id} → depends on: ${f.dependencies.join(', ')}`);
      }
    }
    const standalone = features.filter((f) => !f.alwaysOn && (f.dependencies || []).length === 0);
    console.log(`    (${standalone.length} features are standalone / dependency-free)`);
  }
}

/**
 * `agentkit features enable <feature...>` — enable one or more features.
 */
export async function runFeatureEnable({ agentkitRoot, projectRoot, flags }) {
  const featureIds = flags._args || [];
  if (featureIds.length === 0) {
    throw new Error('Usage: agentkit features enable <feature> [feature2 ...]');
  }

  const { features, presets } = loadFeatureSpec(agentkitRoot);
  const index = buildFeatureIndex(features);
  const { repoName, settingsPath, settings } = loadOverlaySettings(agentkitRoot, projectRoot);

  // Validate feature IDs
  const invalid = featureIds.filter((id) => !index.has(id));
  if (invalid.length > 0) {
    const available = features.map((f) => f.id).join(', ');
    throw new Error(`Unknown feature(s): ${invalid.join(', ')}\nAvailable: ${available}`);
  }

  // Resolve current state, then enable requested features
  const currentEnabled = resolveFeatures(features, settings, presets);
  const toEnable = featureIds.filter((id) => !currentEnabled.has(id));

  if (toEnable.length === 0) {
    console.log(`[agentkit:features] All specified features already enabled.`);
    return;
  }

  // Switch to explicit enabledFeatures mode — clear featurePreset to avoid conflict
  if (!Array.isArray(settings.enabledFeatures)) {
    settings.enabledFeatures = [...currentEnabled];
    if (settings.featurePreset) {
      console.log(
        `[agentkit:features] Switching from preset "${settings.featurePreset}" to explicit mode.`
      );
      delete settings.featurePreset;
    }
  }

  for (const id of toEnable) {
    if (!settings.enabledFeatures.includes(id)) {
      settings.enabledFeatures.push(id);
    }
  }

  // Remove from disabledFeatures if present
  if (Array.isArray(settings.disabledFeatures)) {
    settings.disabledFeatures = settings.disabledFeatures.filter((id) => !toEnable.includes(id));
    if (settings.disabledFeatures.length === 0) {
      delete settings.disabledFeatures;
    }
  }

  saveOverlaySettings(settingsPath, settings);
  console.log(`[agentkit:features] Enabled: ${toEnable.join(', ')}`);

  // Check for auto-enabled dependencies
  const finalEnabled = resolveFeatures(features, settings, presets);
  const autoEnabled = [...finalEnabled].filter(
    (id) => !currentEnabled.has(id) && !toEnable.includes(id)
  );
  if (autoEnabled.length > 0) {
    console.log(`[agentkit:features] Auto-enabled dependencies: ${autoEnabled.join(', ')}`);
  }

  // Sync (opt-in, controlled by autoSyncAfterFeatureChange in overlay settings)
  const { runSync } = await import('./synchronize.mjs');
  const autoSyncAfterFeatureChange = settings.autoSyncAfterFeatureChange ?? false;
  if (autoSyncAfterFeatureChange) {
    console.log(`[agentkit:features] Running sync...`);
    await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });
  } else {
    console.log(
      `[agentkit:features] Sync skipped (autoSyncAfterFeatureChange is false). Run "agentkit sync" manually when ready.`
    );
  }
}

/**
 * `agentkit features disable <feature...>` — disable one or more features.
 */
export async function runFeatureDisable({ agentkitRoot, projectRoot, flags }) {
  const featureIds = flags._args || [];
  if (featureIds.length === 0) {
    throw new Error('Usage: agentkit features disable <feature> [feature2 ...]');
  }

  const { features, presets } = loadFeatureSpec(agentkitRoot);
  const index = buildFeatureIndex(features);
  const { repoName, settingsPath, settings } = loadOverlaySettings(agentkitRoot, projectRoot);

  // Validate feature IDs
  const invalid = featureIds.filter((id) => !index.has(id));
  if (invalid.length > 0) {
    const available = features.map((f) => f.id).join(', ');
    throw new Error(`Unknown feature(s): ${invalid.join(', ')}\nAvailable: ${available}`);
  }

  // Cannot disable alwaysOn features
  const alwaysOn = featureIds.filter((id) => index.get(id)?.alwaysOn);
  if (alwaysOn.length > 0) {
    throw new Error(
      `Cannot disable core features: ${alwaysOn.join(', ')}. These are always enabled.`
    );
  }

  // Check for dependents that would break
  const currentEnabled = resolveFeatures(features, settings, presets);
  const disableSet = new Set(featureIds);
  const brokenDeps = [];

  for (const id of currentEnabled) {
    if (disableSet.has(id)) continue;
    const feature = index.get(id);
    if (!feature) continue;
    for (const dep of feature.dependencies || []) {
      if (disableSet.has(dep)) {
        brokenDeps.push(`${id} depends on ${dep}`);
      }
    }
  }

  if (brokenDeps.length > 0) {
    throw new Error(
      `Cannot disable — other enabled features depend on these:\n  ${brokenDeps.join('\n  ')}\nDisable the dependent features first, or disable them together.`
    );
  }

  // Apply disablement — switch to explicit mode, clear featurePreset to avoid conflict
  if (!Array.isArray(settings.enabledFeatures)) {
    settings.enabledFeatures = [...currentEnabled];
    if (settings.featurePreset) {
      console.log(
        `[agentkit:features] Switching from preset "${settings.featurePreset}" to explicit mode.`
      );
      delete settings.featurePreset;
    }
  }
  settings.enabledFeatures = settings.enabledFeatures.filter((id) => !disableSet.has(id));

  // Also track in disabledFeatures for clarity
  if (!Array.isArray(settings.disabledFeatures)) {
    settings.disabledFeatures = [];
  }
  for (const id of featureIds) {
    if (!settings.disabledFeatures.includes(id)) {
      settings.disabledFeatures.push(id);
    }
  }

  saveOverlaySettings(settingsPath, settings);
  console.log(`[agentkit:features] Disabled: ${featureIds.join(', ')}`);

  // Sync (opt-in, controlled by autoSyncAfterFeatureChange in overlay settings)
  const { runSync } = await import('./synchronize.mjs');
  const autoSyncAfterFeatureChange = settings.autoSyncAfterFeatureChange ?? false;
  if (autoSyncAfterFeatureChange) {
    console.log(`[agentkit:features] Running sync...`);
    await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });
  } else {
    console.log(
      `[agentkit:features] Sync skipped (autoSyncAfterFeatureChange is false). Run "agentkit sync" manually when ready.`
    );
  }
}

/**
 * `agentkit features preset <name>` — apply a named feature preset.
 */
export async function runFeaturePreset({ agentkitRoot, projectRoot, flags }) {
  const presetName = (flags._args || [])[0];
  if (!presetName) {
    throw new Error('Usage: agentkit features preset <name>');
  }

  const { features, presets } = loadFeatureSpec(agentkitRoot);
  if (!presets[presetName]) {
    throw new Error(
      `Unknown preset: "${presetName}". Available: ${Object.keys(presets).join(', ')}`
    );
  }

  const { repoName, settingsPath, settings } = loadOverlaySettings(agentkitRoot, projectRoot);

  // Set preset mode — clears explicit enabledFeatures/disabledFeatures
  settings.featurePreset = presetName;
  delete settings.enabledFeatures;
  delete settings.disabledFeatures;

  saveOverlaySettings(settingsPath, settings);

  const enabled = resolveFeatures(features, settings, presets);
  console.log(`[agentkit:features] Applied preset: ${presets[presetName].label}`);
  console.log(`[agentkit:features] Enabled ${enabled.size} features.`);

  // Sync (opt-in, controlled by autoSyncAfterFeatureChange in overlay settings)
  const { runSync } = await import('./synchronize.mjs');
  const autoSyncAfterFeatureChange = settings.autoSyncAfterFeatureChange ?? false;
  if (autoSyncAfterFeatureChange) {
    console.log(`[agentkit:features] Running sync...`);
    await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });
  } else {
    console.log(
      `[agentkit:features] Sync skipped (autoSyncAfterFeatureChange is false). Run "agentkit sync" manually when ready.`
    );
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates features.yaml structure and cross-references.
 *
 * Checks performed:
 * - Feature entry schema: id, name, category, description, templateVars
 * - Duplicate feature IDs
 * - Dependencies reference existing features (no dangling refs)
 * - No self-dependencies
 * - No dependency cycles (topological sort validation)
 * - Preset feature lists reference existing features
 * - Presets don't redundantly include alwaysOn features
 * - Presets include transitive dependencies (warn if missing)
 * - Valid categories
 * - templateVar naming conventions
 *
 * @param {object[]} features - Feature definitions
 * @param {object} presets - Preset definitions
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateFeatureSpec(features, presets) {
  const errors = [];
  const warnings = [];
  const index = buildFeatureIndex(features);
  const seenIds = new Set();
  const validCategories = new Set([
    'core',
    'workflow',
    'quality',
    'docs',
    'security',
    'infra',
    'advanced',
  ]);

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const path = `features.yaml.features[${i}]`;

    if (!f.id || typeof f.id !== 'string') {
      errors.push(`${path}: missing or invalid "id"`);
      continue;
    }

    if (seenIds.has(f.id)) {
      errors.push(`${path}: duplicate feature id "${f.id}"`);
    }
    seenIds.add(f.id);

    if (!f.name || typeof f.name !== 'string') {
      errors.push(`${path}: missing or invalid "name"`);
    }
    if (!f.category || typeof f.category !== 'string') {
      errors.push(`${path}: missing or invalid "category"`);
    } else if (!validCategories.has(f.category)) {
      warnings.push(`${path}: feature "${f.id}" uses non-standard category "${f.category}"`);
    }
    if (!f.description || typeof f.description !== 'string') {
      errors.push(`${path}: missing or invalid "description"`);
    }
    if (!Array.isArray(f.templateVars) || f.templateVars.length === 0) {
      warnings.push(`${path}: feature "${f.id}" has no templateVars defined`);
    } else {
      for (const varName of f.templateVars) {
        if (typeof varName !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(varName)) {
          errors.push(
            `${path}: invalid templateVar name "${varName}" — must be camelCase alphanumeric`
          );
        }
      }
    }

    // Validate dependencies exist and aren't self-referencing
    for (const dep of f.dependencies || []) {
      if (!index.has(dep)) {
        errors.push(`${path}: dependency "${dep}" does not exist`);
      }
      if (dep === f.id) {
        errors.push(`${path}: feature cannot depend on itself`);
      }
    }

    // Warn if a non-core feature depends on another non-core feature that has alwaysOn
    // (redundant but not an error)
  }

  // Validate presets reference valid feature IDs + check dependency completeness
  for (const [name, preset] of Object.entries(presets || {})) {
    const presetPath = `features.yaml.presets.${name}`;

    if (!preset.features || !Array.isArray(preset.features)) {
      errors.push(`${presetPath}: missing or invalid "features" array`);
      continue;
    }

    if (!preset.label || typeof preset.label !== 'string') {
      warnings.push(`${presetPath}: missing "label"`);
    }
    if (!preset.description || typeof preset.description !== 'string') {
      warnings.push(`${presetPath}: missing "description"`);
    }

    const presetFeatureSet = new Set(preset.features);

    for (const id of preset.features) {
      if (!index.has(id)) {
        errors.push(`${presetPath}: references unknown feature "${id}"`);
        continue;
      }

      // Warn if preset includes alwaysOn features (redundant)
      const feature = index.get(id);
      if (feature?.alwaysOn) {
        warnings.push(
          `${presetPath}: includes always-on feature "${id}" (redundant — always-on features are auto-included)`
        );
      }

      // Warn if a feature's dependencies are missing from the preset
      for (const dep of feature?.dependencies || []) {
        if (!presetFeatureSet.has(dep) && !index.get(dep)?.alwaysOn) {
          warnings.push(
            `${presetPath}: feature "${id}" depends on "${dep}" which is not in this preset ` +
              `(it will be auto-enabled at resolution time, but consider adding it explicitly)`
          );
        }
      }
    }
  }

  // Detect dependency cycles (single DFS pass with shared visiting/visited sets)
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function detectCycle(featureId) {
    if (visiting.has(featureId)) {
      const cycleStart = stack.indexOf(featureId);
      const cycle = [...stack.slice(cycleStart), featureId];
      errors.push(`features.yaml: dependency cycle detected: ${cycle.join(' -> ')}`);
      return;
    }
    if (visited.has(featureId)) return;

    visiting.add(featureId);
    stack.push(featureId);
    const feature = index.get(featureId);
    if (feature) {
      for (const dep of feature.dependencies || []) {
        if (index.has(dep)) detectCycle(dep);
      }
    }
    stack.pop();
    visiting.delete(featureId);
    visited.add(featureId);
  }

  for (const f of features) {
    detectCycle(f.id);
  }

  return { errors, warnings };
}

/**
 * Validates that affectsTemplates paths in feature definitions reference
 * actual files or directories in the templates directory.
 *
 * @param {object[]} features - Feature definitions from features.yaml
 * @param {string} templatesDir - Path to the templates directory
 * @returns {{ warnings: string[] }}
 */
export function validateAffectsTemplates(features, templatesDir) {
  const warnings = [];

  for (const feature of features) {
    for (const tplPath of feature.affectsTemplates || []) {
      // Reject paths that escape the templates root (path traversal)
      if (tplPath.startsWith('/') || tplPath.startsWith('\\') || tplPath.includes('..')) {
        warnings.push(
          `features.yaml: feature "${feature.id}" affectsTemplates path "${tplPath}" ` +
            `must be a relative path within the templates directory (no "..", absolute, or backslash paths)`
        );
        continue;
      }

      // Directory references end with / — check if directory exists
      if (tplPath.endsWith('/')) {
        const dirPath = resolve(templatesDir, tplPath);
        if (!existsSync(dirPath)) {
          warnings.push(
            `features.yaml: feature "${feature.id}" affectsTemplates references directory "${tplPath}" ` +
              `which does not exist in templates/`
          );
        }
        continue;
      }

      // Glob-style patterns (with *) — check that the parent directory exists
      if (tplPath.includes('*')) {
        const parts = tplPath.split('/');
        // Find the deepest non-glob directory segment
        let parentDir = templatesDir;
        for (const part of parts) {
          if (part.includes('*')) break;
          parentDir = join(parentDir, part);
        }
        if (!existsSync(parentDir)) {
          warnings.push(
            `features.yaml: feature "${feature.id}" affectsTemplates references pattern "${tplPath}" ` +
              `but base directory does not exist in templates/`
          );
        }
        continue;
      }

      // Exact file reference — check if file exists
      const filePath = resolve(templatesDir, tplPath);
      if (!existsSync(filePath)) {
        warnings.push(
          `features.yaml: feature "${feature.id}" affectsTemplates references "${tplPath}" ` +
            `which does not exist in templates/`
        );
      }
    }
  }

  return { warnings };
}

/**
 * Validates overlay feature settings against the spec.
 *
 * Checks performed:
 * - featurePreset references a valid preset name
 * - enabledFeatures entries reference valid feature IDs
 * - disabledFeatures entries reference valid feature IDs
 * - disabledFeatures does not include alwaysOn features
 * - Warns if both enabledFeatures and featurePreset are set (enabledFeatures wins)
 * - Warns if a feature appears in both enabledFeatures and disabledFeatures
 * - Warns if disabling a feature would break dependencies of other enabled features
 *
 * @param {object} overlaySettings - Overlay settings.yaml content
 * @param {object[]} features - Feature definitions from features.yaml
 * @param {object} presets - Preset definitions from features.yaml
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateOverlayFeatures(overlaySettings, features, presets) {
  const errors = [];
  const warnings = [];
  const index = buildFeatureIndex(features);

  // Check for conflicting configuration modes
  if (
    Array.isArray(overlaySettings.enabledFeatures) &&
    typeof overlaySettings.featurePreset === 'string'
  ) {
    warnings.push(
      `overlay settings.yaml: both "enabledFeatures" and "featurePreset" are set. ` +
        `"enabledFeatures" takes precedence — "featurePreset" will be ignored. ` +
        `Remove one to avoid confusion.`
    );
  }

  if (overlaySettings.featurePreset) {
    if (!presets[overlaySettings.featurePreset]) {
      errors.push(
        `overlay settings.yaml: unknown featurePreset "${overlaySettings.featurePreset}". ` +
          `Available: ${Object.keys(presets).join(', ')}`
      );
    }
  }

  // Reject non-array feature lists early
  if (
    overlaySettings.enabledFeatures !== undefined &&
    !Array.isArray(overlaySettings.enabledFeatures)
  ) {
    errors.push(
      `overlay settings.yaml: "enabledFeatures" must be an array, got ${typeof overlaySettings.enabledFeatures}`
    );
    return { errors, warnings };
  }
  if (
    overlaySettings.disabledFeatures !== undefined &&
    !Array.isArray(overlaySettings.disabledFeatures)
  ) {
    errors.push(
      `overlay settings.yaml: "disabledFeatures" must be an array, got ${typeof overlaySettings.disabledFeatures}`
    );
    return { errors, warnings };
  }

  const enabledSet = new Set(overlaySettings.enabledFeatures || []);
  const disabledSet = new Set(overlaySettings.disabledFeatures || []);

  if (Array.isArray(overlaySettings.enabledFeatures)) {
    for (const id of overlaySettings.enabledFeatures) {
      if (!index.has(id)) {
        warnings.push(`overlay settings.yaml: enabledFeatures references unknown feature "${id}"`);
      }
      // Check for feature in both lists
      if (disabledSet.has(id)) {
        warnings.push(
          `overlay settings.yaml: feature "${id}" appears in both enabledFeatures and disabledFeatures. ` +
            `disabledFeatures wins — "${id}" will be disabled.`
        );
      }
    }
  }

  if (Array.isArray(overlaySettings.disabledFeatures)) {
    for (const id of overlaySettings.disabledFeatures) {
      if (!index.has(id)) {
        warnings.push(`overlay settings.yaml: disabledFeatures references unknown feature "${id}"`);
      }
      const feature = index.get(id);
      if (feature?.alwaysOn) {
        errors.push(`overlay settings.yaml: cannot disable core feature "${id}"`);
      }
    }

    // Warn about dependency breakage from disabled features
    const resolvedEnabled = resolveFeatures(features, overlaySettings, presets);
    for (const id of resolvedEnabled) {
      const feature = index.get(id);
      if (!feature) continue;
      for (const dep of feature.dependencies || []) {
        if (disabledSet.has(dep) && !index.get(dep)?.alwaysOn) {
          warnings.push(
            `overlay settings.yaml: disabling "${dep}" may break "${id}" which depends on it. ` +
              `The dependency will be auto-enabled at resolution time, effectively overriding the disable.`
          );
        }
      }
    }
  }

  return { errors, warnings };
}
