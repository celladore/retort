import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildFeatureIndex,
  buildFeatureVars,
  buildHookFeatureMap,
  resolveFeatures,
  validateAffectsTemplates,
  validateFeatureSpec,
  validateOverlayFeatures,
  loadFeatureSpec,
  SUPPORTED_SCHEMA_VERSION,
} from '../feature-manager.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeFeature(overrides = {}) {
  return {
    id: 'test-feature',
    name: 'Test Feature',
    category: 'workflow',
    description: 'A test feature',
    alwaysOn: false,
    default: false,
    dependencies: [],
    templateVars: ['hasTestFeature'],
    affectsTemplates: [],
    ...overrides,
  };
}

function coreFeatures() {
  return [
    makeFeature({
      id: 'spec-sync',
      name: 'Spec Sync',
      category: 'core',
      alwaysOn: true,
      templateVars: ['hasSpecSync'],
    }),
    makeFeature({
      id: 'project-context',
      name: 'Project Context',
      category: 'core',
      alwaysOn: true,
      templateVars: ['hasProjectContext'],
    }),
  ];
}

function standardFeatures() {
  return [
    ...coreFeatures(),
    makeFeature({
      id: 'team-orchestration',
      default: false,
      templateVars: ['hasTeamOrchestration'],
    }),
    makeFeature({
      id: 'agent-personas',
      default: false,
      dependencies: ['team-orchestration'],
      templateVars: ['hasAgentPersonas'],
    }),
    makeFeature({
      id: 'quality-gates',
      default: false,
      category: 'quality',
      templateVars: ['hasQualityGates'],
    }),
    makeFeature({
      id: 'coding-rules',
      default: false,
      category: 'quality',
      templateVars: ['hasCodingRules'],
    }),
    makeFeature({
      id: 'doc-scaffolding',
      default: false,
      category: 'docs',
      templateVars: ['hasDocScaffolding'],
    }),
    makeFeature({
      id: 'mcp-integration',
      default: false,
      category: 'advanced',
      templateVars: ['hasMcpIntegration'],
    }),
    makeFeature({
      id: 'healthcheck',
      default: false,
      category: 'advanced',
      dependencies: ['quality-gates'],
      templateVars: ['hasHealthcheck'],
    }),
  ];
}

