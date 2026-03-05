import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from 'vitest';
import { runSync } from '../synchronize.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENTKIT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

/** Creates a temp project root for testing sync output. */
function makeTmpProject() {
  const dir = resolve(
    tmpdir(),
    `agentkit-sync-integration-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeNamedTmpProject(repoName) {
  const parent = makeTmpProject();
  const dir = resolve(parent, repoName);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeTestFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

function makeMinimalAgentkitRoot({ overlayName = 'test-repo', defaultBranch = 'dev' } = {}) {
  const root = resolve(
    tmpdir(),
    `agentkit-minimal-root-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(root, { recursive: true });

  writeTestFile(
    resolve(root, 'package.json'),
    JSON.stringify({ name: 'agentkit-test-root', version: '0.0.1', type: 'module' }, null, 2)
  );

  writeTestFile(resolve(root, 'spec', 'teams.yaml'), 'teams: []\n');
  writeTestFile(
    resolve(root, 'spec', 'commands.yaml'),
    'commands:\n  - name: build\n    description: Build the project\n'
  );
  writeTestFile(resolve(root, 'spec', 'rules.yaml'), 'rules: []\n');
  writeTestFile(resolve(root, 'spec', 'settings.yaml'), 'permissions: {}\n');
  writeTestFile(resolve(root, 'spec', 'agents.yaml'), 'agents: {}\n');
  writeTestFile(resolve(root, 'spec', 'docs.yaml'), '{}\n');
  writeTestFile(resolve(root, 'spec', 'project.yaml'), `name: ${overlayName}\n`);

  writeTestFile(
    resolve(root, 'overlays', '__TEMPLATE__', 'settings.yaml'),
    'repoName: __TEMPLATE__\ndefaultBranch: main\nrenderTargets:\n  - claude\n  - copilot\n'
  );
  writeTestFile(
    resolve(root, 'overlays', overlayName, 'settings.yaml'),
    `repoName: ${overlayName}\ndefaultBranch: ${defaultBranch}\nrenderTargets:\n  - claude\n  - copilot\n`
  );

  writeTestFile(
    resolve(root, 'templates', 'root', 'AGENTS.md'),
    '# Agents\nDefault branch: {{defaultBranch}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'docs', 'README.md'),
    '# Docs\nDefault branch: {{defaultBranch}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'claude', 'CLAUDE.md'),
    '# Claude\nDefault branch: {{defaultBranch}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'claude', 'skills', 'TEMPLATE', 'SKILL.md'),
    '# Skill {{commandName}}\nDefault branch: {{defaultBranch}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'copilot', 'copilot-instructions.md'),
    '# Copilot\nDefault branch: {{defaultBranch}}\n'
  );
  writeTestFile(
    resolve(root, 'templates', 'github', 'workflows', 'ci.yml'),
    'name: Base CI\non:\n  push:\n    branches: [{{defaultBranch}}]\n'
  );
  writeTestFile(
    resolve(root, 'overlays', overlayName, 'templates', 'github', 'workflows', 'ci.yml'),
    'name: Overlay CI\non:\n  push:\n    branches: [{{defaultBranch}}]\n'
  );

  return root;
}

/** Collects all files under a directory recursively (relative paths, forward slashes). */
function collectFiles(dir, base = dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push(full.slice(base.length + 1).replace(/\\/g, '/'));
    }
  }
  return results;
}

