/**
 * AgentKit Forge — Feature Manager
 * Handles feature resolution, validation, enable/disable, and template variable generation.
 *
 * Features are defined in spec/features.yaml and controlled per-repo via overlay settings.yaml.
 * Core features (alwaysOn: true) cannot be disabled.
 * Dependencies are automatically resolved — enabling a feature enables its dependencies.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';
import { REPO_NAME_PATTERN } from './repo-name.mjs';

// ---------------------------------------------------------------------------
// Load feature definitions
// ---------------------------------------------------------------------------

/**
 * Loads and parses the features.yaml spec.
 * @param {string} agentkitRoot - Path to the .agentkit/ directory
 * @returns {{ features: object[], presets: object }}
 */
export function loadFeatureSpec(agentkitRoot) {
  const featuresPath = resolve(agentkitRoot, 'spec', 'features.yaml');
  if (!existsSync(featuresPath)) {
    throw new Error(`features.yaml not found at ${featuresPath}`);
  }
  const spec = yaml.load(readFileSync(featuresPath, 'utf-8'));
  if (!spec || !Array.isArray(spec.features)) {
    throw new Error('features.yaml: missing or invalid "features" array');
  }
  return {
    features: spec.features,
    presets: spec.presets || {},
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
 * 2. If overlay specifies enabledFeatures → use that list
 * 3. If overlay specifies a featurePreset → expand the preset
 * 4. Otherwise → use features with default: true
 * 5. Apply disabledFeatures exclusions (cannot exclude alwaysOn)
 * 6. Resolve dependencies (enabling a feature auto-enables its deps)
 *
 * @param {object[]} features - Feature definitions from features.yaml
 * @param {object} overlaySettings - Overlay settings.yaml content
 * @param {object} presets - Preset definitions from features.yaml
 * @returns {Set<string>} Set of enabled feature IDs
 */
export function resolveFeatures(features, overlaySettings = {}, presets = {}) {
  const index = buildFeatureIndex(features);

  // 1. Always-on features
  const alwaysOn = new Set(
    features.filter((f) => f.alwaysOn).map((f) => f.id)
  );

  // 2-4. Determine base enabled set
  let enabled;

  if (Array.isArray(overlaySettings.enabledFeatures)) {
    // Explicit list from overlay
    enabled = new Set(overlaySettings.enabledFeatures.filter((id) => index.has(id)));
  } else if (
    typeof overlaySettings.featurePreset === 'string' &&
    presets[overlaySettings.featurePreset]
  ) {
    // Preset expansion
    const preset = presets[overlaySettings.featurePreset];
    enabled = new Set((preset.features || []).filter((id) => index.has(id)));
  } else {
    // Default: features with default: true
    enabled = new Set(
      features.filter((f) => f.default === true).map((f) => f.id)
    );
  }

  // 5. Apply disabled exclusions (overlay can explicitly disable features)
  if (Array.isArray(overlaySettings.disabledFeatures)) {
    for (const id of overlaySettings.disabledFeatures) {
      if (!alwaysOn.has(id)) {
        enabled.delete(id);
      }
    }
  }

  // Always include alwaysOn
  for (const id of alwaysOn) {
    enabled.add(id);
  }

  // 6. Resolve dependencies (transitive)
  const resolved = new Set(enabled);
  const visited = new Set();

  function resolveDeps(featureId) {
    if (visited.has(featureId)) return;
    visited.add(featureId);
    const feature = index.get(featureId);
    if (!feature) return;
    for (const dep of feature.dependencies || []) {
      if (index.has(dep)) {
        resolved.add(dep);
        resolveDeps(dep);
      }
    }
  }

  for (const id of enabled) {
    resolveDeps(id);
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Template variable generation
// ---------------------------------------------------------------------------

/**
 * Generates template variables from the resolved feature set.
 * Each feature defines templateVars (e.g., hasTeamOrchestration).
 * Enabled features get their vars set to true; disabled get false.
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

  // Show available presets
  if (flags?.verbose) {
    console.log('  AVAILABLE PRESETS');
    for (const [name, preset] of Object.entries(presets)) {
      console.log(`    ${name.padEnd(12)} ${preset.label}`);
      console.log(`    ${' '.repeat(12)} ${preset.description}`);
    }
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

  // Switch to explicit enabledFeatures mode
  if (!Array.isArray(settings.enabledFeatures)) {
    settings.enabledFeatures = [...currentEnabled];
  }

  for (const id of toEnable) {
    if (!settings.enabledFeatures.includes(id)) {
      settings.enabledFeatures.push(id);
    }
  }

  // Remove from disabledFeatures if present
  if (Array.isArray(settings.disabledFeatures)) {
    settings.disabledFeatures = settings.disabledFeatures.filter(
      (id) => !toEnable.includes(id)
    );
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

  // Trigger sync
  console.log(`[agentkit:features] Running sync...`);
  const { runSync } = await import('./synchronize.mjs');
  await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });
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

  // Apply disablement
  if (!Array.isArray(settings.enabledFeatures)) {
    settings.enabledFeatures = [...currentEnabled];
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

  // Trigger sync
  console.log(`[agentkit:features] Running sync...`);
  const { runSync } = await import('./synchronize.mjs');
  await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });
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

  // Trigger sync
  console.log(`[agentkit:features] Running sync...`);
  const { runSync } = await import('./synchronize.mjs');
  await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates features.yaml structure and cross-references.
 * @param {object[]} features - Feature definitions
 * @param {object} presets - Preset definitions
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateFeatureSpec(features, presets) {
  const errors = [];
  const warnings = [];
  const index = buildFeatureIndex(features);
  const seenIds = new Set();

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
    }
    if (!f.description || typeof f.description !== 'string') {
      errors.push(`${path}: missing or invalid "description"`);
    }
    if (!Array.isArray(f.templateVars) || f.templateVars.length === 0) {
      warnings.push(`${path}: feature "${f.id}" has no templateVars defined`);
    }

    // Validate dependencies exist
    for (const dep of f.dependencies || []) {
      if (!index.has(dep)) {
        errors.push(`${path}: dependency "${dep}" does not exist`);
      }
      if (dep === f.id) {
        errors.push(`${path}: feature cannot depend on itself`);
      }
    }
  }

  // Validate presets reference valid feature IDs
  for (const [name, preset] of Object.entries(presets || {})) {
    if (!preset.features || !Array.isArray(preset.features)) {
      errors.push(`features.yaml.presets.${name}: missing or invalid "features" array`);
      continue;
    }
    for (const id of preset.features) {
      if (!index.has(id)) {
        errors.push(`features.yaml.presets.${name}: references unknown feature "${id}"`);
      }
    }
  }

  // Detect dependency cycles
  const visiting = new Set();
  const visited = new Set();

  function detectCycle(featureId, stack = []) {
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
        if (index.has(dep)) detectCycle(dep, [...stack]);
      }
    }
    visiting.delete(featureId);
    visited.add(featureId);
  }

  for (const f of features) {
    detectCycle(f.id);
  }

  return { errors, warnings };
}

/**
 * Validates overlay feature settings against the spec.
 */
export function validateOverlayFeatures(overlaySettings, features, presets) {
  const errors = [];
  const warnings = [];
  const index = buildFeatureIndex(features);

  if (overlaySettings.featurePreset) {
    if (!presets[overlaySettings.featurePreset]) {
      errors.push(
        `overlay settings.yaml: unknown featurePreset "${overlaySettings.featurePreset}". ` +
          `Available: ${Object.keys(presets).join(', ')}`
      );
    }
  }

  if (Array.isArray(overlaySettings.enabledFeatures)) {
    for (const id of overlaySettings.enabledFeatures) {
      if (!index.has(id)) {
        warnings.push(`overlay settings.yaml: enabledFeatures references unknown feature "${id}"`);
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
  }

  return { errors, warnings };
}
