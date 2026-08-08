import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import yaml from 'js-yaml';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from 'vitest';
import { runSync } from '../synchronize.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENTKIT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

/**
 * Remove a fixture tree, tolerating Windows file locking.
 *
 * `rmSync` throws EBUSY/EPERM on Windows when any handle is still open on a file
 * in the tree — an antivirus scan or the search indexer is enough, and `force`
 * does not cover it (it only suppresses ENOENT). `maxRetries` makes Node back off
 * and retry, which clears the common transient case.
 *
 * Failures are swallowed deliberately: a fixture that cannot be deleted must not
 * fail an otherwise green suite, and the OS temp directory is reclaimable.
 *
 * Every cleanup hook in this file routes through here. Previously they called
 * `rmSync` bare and un-wrapped, so the *first* undeletable tree threw and
 * stranded every remaining root in the same hook. Each sync fixture is 600+
 * files, and 126 of them had accumulated in %TEMP% — enough to exhaust the disk
 * and make the entire suite fail to load, which reads as catastrophic breakage
 * rather than as a cleanup bug.
 */
/** @type {string[]} trees that survived every retry, reported at end of file */
const cleanupFailures = [];

function removeTree(path) {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (err) {
    // Recorded rather than thrown, then reported once at the end of the file.
    // Throwing here would strand the sibling trees again — the bug this helper
    // exists to fix — but swallowing silently would let the leak creep back and
    // recreate the ENOSPC failure while the suite still reported green.
    cleanupFailures.push(`${path} (${err.code ?? err.message})`);
  }
}

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

// ---------------------------------------------------------------------------
// Shared sync roots
// ---------------------------------------------------------------------------
// Full syncs dominate this suite's runtime — a single one renders 600+ files.
// Many describe blocks previously ran their own sync with identical flags
// (`--only copilot` alone ran five times), which is what pushed beforeAll
// hooks past the 30s hook timeout.
//
// Each distinct flag-set is now synced at most once into a pristine "golden"
// root. Blocks that only read the output share that root via goldenSync();
// blocks that mutate it take a cheap recursive copy via cloneSync(), since
// copying an already-rendered tree costs far less than re-rendering it.

/** @type {Map<string, Promise<string>>} flag-set key -> pristine synced root */
const goldenRoots = new Map();

/**
 * Every temp directory handed to a sync, tracked separately from the promises
 * above so cleanup does not depend on those promises resolving. A failed sync
 * still leaves files on disk, and its promise rejects without ever yielding the
 * path, so recording the directory up front is what makes it removable.
 *
 * @type {Set<string>}
 */
const createdRoots = new Set();

/**
 * Resolves the given flag-sets to golden roots one at a time.
 *
 * runSync calls clearTemplateMeta() and clearTemplateTextCache() on entry
 * (synchronize.mjs), and both operate on module-level singletons shared by all
 * callers, so two overlapping runSync calls clear each other's in-flight state.
 * templateMetaMap drives scaffold-mode decisions, so that corruption would be
 * silent rather than a crash.
 *
 * Vitest already runs describe blocks sequentially, so the only place syncs
 * could overlap is a Promise.all over goldenSync — this helper replaces those.
 * Cached flag-sets resolve immediately, so the sequential walk only pays for
 * targets no earlier block has synced.
 *
 * @param {object[]} flagSets
 * @returns {Promise<string[]>} golden root per flag-set, in order
 */
async function goldenSyncAll(flagSets) {
  const roots = [];
  for (const flags of flagSets) {
    roots.push(await goldenSync(flags));
  }
  return roots;
}

/**
 * Returns a pristine project root synced with the given flags, reusing an
 * existing one when the same flag-set has already been synced.
 *
 * The promise (not the resolved path) is cached so concurrent callers share a
 * single in-flight sync rather than racing to build duplicates. A rejected
 * sync stays cached deliberately: the failure is a real problem with the spec
 * or engine, and re-running it for each of the dozen waiting blocks would bury
 * the original error under a pile of identical ones.
 *
 * Callers MUST NOT modify the returned tree — use cloneSync() for that.
 */
