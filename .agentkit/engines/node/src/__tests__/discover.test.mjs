import { describe, it, expect, vi, afterEach } from 'vitest';
import { runDiscover } from '../discover.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

describe('runDiscover()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a discovery report for the current repo', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const report = await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { output: 'json' },
    });

    // Report should have expected structure
    expect(report).toHaveProperty('techStacks');
    expect(report).toHaveProperty('infrastructure');
    expect(report).toHaveProperty('cicd');
    expect(report).toHaveProperty('monorepo');
    expect(report).toHaveProperty('structure');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('repository');

    // Should detect this repo is a git repo
    expect(report.repository.isGit).toBe(true);

    // techStacks should be an array (may or may not detect Node depending on project layout)
    expect(Array.isArray(report.techStacks)).toBe(true);

    // structure should include top-level dirs array
    // (may be empty in template repo since .agentkit/ is a dotfile)
    expect(Array.isArray(report.structure.topLevelDirs)).toBe(true);
  });

  it('detects GitHub Actions CI', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const report = await runDiscover({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: PROJECT_ROOT,
      flags: { output: 'json' },
    });

    // Should detect our CI workflow
    expect(report.cicd).toContain('github-actions');
  });
});
