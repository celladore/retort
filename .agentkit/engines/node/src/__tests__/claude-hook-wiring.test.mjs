/**
 * Regression fixture for #185 — hook wiring in `.claude/settings.json` must
 * never name a hook script that feature gating prevents sync from emitting.
 *
 * Wiring is built from the `hooks:` block in settings.yaml (#575), while
 * `syncClaudeHooks()` skips any hook whose owning feature is disabled. The two
 * are reconciled by `filterHooksToEmitted()`.
 *
 * The converse invariant is asserted here too: a hook template that ships must
 * not be left unwired. A dangling reference errors when its event fires, but an
 * orphan is silent — which is how five `.ps1` hooks shipped wired to nothing.
 *
 * The gating scenarios below are derived from the real `features.yaml`
 * `affectsTemplates` declarations rather than hardcoded, so that re-homing a
 * hook under a different feature fails here instead of silently shipping a
 * dangling reference. All three gating features default to `true`, which is why
 * retort's own generated output was always clean and this defect survived
 * unnoticed — the synthetic scenarios are the only thing that exercises it.
 */
import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load as loadYaml } from 'js-yaml';
import {
  buildHooksFromSpec,
  collectHookExtensions,
  isWindowsFirst,
  extractHookFiles,
  extractHookStems,
  filterHooksToEmitted,
  isHookEmitted,
  syncClaudeHooks,
} from '../platform-syncer.mjs';
import { buildHookFeatureMap, loadFeatureSpec } from '../feature-manager.mjs';
import { runValidate } from '../validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const SETTINGS_SPEC = resolve(AGENTKIT_ROOT, 'spec', 'settings.yaml');
const HOOK_TEMPLATE_DIR = resolve(AGENTKIT_ROOT, 'templates', 'claude', 'hooks');
const TEST_TMP = resolve(AGENTKIT_ROOT, '..', '.test-tmp');

/**
 * Hook feature map + the hook wiring as it really ships. Wiring is built from
 * settings.yaml rather than read from a fixture so that adding or re-homing a
 * hook in the spec is exercised here immediately.
 */
function realFixtures() {
  const { features } = loadFeatureSpec(AGENTKIT_ROOT, { log: () => {} });
  const spec = loadYaml(readFileSync(SETTINGS_SPEC, 'utf-8'));
  return { hookFeatureMap: buildHookFeatureMap(features), hooks: buildHooksFromSpec(spec.hooks) };
}

/** Every hook stem referenced by a settings.hooks tree. */
function referencedStems(hooks) {
  const out = new Set();
  for (const matchers of Object.values(hooks || {})) {
    for (const matcher of matchers) {
      for (const hook of matcher.hooks || []) {
        for (const stem of extractHookStems(hook.command)) out.add(stem);
      }
    }
  }
  return out;
}

const cmd = (stem, ext = 'sh') => `"$CLAUDE_PROJECT_DIR"/.claude/hooks/${stem}.${ext}`;

// ---------------------------------------------------------------------------
// extractHookStems
// ---------------------------------------------------------------------------

describe('extractHookFiles()', () => {
  it('should keep the extension so callers can check the exact file', () => {
    expect([...extractHookFiles(cmd('warn-uncommitted'))]).toEqual(['warn-uncommitted.sh']);
  });

  it('should return both extensions when a command names a .ps1 and a .sh', () => {
    // Arrange — unlike stems, these stay distinct: both files must exist
    const command = `pwsh -NoLogo -File ${cmd('session-start', 'ps1')} || ${cmd('session-start')}`;

    // Act + Assert
    expect([...extractHookFiles(command)].sort()).toEqual([
      'session-start.ps1',
      'session-start.sh',
    ]);
  });

  it('should return an empty set for a command that invokes no hook script', () => {
    expect([...extractHookFiles('echo hi')]).toEqual([]);
    expect([...extractHookFiles(null)]).toEqual([]);
  });
});