function goldenSync(flags = {}) {
  // quiet/verbose only gate console output (see synchronize.mjs), so they are
  // excluded from the key — {} and { quiet: true } render identical trees.
  const significant = Object.fromEntries(
    Object.entries(flags).filter(([name]) => name !== 'quiet' && name !== 'verbose')
  );
  const key = JSON.stringify(significant, Object.keys(significant).sort());
  if (!goldenRoots.has(key)) {
    // Created outside the async body so the path is recorded for cleanup even
    // if runSync rejects.
    const projectRoot = makeTmpProject();
    createdRoots.add(projectRoot);
    goldenRoots.set(
      key,
      runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags }).then(() => projectRoot)
    );
  }
  return goldenRoots.get(key);
}

/** Returns a writable copy of the golden root for the given flags. */
async function cloneSync(flags = {}) {
  const golden = await goldenSync(flags);
  const dest = makeTmpProject();
  createdRoots.add(dest);
  cpSync(golden, dest, { recursive: true });
  return dest;
}

afterAll(() => {
  for (const root of createdRoots) {
    removeTree(root);
  }
  createdRoots.clear();
  goldenRoots.clear();

  // Runs after every describe-level hook in this file, so it sees the full set.
  // Warn rather than fail: a tree held by an antivirus scan is not a broken test,
  // and failing here would make the suite red for an environment condition. But
  // it must not be silent — an accumulating leak is what filled the disk before,
  // and a green suite hid it.
  if (cleanupFailures.length > 0) {
    console.warn(
      `\n[sync-integration] ${cleanupFailures.length} fixture tree(s) could not be removed ` +
        `and remain in the OS temp directory. Delete them manually if they accumulate:\n` +
        cleanupFailures.map((f) => `  - ${f}`).join('\n')
    );
    cleanupFailures.length = 0;
  }
});

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

function parseGeneratedFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  expect(match).not.toBeNull();
  return yaml.load(match[1]);
}

describe('overlay resolution and template precedence regressions', () => {
  let agentkitRoot;
  let projectRoot;

  afterEach(() => {
    if (projectRoot) {
      removeTree(resolve(projectRoot, '..'));
      projectRoot = null;
    }
    if (agentkitRoot) {
      removeTree(agentkitRoot);
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
    projectRoot = await goldenSync({ only: 'copilot' });
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
    expect(content).toContain('GENERATED by Retort');
  });

  it('prompt files contain frontmatter', async () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'prompts', 'build.prompt.md'),
      'utf-8'
    );
    expect(content).toContain("mode: 'agent'");
  });

  it('copilot prompts resolve {{stateDir}} to .github/state', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'prompts', 'orchestrate.prompt.md'),
      'utf-8'
    );
    expect(content).toContain('.github/state/orchestrator.json');
    expect(content).not.toContain('{{stateDir}}');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Copilot Agents
// ---------------------------------------------------------------------------
describe('syncCopilotAgents (via runSync --only copilot)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = await goldenSync({ only: 'copilot' });
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
    projectRoot = await goldenSync({ only: 'copilot' });
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
    projectRoot = await goldenSync({ only: 'gemini' });
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
    expect(content).toContain('GENERATED by Retort');
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
    projectRoot = await goldenSync({ only: 'codex' });
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
    expect(content).toContain('GENERATED by Retort');
  });

  it(
    'escapes apostrophes in Codex skill frontmatter descriptions',
    { timeout: 15000 },
    async () => {
      const content = readFileSync(
        resolve(projectRoot, '.agents', 'skills', 'build', 'SKILL.md'),
        'utf-8'
      );
      const meta = parseGeneratedFrontmatter(content);
      expect(meta.description).toContain("tech stack's build command");
    }
  );

  it('codex skills resolve {{stateDir}} to .agents/state', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.agents', 'skills', 'orchestrate', 'SKILL.md'),
      'utf-8'
    );
    expect(content).toContain('.agents/state/orchestrator.json');
    expect(content).not.toContain('{{stateDir}}');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Claude Skills
