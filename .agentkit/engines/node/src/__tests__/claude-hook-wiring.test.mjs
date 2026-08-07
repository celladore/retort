/**
 * Hook wiring in `.claude/settings.json` is generated from the `hooks:` block in
 * `spec/settings.yaml`, which is the single source of truth. Two invariants are
 * fixed here:
 *
 * 1. (#185) Wiring must never name a hook script that feature gating prevents
 *    `syncClaudeHooks()` from emitting — a dangling reference makes Claude Code
 *    error when the lifecycle event fires.
 * 2. The orphan counterpart: a hook script that ships must not be left unwired.
 *    `budget-guard-check` and `pre-push-validate` were emitted as dead files for
 *    exactly as long as wiring came from the static template, which never named
 *    them.
 *
 * Gating scenarios are derived from the real `features.yaml` `affectsTemplates`
 * declarations rather than hardcoded, so re-homing a hook under a different
 * feature fails here instead of silently shipping a dangling reference. Every
 * gating feature defaults to `true`, which is why retort's own generated output
 * was always clean and #185 survived unnoticed — the synthetic scenarios below
 * are the only thing that exercises it.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHookCommand,
  buildHooksFromSpec,
  collectHookExtensions,
  extractHookFiles,
  extractHookStems,
  filterHooksToEmitted,
  isHookEmitted,
} from '../platform-syncer.mjs';
import { buildHookFeatureMap, loadFeatureSpec } from '../feature-manager.mjs';
import { readYaml } from '../spec-loader.mjs';
import { runValidate } from '../validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const SETTINGS_SPEC = resolve(AGENTKIT_ROOT, 'spec', 'settings.yaml');
const HOOK_TEMPLATE_DIR = resolve(AGENTKIT_ROOT, 'templates', 'claude', 'hooks');

/** Hook feature map, spec, and hook templates as they really ship. */
async function realFixtures() {
  const { features } = loadFeatureSpec(AGENTKIT_ROOT, { log: () => {} });
  return {
    hookFeatureMap: buildHookFeatureMap(features),
    hooksSpec: readYaml(SETTINGS_SPEC).hooks,
    hookExtensions: await collectHookExtensions(HOOK_TEMPLATE_DIR),
  };
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
// buildHookCommand / collectHookExtensions
// ---------------------------------------------------------------------------

describe('buildHookCommand()', () => {
  it('should invoke the .sh directly when only that variant ships', () => {
    expect(buildHookCommand('pre-push-validate', new Set(['sh']))).toBe(cmd('pre-push-validate'));
  });

  it('should prefer the .ps1 and fall back to the .sh when both ship', () => {
    // Arrange + Act
    const command = buildHookCommand('session-start', new Set(['sh', 'ps1']));

    // Assert — hooks signal decisions as stdout JSON and always exit 0, so the
    // `||` fires only when pwsh cannot launch, never after a blocking .ps1
    expect(command).toBe(
      `pwsh -NoLogo -NoProfile -NonInteractive -File ${cmd('session-start', 'ps1')} || ${cmd('session-start')}`
    );
  });

  it('should invoke the .ps1 alone when no .sh variant ships', () => {
    expect(buildHookCommand('windows-only', new Set(['ps1']))).toBe(
      `pwsh -NoLogo -NoProfile -NonInteractive -File ${cmd('windows-only', 'ps1')}`
    );
  });
});

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
});

// ---------------------------------------------------------------------------
// buildHooksFromSpec — against the real spec and hook templates
// ---------------------------------------------------------------------------

