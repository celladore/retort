/**
 * Coverage-targeted tests for init.mjs.
 * Focus: previously-internal helpers — sanitizeRepoName, parseCsvList,
 * applyExternalKnowledgeFlags (every flag branch), applyPresetDefaults
 * (infra defaults including idempotent paths), buildProjectDefaults
 * (documentation/designSystem/testing/crosscutting branches),
 * applyDetectedKitDefaults / applyKitSelections (kit branches),
 * detectCloudProvider / detectIacTool / detectExistingTools, and
 * writeProjectYaml.
 *
 * See issue #520 phase 2 for the broader branch-coverage ratchet.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock for @clack/prompts. vi.doMock is unreliable for bare-module
// dynamic imports in vitest 4 thread workers on Linux — the mock factory
// can race the dynamic import inside init.mjs, falling through to the
// try/catch fallback and silently writing __TEMPLATE__ defaults instead of
// wizard-supplied values. The hoisted vi.mock + mutable factory state is
// the canonical workaround. Caches the materialized mock per import so
// each call to clack.method() shares state (response index, spies); reset
// in beforeEach so each test sees a fresh materialization.
const clackMockState = vi.hoisted(() => ({ factory: null, cached: null }));

vi.mock('@clack/prompts', () => {
  if (!clackMockState.factory) {
    throw new Error('test did not configure @clack/prompts mock');
  }
  if (!clackMockState.cached) {
    clackMockState.cached = clackMockState.factory();
  }
  return clackMockState.cached;
});

const {
  applyDetectedKitDefaults,
  applyExternalKnowledgeFlags,
  applyKitSelections,
  applyPresetDefaults,
  buildProjectDefaults,
  detectCloudProvider,
  detectExistingTools,
  detectIacTool,
  parseCsvList,
  sanitizeRepoName,
  writeProjectYaml,
} = await import('../init.mjs');

function makeTmpDir(prefix = 'agentkit-init-cov-') {
  return mkdtempSync(resolve(tmpdir(), prefix));
}

function cleanupTmpDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function makeMinimalReport(overrides = {}) {
  return {
    techStacks: [],
    frameworks: { frontend: [], backend: [], css: [], orm: [] },
    testing: [],
    monorepo: { detected: false, tools: [] },
    infrastructure: [],
    documentation: [],
    designSystem: [],
    crosscutting: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sanitizeRepoName
// ---------------------------------------------------------------------------
describe('sanitizeRepoName', () => {
  it('returns null for empty string', () => {
    expect(sanitizeRepoName('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(sanitizeRepoName(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(sanitizeRepoName(undefined)).toBeNull();
  });

  it('returns null for non-string types', () => {
    expect(sanitizeRepoName(42)).toBeNull();
    expect(sanitizeRepoName({})).toBeNull();
    expect(sanitizeRepoName([])).toBeNull();
    expect(sanitizeRepoName(true)).toBeNull();
  });

  it('returns null for "."', () => {
    expect(sanitizeRepoName('.')).toBeNull();
  });

  it('returns null for ".."', () => {
    expect(sanitizeRepoName('..')).toBeNull();
  });

  it('returns null for whitespace-only after trim', () => {
    expect(sanitizeRepoName('   ')).toBeNull();
  });

  it('returns null for forward-slash path traversal', () => {
    expect(sanitizeRepoName('foo/bar')).toBeNull();
  });

  it('returns null for backslash path traversal', () => {
    expect(sanitizeRepoName('foo\\bar')).toBeNull();
  });

  it('returns null for invalid characters per REPO_NAME_PATTERN', () => {
    expect(sanitizeRepoName('foo bar')).toBeNull();
    expect(sanitizeRepoName('foo$bar')).toBeNull();
  });

  it('trims and returns valid kebab-case names', () => {
    expect(sanitizeRepoName('  retort  ')).toBe('retort');
  });

  it('accepts dot-separated names', () => {
    expect(sanitizeRepoName('my.project')).toBe('my.project');
  });

  it('accepts underscore and hyphen', () => {
    expect(sanitizeRepoName('my_project-1')).toBe('my_project-1');
  });
});

// ---------------------------------------------------------------------------
// parseCsvList
// ---------------------------------------------------------------------------
describe('parseCsvList', () => {
  it('returns [] for non-string input', () => {
    expect(parseCsvList(undefined)).toEqual([]);
    expect(parseCsvList(null)).toEqual([]);
    expect(parseCsvList(42)).toEqual([]);
    expect(parseCsvList([])).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseCsvList('')).toEqual([]);
  });

  it('returns [] for whitespace-only string', () => {
    expect(parseCsvList('  ,  , ')).toEqual([]);
  });

  it('splits on comma and trims whitespace', () => {
    expect(parseCsvList(' a , b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('filters out empty entries', () => {
    expect(parseCsvList('a,,b, ,c')).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// applyExternalKnowledgeFlags
// ---------------------------------------------------------------------------
describe('applyExternalKnowledgeFlags', () => {
  it('initializes externalKnowledge structure when missing', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, {});

    expect(project.externalKnowledge).toEqual({
      enabled: false,
      mode: 'metadata-overlays',
      sources: {
        windsurfDomainGuidesPath: null,
        mystiraDocsPath: null,
        markdownFiles: [],
        gitRepoUrls: [],
      },
      targetPlatforms: ['copilot', 'windsurf'],
    });
  });

  it('preserves an existing externalKnowledge object but defaults sources', () => {
    const project = {
      externalKnowledge: {
        enabled: true,
        mode: 'hybrid',
        targetPlatforms: ['claude'],
      },
    };

    applyExternalKnowledgeFlags(project, {});

    expect(project.externalKnowledge.enabled).toBe(true);
    expect(project.externalKnowledge.sources).toEqual({
      windsurfDomainGuidesPath: null,
      mystiraDocsPath: null,
      markdownFiles: [],
      gitRepoUrls: [],
    });
  });

  it('enables external knowledge when --external-knowledge=true', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'external-knowledge': true });

    expect(project.externalKnowledge.enabled).toBe(true);
  });

  it('ignores --external-knowledge when not strictly true', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'external-knowledge': 'yes' });

    expect(project.externalKnowledge.enabled).toBe(false);
  });

  it('sets mode and enables when --external-mode is a known value', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'external-mode': 'direct-copy' });

    expect(project.externalKnowledge.mode).toBe('direct-copy');
    expect(project.externalKnowledge.enabled).toBe(true);
  });

  it('ignores unknown --external-mode value', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'external-mode': 'bogus' });

    expect(project.externalKnowledge.mode).toBe('metadata-overlays');
    expect(project.externalKnowledge.enabled).toBe(false);
  });

  it('ignores non-string --external-mode', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'external-mode': 42 });

    expect(project.externalKnowledge.mode).toBe('metadata-overlays');
    expect(project.externalKnowledge.enabled).toBe(false);
  });

  it('clears windsurf path when value is empty string', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'windsurf-guides-path': '   ' });

    expect(project.externalKnowledge.sources.windsurfDomainGuidesPath).toBeNull();
    expect(project.externalKnowledge.enabled).toBe(false);
  });

  it('sets windsurf path and enables when value is non-empty', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'windsurf-guides-path': '/x/y' });

    expect(project.externalKnowledge.sources.windsurfDomainGuidesPath).toBe('/x/y');
    expect(project.externalKnowledge.enabled).toBe(true);
  });

  it('clears mystira path when empty', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'mystira-docs-path': '' });

    expect(project.externalKnowledge.sources.mystiraDocsPath).toBeNull();
    expect(project.externalKnowledge.enabled).toBe(false);
  });

  it('sets mystira path when present', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'mystira-docs-path': '/m/d' });

    expect(project.externalKnowledge.sources.mystiraDocsPath).toBe('/m/d');
    expect(project.externalKnowledge.enabled).toBe(true);
  });

  it('parses --external-markdown-files into a list', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, {
      'external-markdown-files': 'docs/a.md, docs/b.md',
    });

    expect(project.externalKnowledge.sources.markdownFiles).toEqual(['docs/a.md', 'docs/b.md']);
    expect(project.externalKnowledge.enabled).toBe(true);
  });

  it('does not enable when --external-markdown-files parses to empty', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'external-markdown-files': ',,, ' });

    expect(project.externalKnowledge.sources.markdownFiles).toEqual([]);
    expect(project.externalKnowledge.enabled).toBe(false);
  });

  it('parses --external-git-repos into a list', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, {
      'external-git-repos': 'https://example.com/a, https://example.com/b',
    });

    expect(project.externalKnowledge.sources.gitRepoUrls).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(project.externalKnowledge.enabled).toBe(true);
  });

  it('replaces target platforms when valid values are passed', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, {
      'external-target-platforms': 'claude, cursor, bogus',
    });

    expect(project.externalKnowledge.targetPlatforms).toEqual(['claude', 'cursor']);
    expect(project.externalKnowledge.enabled).toBe(true);
  });

  it('keeps default target platforms when all values are invalid', () => {
    const project = {};

    applyExternalKnowledgeFlags(project, { 'external-target-platforms': 'bogus, nope' });

    expect(project.externalKnowledge.targetPlatforms).toEqual(['copilot', 'windsurf']);
    expect(project.externalKnowledge.enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyPresetDefaults
// ---------------------------------------------------------------------------
describe('applyPresetDefaults', () => {
  it('throws TypeError when project is null', () => {
    expect(() => applyPresetDefaults(null, 'infra')).toThrow(TypeError);
  });

  it('throws TypeError when project is undefined', () => {
    expect(() => applyPresetDefaults(undefined, 'infra')).toThrow(TypeError);
  });

  it('returns project unchanged for non-infra preset', () => {
    const project = { existing: true };

    const out = applyPresetDefaults(project, 'minimal');

    expect(out).toBe(project);
    expect(out).toEqual({ existing: true });
  });

  it('returns project unchanged when preset is null', () => {
    const project = { foo: 1 };

    expect(applyPresetDefaults(project, null)).toBe(project);
  });

  it('applies azure + terraform infra defaults when preset is "infra"', () => {
    const project = {};

    const out = applyPresetDefaults(project, 'infra');

    expect(out.deployment.cloudProvider).toBe('azure');
    expect(out.deployment.iacTool).toBe('terraform');
    expect(out.infrastructure.namingConvention).toBe(
      '{org}-{env}-{project}-{resourcetype}-{region}'
    );
    expect(out.infrastructure.iacToolchain).toEqual(['terraform', 'terragrunt']);
    expect(out.infrastructure.stateBackend).toBe('azurerm');
  });

  it('does not overwrite existing infra values', () => {
    const project = {
      deployment: { cloudProvider: 'aws', iacTool: 'pulumi' },
      infrastructure: {
        namingConvention: 'custom',
        iacToolchain: ['cdk'],
        stateBackend: 's3',
      },
    };

    const out = applyPresetDefaults(project, 'infra');

    expect(out.deployment.cloudProvider).toBe('aws');
    expect(out.deployment.iacTool).toBe('pulumi');
    expect(out.infrastructure.namingConvention).toBe('custom');
    expect(out.infrastructure.iacToolchain).toEqual(['cdk']);
    expect(out.infrastructure.stateBackend).toBe('s3');
  });

  it('replaces empty iacToolchain array with default', () => {
    const project = { infrastructure: { iacToolchain: [] } };

    const out = applyPresetDefaults(project, 'infra');

    expect(out.infrastructure.iacToolchain).toEqual(['terraform', 'terragrunt']);
  });

  it('replaces non-array iacToolchain with default', () => {
    const project = { infrastructure: { iacToolchain: 'oops' } };

    const out = applyPresetDefaults(project, 'infra');

    expect(out.infrastructure.iacToolchain).toEqual(['terraform', 'terragrunt']);
  });
});

// ---------------------------------------------------------------------------
// detectCloudProvider / detectIacTool
// ---------------------------------------------------------------------------
describe('detectCloudProvider', () => {
  it('returns "azure" when bicep is detected', () => {
    expect(detectCloudProvider({ infrastructure: ['bicep'] })).toBe('azure');
  });

  it('returns null when only terraform is detected', () => {
    expect(detectCloudProvider({ infrastructure: ['terraform'] })).toBeNull();
  });

  it('returns null when nothing infra-related is detected', () => {
    expect(detectCloudProvider({ infrastructure: [] })).toBeNull();
  });
});

describe('detectIacTool', () => {
  it('returns "bicep" first when bicep present', () => {
    expect(detectIacTool({ infrastructure: ['bicep', 'terraform'] })).toBe('bicep');
  });

  it('returns "terraform" when only terraform present', () => {
    expect(detectIacTool({ infrastructure: ['terraform'] })).toBe('terraform');
  });

  it('returns "pulumi" when only pulumi present', () => {
    expect(detectIacTool({ infrastructure: ['pulumi'] })).toBe('pulumi');
  });

  it('returns null when no IaC tool is detected', () => {
    expect(detectIacTool({ infrastructure: ['docker'] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectExistingTools
// ---------------------------------------------------------------------------
describe('detectExistingTools', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir('agentkit-init-detect-');
  });

  afterEach(() => {
    cleanupTmpDir(tmpRoot);
  });

  it('returns [] when no tool markers are present', () => {
    expect(detectExistingTools(tmpRoot)).toEqual([]);
  });

  it('detects claude when CLAUDE.md exists', () => {
    writeFileSync(resolve(tmpRoot, 'CLAUDE.md'), '# claude', 'utf-8');

    expect(detectExistingTools(tmpRoot)).toEqual(['claude']);
  });

  it('detects cursor when .cursor directory exists', () => {
    mkdirSync(resolve(tmpRoot, '.cursor'));

    expect(detectExistingTools(tmpRoot)).toEqual(['cursor']);
  });

  it('detects multiple tools simultaneously', () => {
    mkdirSync(resolve(tmpRoot, '.windsurf'));
    mkdirSync(resolve(tmpRoot, '.roo'));
    writeFileSync(resolve(tmpRoot, 'WARP.md'), '# warp', 'utf-8');

    expect(detectExistingTools(tmpRoot).sort()).toEqual(['roo', 'warp', 'windsurf']);
  });

  it('detects copilot via the nested .github/copilot-instructions.md path', () => {
    mkdirSync(resolve(tmpRoot, '.github'));
    writeFileSync(resolve(tmpRoot, '.github', 'copilot-instructions.md'), '# copilot', 'utf-8');

    expect(detectExistingTools(tmpRoot)).toContain('copilot');
  });
});

// ---------------------------------------------------------------------------
// applyDetectedKitDefaults / applyKitSelections
// ---------------------------------------------------------------------------
describe('applyDetectedKitDefaults', () => {
  it('sets languageProfile.mode to hybrid when missing', () => {
    const project = {};

    applyDetectedKitDefaults(project, makeMinimalReport());

    expect(project.automation.languageProfile.mode).toBe('hybrid');
  });

  it('preserves an existing languageProfile.mode', () => {
    const project = { automation: { languageProfile: { mode: 'configured' } } };

    applyDetectedKitDefaults(project, makeMinimalReport());

    expect(project.automation.languageProfile.mode).toBe('configured');
  });
});

describe('applyKitSelections', () => {
  it('forces languageProfile.mode to "configured"', () => {
    const project = {};

    applyKitSelections(project, makeMinimalReport(), []);

    expect(project.automation.languageProfile.mode).toBe('configured');
  });

  it('persists ai-cost-ops feature flag when selected', () => {
    const project = {};

    applyKitSelections(project, makeMinimalReport(), ['ai-cost-ops']);

    expect(project.features.aiCostOps).toBe(true);
  });

  it('persists finops feature flag when selected', () => {
    const project = {};

    applyKitSelections(project, makeMinimalReport(), ['finops']);

    expect(project.features.finops).toBe(true);
  });

  it('defaults iac tool to terraform when explicitly selected and none detected', () => {
    const project = {};

    applyKitSelections(project, makeMinimalReport({ infrastructure: [] }), ['iac']);

    expect(project.deployment.iacTool).toBe('terraform');
  });

  it('does not overwrite existing iacTool when iac is selected', () => {
    const project = { deployment: { iacTool: 'pulumi' } };

    applyKitSelections(project, makeMinimalReport(), ['iac']);

    expect(project.deployment.iacTool).toBe('pulumi');
  });

  it('does not set iac tool when IaC is already auto-detected', () => {
    const project = {};

    applyKitSelections(project, makeMinimalReport({ infrastructure: ['terraform'] }), ['iac']);

    expect(project.deployment?.iacTool).toBeUndefined();
  });

  it('handles multiple optional kits at once', () => {
    const project = {};

    applyKitSelections(project, makeMinimalReport(), ['ai-cost-ops', 'finops', 'iac']);

    expect(project.features.aiCostOps).toBe(true);
    expect(project.features.finops).toBe(true);
    expect(project.deployment.iacTool).toBe('terraform');
  });
});

// ---------------------------------------------------------------------------
// buildProjectDefaults
// ---------------------------------------------------------------------------
describe('buildProjectDefaults', () => {
  it('returns a default project shape for an empty report', () => {
    const project = buildProjectDefaults(makeMinimalReport(), 'my-repo');

    expect(project.name).toBe('my-repo');
    expect(project.phase).toBe('active');
    expect(project.architecture.monorepo).toBe(false);
    expect(project.architecture.monorepoTool).toBeNull();
    expect(project.deployment.containerized).toBe(false);
    expect(project.testing.unit).toEqual([]);
    expect(project.testing.e2e).toEqual([]);
  });

  it('populates languages and frameworks from the discovery report', () => {
    const report = makeMinimalReport({
      techStacks: [{ name: 'typescript', label: 'TS', fileCount: 5 }],
      frameworks: { frontend: ['react'], backend: ['express'], css: ['tailwind'], orm: ['prisma'] },
    });

    const project = buildProjectDefaults(report, 'r');

    expect(project.stack.languages).toEqual(['typescript']);
    expect(project.stack.frameworks.frontend).toEqual(['react']);
    expect(project.stack.frameworks.backend).toEqual(['express']);
    expect(project.stack.frameworks.css).toEqual(['tailwind']);
    expect(project.stack.orm).toBe('prisma');
  });

  it('marks containerized true when docker is detected', () => {
    const project = buildProjectDefaults(makeMinimalReport({ infrastructure: ['docker'] }), 'r');

    expect(project.deployment.containerized).toBe(true);
  });

  it('reflects monorepo detection from the report', () => {
    const project = buildProjectDefaults(
      makeMinimalReport({ monorepo: { detected: true, tools: ['pnpm', 'turbo'] } }),
      'r'
    );

    expect(project.architecture.monorepo).toBe(true);
    expect(project.architecture.monorepoTool).toBe('pnpm');
  });

  it('populates documentation fields from each known doc name', () => {
    const project = buildProjectDefaults(
      makeMinimalReport({
        documentation: [
          { name: 'prd', label: 'PRD', path: 'docs/prd' },
          { name: 'adr', label: 'ADR', path: 'docs/adr' },
          { name: 'apiSpec', label: 'API', path: 'docs/api' },
          { name: 'technicalSpec', label: 'Tech', path: 'docs/tech' },
          { name: 'unknown', label: 'X', path: 'x' },
        ],
      }),
      'r'
    );

    expect(project.documentation.hasPrd).toBe(true);
    expect(project.documentation.prdPath).toBe('docs/prd');
    expect(project.documentation.hasAdr).toBe(true);
    expect(project.documentation.adrPath).toBe('docs/adr');
    expect(project.documentation.hasApiSpec).toBe(true);
    expect(project.documentation.apiSpecPath).toBe('docs/api');
    expect(project.documentation.hasTechnicalSpec).toBe(true);
    expect(project.documentation.technicalSpecPath).toBe('docs/tech');
  });

  it('populates designSystem flags for storybook / component-library / design-tokens / brand-guide / editor-theme', () => {
    const project = buildProjectDefaults(
      makeMinimalReport({
        designSystem: [
          'storybook',
          'component-library',
          'design-tokens',
          'brand-guide',
          'editor-theme',
        ],
      }),
      'r'
    );

    expect(project.documentation.storybook).toBe(true);
    expect(project.documentation.hasDesignSystem).toBe(true);
    expect(project.documentation.designSystemPath).toBe('packages/ui/');
    expect(project.documentation.designTokensPath).toBe('styles/tokens/');
    expect(project.documentation.hasBrandGuide).toBe(true);
    expect(project.documentation.brandGuidePath).toBe('.agentkit/spec/brand.yaml');
    expect(project.editorTheme.enabled).toBe(true);
    expect(project.editorTheme.source).toBe('brand');
  });

  it('classifies unit-test tools and e2e tools separately', () => {
    const project = buildProjectDefaults(
      makeMinimalReport({ testing: ['vitest', 'pytest', 'playwright', 'cypress'] }),
      'r'
    );

    expect(project.testing.unit).toEqual(['vitest', 'pytest']);
    expect(project.testing.e2e).toEqual(['playwright', 'cypress']);
    expect(project.testing.integration).toEqual(['playwright', 'cypress']);
  });

  it('ignores unknown testing tools', () => {
    const project = buildProjectDefaults(makeMinimalReport({ testing: ['unknownTool'] }), 'r');

    expect(project.testing.unit).toEqual([]);
    expect(project.testing.e2e).toEqual([]);
  });

  it('tolerates an empty frameworks object (covers || [] fallbacks)', () => {
    const project = buildProjectDefaults(
      {
        techStacks: [],
        frameworks: {},
        testing: undefined,
        monorepo: { detected: false, tools: [] },
        infrastructure: [],
        documentation: undefined,
        designSystem: undefined,
        crosscutting: {},
      },
      'r'
    );

    expect(project.stack.frameworks.frontend).toEqual([]);
    expect(project.stack.frameworks.backend).toEqual([]);
    expect(project.stack.frameworks.css).toEqual([]);
    expect(project.stack.orm).toBeNull();
  });

  it('populates each crosscutting category when reported', () => {
    const project = buildProjectDefaults(
      makeMinimalReport({
        crosscutting: {
          logging: ['pino'],
          authentication: ['jwt'],
          caching: ['redis'],
          errorHandling: ['global-handler'],
          featureFlags: ['launchdarkly'],
          envConfig: 'dotenv',
        },
      }),
      'r'
    );

    expect(project.crosscutting.logging.framework).toBe('pino');
    expect(project.crosscutting.logging.structured).toBe(true);
    expect(project.crosscutting.authentication.provider).toBe('jwt');
    expect(project.crosscutting.caching.provider).toBe('redis');
    expect(project.crosscutting.caching.distributedCache).toBe(true);
    expect(project.crosscutting.errorHandling.strategy).toBe('global-handler');
    expect(project.crosscutting.errorHandling.globalHandler).toBe(true);
    expect(project.crosscutting.featureFlags.provider).toBe('launchdarkly');
    expect(project.crosscutting.environments.configStrategy).toBe('dotenv');
  });

  it('marks distributedCache false for non-redis cache providers', () => {
    const project = buildProjectDefaults(
      makeMinimalReport({ crosscutting: { caching: ['memcached'] } }),
      'r'
    );

    expect(project.crosscutting.caching.provider).toBe('memcached');
    expect(project.crosscutting.caching.distributedCache).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// writeProjectYaml
// ---------------------------------------------------------------------------
describe('writeProjectYaml', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir('agentkit-init-yaml-');
  });

  afterEach(() => {
    cleanupTmpDir(tmpRoot);
  });

  it('writes a YAML file with the canonical generated header', () => {
    const filePath = resolve(tmpRoot, 'project.yaml');
    const project = { name: 'r', phase: 'active' };

    writeProjectYaml(filePath, project);

    const content = readFileSync(filePath, 'utf-8');
    expect(content.startsWith('# ===')).toBe(true);
    expect(content).toContain('project.yaml');
    expect(content).toContain('name: r');
    expect(content).toContain('phase: active');
  });
});

// ---------------------------------------------------------------------------
// runInit dry-run path
// ---------------------------------------------------------------------------
describe('runInit dry-run', () => {
  let tmpRoot;
  let projectRoot;
  let agentkitRoot;
  let logSpy;

  beforeEach(async () => {
    vi.resetModules();
    tmpRoot = makeTmpDir('agentkit-init-dry-');
    projectRoot = resolve(tmpRoot, 'project');
    agentkitRoot = resolve(tmpRoot, 'agentkit');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(resolve(agentkitRoot, 'spec'), { recursive: true });
    mkdirSync(resolve(agentkitRoot, 'overlays', '__TEMPLATE__'), { recursive: true });
    writeFileSync(
      resolve(agentkitRoot, 'overlays', '__TEMPLATE__', 'settings.yaml'),
      'repoName: __TEMPLATE__\n',
      'utf-8'
    );
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.doMock('../discover.mjs', () => ({
      runDiscover: vi.fn().mockResolvedValue(makeMinimalReport()),
    }));
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    vi.doUnmock('../discover.mjs');
    vi.doUnmock('../synchronize.mjs');
    vi.restoreAllMocks();
    cleanupTmpDir(tmpRoot);
  });

  it('does not write the .agentkit-repo marker in dry-run mode', async () => {
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo', 'non-interactive': true, 'dry-run': true },
    });

    expect(existsSync(resolve(projectRoot, '.agentkit-repo'))).toBe(false);
    expect(existsSync(resolve(agentkitRoot, 'overlays', 'demo'))).toBe(false);
    // The dry-run path prints a "DRY-RUN" banner.
    const printed = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).toContain('DRY-RUN');
  });
});

// ---------------------------------------------------------------------------
// runInit interactive wizard (via mocked @clack/prompts)
// ---------------------------------------------------------------------------
describe('runInit interactive wizard', () => {
  let tmpRoot;
  let projectRoot;
  let agentkitRoot;

  beforeEach(() => {
    vi.resetModules();
    tmpRoot = makeTmpDir('agentkit-init-int-');
    projectRoot = resolve(tmpRoot, 'project');
    agentkitRoot = resolve(tmpRoot, 'agentkit');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(resolve(agentkitRoot, 'spec'), { recursive: true });
    mkdirSync(resolve(agentkitRoot, 'overlays', '__TEMPLATE__'), { recursive: true });
    writeFileSync(
      resolve(agentkitRoot, 'overlays', '__TEMPLATE__', 'settings.yaml'),
      'repoName: __TEMPLATE__\nrenderTargets: []\n',
      'utf-8'
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.doMock('../discover.mjs', () => ({
      runDiscover: vi.fn().mockResolvedValue(
        makeMinimalReport({
          techStacks: [{ name: 'typescript', label: 'TS', fileCount: 1 }],
          frameworks: { frontend: ['react'], backend: [], css: [], orm: [] },
          documentation: [{ name: 'prd', label: 'PRD', path: 'docs/prd' }],
          designSystem: ['storybook'],
          infrastructure: ['terraform'],
          crosscutting: { logging: ['pino'] },
        })
      ),
    }));
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    vi.doUnmock('../discover.mjs');
    vi.doUnmock('../synchronize.mjs');
    clackMockState.factory = null;
    clackMockState.cached = null;
    vi.restoreAllMocks();
    cleanupTmpDir(tmpRoot);
  });

  it('runs the wizard end-to-end when all prompts return non-cancel values', async () => {
    // Arrange — mock @clack/prompts to return scripted values per prompt order.
    const responses = [
      ['iac', 'finops'], // optional kits multiselect
      // identity group is invoked once with three sub-prompts handled inline
      'My Project',
      'A description',
      'active',
      // arch+process group (5 sub-prompts)
      'monolith',
      'rest',
      'github-flow',
      'conventional',
      'small',
      true, // accept detected docs
      false, // configure external knowledge → no
      // deployment group (3 sub-prompts)
      'azure',
      true,
      'terraform',
      true, // accept cross-cutting
      // feature mode select is skipped because loadFeatureSpec throws (no features.yaml)
      ['claude'], // selected AI tools (multiselect)
      false, // generate .retortconfig confirm → no
    ];
    let idx = 0;
    const next = async () => responses[idx++];

    clackMockState.factory = () => {
      const isCancel = () => false;
      const groupImpl = async (cfg) => {
        const out = {};
        for (const k of Object.keys(cfg)) {
          out[k] = await cfg[k]();
        }
        return out;
      };
      return {
        intro: vi.fn(),
        outro: vi.fn(),
        cancel: vi.fn(),
        note: vi.fn(),
        isCancel,
        text: vi.fn(async () => next()),
        select: vi.fn(async () => next()),
        confirm: vi.fn(async () => next()),
        multiselect: vi.fn(async () => next()),
        group: vi.fn(groupImpl),
      };
    };

    const { runInit } = await import('../init.mjs');

    // Act
    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo', force: false },
    });

    // Assert
    const settings = readFileSync(
      resolve(agentkitRoot, 'overlays', 'demo', 'settings.yaml'),
      'utf-8'
    );
    expect(settings).toContain('repoName: demo');
    expect(settings).toContain('renderTargets:');
    expect(settings).toContain('claude');

    const spec = readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8');
    expect(spec).toContain('name: My Project');
    expect(spec).toContain('pattern: monolith');
    expect(spec).toContain('cloudProvider: azure');
  });

  it('runs the wizard with external-knowledge enabled via flags and a features.yaml present', async () => {
    // Pre-seed features.yaml so the kit-feature select path is exercised.
    writeFileSync(
      resolve(agentkitRoot, 'spec', 'features.yaml'),
      [
        'schemaVersion: 1',
        'features:',
        '  - { id: core, name: Core, category: core, alwaysOn: true }',
        '  - { id: extra, name: Extra, category: optional, default: true }',
        'presets:',
        '  minimal: { label: Minimal, features: [core] }',
        '  standard: { label: Standard, features: [core, extra] }',
      ].join('\n'),
      'utf-8'
    );

    const responses = [
      [], // optional kits multiselect (no extras)
      'My Project',
      'A description',
      'active',
      'monolith',
      'rest',
      'github-flow',
      'conventional',
      'small',
      true, // accept docs
      // external knowledge interactive is skipped (enabled via flags) — no responses consumed
      'azure',
      true,
      'terraform',
      true, // accept cross-cutting
      '__custom__', // feature mode → custom
      ['extra'], // selected feature ids
      ['claude'], // AI tools
      true, // .retortconfig confirm
    ];
    let idx = 0;
    const next = async () => responses[idx++];
    clackMockState.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      isCancel: () => false,
      text: vi.fn(async () => next()),
      select: vi.fn(async () => next()),
      confirm: vi.fn(async () => next()),
      multiselect: vi.fn(async () => next()),
      group: vi.fn(async (cfg) => {
        const out = {};
        for (const k of Object.keys(cfg)) out[k] = await cfg[k]();
        return out;
      }),
    });
    vi.doMock('../retort-config-wizard.mjs', () => ({
      runRetortConfigWizard: vi.fn().mockResolvedValue(undefined),
    }));

    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: {
        repoName: 'demo',
        'external-knowledge': true,
        'external-mode': 'hybrid',
        'windsurf-guides-path': '/x/y',
        'mystira-docs-path': '/m/d',
        'external-markdown-files': 'a.md',
        'external-git-repos': 'https://example.com/r',
        'external-target-platforms': 'claude',
      },
    });

    const settings = readFileSync(
      resolve(agentkitRoot, 'overlays', 'demo', 'settings.yaml'),
      'utf-8'
    );
    expect(settings).toContain('enabledFeatures:');
  });

  it('uses flags.ci as alias for non-interactive', async () => {
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'r', ci: true },
    });

    expect(existsSync(resolve(agentkitRoot, 'overlays', 'r'))).toBe(true);
  });

  it('falls back to basename(projectRoot) when flags.repoName is undefined', async () => {
    const { runInit } = await import('../init.mjs');
    const namedRoot = resolve(tmpRoot, 'project-with-name');
    mkdirSync(namedRoot, { recursive: true });

    await runInit({
      agentkitRoot,
      projectRoot: namedRoot,
      flags: { 'non-interactive': true },
    });

    expect(existsSync(resolve(agentkitRoot, 'overlays', 'project-with-name'))).toBe(true);
  });

  it('takes the preset fast-path when interactive mode is allowed but preset is provided', async () => {
    // No non-interactive flag → falls through to "if (preset)" at line 266.
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'r', preset: 'team' },
    });

    const settings = readFileSync(resolve(agentkitRoot, 'overlays', 'r', 'settings.yaml'), 'utf-8');
    expect(settings).toContain('claude');
    expect(settings).toContain('cursor');
  });

  it('runs the interactive external-knowledge sub-flow when no flags are set and the user opts in', async () => {
    const responses = [
      [], // optional kits multiselect
      'Project',
      '',
      'active',
      'monolith',
      'rest',
      'github-flow',
      'conventional',
      'small',
      // no documentation in report → no acceptDocs prompt
      true, // configure external knowledge YES
      // external knowledge group: mode, windsurfPath, mystiraPath, markdownFiles, gitRepos, targetPlatforms
      'metadata-overlays',
      '/x',
      '/y',
      'a.md, b.md',
      'https://example.com/r',
      ['copilot', 'windsurf'],
      // deployment group
      'aws',
      false,
      'none',
      // no cross-cutting in report → no acceptCC prompt
      ['claude'], // selectedTools
      false, // .retortconfig confirm
    ];
    let idx = 0;
    const next = async () => responses[idx++];
    clackMockState.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      isCancel: () => false,
      text: vi.fn(async () => next()),
      select: vi.fn(async () => next()),
      confirm: vi.fn(async () => next()),
      multiselect: vi.fn(async () => next()),
      group: vi.fn(async (cfg) => {
        const out = {};
        for (const k of Object.keys(cfg)) out[k] = await cfg[k]();
        return out;
      }),
    });
    // Use a minimal report (no documentation, no crosscutting) so those prompts are skipped.
    vi.doMock('../discover.mjs', () => ({
      runDiscover: vi.fn().mockResolvedValue(makeMinimalReport()),
    }));

    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo' },
    });

    const spec = readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8');
    expect(spec).toContain('mode: metadata-overlays');
    expect(spec).toContain('windsurfDomainGuidesPath: /x');
    expect(spec).toContain('mystiraDocsPath: /y');
  });

  it('handles non-array externalConfig.targetPlatforms (clears list)', async () => {
    const responses = [
      [],
      'Project',
      '',
      'active',
      'monolith',
      'rest',
      'github-flow',
      'conventional',
      'small',
      true, // configure external knowledge
      // external-knowledge group
      'direct-copy',
      '',
      '',
      '',
      '',
      'oops-not-an-array', // non-array targetPlatforms
      'aws',
      false,
      'none',
      ['claude'],
      false,
    ];
    let idx = 0;
    const next = async () => responses[idx++];
    clackMockState.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      isCancel: () => false,
      text: vi.fn(async () => next()),
      select: vi.fn(async () => next()),
      confirm: vi.fn(async () => next()),
      multiselect: vi.fn(async () => next()),
      group: vi.fn(async (cfg) => {
        const out = {};
        for (const k of Object.keys(cfg)) out[k] = await cfg[k]();
        return out;
      }),
    });
    vi.doMock('../discover.mjs', () => ({
      runDiscover: vi.fn().mockResolvedValue(makeMinimalReport()),
    }));

    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo' },
    });

    const spec = readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8');
    expect(spec).toContain('targetPlatforms: []');
  });

  it('falls back to ["claude"] when the AI tools multiselect returns an empty list', async () => {
    const responses = [
      [],
      'Project',
      '',
      'active',
      'monolith',
      'rest',
      'github-flow',
      'conventional',
      'small',
      false, // skip external knowledge
      'aws',
      false,
      'none',
      [], // selectedTools — empty
      false,
    ];
    let idx = 0;
    const next = async () => responses[idx++];
    clackMockState.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      isCancel: () => false,
      text: vi.fn(async () => next()),
      select: vi.fn(async () => next()),
      confirm: vi.fn(async () => next()),
      multiselect: vi.fn(async () => next()),
      group: vi.fn(async (cfg) => {
        const out = {};
        for (const k of Object.keys(cfg)) out[k] = await cfg[k]();
        return out;
      }),
    });
    vi.doMock('../discover.mjs', () => ({
      runDiscover: vi.fn().mockResolvedValue(makeMinimalReport()),
    }));

    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo' },
    });

    const settings = readFileSync(
      resolve(agentkitRoot, 'overlays', 'demo', 'settings.yaml'),
      'utf-8'
    );
    expect(settings).toContain('claude');
  });

  it('logs a monorepo line when the report indicates a monorepo', async () => {
    vi.doMock('../discover.mjs', () => ({
      runDiscover: vi
        .fn()
        .mockResolvedValue(makeMinimalReport({ monorepo: { detected: true, tools: ['pnpm'] } })),
    }));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'r', 'non-interactive': true },
    });

    const out = logSpy.mock.calls.flat().map(String).join('\n');
    expect(out).toContain('Monorepo');
  });

  it('exits the wizard cleanly when the optional-kits prompt is cancelled', async () => {
    // Cancel on the FIRST prompt (optional kits multiselect).
    const cancelMarker = Symbol('cancel');
    clackMockState.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      isCancel: (v) => v === cancelMarker,
      text: vi.fn(async () => cancelMarker),
      select: vi.fn(async () => cancelMarker),
      confirm: vi.fn(async () => cancelMarker),
      multiselect: vi.fn(async () => cancelMarker),
      group: vi.fn(async () => cancelMarker),
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const { runInit } = await import('../init.mjs');

    await expect(
      runInit({
        agentkitRoot,
        projectRoot,
        flags: { repoName: 'demo' },
      })
    ).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('falls back to non-interactive mode when @clack/prompts import fails', async () => {
    // Arrange — make the @clack/prompts dynamic import throw.
    clackMockState.factory = () => {
      throw new Error('clack unavailable');
    };

    const { runInit } = await import('../init.mjs');

    // Act
    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo' },
    });

    // Assert — overlay was created via fallback
    expect(existsSync(resolve(agentkitRoot, 'overlays', 'demo', 'settings.yaml'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runInit applies presets correctly
// ---------------------------------------------------------------------------
describe('runInit preset edge cases', () => {
  let tmpRoot;
  let projectRoot;
  let agentkitRoot;

  beforeEach(() => {
    vi.resetModules();
    tmpRoot = makeTmpDir('agentkit-init-preset-');
    projectRoot = resolve(tmpRoot, 'project');
    agentkitRoot = resolve(tmpRoot, 'agentkit');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(resolve(agentkitRoot, 'spec'), { recursive: true });
    mkdirSync(resolve(agentkitRoot, 'overlays', '__TEMPLATE__'), { recursive: true });
    writeFileSync(
      resolve(agentkitRoot, 'overlays', '__TEMPLATE__', 'settings.yaml'),
      'repoName: __TEMPLATE__\nrenderTargets: []\n',
      'utf-8'
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.doMock('../discover.mjs', () => ({
      runDiscover: vi.fn().mockResolvedValue(makeMinimalReport({ techStacks: [] })),
    }));
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    vi.doUnmock('../discover.mjs');
    vi.doUnmock('../synchronize.mjs');
    vi.restoreAllMocks();
    cleanupTmpDir(tmpRoot);
  });

  it('writes infra preset defaults to spec/project.yaml', async () => {
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'r', 'non-interactive': true, preset: 'infra' },
    });

    const spec = readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8');
    expect(spec).toContain('cloudProvider: azure');
    expect(spec).toContain('iacTool: terraform');
    expect(spec).toContain('namingConvention:');
  });

  it('uses minimal preset renderTargets in non-interactive mode', async () => {
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'r', 'non-interactive': true, preset: 'minimal' },
    });

    const settings = readFileSync(resolve(agentkitRoot, 'overlays', 'r', 'settings.yaml'), 'utf-8');
    expect(settings).toContain('claude');
    expect(settings).not.toContain('cursor');
  });

  it('renders dry-run banner with featurePreset and ai-cost-ops feature flag', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: {
        repoName: 'r',
        'non-interactive': true,
        'dry-run': true,
        preset: 'infra',
      },
    });

    const out = logSpy.mock.calls.flat().map(String).join('\n');
    expect(out).toContain('DRY-RUN');
    expect(out).toContain('Would write');
  });

  it('skips auto-import when project.yaml has autoImport=false', async () => {
    const importMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../import-issues.mjs', () => ({ runImportIssues: importMock }));
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn(async ({ agentkitRoot: r }) => {
        const p = resolve(r, 'spec', 'project.yaml');
        const yamlMod = await import('js-yaml');
        const obj = yamlMod.default.load(readFileSync(p, 'utf-8')) || {};
        obj.process = obj.process || {};
        obj.process.intake = { autoImport: false };
        obj.process.issueTracker = 'github';
        writeFileSync(p, yamlMod.default.dump(obj), 'utf-8');
      }),
    }));
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo', 'non-interactive': true },
    });

    expect(importMock).not.toHaveBeenCalled();
  });

  it('skips auto-import when issueTracker is "none"', async () => {
    const importMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../import-issues.mjs', () => ({ runImportIssues: importMock }));
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn(async ({ agentkitRoot: r }) => {
        const p = resolve(r, 'spec', 'project.yaml');
        const yamlMod = await import('js-yaml');
        const obj = yamlMod.default.load(readFileSync(p, 'utf-8')) || {};
        obj.process = obj.process || {};
        obj.process.intake = { autoImport: true };
        obj.process.issueTracker = 'none';
        writeFileSync(p, yamlMod.default.dump(obj), 'utf-8');
      }),
    }));
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo', 'non-interactive': true },
    });

    expect(importMock).not.toHaveBeenCalled();
  });

  it('runs auto-import successfully when enabled and tracker is set', async () => {
    const importMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../import-issues.mjs', () => ({ runImportIssues: importMock }));
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn(async ({ agentkitRoot: r }) => {
        const p = resolve(r, 'spec', 'project.yaml');
        const yamlMod = await import('js-yaml');
        const obj = yamlMod.default.load(readFileSync(p, 'utf-8')) || {};
        obj.process = obj.process || {};
        obj.process.intake = { autoImport: true };
        obj.process.issueTracker = 'github';
        writeFileSync(p, yamlMod.default.dump(obj), 'utf-8');
      }),
    }));
    const { runInit } = await import('../init.mjs');

    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo', 'non-interactive': true },
    });

    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('runs auto-import when project.yaml enables it (non-fatal on failure)', async () => {
    // Arrange — write a project.yaml that enables intake.autoImport.
    const { runInit } = await import('../init.mjs');
    const importMock = vi.fn().mockRejectedValue(new Error('simulated import failure'));
    vi.doMock('../import-issues.mjs', () => ({
      runImportIssues: importMock,
    }));

    // Pre-write project.yaml so finalizeInit's auto-import branch reads
    // autoImport=true; runInit will overwrite it but the post-sync read
    // sees the fresh value we round-tripped via writeProjectYaml.
    // Rather than relying on the round-trip we hijack post-write by
    // mocking synchronize.mjs to mutate project.yaml after sync.
    vi.doMock('../synchronize.mjs', () => ({
      runSync: vi.fn(async ({ agentkitRoot: r }) => {
        const p = resolve(r, 'spec', 'project.yaml');
        const yamlMod = await import('js-yaml');
        const obj = yamlMod.default.load(readFileSync(p, 'utf-8')) || {};
        obj.process = obj.process || {};
        obj.process.intake = { autoImport: true };
        obj.process.issueTracker = 'github';
        writeFileSync(p, yamlMod.default.dump(obj), 'utf-8');
      }),
    }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    await runInit({
      agentkitRoot,
      projectRoot,
      flags: { repoName: 'demo', 'non-interactive': true },
    });

    // Assert
    expect(importMock).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('Issue import failed');
  });
});