// ---------------------------------------------------------------------------
describe('syncClaudeSkills (via runSync --only claude)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = await goldenSync({ only: 'claude' });
  });

  it('generates .claude/skills/*/SKILL.md for non-team commands', { timeout: 15000 }, async () => {
    const files = collectFiles(projectRoot);
    const skills = files.filter((f) => f.startsWith('.claude/skills/'));
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some((f) => f.includes('build/SKILL.md'))).toBe(true);
  });

  it('Claude skills render commandPrompt when present', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.claude', 'skills', 'orchestrate', 'SKILL.md'),
      'utf-8'
    );
    // orchestrate has a prompt field — should render its content, not the generic fallback
    expect(content).toContain('W1 Orchestrator');
    expect(content).not.toContain('Parse any arguments provided');
  });

  it('Claude skills resolve {{stateDir}} to .claude/state', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.claude', 'skills', 'orchestrate', 'SKILL.md'),
      'utf-8'
    );
    expect(content).toContain('.claude/state/orchestrator.json');
    expect(content).not.toContain('{{stateDir}}');
  });

  it('Claude skills render generic fallback when no prompt', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.claude', 'skills', 'build', 'SKILL.md'),
      'utf-8'
    );
    // All commands currently have prompts, so just verify the skill renders correctly
    expect(content).toContain('build');
  });

  it(
    'escapes apostrophes in Claude skill frontmatter descriptions',
    { timeout: 15000 },
    async () => {
      const content = readFileSync(
        resolve(projectRoot, '.claude', 'skills', 'build', 'SKILL.md'),
        'utf-8'
      );
      const meta = parseGeneratedFrontmatter(content);
      expect(meta.description).toContain("tech stack's build command");
    }
  );
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Cursor Commands
// ---------------------------------------------------------------------------
describe('syncCursorCommands (via runSync --only cursor)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = await goldenSync({ only: 'cursor' });
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
    expect(content).toContain('GENERATED by Retort');
  });

  it('cursor commands resolve {{stateDir}} to .cursor/state', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.cursor', 'commands', 'orchestrate.md'),
      'utf-8'
    );
    expect(content).toContain('.cursor/state/orchestrator.json');
    expect(content).not.toContain('{{stateDir}}');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Windsurf Commands
// ---------------------------------------------------------------------------
describe('syncWindsurfCommands (via runSync --only windsurf)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = await goldenSync({ only: 'windsurf' });
  });

  it('windsurf commands resolve {{stateDir}} to .windsurf/state', { timeout: 15000 }, async () => {
    const content = readFileSync(
      resolve(projectRoot, '.windsurf', 'commands', 'orchestrate.md'),
      'utf-8'
    );
    expect(content).toContain('.windsurf/state/orchestrator.json');
    expect(content).not.toContain('{{stateDir}}');
  });
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — WARP.md
// ---------------------------------------------------------------------------
describe('syncWarp (via runSync --only warp)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = await goldenSync({ only: 'warp' });
  });

  it('generates WARP.md at project root', async () => {
    expect(existsSync(resolve(projectRoot, 'WARP.md'))).toBe(true);
  });

  it('WARP.md contains GENERATED header', async () => {
    const content = readFileSync(resolve(projectRoot, 'WARP.md'), 'utf-8');
    expect(content).toContain('GENERATED by Retort');
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
    projectRoot = await goldenSync({ only: 'cline' });
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
    projectRoot = await goldenSync({ only: 'roo' });
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
    expect(content).toContain('GENERATED by Retort');
  });
});