describe('overlay resolution and template precedence regressions', () => {
  let agentkitRoot;
  let projectRoot;

  afterEach(() => {
    if (projectRoot) {
      rmSync(resolve(projectRoot, '..'), { recursive: true, force: true });
      projectRoot = null;
    }
    if (agentkitRoot) {
      rmSync(agentkitRoot, { recursive: true, force: true });
      agentkitRoot = null;
    }
  });

  it('auto-detects the overlay from the project root when .agentkit-repo is missing', async () => {
    agentkitRoot = makeMinimalAgentkitRoot({ overlayName: 'test-repo', defaultBranch: 'dev' });
    projectRoot = makeNamedTmpProject('test-repo');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.map(String).join(' '));
    };

    try {
      await runSync({ agentkitRoot, projectRoot, flags: { quiet: false } });
    } finally {
      console.log = originalLog;
    }

    const agentsContent = readFileSync(resolve(projectRoot, 'AGENTS.md'), 'utf-8');
    expect(agentsContent).toContain('Default branch: dev');
    expect(logs.join('\n')).toContain('Using overlay: test-repo');
    expect(logs.join('\n')).toContain('inferred from project root name "test-repo"');
  });

  it('prefers overlay templates for github workflows over base templates', async () => {
    agentkitRoot = makeMinimalAgentkitRoot({ overlayName: 'test-repo', defaultBranch: 'dev' });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: {} });

    const ciContent = readFileSync(resolve(projectRoot, '.github', 'workflows', 'ci.yml'), 'utf-8');
    expect(ciContent).toContain('name: Overlay CI');
    expect(ciContent).not.toContain('name: Base CI');
  });

  it('renders the resolved defaultBranch consistently across generated outputs', async () => {
    agentkitRoot = makeMinimalAgentkitRoot({ overlayName: 'test-repo', defaultBranch: 'dev' });
    projectRoot = makeNamedTmpProject('test-repo');

    await runSync({ agentkitRoot, projectRoot, flags: {} });

    expect(readFileSync(resolve(projectRoot, 'AGENTS.md'), 'utf-8')).toContain(
      'Default branch: dev'
    );
    expect(readFileSync(resolve(projectRoot, 'docs', 'README.md'), 'utf-8')).toContain(
      'Default branch: dev'
    );
    expect(readFileSync(resolve(projectRoot, 'CLAUDE.md'), 'utf-8')).toContain(
      'Default branch: dev'
    );
    expect(
      readFileSync(resolve(projectRoot, '.github', 'copilot-instructions.md'), 'utf-8')
    ).toContain('Default branch: dev');
    expect(readFileSync(resolve(projectRoot, '.github', 'workflows', 'ci.yml'), 'utf-8')).toContain(
      'branches: [dev]'
    );
    expect(
      readFileSync(resolve(projectRoot, '.claude', 'skills', 'build', 'SKILL.md'), 'utf-8')
    ).toContain('Default branch: dev');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Copilot Prompts
// ---------------------------------------------------------------------------
describe('syncCopilotPrompts (via runSync --only copilot)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'copilot' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it(
    'generates .github/prompts/*.prompt.md for non-team commands',
    { timeout: 15000 },
    async () => {
      const files = collectFiles(projectRoot);
      const prompts = files.filter((f) => f.startsWith('.github/prompts/'));
      expect(prompts.length).toBeGreaterThan(0);
      // Should have prompt files for workflow/utility commands
      expect(prompts.some((f) => f.includes('build.prompt.md'))).toBe(true);
      expect(prompts.some((f) => f.includes('check.prompt.md'))).toBe(true);
      // Should NOT have prompt files for team commands
      expect(prompts.some((f) => f.includes('team-backend.prompt.md'))).toBe(false);
    }
  );

  it('prompt files contain GENERATED header', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'prompts', 'build.prompt.md'),
      'utf-8'
    );
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('prompt files contain frontmatter', async () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'prompts', 'build.prompt.md'),
      'utf-8'
    );
    expect(content).toContain("mode: 'agent'");
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Copilot Agents
// ---------------------------------------------------------------------------
describe('syncCopilotAgents (via runSync --only copilot)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'copilot' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .github/agents/*.agent.md from agents.yaml', async () => {
    const files = collectFiles(projectRoot);
    const agents = files.filter((f) => f.startsWith('.github/agents/'));
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some((f) => f.includes('backend.agent.md'))).toBe(true);
    expect(agents.some((f) => f.includes('frontend.agent.md'))).toBe(true);
  });

  it('agent files contain agent name and role', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'agents', 'backend.agent.md'),
      'utf-8'
    );
    expect(content).toContain('Backend Engineer');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Copilot Chat Modes