describe('extractHookStems()', () => {
  it('should extract the hook stem from a plain command', () => {
    expect([...extractHookStems(cmd('warn-uncommitted'))]).toEqual(['warn-uncommitted']);
  });

  it('should collapse a .ps1 command and its .sh fallback to a single stem', () => {
    // Arrange — the real SessionStart command names both extensions
    const command = `pwsh -NoLogo -File ${cmd('session-start', 'ps1')} || ${cmd('session-start')}`;

    // Act
    const stems = extractHookStems(command);

    // Assert
    expect([...stems]).toEqual(['session-start']);
  });

  it('should extract every distinct stem when a command chains two hooks', () => {
    const command = `${cmd('protect-sensitive')} && ${cmd('protect-templates')}`;

    expect([...extractHookStems(command)].sort()).toEqual([
      'protect-sensitive',
      'protect-templates',
    ]);
  });

  it('should return an empty set for a command that invokes no hook script', () => {
    expect([...extractHookStems('echo "no hooks here"')]).toEqual([]);
  });

  it('should return an empty set for a missing command rather than throwing', () => {
    expect([...extractHookStems(undefined)]).toEqual([]);
    expect([...extractHookStems(null)]).toEqual([]);
  });

  it('should ignore a hook path with an unrecognised extension', () => {
    expect([...extractHookStems('"$CLAUDE_PROJECT_DIR"/.claude/hooks/notes.md')]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isHookEmitted
// ---------------------------------------------------------------------------

describe('isHookEmitted()', () => {
  it('should emit a hook that no feature claims', () => {
    const map = { specific: {}, defaultFeature: null };

    expect(isHookEmitted('unclaimed', map, {})).toBe(true);
  });

  it('should emit a claimed hook while its owning feature is enabled', () => {
    const map = { specific: { 'stop-build-check': 'quality-gates' }, defaultFeature: null };

    expect(isHookEmitted('stop-build-check', map, { feature_quality_gates: true })).toBe(true);
  });

  it('should skip a claimed hook when its owning feature is disabled', () => {
    const map = { specific: { 'stop-build-check': 'quality-gates' }, defaultFeature: null };

    expect(isHookEmitted('stop-build-check', map, { feature_quality_gates: false })).toBe(false);
  });

  it('should fall back to the directory-level feature for an unclaimed hook', () => {
    // Arrange — `claude/hooks/` claimed by permission-guards gates everything
    // not claimed more specifically
    const map = {
      specific: { 'stop-build-check': 'quality-gates' },
      defaultFeature: 'permission-guards',
    };

    // Act + Assert — the specific claim wins over the directory default
    expect(isHookEmitted('warn-uncommitted', map, { feature_permission_guards: false })).toBe(
      false
    );
    expect(isHookEmitted('stop-build-check', map, { feature_permission_guards: false })).toBe(true);
  });

  it('should treat an absent hookFeatureMap as no gating', () => {
    expect(isHookEmitted('anything', undefined, {})).toBe(true);
    expect(isHookEmitted('anything', null, {})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildHooksFromSpec
// ---------------------------------------------------------------------------

describe('buildHooksFromSpec()', () => {
  it('should invoke sessionStart via pwsh with a shell fallback', () => {
    // Arrange — the one hook wired cross-platform; the rest are .sh
    const built = buildHooksFromSpec({ sessionStart: 'session-start' });

    // Act
    const { command } = built.SessionStart[0].hooks[0];

    // Assert
    expect(command).toBe(
      'pwsh -NoLogo -NoProfile -NonInteractive -File "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.ps1 || "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh'
    );
  });

  it('should invoke stop as a plain shell hook with no matcher', () => {
    const built = buildHooksFromSpec({ stop: 'stop-build-check' });

    expect(built.Stop).toEqual([
      {
        hooks: [
          {
            type: 'command',
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/stop-build-check.sh',
          },
        ],
      },
    ]);
  });

  it('should carry the matcher through for each pre/post tool-use entry', () => {
    // Arrange
    const built = buildHooksFromSpec({
      preToolUse: [{ matcher: 'Bash', hook: 'guard-destructive-commands' }],
      postToolUse: [{ matcher: 'Write|Edit', hook: 'warn-uncommitted' }],
    });

    // Assert
    expect(built.PreToolUse[0].matcher).toBe('Bash');
    expect(built.PreToolUse[0].hooks[0].command).toContain('guard-destructive-commands.sh');
    expect(built.PostToolUse[0].matcher).toBe('Write|Edit');
  });

  it('should preserve the order the spec declares', () => {
    const built = buildHooksFromSpec({
      preToolUse: [
        { matcher: 'Bash', hook: 'first' },
        { matcher: 'Bash', hook: 'second' },
      ],
    });

    expect(built.PreToolUse.map((m) => m.hooks[0].command)).toEqual([
      '"$CLAUDE_PROJECT_DIR"/.claude/hooks/first.sh',
      '"$CLAUDE_PROJECT_DIR"/.claude/hooks/second.sh',
    ]);
  });

  it('should emit events in a stable SessionStart/Pre/Post/Stop order', () => {
    const built = buildHooksFromSpec({
      stop: 'stop-build-check',
      postToolUse: [{ matcher: 'Write', hook: 'warn-uncommitted' }],
      preToolUse: [{ matcher: 'Bash', hook: 'guard-destructive-commands' }],
      sessionStart: 'session-start',
    });

    expect(Object.keys(built)).toEqual(['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop']);
  });

  it('should not double the extension when the spec names one', () => {
    // Arrange — the spec names hooks by stem, but tolerate an extension
    const built = buildHooksFromSpec({
      sessionStart: 'session-start.sh',
      preToolUse: [{ matcher: 'Bash', hook: 'guard-destructive-commands.ps1' }],
    });

    // Assert
    expect(built.SessionStart[0].hooks[0].command).not.toContain('.sh.sh');
    expect(built.SessionStart[0].hooks[0].command).toContain('session-start.ps1 ||');
    expect(built.PreToolUse[0].hooks[0].command).toBe(
      '"$CLAUDE_PROJECT_DIR"/.claude/hooks/guard-destructive-commands.sh'
    );
  });

  it('should omit the matcher key entirely when the spec sets none', () => {
    // Arrange — an undefined matcher would vanish in JSON.stringify anyway;
    // omitting it explicitly keeps the object and its serialized form the same
    const built = buildHooksFromSpec({ preToolUse: [{ hook: 'guard-destructive-commands' }] });

    // Assert
    expect(built.PreToolUse[0]).not.toHaveProperty('matcher');
    expect(JSON.parse(JSON.stringify(built.PreToolUse[0]))).toEqual(built.PreToolUse[0]);
  });

  it('should skip entries that name no hook', () => {
    const built = buildHooksFromSpec({
      sessionStart: '   ',
      preToolUse: [{ matcher: 'Bash' }, null, { matcher: 'Bash', hook: 'kept' }],
    });

    expect(built).not.toHaveProperty('SessionStart');
    expect(built.PreToolUse).toHaveLength(1);
    expect(built.PreToolUse[0].hooks[0].command).toContain('kept.sh');
  });

  it('should skip a value that is nothing but an extension', () => {
    // Arrange — '.sh' would normalise to an empty stem and build a path
    // pointing at `.claude/hooks/.sh`
    const built = buildHooksFromSpec({
      stop: '.sh',
      preToolUse: [
        { matcher: 'Bash', hook: '.ps1' },
        { matcher: 'Bash', hook: 'kept' },
      ],
    });

    // Assert
    expect(built).not.toHaveProperty('Stop');
    expect(built.PreToolUse).toHaveLength(1);
    expect(built.PreToolUse[0].hooks[0].command).toContain('kept.sh');
  });

  it('should return null when the spec declares no hooks', () => {
    // Arrange + Act + Assert — the caller then leaves existing wiring alone
    expect(buildHooksFromSpec(undefined)).toBeNull();
    expect(buildHooksFromSpec(null)).toBeNull();
    expect(buildHooksFromSpec({})).toBeNull();
    expect(buildHooksFromSpec({ preToolUse: [] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// collectHookExtensions — which variants each hook actually ships
// ---------------------------------------------------------------------------

describe('collectHookExtensions()', () => {
  it('should group both variants of a hook under one stem', async () => {
    const byStem = await collectHookExtensions(HOOK_TEMPLATE_DIR);

    expect([...byStem.get('session-start')].sort()).toEqual(['ps1', 'sh']);
  });

  it('should record a single variant for a hook that ships only a .sh', async () => {
    const byStem = await collectHookExtensions(HOOK_TEMPLATE_DIR);

    expect([...byStem.get('pre-push-validate')]).toEqual(['sh']);
  });

  it('should return an empty map for a directory that does not exist', async () => {
    expect((await collectHookExtensions(resolve(HOOK_TEMPLATE_DIR, 'nope'))).size).toBe(0);
  });

  it('should leave out a template whose name would not survive shell interpolation', async () => {
    // Arrange — the stem lands in a partly-quoted command, so a name carrying
    // whitespace or a metacharacter must never reach it
    const dir = resolve(TEST_TMP, 'unsafe-hook-stems');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const name of [
      'ok-hook.sh',
      'has space.sh',
      'semi;colon.sh',
      '$dollar.sh',
      'back`tick.sh',
    ]) {
      writeFileSync(resolve(dir, name), '#!/usr/bin/env bash\n', 'utf-8');
    }

    // Act
    const byStem = await collectHookExtensions(dir);

    // Assert — only the plain name is indexed, so only it can be wired
    expect([...byStem.keys()]).toEqual(['ok-hook']);

    rmSync(dir, { recursive: true, force: true });
  });

  it('should index both variants when windowsFirst is unset', async () => {
    const byStem = await collectHookExtensions(HOOK_TEMPLATE_DIR, {});

    expect([...byStem.get('session-start')].sort()).toEqual(['ps1', 'sh']);
  });

  it('should drop the .ps1 variant when windowsFirst is false', async () => {
    const byStem = await collectHookExtensions(HOOK_TEMPLATE_DIR, { windowsFirst: false });

    expect([...byStem.get('session-start')]).toEqual(['sh']);
  });

  it('should keep every hook when windowsFirst is false, since .sh always ships', async () => {
    // Arrange — dropping .ps1 must never remove a hook outright
    const withPs1 = await collectHookExtensions(HOOK_TEMPLATE_DIR);

    // Act
    const shOnly = await collectHookExtensions(HOOK_TEMPLATE_DIR, { windowsFirst: false });

    // Assert
    expect([...shOnly.keys()].sort()).toEqual([...withPs1.keys()].sort());
    for (const exts of shOnly.values()) {
      expect([...exts]).toEqual(['sh']);
    }
  });
});

// ---------------------------------------------------------------------------
// isWindowsFirst — the emit filter for the PowerShell variant
// ---------------------------------------------------------------------------

describe('isWindowsFirst()', () => {
  it('should default to true so an overlay that never set the key is unaffected', () => {
    expect(isWindowsFirst(undefined)).toBe(true);
    expect(isWindowsFirst({})).toBe(true);
    expect(isWindowsFirst({ windowsFirst: true })).toBe(true);
  });

  it('should be false only for an explicit false', () => {
    expect(isWindowsFirst({ windowsFirst: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// syncClaudeHooks — the emission half of the windowsFirst filter
//
// collectHookExtensions() decides what settings.json invokes; this decides what
// lands on disk. They read the same flag, and a test on only one of them would
// let the pair drift back apart.
// ---------------------------------------------------------------------------

describe('syncClaudeHooks() windowsFirst emission', () => {
  const root = resolve(TEST_TMP, 'windows-first-emission');
  const templatesDir = resolve(root, 'templates');
  const hooksDir = resolve(templatesDir, 'claude', 'hooks');

  beforeEach(() => {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(resolve(hooksDir, 'alpha.sh'), '#!/usr/bin/env bash\nexit 0\n', 'utf-8');
    writeFileSync(resolve(hooksDir, 'alpha.ps1'), 'exit 0\n', 'utf-8');
    writeFileSync(resolve(hooksDir, 'beta.sh'), '#!/usr/bin/env bash\nexit 0\n', 'utf-8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  async function emitWith(vars) {
    const out = resolve(root, 'out');
    await syncClaudeHooks(templatesDir, out, vars, '1.0.0', 'test-repo', null);
    const dir = resolve(out, '.claude', 'hooks');
    return existsSync(dir) ? readdirSync(dir).sort() : [];
  }

  it('should emit both variants by default', async () => {
    expect(await emitWith({})).toEqual(['alpha.ps1', 'alpha.sh', 'beta.sh']);
  });

  it('should skip .ps1 files when windowsFirst is false', async () => {
    expect(await emitWith({ windowsFirst: false })).toEqual(['alpha.sh', 'beta.sh']);
  });

  it('should still emit a hook that ships no .ps1 when windowsFirst is false', async () => {
    // The filter drops a variant, never a hook — budget-guard-check and
    // pre-push-validate ship only a .sh and must survive either setting
    expect(await emitWith({ windowsFirst: false })).toContain('beta.sh');
  });
});

// ---------------------------------------------------------------------------
// buildHooksFromSpec — variant selection driven by the shipped templates
// ---------------------------------------------------------------------------

describe('buildHooksFromSpec() variant selection', () => {
  const spec = { preToolUse: [{ matcher: 'Bash', hook: 'guard-destructive-commands' }] };
  const commandFor = (built) => built.PreToolUse[0].hooks[0].command;

  it('should prefer the .ps1 with a .sh fallback when both variants ship', () => {
    // Arrange — hooks signal via stdout JSON and exit 0, so the `||` fires only
    // when pwsh cannot launch, never after a blocking .ps1
    const exts = new Map([['guard-destructive-commands', new Set(['sh', 'ps1'])]]);

    // Act
    const built = buildHooksFromSpec(spec, exts);

    // Assert
    expect(commandFor(built)).toBe(
      `pwsh -NoLogo -NoProfile -NonInteractive -File ${cmd('guard-destructive-commands', 'ps1')} || ${cmd('guard-destructive-commands')}`
    );
  });

  it('should invoke the .sh alone when no .ps1 variant ships', () => {
    const exts = new Map([['guard-destructive-commands', new Set(['sh'])]]);

    expect(commandFor(buildHooksFromSpec(spec, exts))).toBe(cmd('guard-destructive-commands'));
  });

  it('should invoke the .ps1 alone when no .sh variant ships', () => {
    const exts = new Map([['guard-destructive-commands', new Set(['ps1'])]]);

    expect(commandFor(buildHooksFromSpec(spec, exts))).toBe(
      `pwsh -NoLogo -NoProfile -NonInteractive -File ${cmd('guard-destructive-commands', 'ps1')}`
    );
  });

  it('should keep the declared form for a stem absent from the index', () => {
    // Arrange — preserves the single-argument contract for existing callers
    const exts = new Map();

    // Act + Assert
    expect(commandFor(buildHooksFromSpec(spec, exts))).toBe(cmd('guard-destructive-commands'));
    expect(
      buildHooksFromSpec({ sessionStart: 'session-start' }, exts).SessionStart[0].hooks[0].command
    ).toBe(
      `pwsh -NoLogo -NoProfile -NonInteractive -File ${cmd('session-start', 'ps1')} || ${cmd('session-start')}`
    );
  });
});

// ---------------------------------------------------------------------------
// The orphan invariant — every shipped hook template must be wired
// ---------------------------------------------------------------------------

describe('hook wiring leaves no orphaned template', () => {
  it('should wire every hook variant that ships, in both extensions', async () => {
    // Arrange — the counterpart to #185: a dangling reference errors when the
    // event fires, but an orphan is silent. `pre-push-validate` shipped and ran
    // never. Derived from the template directory rather than a fixed list, so a
    // newly added hook nobody wires fails here.
    const spec = loadYaml(readFileSync(SETTINGS_SPEC, 'utf-8'));
    const exts = await collectHookExtensions(HOOK_TEMPLATE_DIR);

    // Act
    const wired = new Set();
    for (const matchers of Object.values(buildHooksFromSpec(spec.hooks, exts))) {
      for (const matcher of matchers) {
        for (const hook of matcher.hooks) {
          for (const file of extractHookFiles(hook.command)) wired.add(file);
        }
      }
    }

    // Assert
    for (const [stem, variants] of exts) {
      for (const ext of variants) {
        expect(
          wired.has(`${stem}.${ext}`),
          `hook template "${stem}.${ext}" ships but nothing wires it`
        ).toBe(true);
      }
    }
  });

  it('should hold in both directions when windowsFirst drops the .ps1 variant', async () => {
    // Arrange — the emit filter has to move wiring and files together. Wiring a
    // .ps1 this repo no longer writes is the dangling reference #185 was about;
    // emitting one nothing invokes is the orphan the test above covers.
    const spec = loadYaml(readFileSync(SETTINGS_SPEC, 'utf-8'));
    const exts = await collectHookExtensions(HOOK_TEMPLATE_DIR, { windowsFirst: false });

    // Act
    const wired = new Set();
    for (const matchers of Object.values(buildHooksFromSpec(spec.hooks, exts))) {
      for (const matcher of matchers) {
        for (const hook of matcher.hooks) {
          for (const file of extractHookFiles(hook.command)) wired.add(file);
        }
      }
    }

    // Assert — nothing wired that is not emitted...
    for (const file of wired) {
      expect(file.endsWith('.sh'), `"${file}" is wired but windowsFirst:false emits no .ps1`).toBe(
        true
      );
      const stem = file.replace(/\.sh$/, '');
      expect(exts.has(stem), `"${file}" is wired but ships no template`).toBe(true);
    }

    // ...and nothing emitted that is not wired
    for (const stem of exts.keys()) {
      expect(wired.has(`${stem}.sh`), `hook template "${stem}.sh" ships but nothing wires it`).toBe(
        true
      );
    }
  });
});

// ---------------------------------------------------------------------------
// filterHooksToEmitted — against the real spec and template
// ---------------------------------------------------------------------------

describe('filterHooksToEmitted() against the shipped spec', () => {
  it('should keep every hook and event when all features are enabled', () => {
    // Arrange
    const { hookFeatureMap, hooks } = realFixtures();

    // Act
    const filtered = filterHooksToEmitted(hooks, hookFeatureMap, {});

    // Assert — the default configuration must be untouched, otherwise the
    // generated output in this repo would drift on the next sync
    expect(filtered).toEqual(hooks);
    expect(referencedStems(filtered).size).toBe(8);
  });

  it('should drop the Stop event entirely when quality-gates is disabled', () => {
    // Arrange — quality-gates owns stop-build-check, the only Stop hook
    const { hookFeatureMap, hooks } = realFixtures();

    // Act
    const filtered = filterHooksToEmitted(hooks, hookFeatureMap, {
      feature_quality_gates: false,
    });

    // Assert
    expect(referencedStems(filtered).has('stop-build-check')).toBe(false);
    expect(filtered).not.toHaveProperty('Stop');
    expect(Object.keys(filtered)).toEqual(['SessionStart', 'PreToolUse', 'PostToolUse']);
  });

  it('should drop only protect-sensitive when sensitive-file-protection is disabled', () => {
    const { hookFeatureMap, hooks } = realFixtures();

    const filtered = filterHooksToEmitted(hooks, hookFeatureMap, {
      feature_sensitive_file_protection: false,
    });

    const stems = referencedStems(filtered);
    expect(stems.has('protect-sensitive')).toBe(false);
    // Its sibling PreToolUse Write|Edit hook must survive
    expect(stems.has('protect-templates')).toBe(true);
    expect(stems.size).toBe(7);
  });

  it('should drop all directory-gated hooks when permission-guards is disabled', () => {
    // Arrange — permission-guards claims `claude/hooks/`, so it gates every
    // hook not claimed by a more specific feature
    const { hookFeatureMap, hooks } = realFixtures();

    // Act
    const filtered = filterHooksToEmitted(hooks, hookFeatureMap, {
      feature_permission_guards: false,
    });

    // Assert — only the two specifically-claimed hooks remain
    expect([...referencedStems(filtered)].sort()).toEqual([
      'protect-sensitive',
      'stop-build-check',
    ]);
    expect(Object.keys(filtered).sort()).toEqual(['PreToolUse', 'Stop']);
  });

  it('should wire every hook the spec declares', () => {
    // Arrange — the orphan half of #185: budget-guard-check and
    // pre-push-validate were emitted as files but wired to nothing, because
    // the static template was maintained separately from the spec
    const { hooks } = realFixtures();

    // Act
    const stems = referencedStems(hooks);

    // Assert
    expect([...stems].sort()).toEqual([
      'budget-guard-check',
      'guard-destructive-commands',
      'pre-push-validate',
      'protect-sensitive',
      'protect-templates',
      'session-start',
      'stop-build-check',
      'warn-uncommitted',
    ]);
  });

  it('should never reference a hook that gating would skip, in any single-feature scenario', () => {
    // Arrange — the invariant #185 violated, asserted across every feature
    // that owns a hook rather than a fixed list
    const { hookFeatureMap, hooks } = realFixtures();
    const owning = new Set(
      [...Object.values(hookFeatureMap.specific), hookFeatureMap.defaultFeature].filter(Boolean)
    );
    expect(owning.size).toBeGreaterThan(0);

    for (const featureId of owning) {
      const vars = { [`feature_${featureId.replace(/-/g, '_')}`]: false };

      // Act
      const filtered = filterHooksToEmitted(hooks, hookFeatureMap, vars);

      // Assert
      for (const stem of referencedStems(filtered)) {
        expect(
          isHookEmitted(stem, hookFeatureMap, vars),
          `${featureId} disabled: settings.json still wires "${stem}", which sync will not emit`
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// filterHooksToEmitted — structural behaviour
// ---------------------------------------------------------------------------

describe('filterHooksToEmitted() structure', () => {
  const map = { specific: { gated: 'some-feature' }, defaultFeature: null };
  const off = { feature_some_feature: false };

  it('should return hooks unchanged when no hookFeatureMap is supplied', () => {
    // Arrange — preserves behaviour for callers predating feature gating
    const hooks = { Stop: [{ hooks: [{ type: 'command', command: cmd('gated') }] }] };

    // Act + Assert
    expect(filterHooksToEmitted(hooks, null, off)).toBe(hooks);
    expect(filterHooksToEmitted(hooks, undefined, off)).toBe(hooks);
  });

  it('should prune a matcher group once its last hook is dropped', () => {
    const hooks = {
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: cmd('gated') }] },
        { matcher: 'Write', hooks: [{ type: 'command', command: cmd('kept') }] },
      ],
    };

    const filtered = filterHooksToEmitted(hooks, map, off);

    expect(filtered.PreToolUse).toHaveLength(1);
    expect(filtered.PreToolUse[0].matcher).toBe('Write');
  });

  it('should keep surviving hooks within a partially-dropped matcher group', () => {
    const hooks = {
      PreToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [
            { type: 'command', command: cmd('gated') },
            { type: 'command', command: cmd('kept') },
          ],
        },
      ],
    };

    const filtered = filterHooksToEmitted(hooks, map, off);

    expect(filtered.PreToolUse[0].hooks).toHaveLength(1);
    expect(filtered.PreToolUse[0].hooks[0].command).toContain('kept');
  });

  it('should preserve matcher metadata on a filtered group', () => {
    const hooks = {
      PreToolUse: [
        {
          matcher: 'Write|Edit',
          extra: 'preserved',
          hooks: [
            { type: 'command', command: cmd('gated') },
            { type: 'command', command: cmd('kept') },
          ],
        },
      ],
    };

    const filtered = filterHooksToEmitted(hooks, map, off);

    expect(filtered.PreToolUse[0].matcher).toBe('Write|Edit');
    expect(filtered.PreToolUse[0].extra).toBe('preserved');
  });

  it('should drop an entry when only one of the stems it chains is gated off', () => {
    // Arrange — a partially-resolvable command is still a broken command
    const hooks = {
      Stop: [{ hooks: [{ type: 'command', command: `${cmd('kept')} && ${cmd('gated')}` }] }],
    };

    // Act
    const filtered = filterHooksToEmitted(hooks, map, off);

    // Assert
    expect(filtered).toEqual({});
  });

  it('should keep a command that invokes no hook script', () => {
    const hooks = { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] };

    expect(filterHooksToEmitted(hooks, map, off)).toEqual(hooks);
  });

  it('should skip a malformed event whose value is not an array', () => {
    const hooks = { Stop: 'not-an-array' };

    expect(filterHooksToEmitted(hooks, map, off)).toEqual({});
  });

  it('should skip a null matcher rather than throwing', () => {
    // Arrange — structurally valid JSON, structurally invalid hook tree
    const hooks = { Stop: [null, { hooks: [{ type: 'command', command: cmd('kept') }] }] };

    // Act + Assert — the surviving matcher is still processed
    expect(() => filterHooksToEmitted(hooks, map, off)).not.toThrow();
    expect(filterHooksToEmitted(hooks, map, off).Stop).toHaveLength(1);
  });

  it('should skip a matcher whose hooks field is not an array', () => {
    const hooks = { Stop: [{ matcher: 'Bash', hooks: 'not-an-array' }] };

    expect(() => filterHooksToEmitted(hooks, map, off)).not.toThrow();
    expect(filterHooksToEmitted(hooks, map, off)).toEqual({});
  });

  it('should skip a null hook entry rather than throwing', () => {
    const hooks = { Stop: [{ hooks: [null, { type: 'command', command: cmd('kept') }] }] };

    expect(() => filterHooksToEmitted(hooks, map, off)).not.toThrow();
    expect(filterHooksToEmitted(hooks, map, off).Stop[0].hooks).toHaveLength(1);
  });

  it('should not mutate the input hooks tree', () => {
    const hooks = {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            { type: 'command', command: cmd('gated') },
            { type: 'command', command: cmd('kept') },
          ],
        },
      ],
    };
    const snapshot = JSON.parse(JSON.stringify(hooks));

    filterHooksToEmitted(hooks, map, off);

    expect(hooks).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// validate.mjs Phase 5 — required hooks derived from settings.json
// ---------------------------------------------------------------------------

describe('runValidate() hook phase', () => {
  const TEST_ROOT = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    '.test-tmp',
    'validate-hook-wiring'
  );

  /** Writes a minimal project whose settings.json wires `wired` hook files. */
  function scaffold({ wired = [], present = [], settingsRaw = null } = {}) {
    mkdirSync(resolve(TEST_ROOT, '.claude', 'hooks'), { recursive: true });
    for (const file of present) {
      writeFileSync(resolve(TEST_ROOT, '.claude', 'hooks', file), '#!/usr/bin/env bash\n', 'utf-8');
    }
    const raw =
      settingsRaw ??
      JSON.stringify({
        permissions: { allow: ['Bash(ls *)'], deny: [] },
        hooks: {
          PreToolUse: wired.map((file) => ({
            matcher: 'Write',
            hooks: [{ type: 'command', command: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/${file}` }],
          })),
        },
      });
    writeFileSync(resolve(TEST_ROOT, '.claude', 'settings.json'), raw, 'utf-8');
  }

  async function validateTestRoot() {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    await runValidate({ agentkitRoot: AGENTKIT_ROOT, projectRoot: TEST_ROOT, flags: {} });

    return {
      log: logSpy.mock.calls.map((c) => c.join(' ')).join('\n'),
      error: errorSpy.mock.calls.map((c) => c.join(' ')).join('\n'),
    };
  }

  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    vi.restoreAllMocks();
  });

  it('should pass when every wired hook script exists', async () => {
    // Arrange
    scaffold({
      wired: ['protect-sensitive.sh', 'warn-uncommitted.sh'],
      present: ['protect-sensitive.sh', 'warn-uncommitted.sh'],
    });

    // Act
    const { log, error } = await validateTestRoot();

    // Assert
    expect(log).toContain('Checked 2 hook script(s) wired in settings.json');
    expect(error).not.toContain('.claude/hooks/protect-sensitive.sh');
  });

  it('should fail and name the script when a wired hook is missing on disk', async () => {
    // Arrange
    scaffold({
      wired: ['protect-sensitive.sh', 'warn-uncommitted.sh'],
      present: ['protect-sensitive.sh'],
    });

    // Act
    const { error } = await validateTestRoot();

    // Assert
    expect(error).toContain(
      'settings.json wires .claude/hooks/warn-uncommitted.sh, which does not exist'
    );
  });

  it('should not require a feature-gated hook that settings.json does not wire', async () => {
    // Arrange — the #185 regression: a hardcoded required-hook list failed
    // repos that had legitimately gated stop-build-check off
    scaffold({ wired: ['protect-sensitive.sh'], present: ['protect-sensitive.sh'] });

    // Act
    const { log, error } = await validateTestRoot();

    // Assert
    expect(error).not.toContain('stop-build-check');
    expect(log).toContain('Checked 1 hook script(s) wired in settings.json');
  });

  it('should count a .ps1 hook and its .sh fallback as two required scripts', async () => {
    // Arrange — both extensions are named explicitly, so both must exist
    mkdirSync(resolve(TEST_ROOT, '.claude', 'hooks'), { recursive: true });
    writeFileSync(resolve(TEST_ROOT, '.claude', 'hooks', 'session-start.sh'), '#!/bin/sh\n');
    writeFileSync(
      resolve(TEST_ROOT, '.claude', 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(ls *)'], deny: [] },
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command:
                    'pwsh -File "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.ps1 || "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh',
                },
              ],
            },
          ],
        },
      }),
      'utf-8'
    );

    // Act
    const { log, error } = await validateTestRoot();

    // Assert
    expect(log).toContain('Checked 2 hook script(s) wired in settings.json');
    expect(error).toContain(
      'settings.json wires .claude/hooks/session-start.ps1, which does not exist'
    );
  });

  it('should still collect valid hooks alongside a null matcher', async () => {
    // Arrange — parses as JSON, so the hook phase must not abort on the shape.
    // The valid entry proves the malformed one was skipped rather than fatal:
    // an unguarded throw would be swallowed by the catch and lose this too.
    scaffold({
      settingsRaw: JSON.stringify({
        hooks: {
          Stop: [
            null,
            { hooks: [{ command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/stop-build-check.sh' }] },
          ],
        },
      }),
      present: ['stop-build-check.sh'],
    });

    // Act
    const { log, error } = await validateTestRoot();

    // Assert
    expect(log).toContain('Checked 1 hook script(s) wired in settings.json');
    expect(error).not.toContain('stop-build-check.sh, which does not exist');
  });

  it('should still collect valid hooks alongside a null hook entry', async () => {
    // Arrange
    scaffold({
      settingsRaw: JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [null, { command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/stop-build-check.sh' }],
            },
          ],
        },
      }),
      present: ['stop-build-check.sh'],
    });

    // Act
    const { log } = await validateTestRoot();

    // Assert
    expect(log).toContain('Checked 1 hook script(s) wired in settings.json');
  });

  it('should still collect valid hooks alongside a non-array hooks field', async () => {
    // Arrange
    scaffold({
      settingsRaw: JSON.stringify({
        hooks: {
          Stop: [
            { matcher: 'Bash', hooks: 'not-an-array' },
            { hooks: [{ command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/stop-build-check.sh' }] },
          ],
        },
      }),
      present: ['stop-build-check.sh'],
    });

    // Act
    const { log } = await validateTestRoot();

    // Assert
    expect(log).toContain('Checked 1 hook script(s) wired in settings.json');
  });

  it('should handle a settings.json whose entire content is null', async () => {
    // Arrange — `null` parses fine, so the catch must not be what saves us
    scaffold({ settingsRaw: 'null' });

    // Act
    const { log } = await validateTestRoot();

    // Assert
    expect(log).toContain('Checked 0 hook script(s) wired in settings.json');
  });

  it('should not throw on a malformed settings.json', async () => {
    // Arrange
    scaffold({ settingsRaw: '{ this is not json' });

    // Act
    const { log } = await validateTestRoot();

    // Assert — the hook phase degrades to zero wired scripts; the malformed
    // file is reported by the JSON/settings phases instead
    expect(log).toContain('Checked 0 hook script(s) wired in settings.json');
  });

  it('should report zero wired scripts when settings.json is absent', async () => {
    // Arrange — no .claude/settings.json at all
    mkdirSync(resolve(TEST_ROOT, '.claude', 'hooks'), { recursive: true });

    // Act
    const { log } = await validateTestRoot();

    // Assert
    expect(log).toContain('Checked 0 hook script(s) wired in settings.json');
  });
});