describe('buildHooksFromSpec() against the shipped spec', () => {
  it('should wire every hook the spec declares when all features are enabled', async () => {
    // Arrange
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();

    // Act
    const hooks = buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, {});

    // Assert — the orphan invariant: budget-guard-check and pre-push-validate
    // ship as files, so they must appear in the wiring
    expect([...referencedStems(hooks)].sort()).toEqual([
      'budget-guard-check',
      'guard-destructive-commands',
      'pre-push-validate',
      'protect-sensitive',
      'protect-templates',
      'session-start',
      'stop-build-check',
      'warn-uncommitted',
    ]);
    expect(Object.keys(hooks)).toEqual(['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop']);
  });

  it('should wire every hook template that ships, leaving no orphan files', async () => {
    // Arrange — the defect this change fixes, asserted against the template
    // directory rather than a hardcoded list so a newly added hook fails here
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();

    // Act
    const wired = referencedStems(
      buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, {})
    );

    // Assert
    for (const stem of hookExtensions.keys()) {
      expect(wired.has(stem), `hook template "${stem}" ships but no event wires it`).toBe(true);
    }
  });

  it('should carry the matcher the spec declares for each PreToolUse entry', async () => {
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();

    const hooks = buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, {});

    const matcherFor = (stem) =>
      hooks.PreToolUse.find((g) => extractHookStems(g.hooks[0].command).has(stem))?.matcher;
    expect(matcherFor('budget-guard-check')).toBe('Bash|Write|Edit');
    expect(matcherFor('pre-push-validate')).toBe('Bash');
    expect(matcherFor('protect-templates')).toBe('Write|Edit');
  });

  it('should omit the matcher key on events the spec declares as a bare stem', async () => {
    // Arrange — `stop: stop-build-check` has no matcher to carry
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();

    // Act
    const hooks = buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, {});

    // Assert
    expect(hooks.Stop[0]).not.toHaveProperty('matcher');
    expect(hooks.SessionStart[0]).not.toHaveProperty('matcher');
  });

  it('should drop the Stop event entirely when quality-gates is disabled', async () => {
    // Arrange — quality-gates owns stop-build-check, the only Stop hook
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();

    // Act
    const hooks = buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, {
      feature_quality_gates: false,
    });

    // Assert
    expect(referencedStems(hooks).has('stop-build-check')).toBe(false);
    expect(hooks).not.toHaveProperty('Stop');
    expect(Object.keys(hooks)).toEqual(['SessionStart', 'PreToolUse', 'PostToolUse']);
  });

  it('should drop only protect-sensitive when sensitive-file-protection is disabled', async () => {
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();

    const hooks = buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, {
      feature_sensitive_file_protection: false,
    });

    const stems = referencedStems(hooks);
    expect(stems.has('protect-sensitive')).toBe(false);
    // Its sibling PreToolUse Write|Edit hook must survive
    expect(stems.has('protect-templates')).toBe(true);
    expect(stems.size).toBe(7);
  });

  it('should drop all directory-gated hooks when permission-guards is disabled', async () => {
    // Arrange — permission-guards claims `claude/hooks/`, so it gates every
    // hook not claimed by a more specific feature
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();

    // Act
    const hooks = buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, {
      feature_permission_guards: false,
    });

    // Assert — only the two specifically-claimed hooks remain
    expect([...referencedStems(hooks)].sort()).toEqual(['protect-sensitive', 'stop-build-check']);
    expect(Object.keys(hooks).sort()).toEqual(['PreToolUse', 'Stop']);
  });

  it('should never wire a hook that gating would skip, in any single-feature scenario', async () => {
    // Arrange — the invariant #185 violated, asserted across every feature
    // that owns a hook rather than a fixed list
    const { hookFeatureMap, hooksSpec, hookExtensions } = await realFixtures();
    const owning = new Set(
      [...Object.values(hookFeatureMap.specific), hookFeatureMap.defaultFeature].filter(Boolean)
    );
    expect(owning.size).toBeGreaterThan(0);

    for (const featureId of owning) {
      const vars = { [`feature_${featureId.replace(/-/g, '_')}`]: false };

      // Act
      const hooks = buildHooksFromSpec(hooksSpec, hookExtensions, hookFeatureMap, vars);

      // Assert
      for (const stem of referencedStems(hooks)) {
        expect(
          isHookEmitted(stem, hookFeatureMap, vars),
          `${featureId} disabled: settings.json still wires "${stem}", which sync will not emit`
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildHooksFromSpec — structural behaviour
// ---------------------------------------------------------------------------

describe('buildHooksFromSpec() structure', () => {
  const exts = new Map([['kept', new Set(['sh'])]]);

  it('should return null when the spec declares no hooks, so the caller can fall back', () => {
    expect(buildHooksFromSpec(undefined, exts, null, {})).toBeNull();
    expect(buildHooksFromSpec(null, exts, null, {})).toBeNull();
  });

  it('should skip a spec entry naming a hook with no template on disk', () => {
    // Arrange — a typo in settings.yaml must not produce a dangling reference
    const spec = { stop: 'does-not-exist' };

    // Act + Assert
    expect(buildHooksFromSpec(spec, exts, null, {})).toEqual({});
  });

  it('should ignore an unrecognised lifecycle key rather than emitting it', () => {
    const spec = { stop: 'kept', notAnEvent: 'kept' };

    expect(Object.keys(buildHooksFromSpec(spec, exts, null, {}))).toEqual(['Stop']);
  });

  it('should skip a malformed list entry that names no hook', () => {
    const spec = { preToolUse: [{ matcher: 'Bash' }, { matcher: 'Write', hook: 'kept' }] };

    const hooks = buildHooksFromSpec(spec, exts, null, {});

    expect(hooks.PreToolUse).toHaveLength(1);
    expect(hooks.PreToolUse[0].matcher).toBe('Write');
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