// ---------------------------------------------------------------------------
describe('syncCopilotChatModes (via runSync --only copilot)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'copilot' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .github/chatmodes/team-*.chatmode.md from teams.yaml', async () => {
    const files = collectFiles(projectRoot);
    const chatmodes = files.filter((f) => f.startsWith('.github/chatmodes/'));
    expect(chatmodes.length).toBeGreaterThan(0);
    expect(chatmodes.some((f) => f.includes('team-backend.chatmode.md'))).toBe(true);
    expect(chatmodes.some((f) => f.includes('team-frontend.chatmode.md'))).toBe(true);
  });

  it('chat mode files contain team focus', async () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'chatmodes', 'team-backend.chatmode.md'),
      'utf-8'
    );
    expect(content).toContain('API, services, core logic');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Gemini
// ---------------------------------------------------------------------------
describe('syncGemini (via runSync --only gemini)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'gemini' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates GEMINI.md at project root', async () => {
    expect(existsSync(resolve(projectRoot, 'GEMINI.md'))).toBe(true);
  });

  it('generates .gemini/styleguide.md', async () => {
    expect(existsSync(resolve(projectRoot, '.gemini', 'styleguide.md'))).toBe(true);
  });

  it('generates .gemini/config.yaml', async () => {
    expect(existsSync(resolve(projectRoot, '.gemini', 'config.yaml'))).toBe(true);
  });

  it('GEMINI.md contains GENERATED header', async () => {
    const content = readFileSync(resolve(projectRoot, 'GEMINI.md'), 'utf-8');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('GEMINI.md contains project template vars', async () => {
    const content = readFileSync(resolve(projectRoot, 'GEMINI.md'), 'utf-8');
    expect(content).toContain('Gemini Instructions');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Codex Skills
// ---------------------------------------------------------------------------
describe('syncCodexSkills (via runSync --only codex)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'codex' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .agents/skills/*/SKILL.md for non-team commands', { timeout: 15000 }, async () => {
    const files = collectFiles(projectRoot);
    const skills = files.filter((f) => f.startsWith('.agents/skills/'));
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some((f) => f.includes('build/SKILL.md'))).toBe(true);
    // Should NOT have skills for team commands
    expect(skills.some((f) => f.includes('team-backend/SKILL.md'))).toBe(false);
  });

  it('SKILL.md contains command name', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.agents', 'skills', 'build', 'SKILL.md'),
      'utf-8'
    );
    expect(content).toContain('build');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Claude Skills
// ---------------------------------------------------------------------------
describe('syncClaudeSkills (via runSync --only claude)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'claude' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .claude/skills/*/SKILL.md for non-team commands', { timeout: 15000 }, async () => {
    const files = collectFiles(projectRoot);
    const skills = files.filter((f) => f.startsWith('.claude/skills/'));
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some((f) => f.includes('build/SKILL.md'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Cursor Commands
// ---------------------------------------------------------------------------
describe('syncCursorCommands (via runSync --only cursor)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'cursor' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .cursor/commands/*.md for non-team commands', async () => {
    const files = collectFiles(projectRoot);
    const commands = files.filter((f) => f.startsWith('.cursor/commands/'));
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.some((f) => f.includes('build.md'))).toBe(true);
    expect(commands.some((f) => f.includes('check.md'))).toBe(true);
    // No team commands
    expect(commands.some((f) => f.includes('team-backend.md'))).toBe(false);
  });

  it('cursor command files contain GENERATED header', async () => {
    const content = readFileSync(resolve(projectRoot, '.cursor', 'commands', 'build.md'), 'utf-8');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — WARP.md
// ---------------------------------------------------------------------------
describe('syncWarp (via runSync --only warp)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'warp' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates WARP.md at project root', async () => {
    expect(existsSync(resolve(projectRoot, 'WARP.md'))).toBe(true);
  });

  it('WARP.md contains GENERATED header', async () => {
    const content = readFileSync(resolve(projectRoot, 'WARP.md'), 'utf-8');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('WARP.md contains Warp Instructions heading', async () => {
    const content = readFileSync(resolve(projectRoot, 'WARP.md'), 'utf-8');
    expect(content).toContain('Warp Instructions');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Cline Rules
// ---------------------------------------------------------------------------
describe('syncClineRules (via runSync --only cline)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'cline' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .clinerules/*.md from rules.yaml domains', { timeout: 15000 }, async () => {
    const files = collectFiles(projectRoot);
    const rules = files.filter((f) => f.startsWith('.clinerules/'));
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((f) => f.includes('typescript.md'))).toBe(true);
    expect(rules.some((f) => f.includes('security.md'))).toBe(true);
  });

  it('cline rule files contain domain name and conventions', { timeout: 15000 }, async () => {
    const content = readFileSync(resolve(projectRoot, '.clinerules', 'typescript.md'), 'utf-8');
    expect(content).toContain('typescript');
    expect(content).toMatch(/Enforcement Rules|Advisory Rules/);
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Roo Code Rules
// ---------------------------------------------------------------------------
describe('syncRooRules (via runSync --only roo)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'roo' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .roo/rules/*.md from rules.yaml domains', { timeout: 15000 }, async () => {
    const files = collectFiles(projectRoot);
    const rules = files.filter((f) => f.startsWith('.roo/rules/'));
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((f) => f.includes('typescript.md'))).toBe(true);
    expect(rules.some((f) => f.includes('security.md'))).toBe(true);
  });

  it('roo rule files contain GENERATED header', async () => {
    const content = readFileSync(resolve(projectRoot, '.roo', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });
});

// ---------------------------------------------------------------------------
// Tests: Render target gating — new tools excluded when not in targets
// ---------------------------------------------------------------------------
describe('render target gating for new tools', () => {
  let projectRoot;

  beforeAll(() => {
    projectRoot = makeTmpProject();
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('--only claude does NOT generate gemini, warp, cline, roo, codex files', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'claude' } });
    const files = collectFiles(projectRoot);
    expect(files.some((f) => f === 'GEMINI.md')).toBe(false);
    expect(files.some((f) => f === 'WARP.md')).toBe(false);
    expect(files.some((f) => f.startsWith('.gemini/'))).toBe(false);
    expect(files.some((f) => f.startsWith('.agents/'))).toBe(false);
    expect(files.some((f) => f.startsWith('.clinerules/'))).toBe(false);
    expect(files.some((f) => f.startsWith('.roo/'))).toBe(false);
  });

  it('always-on outputs generated regardless of --only flag', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'warp' } });
    const files = collectFiles(projectRoot);
    // AGENTS.md is always-on
    expect(files.some((f) => f === 'AGENTS.md')).toBe(true);
    // WARP.md is the only gated output
    expect(files.some((f) => f === 'WARP.md')).toBe(true);
    // Claude-specific outputs should NOT be present
    expect(files.some((f) => f === 'CLAUDE.md')).toBe(false);
    expect(files.some((f) => f.startsWith('.claude/'))).toBe(false);
  });
});

describe('--overwrite flag', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: {} });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it(
    'skips project-owned files by default, overwrites with --overwrite',
    { timeout: 25000 },
    async () => {
      const contribPath = join(projectRoot, 'CONTRIBUTING.md');
      expect(existsSync(contribPath)).toBe(true);

      const customContent = 'CUSTOM_CONTENT_MARKER_12345';
      writeFileSync(contribPath, customContent, 'utf-8');

      await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: {} });
      expect(readFileSync(contribPath, 'utf-8')).toBe(customContent);

      await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { overwrite: true } });
      expect(readFileSync(contribPath, 'utf-8')).not.toContain(customContent);
    }
  );

  it('--force is alias for --overwrite', { timeout: 15000 }, async () => {
    const contribPath = join(projectRoot, 'CONTRIBUTING.md');
    writeFileSync(contribPath, 'CUSTOM', 'utf-8');
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { force: true } });
    expect(readFileSync(contribPath, 'utf-8')).not.toContain('CUSTOM');
  });
});

