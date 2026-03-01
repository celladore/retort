import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENTKIT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

function makeTmpDir() {
  const dir = resolve(
    tmpdir(),
    `agentkit-init-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Sets up a minimal agentkit root with __TEMPLATE__ overlay and required spec
 * files so init can run without hitting the real discover/sync.
 */
function setupAgentkitRoot(dir) {
  const specDir = resolve(dir, 'spec');
  mkdirSync(specDir, { recursive: true });
  writeFileSync(resolve(specDir, 'VERSION'), '0.1.0\n', 'utf-8');
  writeFileSync(resolve(specDir, 'project.yaml'), yaml.dump({ name: null, phase: null }), 'utf-8');

  const templateDir = resolve(dir, 'overlays', '__TEMPLATE__');
  mkdirSync(templateDir, { recursive: true });
  writeFileSync(
    resolve(templateDir, 'settings.yaml'),
    yaml.dump({ repoName: '__TEMPLATE__', renderTargets: [] }),
    'utf-8'
  );
  writeFileSync(resolve(templateDir, 'commands.yaml'), yaml.dump({ commands: [] }), 'utf-8');
  writeFileSync(resolve(templateDir, 'rules.yaml'), yaml.dump({ rules: [] }), 'utf-8');

  // Minimal package.json
  writeFileSync(
    resolve(dir, 'package.json'),
    JSON.stringify({ name: 'test', version: '0.0.1' }),
    'utf-8'
  );

  return dir;
}

// Stub discover to return a minimal report without filesystem scanning
function makeStubReport() {
  return {
    techStacks: [],
    frameworks: { frontend: [], backend: [], css: [], orm: [] },
    testing: [],
    monorepo: { detected: false, tools: [] },
    infrastructure: [],
    documentation: [],
    designSystem: [],
    crosscutting: {},
    cicd: [],
    repository: { isGit: true },
    structure: { topLevelDirs: [] },
    recommendations: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('runInit', () => {
  let tmpRoot;
  let projectRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    projectRoot = resolve(tmpRoot, 'project');
    mkdirSync(projectRoot, { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Non-interactive mode
  // ---------------------------------------------------------------------------
  describe('non-interactive mode', () => {
    it('creates overlay directory from __TEMPLATE__', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));

      // Mock discover + sync so we don't need the full engine
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'test-project' },
      });

      const overlayDir = resolve(agentkitRoot, 'overlays', 'test-project');
      expect(existsSync(overlayDir)).toBe(true);
      expect(existsSync(resolve(overlayDir, 'settings.yaml'))).toBe(true);
    });

    it('writes .agentkit-repo marker file', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'marker-test' },
      });

      const marker = resolve(projectRoot, '.agentkit-repo');
      expect(existsSync(marker)).toBe(true);
      expect(readFileSync(marker, 'utf-8').trim()).toBe('marker-test');
    });

    it('writes project.yaml with name field', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'yaml-test' },
      });

      const projectYaml = yaml.load(
        readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8')
      );
      expect(projectYaml.name).toBe('yaml-test');
    });

    it('uses full preset renderTargets by default in non-interactive mode', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'targets-test' },
      });

      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'targets-test', 'settings.yaml'), 'utf-8')
      );
      // non-interactive defaults to full preset
      expect(settings.renderTargets.length).toBeGreaterThanOrEqual(5);
      expect(settings.renderTargets).toContain('claude');
      expect(settings.renderTargets).toContain('cursor');
    });

    it('persists external knowledge flags to project.yaml', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: {
          'non-interactive': true,
          repoName: 'external-knowledge-test',
          'external-knowledge': true,
          'external-mode': 'metadata-overlays',
          'windsurf-guides-path': 'C:/Users/test/.windsurf/plans/domain-guides',
          'mystira-docs-path': 'C:/Users/test/repos/Mystira.workspace/docs',
          'external-markdown-files': 'docs/vision.md, docs/strategy.md',
          'external-git-repos': 'https://github.com/example/repo-a, https://github.com/example/repo-b',
          'external-target-platforms': 'copilot,windsurf',
        },
      });

      const projectYaml = yaml.load(
        readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8')
      );
      expect(projectYaml.externalKnowledge.enabled).toBe(true);
      expect(projectYaml.externalKnowledge.mode).toBe('metadata-overlays');
      expect(projectYaml.externalKnowledge.sources.windsurfDomainGuidesPath).toBe(
        'C:/Users/test/.windsurf/plans/domain-guides'
      );
      expect(projectYaml.externalKnowledge.sources.mystiraDocsPath).toBe(
        'C:/Users/test/repos/Mystira.workspace/docs'
      );
      expect(projectYaml.externalKnowledge.sources.markdownFiles).toEqual([
        'docs/vision.md',
        'docs/strategy.md',
      ]);
      expect(projectYaml.externalKnowledge.sources.gitRepoUrls).toEqual([
        'https://github.com/example/repo-a',
        'https://github.com/example/repo-b',
      ]);
      expect(projectYaml.externalKnowledge.targetPlatforms).toEqual(['copilot', 'windsurf']);
    });
  });

  // ---------------------------------------------------------------------------
  // Preset mode
  // ---------------------------------------------------------------------------
  describe('preset mode', () => {
    it('uses minimal preset renderTargets', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, preset: 'minimal', repoName: 'min-test' },
      });

      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'min-test', 'settings.yaml'), 'utf-8')
      );
      expect(settings.renderTargets).toEqual(['claude']);
    });

    it('uses team preset renderTargets', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, preset: 'team', repoName: 'team-test' },
      });

      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'team-test', 'settings.yaml'), 'utf-8')
      );
      expect(settings.renderTargets).toEqual(['claude', 'cursor', 'copilot', 'windsurf']);
    });

    it('uses infra preset renderTargets and applies infra defaults', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, preset: 'infra', repoName: 'infra-test' },
      });

      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'infra-test', 'settings.yaml'), 'utf-8')
      );
      expect(settings.renderTargets).toEqual(['claude', 'cursor', 'copilot', 'windsurf', 'mcp']);

      const projectYaml = yaml.load(
        readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8')
      );
      expect(projectYaml.deployment.cloudProvider).toBe('azure');
      expect(projectYaml.deployment.iacTool).toBe('terraform');
      expect(projectYaml.infrastructure.namingConvention).toBe(
        '{org}-{env}-{project}-{resourcetype}-{region}'
      );
      expect(projectYaml.infrastructure.iacToolchain).toEqual(['terraform', 'terragrunt']);
      expect(projectYaml.infrastructure.stateBackend).toBe('azurerm');
    });
  });

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws on invalid repoName (empty string)', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const { runInit } = await import('../init.mjs');
      await expect(
        runInit({
          agentkitRoot,
          projectRoot,
          flags: { repoName: '', 'non-interactive': true },
        })
      ).rejects.toThrow('Invalid repo name');
    });

    it('throws on invalid repoName (.)', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const { runInit } = await import('../init.mjs');
      await expect(
        runInit({
          agentkitRoot,
          projectRoot,
          flags: { repoName: '.', 'non-interactive': true },
        })
      ).rejects.toThrow('Invalid repo name');
    });

    it('throws on invalid repoName (..)', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const { runInit } = await import('../init.mjs');
      await expect(
        runInit({
          agentkitRoot,
          projectRoot,
          flags: { repoName: '..', 'non-interactive': true },
        })
      ).rejects.toThrow('Invalid repo name');
    });

    it('throws on invalid repoName (path traversal)', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const { runInit } = await import('../init.mjs');
      await expect(
        runInit({
          agentkitRoot,
          projectRoot,
          flags: { repoName: '../evil', 'non-interactive': true },
        })
      ).rejects.toThrow('Invalid repo name');
    });

    it('throws on unknown preset', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const { runInit } = await import('../init.mjs');
      await expect(
        runInit({
          agentkitRoot,
          projectRoot,
          flags: { preset: 'nonexistent', repoName: 'err-test' },
        })
      ).rejects.toThrow('Unknown preset');
    });

    it('throws when overlay already exists without --force', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      mkdirSync(resolve(agentkitRoot, 'overlays', 'existing-project'), {
        recursive: true,
      });
      const { runInit } = await import('../init.mjs');
      await expect(
        runInit({
          agentkitRoot,
          projectRoot,
          flags: { repoName: 'existing-project', 'non-interactive': true },
        })
      ).rejects.toThrow('Overlay already exists');
    });

    it('succeeds with --force when overlay exists', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      mkdirSync(resolve(agentkitRoot, 'overlays', 'force-project'), {
        recursive: true,
      });

      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await expect(
        initFn({
          agentkitRoot,
          projectRoot,
          flags: { repoName: 'force-project', force: true, 'non-interactive': true },
        })
      ).resolves.not.toThrow();
    });

    it('throws when __TEMPLATE__ overlay is missing', async () => {
      const agentkitRoot = resolve(tmpRoot, 'agentkit-empty');
      mkdirSync(resolve(agentkitRoot, 'spec'), { recursive: true });
      mkdirSync(resolve(agentkitRoot, 'overlays'), { recursive: true });
      writeFileSync(
        resolve(agentkitRoot, 'package.json'),
        JSON.stringify({ name: 'test', version: '0.0.1' }),
        'utf-8'
      );
      writeFileSync(
        resolve(agentkitRoot, 'spec', 'project.yaml'),
        yaml.dump({ name: null }),
        'utf-8'
      );
      // No __TEMPLATE__ overlay

      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(makeStubReport()),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await expect(
        initFn({
          agentkitRoot,
          projectRoot,
          flags: { repoName: 'no-template', 'non-interactive': true },
        })
      ).rejects.toThrow('Template overlay not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Discovery-derived defaults
  // ---------------------------------------------------------------------------
  describe('discovery integration', () => {
    it('populates project.yaml stack from discovery report', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const report = makeStubReport();
      report.techStacks = [{ name: 'node', label: 'Node.js', fileCount: 42 }];
      report.frameworks.frontend = ['react'];
      report.testing = ['vitest', 'playwright'];

      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(report),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'disc-test' },
      });

      const projectYaml = yaml.load(
        readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8')
      );
      expect(projectYaml.stack.languages).toContain('node');
      expect(projectYaml.stack.frameworks.frontend).toContain('react');
      expect(projectYaml.testing.unit).toContain('vitest');
      expect(projectYaml.testing.e2e).toContain('playwright');
    });

    it('populates deployment.containerized from docker detection', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const report = makeStubReport();
      report.infrastructure = ['docker'];

      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(report),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));

      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'docker-test' },
      });

      const projectYaml = yaml.load(
        readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8')
      );
      expect(projectYaml.deployment.containerized).toBe(true);
    });

    it('populates crosscutting from discovery report', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const report = makeStubReport();
      report.crosscutting = {
        logging: ['winston'],
        authentication: ['auth0'],
        caching: ['redis'],
        errorHandling: ['problem-details'],
        featureFlags: ['launchdarkly'],
      };

      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(report),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'cc-test' },
      });

      const projectYaml = yaml.load(
        readFileSync(resolve(agentkitRoot, 'spec', 'project.yaml'), 'utf-8')
      );
      expect(projectYaml.crosscutting.logging.framework).toBe('winston');
      expect(projectYaml.crosscutting.authentication.provider).toBe('auth0');
      expect(projectYaml.crosscutting.caching.provider).toBe('redis');
      expect(projectYaml.crosscutting.caching.distributedCache).toBe(true);
      expect(projectYaml.crosscutting.featureFlags.provider).toBe('launchdarkly');
    });

    it('sets overlay primaryStack from first detected language', async () => {
      const agentkitRoot = setupAgentkitRoot(resolve(tmpRoot, 'agentkit'));
      const report = makeStubReport();
      report.techStacks = [
        { name: 'rust', label: 'Rust', fileCount: 100 },
        { name: 'node', label: 'Node.js', fileCount: 10 },
      ];

      vi.doMock('../discover.mjs', () => ({
        runDiscover: vi.fn().mockResolvedValue(report),
      }));
      vi.doMock('../synchronize.mjs', () => ({
        runSync: vi.fn().mockResolvedValue(undefined),
      }));
      vi.resetModules();
      const { runInit: initFn } = await import('../init.mjs');
      await initFn({
        agentkitRoot,
        projectRoot,
        flags: { 'non-interactive': true, repoName: 'stack-test' },
      });

      const settings = yaml.load(
        readFileSync(resolve(agentkitRoot, 'overlays', 'stack-test', 'settings.yaml'), 'utf-8')
      );
      expect(settings.primaryStack).toBe('rust');
    });
  });
});