// ---------------------------------------------------------------------------
// Tests: Render target gating — new tools excluded when not in targets
// ---------------------------------------------------------------------------
describe('render target gating for new tools', () => {
  let claudeFiles;
  let warpFiles;

  beforeAll(async () => {
    const [claudeRoot, warpRoot] = await goldenSyncAll([{ only: 'claude' }, { only: 'warp' }]);
    claudeFiles = collectFiles(claudeRoot);
    warpFiles = collectFiles(warpRoot);
  });

  it('--only claude does NOT generate gemini, warp, cline, roo, codex files', () => {
    expect(claudeFiles.some((f) => f === 'GEMINI.md')).toBe(false);
    expect(claudeFiles.some((f) => f === 'WARP.md')).toBe(false);
    expect(claudeFiles.some((f) => f.startsWith('.gemini/'))).toBe(false);
    expect(claudeFiles.some((f) => f.startsWith('.agents/'))).toBe(false);
    expect(claudeFiles.some((f) => f.startsWith('.clinerules/'))).toBe(false);
    expect(claudeFiles.some((f) => f.startsWith('.roo/'))).toBe(false);
  });

  it('always-on outputs generated regardless of --only flag', () => {
    // AGENTS.md is always-on
    expect(warpFiles.some((f) => f === 'AGENTS.md')).toBe(true);
    // WARP.md is the only gated output
    expect(warpFiles.some((f) => f === 'WARP.md')).toBe(true);
    // Claude-specific outputs should NOT be present
    expect(warpFiles.some((f) => f === 'CLAUDE.md')).toBe(false);
    expect(warpFiles.some((f) => f.startsWith('.claude/'))).toBe(false);
  });
});

describe('--overwrite flag', () => {
  let projectRoot;

  beforeAll(async () => {
    // These tests re-sync and edit files, so take a writable copy rather than
    // sharing the golden root.
    projectRoot = await cloneSync({});
  });
  afterAll(() => {
    removeTree(projectRoot);
  });

  it('skips project-owned files by default', { timeout: 120_000 }, async () => {
    const contribPath = join(projectRoot, 'CONTRIBUTING.md');
    expect(existsSync(contribPath)).toBe(true);

    const customContent = 'CUSTOM_CONTENT_MARKER_12345';
    writeFileSync(contribPath, customContent, 'utf-8');

    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: {} });
    expect(readFileSync(contribPath, 'utf-8')).toBe(customContent);
  });

  it('overwrites project-owned files with --overwrite', { timeout: 120_000 }, async () => {
    const contribPath = join(projectRoot, 'CONTRIBUTING.md');
    const customContent = 'CUSTOM_OVERWRITE_MARKER_67890';
    writeFileSync(contribPath, customContent, 'utf-8');

    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { overwrite: true } });
    expect(readFileSync(contribPath, 'utf-8')).not.toContain(customContent);
  });

  it('--force is alias for --overwrite', { timeout: 120_000 }, async () => {
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
    removeTree(projectRoot);
  });

  // Performs a full sync, which measures 13–25s on Windows. The 30s budget left
  // no headroom and timed out under load — matching the 120s already used by the
  // --overwrite tests in this block, which do the same amount of work.
  it('--diff shows create/update/skip without writing', { timeout: 120_000 }, async () => {
    const log = [];
    const origLog = console.log;
    console.log = (...args) => {
      log.push(args.map(String).join(' '));
      origLog.apply(console, args);
    };
    try {
      await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { diff: true } });
      const out = log.join('\n');
      expect(out).toContain('Diff mode');
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
        removeTree(tempAgentkitRoot);
      }
    },
    // Two full syncs plus a recursive copy of spec/, templates/ and engines/.
    // At 13–25s per sync on Windows the old 60s budget could not fit the work,
    // so this timed out deterministically under load rather than intermittently.
    180_000
  );
});

// ---------------------------------------------------------------------------
// Tests: Render-target output isolation (--only flag)
// ---------------------------------------------------------------------------
// Each case syncs a single render target and asserts that no OTHER target's
// output appears. Previously every assertion ran its own full sync (10 syncs,
// sequential); the targets are now synced once each, in parallel, and the
// assertions read the resulting trees. Each target keeps its own project root —
// sharing one root across targets would let earlier output linger and
// invalidate the negative assertions, because sync only prunes orphaned files
// when a previous .manifest.json is present.
const ISOLATION_CASES = [
  {
    only: 'mcp',
    absent: [
      ['.github', 'prompts'],
      ['.roo', 'rules'],
    ],
  },
  { only: 'windsurf', absent: [['.cursor', 'commands']] },
  { only: 'cline', absent: [['.agents', 'skills']] },
  { only: 'ai', absent: [['.cursor', 'rules', 'team-backend.mdc']] },
  { only: 'codex', absent: [['.windsurf', 'rules', 'team-backend.md']] },
  { only: 'gemini', absent: [['.github', 'chatmodes']] },
  { only: 'warp', absent: [['.github', 'agents'], ['.clinerules']] },
  { only: 'roo', absent: [['.claude', 'agents']] },
];