function standardPresets() {
  return {
    minimal: {
      label: 'Minimal',
      description: 'Core + basic quality',
      features: ['quality-gates', 'coding-rules'],
    },
    standard: {
      label: 'Standard',
      description: 'Teams + quality + docs',
      features: [
        'team-orchestration',
        'agent-personas',
        'quality-gates',
        'coding-rules',
        'doc-scaffolding',
      ],
    },
    full: {
      label: 'Full',
      description: 'Everything',
      features: [
        'team-orchestration',
        'agent-personas',
        'quality-gates',
        'coding-rules',
        'doc-scaffolding',
        'mcp-integration',
        'healthcheck',
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// buildFeatureIndex()
// ---------------------------------------------------------------------------
describe('buildFeatureIndex()', () => {
  it('creates a Map keyed by feature id', () => {
    const features = standardFeatures();
    const index = buildFeatureIndex(features);
    expect(index).toBeInstanceOf(Map);
    expect(index.size).toBe(features.length);
    expect(index.get('team-orchestration').name).toBe('Test Feature');
  });

  it('skips features without an id', () => {
    const features = [{ name: 'No ID' }, makeFeature({ id: 'valid' })];
    const index = buildFeatureIndex(features);
    expect(index.size).toBe(1);
    expect(index.has('valid')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveFeatures()
// ---------------------------------------------------------------------------
describe('resolveFeatures()', () => {
  const features = standardFeatures();
  const presets = standardPresets();

  describe('alwaysOn features', () => {
    it('always includes core features regardless of overlay settings', () => {
      const result = resolveFeatures(features, { enabledFeatures: [] }, presets);
      expect(result.has('spec-sync')).toBe(true);
      expect(result.has('project-context')).toBe(true);
    });

    it('core features survive disabledFeatures', () => {
      const result = resolveFeatures(
        features,
        {
          disabledFeatures: ['spec-sync', 'project-context'],
        },
        presets
      );
      expect(result.has('spec-sync')).toBe(true);
      expect(result.has('project-context')).toBe(true);
    });
  });

  describe('precedence: enabledFeatures > featurePreset > default', () => {
    it('uses enabledFeatures when present (precedence 1)', () => {
      const result = resolveFeatures(
        features,
        {
          enabledFeatures: ['mcp-integration'],
          featurePreset: 'standard',
        },
        presets
      );
      // enabledFeatures wins — only mcp-integration + core
      expect(result.has('mcp-integration')).toBe(true);
      expect(result.has('team-orchestration')).toBe(false);
    });

    it('uses featurePreset when no enabledFeatures (precedence 2)', () => {
      const result = resolveFeatures(features, { featurePreset: 'minimal' }, presets);
      expect(result.has('quality-gates')).toBe(true);
      expect(result.has('coding-rules')).toBe(true);
      expect(result.has('team-orchestration')).toBe(false);
    });

    it('uses default: false when neither set (precedence 3)', () => {
      const result = resolveFeatures(features, {}, presets);
      expect(result.has('team-orchestration')).toBe(false);
      expect(result.has('quality-gates')).toBe(false);
      expect(result.has('mcp-integration')).toBe(false);
      expect(result.has('spec-sync')).toBe(true);
      expect(result.has('project-context')).toBe(true);
    });
  });

  describe('disabledFeatures', () => {
    it('subtracts features from the enabled set', () => {
      // Disable both team-orchestration and its dependent agent-personas
      // to prevent transitive re-enable via dependency resolution
      const result = resolveFeatures(
        features,
        {
          disabledFeatures: ['team-orchestration', 'agent-personas'],
        },
        presets
      );
      expect(result.has('team-orchestration')).toBe(false);
      expect(result.has('agent-personas')).toBe(false);
    });

    it('disabledFeatures wins over enabledFeatures', () => {
      const result = resolveFeatures(
        features,
        {
          enabledFeatures: ['mcp-integration'],
          disabledFeatures: ['mcp-integration'],
        },
        presets
      );
      expect(result.has('mcp-integration')).toBe(false);
    });
  });

  describe('transitive dependency resolution', () => {
    it('auto-enables dependencies of enabled features', () => {
      const result = resolveFeatures(
        features,
        {
          enabledFeatures: ['agent-personas'],
        },
        presets
      );
      // agent-personas depends on team-orchestration
      expect(result.has('agent-personas')).toBe(true);
      expect(result.has('team-orchestration')).toBe(true);
    });

    it('resolves multi-level dependencies', () => {
      // healthcheck → quality-gates (1 level)
      const result = resolveFeatures(
        features,
        {
          enabledFeatures: ['healthcheck'],
        },
        presets
      );
      expect(result.has('healthcheck')).toBe(true);
      expect(result.has('quality-gates')).toBe(true);
    });
  });

  describe('empty / missing overlay', () => {
    it('works with no overlay settings', () => {
      const result = resolveFeatures(features);
      expect(result.size).toBeGreaterThan(0);
      expect(result.has('spec-sync')).toBe(true);
    });

    it('works with empty overlay', () => {
      const result = resolveFeatures(features, {}, presets);
      expect(result.has('spec-sync')).toBe(true);
    });
  });

  describe('unknown preset', () => {
    it('falls back to defaults for unknown preset name', () => {
      const result = resolveFeatures(features, { featurePreset: 'nonexistent' }, presets);
      // Falls through to default: false — only alwaysOn features remain
      expect(result.has('team-orchestration')).toBe(false);
      expect(result.has('spec-sync')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// buildFeatureVars()
// ---------------------------------------------------------------------------
describe('buildFeatureVars()', () => {
  const features = standardFeatures();

  it('sets templateVars to true for enabled features', () => {
    const enabled = new Set(['spec-sync', 'team-orchestration', 'quality-gates']);
    const vars = buildFeatureVars(features, enabled);
    expect(vars.hasTeamOrchestration).toBe(true);
    expect(vars.hasQualityGates).toBe(true);
  });

  it('sets templateVars to false for disabled features', () => {
    const enabled = new Set(['spec-sync']);
    const vars = buildFeatureVars(features, enabled);
    expect(vars.hasTeamOrchestration).toBe(false);
    expect(vars.hasMcpIntegration).toBe(false);
  });

  it('sets canonical feature_<id> vars', () => {
    const enabled = new Set(['team-orchestration']);
    const vars = buildFeatureVars(features, enabled);
    expect(vars.feature_team_orchestration).toBe(true);
    expect(vars.feature_mcp_integration).toBe(false);
  });

  it('generates aggregate vars', () => {
    const enabled = new Set(['spec-sync', 'project-context', 'team-orchestration']);
    const vars = buildFeatureVars(features, enabled);
    expect(vars.enabledFeaturesCount).toBe('3');
    expect(vars.totalFeaturesCount).toBe(String(features.length));
    expect(vars.enabledFeaturesList).toContain('team-orchestration');
    expect(typeof vars.featureSummary).toBe('string');
    expect(vars.featureSummary).toContain('Enabled');
  });
});

// ---------------------------------------------------------------------------
// buildHookFeatureMap()
// ---------------------------------------------------------------------------
describe('buildHookFeatureMap()', () => {
  it('maps specific hook files to features', () => {
    const features = [
      makeFeature({ id: 'quality-gates', affectsTemplates: ['claude/hooks/stop-build-check.sh'] }),
      makeFeature({
        id: 'sensitive-file-protection',
        affectsTemplates: ['claude/hooks/protect-sensitive.sh'],
      }),
    ];
    const { specific, defaultFeature } = buildHookFeatureMap(features);
    expect(specific['stop-build-check']).toBe('quality-gates');
    expect(specific['protect-sensitive']).toBe('sensitive-file-protection');
    expect(defaultFeature).toBeNull();
  });

  it('maps directory-level claim to defaultFeature', () => {
    const features = [
      makeFeature({
        id: 'permission-guards',
        affectsTemplates: ['claude/settings.json', 'claude/hooks/'],
      }),
    ];
    const { defaultFeature } = buildHookFeatureMap(features);
    expect(defaultFeature).toBe('permission-guards');
  });

  it('specific mappings take precedence over default', () => {
    const features = [
      makeFeature({ id: 'permission-guards', affectsTemplates: ['claude/hooks/'] }),
      makeFeature({ id: 'quality-gates', affectsTemplates: ['claude/hooks/stop-build-check.sh'] }),
    ];
    const { specific, defaultFeature } = buildHookFeatureMap(features);
    expect(specific['stop-build-check']).toBe('quality-gates');
    expect(defaultFeature).toBe('permission-guards');
  });

  it('returns empty map when no features reference hooks', () => {
    const features = [makeFeature({ id: 'no-hooks', affectsTemplates: ['docs/'] })];
    const { specific, defaultFeature } = buildHookFeatureMap(features);
    expect(Object.keys(specific)).toHaveLength(0);
    expect(defaultFeature).toBeNull();
  });

  it('produces correct map from real features.yaml', () => {
    const { features } = loadFeatureSpec(AGENTKIT_ROOT);
    const { specific, defaultFeature } = buildHookFeatureMap(features);
    // Verify the known mappings from features.yaml
    expect(specific['stop-build-check']).toBe('quality-gates');
    expect(specific['protect-sensitive']).toBe('sensitive-file-protection');
    expect(defaultFeature).toBe('permission-guards');
  });
});

// ---------------------------------------------------------------------------
// validateFeatureSpec()
// ---------------------------------------------------------------------------
describe('validateFeatureSpec()', () => {
  describe('valid specs', () => {
    it('passes for the real features.yaml', () => {
      const { features, presets } = loadFeatureSpec(AGENTKIT_ROOT);
      const { errors } = validateFeatureSpec(features, presets);
      expect(errors).toHaveLength(0);
    });

    it('passes for well-formed minimal features', () => {
      const features = [makeFeature({ id: 'a' }), makeFeature({ id: 'b', dependencies: ['a'] })];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors).toHaveLength(0);
    });
  });

  describe('feature entry errors', () => {
    it('reports missing id', () => {
      const features = [{ name: 'No ID', category: 'core', description: 'x', templateVars: ['v'] }];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('missing or invalid "id"'))).toBe(true);
    });

    it('reports duplicate ids', () => {
      const features = [makeFeature({ id: 'dup' }), makeFeature({ id: 'dup' })];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('duplicate feature id "dup"'))).toBe(true);
    });

    it('reports missing name', () => {
      const features = [makeFeature({ id: 'x', name: '' })];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('missing or invalid "name"'))).toBe(true);
    });

    it('reports missing description', () => {
      const features = [makeFeature({ id: 'x', description: '' })];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('missing or invalid "description"'))).toBe(true);
    });
  });

  describe('dependency validation', () => {
    it('reports dangling dependency references', () => {
      const features = [makeFeature({ id: 'a', dependencies: ['nonexistent'] })];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('dependency "nonexistent" does not exist'))).toBe(true);
    });

    it('reports self-dependency', () => {
      const features = [makeFeature({ id: 'a', dependencies: ['a'] })];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('cannot depend on itself'))).toBe(true);
    });

    it('detects dependency cycles', () => {
      const features = [
        makeFeature({ id: 'a', dependencies: ['b'] }),
        makeFeature({ id: 'b', dependencies: ['a'] }),
      ];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('dependency cycle detected'))).toBe(true);
    });

    it('detects 3-node cycles', () => {
      const features = [
        makeFeature({ id: 'a', dependencies: ['b'] }),
        makeFeature({ id: 'b', dependencies: ['c'] }),
        makeFeature({ id: 'c', dependencies: ['a'] }),
      ];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('cycle detected'))).toBe(true);
    });
  });

  describe('preset validation', () => {
    it('reports unknown feature in preset', () => {
      const features = [makeFeature({ id: 'a' })];
      const presets = { test: { label: 'T', description: 'D', features: ['nonexistent'] } };
      const { errors } = validateFeatureSpec(features, presets);
      expect(errors.some((e) => e.includes('references unknown feature "nonexistent"'))).toBe(true);
    });

    it('warns about alwaysOn features in presets', () => {
      const features = [makeFeature({ id: 'core', alwaysOn: true })];
      const presets = { test: { label: 'T', description: 'D', features: ['core'] } };
      const { warnings } = validateFeatureSpec(features, presets);
      expect(warnings.some((w) => w.includes('always-on feature "core"'))).toBe(true);
    });

    it('warns about missing preset dependencies', () => {
      const features = [makeFeature({ id: 'a' }), makeFeature({ id: 'b', dependencies: ['a'] })];
      const presets = { test: { label: 'T', description: 'D', features: ['b'] } };
      const { warnings } = validateFeatureSpec(features, presets);
      expect(warnings.some((w) => w.includes('depends on "a"'))).toBe(true);
    });
  });

  describe('category and templateVar validation', () => {
    it('warns about non-standard categories', () => {
      const features = [makeFeature({ id: 'x', category: 'experimental' })];
      const { warnings } = validateFeatureSpec(features, {});
      expect(warnings.some((w) => w.includes('non-standard category'))).toBe(true);
    });

    it('reports invalid templateVar names', () => {
      const features = [makeFeature({ id: 'x', templateVars: ['123invalid'] })];
      const { errors } = validateFeatureSpec(features, {});
      expect(errors.some((e) => e.includes('invalid templateVar name'))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// validateOverlayFeatures()
// ---------------------------------------------------------------------------
describe('validateOverlayFeatures()', () => {
  const features = standardFeatures();
  const presets = standardPresets();

  it('warns when both enabledFeatures and featurePreset are set', () => {
    const { warnings } = validateOverlayFeatures(
      { enabledFeatures: ['quality-gates'], featurePreset: 'standard' },
      features,
      presets
    );
    expect(warnings.some((w) => w.includes('both "enabledFeatures" and "featurePreset"'))).toBe(
      true
    );
  });

  it('errors for unknown featurePreset', () => {
    const { errors } = validateOverlayFeatures({ featurePreset: 'bogus' }, features, presets);
    expect(errors.some((e) => e.includes('unknown featurePreset "bogus"'))).toBe(true);
  });

  it('warns for unknown feature in enabledFeatures', () => {
    const { warnings } = validateOverlayFeatures(
      { enabledFeatures: ['nonexistent'] },
      features,
      presets
    );
    expect(warnings.some((w) => w.includes('references unknown feature "nonexistent"'))).toBe(true);
  });

  it('warns when feature in both enabledFeatures and disabledFeatures', () => {
    const { warnings } = validateOverlayFeatures(
      { enabledFeatures: ['quality-gates'], disabledFeatures: ['quality-gates'] },
      features,
      presets
    );
    expect(warnings.some((w) => w.includes('appears in both'))).toBe(true);
  });

  it('errors when trying to disable a core feature', () => {
    const { errors } = validateOverlayFeatures(
      { disabledFeatures: ['spec-sync'] },
      features,
      presets
    );
    expect(errors.some((e) => e.includes('cannot disable core feature'))).toBe(true);
  });

  it('passes for valid overlay settings', () => {
    const { errors, warnings } = validateOverlayFeatures(
      { featurePreset: 'standard' },
      features,
      presets
    );
    expect(errors).toHaveLength(0);
    // May have warnings but no errors
  });
});

// ---------------------------------------------------------------------------
// loadFeatureSpec() — integration with real features.yaml
// ---------------------------------------------------------------------------
describe('loadFeatureSpec()', () => {
  it('loads the real features.yaml without errors', () => {
    const { features, presets, schemaVersion } = loadFeatureSpec(AGENTKIT_ROOT);
    expect(Array.isArray(features)).toBe(true);
    expect(features.length).toBeGreaterThan(0);
    expect(typeof presets).toBe('object');
    expect(schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
  });

  it('throws for nonexistent path', () => {
    expect(() => loadFeatureSpec('/nonexistent')).toThrow('features.yaml not found');
  });

  it('warns for future schema version', () => {
    const tmpRoot = mkdtempSync(resolve(tmpdir(), 'agentkit-feature-test-'));
    const specDir = resolve(tmpRoot, 'spec');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(
      resolve(specDir, 'features.yaml'),
      JSON.stringify({
        schemaVersion: 999,
        features: [
          { id: 'test', name: 'Test', category: 'core', description: 'x', templateVars: ['t'] },
        ],
      })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadFeatureSpec(tmpRoot);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('schemaVersion 999'));
    expect(result.schemaVersion).toBe(999);

    warnSpy.mockRestore();
    rmSync(tmpRoot, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// Integration: resolveFeatures + buildFeatureVars with real spec
// ---------------------------------------------------------------------------
describe('integration: real features.yaml', () => {
  const { features, presets } = loadFeatureSpec(AGENTKIT_ROOT);

  it('resolves standard preset correctly', () => {
    const enabled = resolveFeatures(features, { featurePreset: 'standard' }, presets);
    // Standard should include team-orchestration, quality-gates, etc.
    expect(enabled.has('team-orchestration')).toBe(true);
    expect(enabled.has('quality-gates')).toBe(true);
    // Should NOT include mcp-integration
    expect(enabled.has('mcp-integration')).toBe(false);
    // Core features always present
    expect(enabled.has('spec-sync')).toBe(true);
  });

  it('resolves minimal preset correctly', () => {
    const enabled = resolveFeatures(features, { featurePreset: 'minimal' }, presets);
    expect(enabled.has('quality-gates')).toBe(true);
    expect(enabled.has('team-orchestration')).toBe(false);
    expect(enabled.has('doc-scaffolding')).toBe(false);
  });

  it('resolves full preset with all features', () => {
    const enabled = resolveFeatures(features, { featurePreset: 'full' }, presets);
    // Full should include everything except core (which is auto-added)
    const nonCoreFeatures = features.filter((f) => !f.alwaysOn);
    for (const f of nonCoreFeatures) {
      expect(enabled.has(f.id)).toBe(true);
    }
  });

  it('buildFeatureVars produces correct vars for standard preset', () => {
    const enabled = resolveFeatures(features, { featurePreset: 'standard' }, presets);
    const vars = buildFeatureVars(features, enabled);
    expect(vars.hasTeamOrchestration).toBe(true);
    expect(vars.hasQualityGates).toBe(true);
    expect(vars.hasMcpIntegration).toBe(false);
    expect(vars.feature_team_orchestration).toBe(true);
    expect(vars.feature_mcp_integration).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateAffectsTemplates()
// ---------------------------------------------------------------------------
describe('validateAffectsTemplates()', () => {
  const TEMPLATES_DIR = resolve(AGENTKIT_ROOT, 'templates');

  it('passes for real features.yaml against real templates', () => {
    const { features } = loadFeatureSpec(AGENTKIT_ROOT);
    const { warnings } = validateAffectsTemplates(features, TEMPLATES_DIR);
    expect(warnings).toHaveLength(0);
  });

  it('warns for nonexistent file path', () => {
    const features = [makeFeature({ id: 'x', affectsTemplates: ['claude/nonexistent.md'] })];
    const { warnings } = validateAffectsTemplates(features, TEMPLATES_DIR);
    expect(warnings.some((w) => w.includes('does not exist'))).toBe(true);
  });

  it('warns for nonexistent directory path', () => {
    const features = [makeFeature({ id: 'x', affectsTemplates: ['nonexistent-dir/'] })];
    const { warnings } = validateAffectsTemplates(features, TEMPLATES_DIR);
    expect(warnings.some((w) => w.includes('does not exist'))).toBe(true);
  });

  it('passes for valid directory reference', () => {
    const features = [makeFeature({ id: 'x', affectsTemplates: ['claude/commands/'] })];
    const { warnings } = validateAffectsTemplates(features, TEMPLATES_DIR);
    expect(warnings).toHaveLength(0);
  });

  it('handles glob patterns by checking parent directory', () => {
    const features = [makeFeature({ id: 'x', affectsTemplates: ['cursor/rules/team-*.mdc'] })];
    const { warnings } = validateAffectsTemplates(features, TEMPLATES_DIR);
    // cursor/rules/ directory should exist
    expect(warnings).toHaveLength(0);
  });

  it('warns for glob pattern with nonexistent parent', () => {
    const features = [makeFeature({ id: 'x', affectsTemplates: ['nonexistent/rules/*.mdc'] })];
    const { warnings } = validateAffectsTemplates(features, TEMPLATES_DIR);
    expect(warnings.some((w) => w.includes('base directory does not exist'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CLI handler integration tests
// ---------------------------------------------------------------------------

import {
  runFeatures,
  runFeatureEnable,
  runFeatureDisable,
  runFeaturePreset,
} from '../feature-manager.mjs';
import yaml from 'js-yaml';

describe('CLI handlers', () => {
  let tmpDir;
  let agentkitRoot;
  let projectRoot;
  const origLog = console.log;

  function setupCliFixture(
    overlaySettings = {},
    specSync = { autoSyncAfterInit: false, autoSyncAfterFeatureChange: false }
  ) {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'fm-cli-'));
    agentkitRoot = resolve(tmpDir, '.agentkit');
    projectRoot = tmpDir;

    // Create features.yaml
    mkdirSync(resolve(agentkitRoot, 'spec'), { recursive: true });
    writeFileSync(
      resolve(agentkitRoot, 'spec', 'features.yaml'),
      yaml.dump({
        schemaVersion: 1,
        features: [
          {
            id: 'core-engine',
            name: 'Core Engine',
            category: 'core',
            description: 'Core',
            alwaysOn: true,
            default: true,
            dependencies: [],
            templateVars: [],
          },
          {
            id: 'test-feature',
            name: 'Test Feature',
            category: 'workflow',
            description: 'Testable',
            alwaysOn: false,
            default: true,
            dependencies: [],
            templateVars: ['hasTestFeature'],
          },
          {
            id: 'optional-feature',
            name: 'Optional Feature',
            category: 'quality',
            description: 'Optional',
            alwaysOn: false,
            default: false,
            dependencies: [],
            templateVars: ['hasOptionalFeature'],
          },
          {
            id: 'dep-feature',
            name: 'Dep Feature',
            category: 'quality',
            description: 'Has deps',
            alwaysOn: false,
            default: false,
            dependencies: ['test-feature'],
            templateVars: ['hasDepFeature'],
          },
        ],
        presets: {
          minimal: {
            label: 'Minimal',
            description: 'Just the basics',
            features: ['test-feature'],
          },
          full: {
            label: 'Full',
            description: 'Everything',
            features: ['test-feature', 'optional-feature', 'dep-feature'],
          },
        },
      }),
      'utf-8'
    );

    writeFileSync(
      resolve(agentkitRoot, 'spec', 'settings.yaml'),
      yaml.dump({ sync: specSync }),
      'utf-8'
    );

    // Create overlay settings
    const overlayName = 'test-repo';
    mkdirSync(resolve(agentkitRoot, 'overlays', overlayName), { recursive: true });
    writeFileSync(
      resolve(agentkitRoot, 'overlays', overlayName, 'settings.yaml'),
      yaml.dump({ repoName: overlayName, ...overlaySettings }),
      'utf-8'
    );

    // Create .agentkit-repo marker
    writeFileSync(resolve(projectRoot, '.agentkit-repo'), overlayName, 'utf-8');
  }

  afterEach(() => {
    console.log = origLog;
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  describe('runFeatures', () => {
    it('lists features without error', async () => {
      setupCliFixture();
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));

      await runFeatures({ agentkitRoot, projectRoot, flags: {} });

      const output = logs.join('\n');
      expect(output).toContain('core-engine');
      expect(output).toContain('test-feature');
      expect(output).toContain('optional-feature');
    });

    it('shows preset mode when featurePreset is set', async () => {
      setupCliFixture({ featurePreset: 'minimal' });
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));

      await runFeatures({ agentkitRoot, projectRoot, flags: {} });

      expect(logs.join('\n')).toContain('Feature preset: minimal');
    });
  });

  describe('runFeatureEnable', () => {
    it('enables a disabled feature', async () => {
      setupCliFixture();
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));

      // Mock the sync import to avoid running full sync
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn(),
      }));

      await runFeatureEnable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      // Verify settings were updated
      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'test-repo', 'settings.yaml'), 'utf-8')
      );
      expect(settings.enabledFeatures).toContain('optional-feature');
    });

    it('throws for unknown feature', async () => {
      setupCliFixture();
      await expect(
        runFeatureEnable({
          agentkitRoot,
          projectRoot,
          flags: { _args: ['nonexistent'] },
        })
      ).rejects.toThrow('Unknown feature');
    });

    it('throws without arguments', async () => {
      setupCliFixture();
      await expect(
        runFeatureEnable({ agentkitRoot, projectRoot, flags: { _args: [] } })
      ).rejects.toThrow('Usage');
    });

    it('runs sync when autoSyncAfterFeatureChange is true', async () => {
      setupCliFixture({ autoSyncAfterFeatureChange: true });
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureEnable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it('skips sync when autoSyncAfterFeatureChange is false', async () => {
      setupCliFixture({ autoSyncAfterFeatureChange: false });
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureEnable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).not.toHaveBeenCalled();
      expect(logs.join('\n')).toContain('Sync skipped');
    });

    it('runs sync from spec default when overlay omits autoSyncAfterFeatureChange', async () => {
      setupCliFixture({}, { autoSyncAfterFeatureChange: true });
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureEnable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it('overlay false overrides spec true for autoSyncAfterFeatureChange', async () => {
      setupCliFixture({ autoSyncAfterFeatureChange: false }, { autoSyncAfterFeatureChange: true });
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureEnable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).not.toHaveBeenCalled();
      expect(logs.join('\n')).toContain('Sync skipped');
    });
  });

  describe('runFeatureDisable', () => {
    it('disables a non-core feature', async () => {
      setupCliFixture({ enabledFeatures: ['test-feature', 'optional-feature'] });
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));

      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn(),
      }));

      await runFeatureDisable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'test-repo', 'settings.yaml'), 'utf-8')
      );
      expect(settings.disabledFeatures).toContain('optional-feature');
    });

    it('blocks disabling alwaysOn features', async () => {
      setupCliFixture();
      await expect(
        runFeatureDisable({
          agentkitRoot,
          projectRoot,
          flags: { _args: ['core-engine'] },
        })
      ).rejects.toThrow(/cannot disable core|always enabled/i);
    });

    it('runs sync when autoSyncAfterFeatureChange is true', async () => {
      setupCliFixture({
        enabledFeatures: ['test-feature', 'optional-feature'],
        autoSyncAfterFeatureChange: true,
      });
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureDisable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it('skips sync when autoSyncAfterFeatureChange is false', async () => {
      setupCliFixture({
        enabledFeatures: ['test-feature', 'optional-feature'],
        autoSyncAfterFeatureChange: false,
      });
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureDisable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).not.toHaveBeenCalled();
      expect(logs.join('\n')).toContain('Sync skipped');
    });

    it('runs sync from spec default when overlay omits autoSyncAfterFeatureChange', async () => {
      setupCliFixture(
        { enabledFeatures: ['test-feature', 'optional-feature'] },
        { autoSyncAfterFeatureChange: true }
      );
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureDisable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it('overlay false overrides spec true for autoSyncAfterFeatureChange', async () => {
      setupCliFixture(
        {
          enabledFeatures: ['test-feature', 'optional-feature'],
          autoSyncAfterFeatureChange: false,
        },
        { autoSyncAfterFeatureChange: true }
      );
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeatureDisable({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['optional-feature'] },
      });

      expect(syncMock).not.toHaveBeenCalled();
      expect(logs.join('\n')).toContain('Sync skipped');
    });
  });

  describe('runFeaturePreset', () => {
    it('applies a valid preset', async () => {
      setupCliFixture();
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));

      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn(),
      }));

      await runFeaturePreset({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['minimal'] },
      });

      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'test-repo', 'settings.yaml'), 'utf-8')
      );
      expect(settings.featurePreset).toBe('minimal');
    });

    it('throws for unknown preset', async () => {
      setupCliFixture();
      await expect(
        runFeaturePreset({
          agentkitRoot,
          projectRoot,
          flags: { _args: ['nonexistent'] },
        })
      ).rejects.toThrow(/unknown preset|not found/i);
    });

    it('runs sync when autoSyncAfterFeatureChange is true', async () => {
      setupCliFixture({ autoSyncAfterFeatureChange: true });
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeaturePreset({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['minimal'] },
      });

      expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it('skips sync when autoSyncAfterFeatureChange is false', async () => {
      setupCliFixture({ autoSyncAfterFeatureChange: false });
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeaturePreset({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['minimal'] },
      });

      expect(syncMock).not.toHaveBeenCalled();
      expect(logs.join('\n')).toContain('Sync skipped');
    });

    it('runs sync from spec default when overlay omits autoSyncAfterFeatureChange', async () => {
      setupCliFixture({}, { autoSyncAfterFeatureChange: true });
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeaturePreset({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['minimal'] },
      });

      expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it('overlay false overrides spec true for autoSyncAfterFeatureChange', async () => {
      setupCliFixture({ autoSyncAfterFeatureChange: false }, { autoSyncAfterFeatureChange: true });
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));
      const syncMock = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../synchronize.mjs', () => ({
        runSync: syncMock,
      }));

      await runFeaturePreset({
        agentkitRoot,
        projectRoot,
        flags: { _args: ['minimal'] },
      });

      expect(syncMock).not.toHaveBeenCalled();
      expect(logs.join('\n')).toContain('Sync skipped');
    });
  });
});

// ---------------------------------------------------------------------------
// resolveFeatures: dependency resurrection warning
// ---------------------------------------------------------------------------

describe('resolveFeatures() dependency resurrection', () => {
  it('warns when a disabled feature is resurrected by dependency', () => {
    const features = [
      makeFeature({ id: 'a', dependencies: ['b'], default: false }),
      makeFeature({ id: 'b', default: false }),
    ];
    const overlay = { enabledFeatures: ['a'], disabledFeatures: ['b'] };
    const logs = [];
    const result = resolveFeatures(features, overlay, {}, { log: (msg) => logs.push(msg) });

    expect(result.has('b')).toBe(true);
    expect(logs.some((m) => m.includes('re-enabled'))).toBe(true);
  });

  it('does not warn when disabled feature has no dependents', () => {
    const features = [
      makeFeature({ id: 'a', default: false }),
      makeFeature({ id: 'b', default: false }),
    ];
    const overlay = { enabledFeatures: ['a', 'b'], disabledFeatures: ['b'] };
    const logs = [];
    resolveFeatures(features, overlay, {}, { log: (msg) => logs.push(msg) });

    expect(logs).toHaveLength(0);
  });
});