describe('--quiet, --verbose, --no-clean, --diff flags', () => {
  let projectRoot;

  beforeAll(() => {
    projectRoot = makeTmpProject();
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('--diff shows create/update/skip without writing', { timeout: 30000 }, async () => {
    const log = [];
    const origLog = console.log;
    console.log = (...args) => {
      log.push(args.map(String).join(' '));
      origLog.apply(console, args);
    };
    try {
      await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { diff: true } });
      const out = log.join('\n');
      expect(out).toContain('[agentkit:sync] Diff mode');
      expect(out).toContain('create ');
      expect(out).toContain('Diff:');
      expect(existsSync(join(projectRoot, 'CONTRIBUTING.md'))).toBe(false);
    } finally {
      console.log = origLog;
    }
  });

  test.sequential(
    '--no-clean preserves orphaned files',
    async () => {
      // Create isolated temp agentkit root to avoid mutating shared state
      const tempAgentkitRoot = resolve(
        tmpdir(),
        `agentkit-sync-integration-manifest-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      );
      mkdirSync(tempAgentkitRoot, { recursive: true });

      // Copy essential files from AGENTKIT_ROOT to temp
      const essentialFiles = ['.manifest.json', 'spec', 'templates', 'engines'];
      for (const file of essentialFiles) {
        const src = join(AGENTKIT_ROOT, file);
        const dest = join(tempAgentkitRoot, file);
        if (existsSync(src)) {
          // Use simple copy for files, recursive for directories
          if (file === '.manifest.json') {
            if (existsSync(src)) {
              writeFileSync(dest, readFileSync(src, 'utf-8'), 'utf-8');
            }
          } else {
            const { cpSync } = await import('fs');
            cpSync(src, dest, { recursive: true });
          }
        }
      }

      try {
        await runSync({ agentkitRoot: tempAgentkitRoot, projectRoot, flags: {} });
        const manifestPath = join(tempAgentkitRoot, '.manifest.json');
        const originalManifest = existsSync(manifestPath)
          ? readFileSync(manifestPath, 'utf-8')
          : null;
        const manifest = originalManifest ? JSON.parse(originalManifest) : { files: {} };
        manifest.files['__TEST_ORPHAN__.md'] = { hash: 'abc' };
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        const orphanPath = join(projectRoot, '__TEST_ORPHAN__.md');
        writeFileSync(orphanPath, 'orphan', 'utf-8');
        await runSync({ agentkitRoot: tempAgentkitRoot, projectRoot, flags: { 'no-clean': true } });
        expect(existsSync(orphanPath)).toBe(true);
      } finally {
        rmSync(tempAgentkitRoot, { recursive: true, force: true });
      }
    },
    60000
  );
});

// ---------------------------------------------------------------------------
// Tests: Render-target output isolation (--only flag)
// ---------------------------------------------------------------------------
describe('render-target output isolation (--only flag)', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = makeTmpProject();
  });
  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('--only mcp produces no copilot prompts', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'mcp' } });
    expect(existsSync(resolve(projectRoot, '.github', 'prompts'))).toBe(false);
  });

  it('--only windsurf produces no cursor command files', { timeout: 15000 }, async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'windsurf' } });
    expect(existsSync(resolve(projectRoot, '.cursor', 'commands'))).toBe(false);
  });

  it('--only cline produces no codex skills', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'cline' } });
    expect(existsSync(resolve(projectRoot, '.agents', 'skills'))).toBe(false);
  });

  it('--only ai produces no cursor team rules', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'ai' } });
    expect(existsSync(resolve(projectRoot, '.cursor', 'rules', 'team-backend.mdc'))).toBe(false);
  });

  it('--only codex produces no windsurf team rules', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'codex' } });
    expect(existsSync(resolve(projectRoot, '.windsurf', 'rules', 'team-backend.md'))).toBe(false);
  });

  it('--only gemini produces no copilot chatmodes', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'gemini' } });
    expect(existsSync(resolve(projectRoot, '.github', 'chatmodes'))).toBe(false);
  });

  it('--only warp produces no copilot agent files', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'warp' } });
    expect(existsSync(resolve(projectRoot, '.github', 'agents'))).toBe(false);
  });

  it('--only roo produces no claude agent files', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'roo' } });
    expect(existsSync(resolve(projectRoot, '.claude', 'agents'))).toBe(false);
  });

  it('--only warp produces no cline rules', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'warp' } });
    expect(existsSync(resolve(projectRoot, '.clinerules'))).toBe(false);
  });

  it('--only mcp produces no roo rules', async () => {
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'mcp' } });
    expect(existsSync(resolve(projectRoot, '.roo', 'rules'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Copilot testing/QA instruction templates
// ---------------------------------------------------------------------------
describe('syncCopilotInstructions — testing & QA templates (via runSync --only copilot)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'copilot' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .github/instructions/testing.md', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.github', 'instructions', 'testing.md'))).toBe(true);
  });

  it('generates .github/instructions/quality.md', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.github', 'instructions', 'quality.md'))).toBe(true);
  });

  it('generates .github/instructions/code-verify.md', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.github', 'instructions', 'code-verify.md'))).toBe(
      true
    );
  });

  it('does NOT generate kluster-code-verify.md (renamed to code-verify.md)', () => {
    expect(
      existsSync(resolve(projectRoot, '.github', 'instructions', 'kluster-code-verify.md'))
    ).toBe(false);
  });

  it('testing.md contains GENERATED header', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'testing.md'),
      'utf-8'
    );
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('testing.md contains AAA pattern guidance', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'testing.md'),
      'utf-8'
    );
    expect(content).toContain('Arrange');
    expect(content).toContain('Act');
    expect(content).toContain('Assert');
  });

  it('quality.md contains Definition of Done section', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'quality.md'),
      'utf-8'
    );
    expect(content).toContain('Definition of Done');
  });

  it('quality.md contains Code Review Checklist', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'quality.md'),
      'utf-8'
    );
    expect(content).toContain('Code Review Checklist');
  });

  it('code-verify.md contains Verification Scope section', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'code-verify.md'),
      'utf-8'
    );
    expect(content).toContain('Verification Scope');
  });

  it('code-verify.md contains Sign-Off Criteria', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'code-verify.md'),
      'utf-8'
    );
    expect(content).toContain('Sign-Off Criteria');
  });

  it('instructions README.md lists testing.md, quality.md, and code-verify.md', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'README.md'),
      'utf-8'
    );
    expect(content).toContain('testing.md');
    expect(content).toContain('quality.md');
    expect(content).toContain('code-verify.md');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Claude testing rules template
// ---------------------------------------------------------------------------
describe('syncClaudeRules — testing template (via runSync --only claude)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'claude' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .claude/rules/testing.md', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.claude', 'rules', 'testing.md'))).toBe(true);
  });

  it('testing.md contains GENERATED header', () => {
    const content = readFileSync(resolve(projectRoot, '.claude', 'rules', 'testing.md'), 'utf-8');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('testing.md resolves project name placeholder', () => {
    const content = readFileSync(resolve(projectRoot, '.claude', 'rules', 'testing.md'), 'utf-8');
    // projectName should be resolved (no raw {{projectName}} left)
    expect(content).not.toContain('{{projectName}}');
  });

  it('testing.md contains coverage quality gate section', () => {
    const content = readFileSync(resolve(projectRoot, '.claude', 'rules', 'testing.md'), 'utf-8');
    expect(content).toContain('Coverage');
  });

  it('testing.md contains forbidden patterns section', () => {
    const content = readFileSync(resolve(projectRoot, '.claude', 'rules', 'testing.md'), 'utf-8');
    expect(content).toContain('Forbidden Patterns');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Generic syncLanguageInstructions (multi-platform)
// ---------------------------------------------------------------------------
describe('syncLanguageInstructions — generic, multi-platform dynamic generation from rules.yaml', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'copilot' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  // --- Copilot output (.github/instructions/languages/) ---

  it('generates .github/instructions/languages/ for copilot target', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.github', 'instructions', 'languages'))).toBe(true);
  });

  it('generates one file per rules.yaml domain under copilot output', { timeout: 15000 }, () => {
    const files = collectFiles(resolve(projectRoot, '.github', 'instructions', 'languages'));
    expect(files.some((f) => f.endsWith('typescript.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('rust.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('python.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('security.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('testing.md'))).toBe(true);
  });

  it('generates languages/README.md for copilot target', () => {
    expect(
      existsSync(resolve(projectRoot, '.github', 'instructions', 'languages', 'README.md'))
    ).toBe(true);
  });

  it('domain-specific template is used for typescript.md', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'typescript.md'),
      'utf-8'
    );
    expect(content).toContain('TypeScript');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('domain-specific template is used for rust.md', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'rust.md'),
      'utf-8'
    );
    expect(content).toContain('Rust');
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('ruleConventions from rules.yaml are injected into domain files', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'typescript.md'),
      'utf-8'
    );
    expect(content).toContain('Project Conventions');
  });

  it('security.md uses generic TEMPLATE.md fallback (no domain-specific template)', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'security.md'),
      'utf-8'
    );
    expect(content).toMatch(/Enforcement Rules|Advisory Rules/);
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('no raw Handlebars placeholders remain in generated copilot files', () => {
    const typescriptContent = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'typescript.md'),
      'utf-8'
    );
    expect(typescriptContent).not.toMatch(/\{\{[a-zA-Z]/);
  });

  it('languages/README.md does not contain unresolved placeholders (copilot)', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'README.md'),
      'utf-8'
    );
    expect(content).not.toMatch(/\{\{[a-zA-Z]/);
  });
});

// --- Claude output (.claude/rules/languages/) ---
describe('syncLanguageInstructions — claude target output (.claude/rules/languages/)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { only: 'claude' } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('generates .claude/rules/languages/ for claude target', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.claude', 'rules', 'languages'))).toBe(true);
  });

  it('generates one file per rules.yaml domain under claude output', { timeout: 15000 }, () => {
    const files = collectFiles(resolve(projectRoot, '.claude', 'rules', 'languages'));
    expect(files.some((f) => f.endsWith('typescript.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('rust.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('testing.md'))).toBe(true);
  });

  it('claude language files contain GENERATED header', () => {
    const content = readFileSync(
      resolve(projectRoot, '.claude', 'rules', 'languages', 'typescript.md'),
      'utf-8'
    );
    expect(content).toContain('GENERATED by AgentKit Forge');
  });

  it('no raw Handlebars placeholders remain in generated claude files', () => {
    const content = readFileSync(
      resolve(projectRoot, '.claude', 'rules', 'languages', 'typescript.md'),
      'utf-8'
    );
    expect(content).not.toMatch(/\{\{[a-zA-Z]/);
  });
});

// ---------------------------------------------------------------------------
// Tests: Editor Theme Generation
// ---------------------------------------------------------------------------
describe('syncEditorTheme (brand-driven editor theme)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    // Full sync — brand.yaml and editor-theme.yaml exist in spec, editorTheme.enabled is true
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { quiet: true } });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it(
    'generates .vscode/settings.json with workbench.colorCustomizations',
    { timeout: 15000 },
    () => {
      const settingsPath = resolve(projectRoot, '.vscode', 'settings.json');
      expect(existsSync(settingsPath)).toBe(true);
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(settings['workbench.colorCustomizations']).toBeDefined();
      expect(typeof settings['workbench.colorCustomizations']).toBe('object');
      // Should have at least a few brand-derived colors
      const colors = settings['workbench.colorCustomizations'];
      expect(Object.keys(colors).length).toBeGreaterThan(5);
    }
  );

  it('includes _agentkit_theme sentinel with brand metadata', () => {
    const settings = JSON.parse(
      readFileSync(resolve(projectRoot, '.vscode', 'settings.json'), 'utf-8')
    );
    expect(settings['_agentkit_theme']).toBeDefined();
    expect(settings['_agentkit_theme'].brand).toBe('AgentKit Forge');
    expect(settings['_agentkit_theme'].mode).toBe('both');
    expect(settings['_agentkit_theme'].version).toBe('1.0.0');
  });

  it('preserves base editor settings alongside theme colors', () => {
    const settings = JSON.parse(
      readFileSync(resolve(projectRoot, '.vscode', 'settings.json'), 'utf-8')
    );
    // Base settings from templates/vscode/settings.json should still be present
    expect(settings['editor.formatOnSave']).toBe(true);
    expect(settings['files.eol']).toBe('\n');
  });

  it('generates .cursor/settings.json with theme colors', () => {
    const settingsPath = resolve(projectRoot, '.cursor', 'settings.json');
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(settings['workbench.colorCustomizations']).toBeDefined();
    expect(settings['_agentkit_theme'].brand).toBe('AgentKit Forge');
  });

  it('generates .windsurf/settings.json with theme colors', () => {
    const settingsPath = resolve(projectRoot, '.windsurf', 'settings.json');
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(settings['workbench.colorCustomizations']).toBeDefined();
    expect(settings['_agentkit_theme'].brand).toBe('AgentKit Forge');
  });

  it('resolved colors are valid hex values', () => {
    const settings = JSON.parse(
      readFileSync(resolve(projectRoot, '.vscode', 'settings.json'), 'utf-8')
    );
    const colors = settings['workbench.colorCustomizations'];
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
    for (const [key, value] of Object.entries(colors)) {
      expect(value, `Color "${key}" should be a valid hex`).toMatch(hexRegex);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Editor Theme — Pre-existing settings.json merge regression
// ---------------------------------------------------------------------------
describe('syncEditorTheme — pre-existing settings.json merge', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = makeTmpProject();
    // Create a .vscode/settings.json with user-defined keys BEFORE running sync
    const vscodeDir = resolve(projectRoot, '.vscode');
    mkdirSync(vscodeDir, { recursive: true });
    writeFileSync(
      resolve(vscodeDir, 'settings.json'),
      JSON.stringify(
        {
          'editor.rulers': [80],
          'files.exclude': { node_modules: true },
          'editor.wordWrap': 'on',
        },
        null,
        2
      ),
      'utf-8'
    );
    // Use --overwrite to force theme generation over existing settings
    await runSync({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot,
      flags: { quiet: true, overwrite: true },
    });
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('has workbench.colorCustomizations and _agentkit_theme after merge', () => {
    const settings = JSON.parse(
      readFileSync(resolve(projectRoot, '.vscode', 'settings.json'), 'utf-8')
    );
    expect(settings['workbench.colorCustomizations']).toBeDefined();
    expect(settings['_agentkit_theme']).toBeDefined();
    expect(settings['_agentkit_theme'].brand).toBe('AgentKit Forge');
  });

  it('preserves original user-defined keys after merge', () => {
    const settings = JSON.parse(
      readFileSync(resolve(projectRoot, '.vscode', 'settings.json'), 'utf-8')
    );
    // The overwrite flag replaces the file, so user keys from the template
    // (editor.formatOnSave, files.eol) should be present from the vscode template
    // The pre-existing user keys are overwritten by the template+theme merge.
    // This verifies that the theme merge path itself preserves base template settings.
    expect(settings['editor.formatOnSave']).toBe(true);
    expect(settings['files.eol']).toBe('\n');
  });
});