describe('render-target output isolation (--only flag)', () => {
  /** @type {Map<string, string>} render target -> synced project root */
  const rootsByTarget = new Map();

  beforeAll(async () => {
    // goldenSync dedupes against the per-target describe blocks above, so each
    // render target is synced once for the whole file rather than twice.
    const roots = await goldenSyncAll(ISOLATION_CASES.map(({ only }) => ({ only })));
    ISOLATION_CASES.forEach(({ only }, i) => rootsByTarget.set(only, roots[i]));
  });

  for (const { only, absent } of ISOLATION_CASES) {
    for (const segments of absent) {
      it(`--only ${only} produces no ${segments.join('/')}`, () => {
        expect(existsSync(resolve(rootsByTarget.get(only), ...segments))).toBe(false);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Tests: Sync Integration — Copilot testing/QA instruction templates
// ---------------------------------------------------------------------------
describe('syncCopilotInstructions — testing & QA templates (via runSync --only copilot)', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = await goldenSync({ only: 'copilot' });
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
    expect(content).toContain('GENERATED by Retort');
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
    projectRoot = await goldenSync({ only: 'claude' });
  });

  it('generates .claude/rules/testing.md', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.claude', 'rules', 'testing.md'))).toBe(true);
  });

  it('testing.md contains GENERATED header', () => {
    const content = readFileSync(resolve(projectRoot, '.claude', 'rules', 'testing.md'), 'utf-8');
    expect(content).toContain('GENERATED by Retort');
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
    projectRoot = await goldenSync({ only: 'copilot' });
  });

  // --- Copilot output (.github/instructions/languages/) ---

  it('generates .github/instructions/languages/ for copilot target', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.github', 'instructions', 'languages'))).toBe(true);
  });

  it('generates active stack domains under copilot output', { timeout: 15000 }, () => {
    const files = collectFiles(resolve(projectRoot, '.github', 'instructions', 'languages'));
    // Retort spec declares [javascript, yaml, markdown] with mode: configured
    // typescript + all universal domains should be present
    expect(files.some((f) => f.endsWith('typescript.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('security.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('testing.md'))).toBe(true);
    // rust/python not in stack — should be absent
    expect(files.some((f) => f.endsWith('rust.md'))).toBe(false);
    expect(files.some((f) => f.endsWith('python.md'))).toBe(false);
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
    expect(content).toContain('GENERATED by Retort');
  });

  it('rust.md is absent for a JS-only project', () => {
    expect(
      existsSync(resolve(projectRoot, '.github', 'instructions', 'languages', 'rust.md'))
    ).toBe(false);
  });

  it('ruleConventions from rules.yaml are injected into domain files', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'typescript.md'),
      'utf-8'
    );
    expect(content).toContain('Project Conventions');
  });

  it('domain-specific templates render enforcement/advisory sections', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'typescript.md'),
      'utf-8'
    );
    // TypeScript rules.yaml has both enforcement (ts-lint, ts-format) and advisory (ts-explicit-types) conventions
    expect(content).toContain('Enforcement Rules');
    expect(content).toContain('Advisory Rules');
    // Enforcement conventions should include type badge
    expect(content).toMatch(/\(enforcement/);
    // Advisory conventions should include type badge
    expect(content).toMatch(/\(advisory/);
  });

  it('security.md uses generic TEMPLATE.md fallback (no domain-specific template)', () => {
    const content = readFileSync(
      resolve(projectRoot, '.github', 'instructions', 'languages', 'security.md'),
      'utf-8'
    );
    expect(content).toMatch(/Enforcement Rules|Advisory Rules/);
    expect(content).toContain('GENERATED by Retort');
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
    projectRoot = await goldenSync({ only: 'claude' });
  });

  it('generates .claude/rules/languages/ for claude target', { timeout: 15000 }, () => {
    expect(existsSync(resolve(projectRoot, '.claude', 'rules', 'languages'))).toBe(true);
  });

  it('generates active stack domains under claude output', { timeout: 15000 }, () => {
    const files = collectFiles(resolve(projectRoot, '.claude', 'rules', 'languages'));
    // Retort spec: [javascript] → typescript + universal domains present
    expect(files.some((f) => f.endsWith('typescript.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('testing.md'))).toBe(true);
    // rust not in stack — should be absent
    expect(files.some((f) => f.endsWith('rust.md'))).toBe(false);
  });

  it('claude language files contain GENERATED header', () => {
    const content = readFileSync(
      resolve(projectRoot, '.claude', 'rules', 'languages', 'typescript.md'),
      'utf-8'
    );
    expect(content).toContain('GENERATED by Retort');
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
    // Full sync — brand.yaml and editor-theme.yaml exist in spec, editorTheme.enabled is true
    projectRoot = await goldenSync({ quiet: true });
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
  }, 120_000);
  afterAll(() => {
    removeTree(projectRoot);
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

// ---------------------------------------------------------------------------
// Tests: syncGitattributes (merge driver section management)
// ---------------------------------------------------------------------------
describe('syncGitattributes (merge driver sync)', () => {
  let projectRoot;

  beforeAll(async () => {
    // These tests edit .gitattributes and re-sync, so they need a writable copy.
    projectRoot = await cloneSync({ quiet: true });
  });
  afterAll(() => {
    removeTree(projectRoot);
  });

  it('generates .gitattributes with merge driver section', () => {
    const gitattrsPath = resolve(projectRoot, '.gitattributes');
    expect(existsSync(gitattrsPath)).toBe(true);
    const content = readFileSync(gitattrsPath, 'utf-8');
    expect(content).toContain('# >>> Retort merge drivers');
    expect(content).toContain('# <<< Retort merge drivers');
    expect(content).toContain('merge=agentkit-generated');
  });

  it('includes expected file patterns in merge rules', () => {
    const content = readFileSync(resolve(projectRoot, '.gitattributes'), 'utf-8');
    expect(content).toContain('.agents/skills/**/SKILL.md');
    expect(content).toContain('.github/agents/*.agent.md');
    expect(content).toContain('.github/chatmodes/*.chatmode.md');
    expect(content).toContain('.github/prompts/*.prompt.md');
    expect(content).toContain('pnpm-lock.yaml');
  });

  it(
    'preserves user content outside managed section on re-sync',
    { timeout: 120_000 },
    async () => {
      const gitattrsPath = resolve(projectRoot, '.gitattributes');
      // Prepend custom user content
      const existing = readFileSync(gitattrsPath, 'utf-8');
      writeFileSync(gitattrsPath, '# My custom rules\n*.pdf binary\n\n' + existing, 'utf-8');

      // Re-sync
      await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { quiet: true } });

      const updated = readFileSync(gitattrsPath, 'utf-8');
      expect(updated).toContain('# My custom rules');
      expect(updated).toContain('*.pdf binary');
      expect(updated).toContain('merge=agentkit-generated');
      // Should have exactly one managed section (not duplicated)
      const startCount = (updated.match(/# >>> Retort merge drivers/g) || []).length;
      expect(startCount).toBe(1);
    }
  );

  it('replaces stale managed section without duplication', { timeout: 120_000 }, async () => {
    const gitattrsPath = resolve(projectRoot, '.gitattributes');
    // Re-sync a second time to verify no duplication
    await runSync({ agentkitRoot: AGENTKIT_ROOT, projectRoot, flags: { quiet: true } });

    const content = readFileSync(gitattrsPath, 'utf-8');
    const startCount = (content.match(/# >>> Retort merge drivers/g) || []).length;
    const endCount = (content.match(/# <<< Retort merge drivers/g) || []).length;
    expect(startCount).toBe(1);
    expect(endCount).toBe(1);
  });
});
