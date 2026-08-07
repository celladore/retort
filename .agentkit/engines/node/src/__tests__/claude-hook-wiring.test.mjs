/**
 * Regression fixture for #185 — hook wiring in `.claude/settings.json` must
 * never name a hook script that feature gating prevents sync from emitting.
 *
 * `settings.json` is rendered from a STATIC template that unconditionally wires
 * six hook scripts, while `syncClaudeHooks()` skips any hook whose owning
 * feature is disabled. The two are reconciled by `filterHooksToEmitted()`.
 *
 * The gating scenarios below are derived from the real `features.yaml`
 * `affectsTemplates` declarations rather than hardcoded, so that re-homing a
 * hook under a different feature fails here instead of silently shipping a
 * dangling reference. All three gating features default to `true`, which is why
 * retort's own generated output was always clean and this defect survived
 * unnoticed — the synthetic scenarios are the only thing that exercises it.
 */
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractHookStems, filterHooksToEmitted, isHookEmitted } from '../platform-syncer.mjs';
import { buildHookFeatureMap, loadFeatureSpec } from '../feature-manager.mjs';
import { runValidate } from '../validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const SETTINGS_TEMPLATE = resolve(AGENTKIT_ROOT, 'templates', 'claude', 'settings.json');

/** Hook feature map + settings template as they really ship. */
function realFixtures() {
  const { features } = loadFeatureSpec(AGENTKIT_ROOT, { log: () => {} });
  const settings = JSON.parse(readFileSync(SETTINGS_TEMPLATE, 'utf-8'));
  return { hookFeatureMap: buildHookFeatureMap(features), settings };
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
// filterHooksToEmitted — against the real spec and template
// ---------------------------------------------------------------------------

describe('filterHooksToEmitted() against the shipped spec', () => {
  it('should keep every hook and event when all features are enabled', () => {
    // Arrange
    const { hookFeatureMap, settings } = realFixtures();

    // Act
    const filtered = filterHooksToEmitted(settings.hooks, hookFeatureMap, {});

    // Assert — the default configuration must be untouched, otherwise the
    // generated output in this repo would drift on the next sync
    expect(filtered).toEqual(settings.hooks);
    expect(referencedStems(filtered).size).toBe(6);
  });

  it('should drop the Stop event entirely when quality-gates is disabled', () => {
    // Arrange — quality-gates owns stop-build-check, the only Stop hook
    const { hookFeatureMap, settings } = realFixtures();

    // Act
    const filtered = filterHooksToEmitted(settings.hooks, hookFeatureMap, {
      feature_quality_gates: false,
    });

    // Assert
    expect(referencedStems(filtered).has('stop-build-check')).toBe(false);
    expect(filtered).not.toHaveProperty('Stop');
    expect(Object.keys(filtered)).toEqual(['SessionStart', 'PreToolUse', 'PostToolUse']);
  });

  it('should drop only protect-sensitive when sensitive-file-protection is disabled', () => {
    const { hookFeatureMap, settings } = realFixtures();

    const filtered = filterHooksToEmitted(settings.hooks, hookFeatureMap, {
      feature_sensitive_file_protection: false,
    });

    const stems = referencedStems(filtered);
    expect(stems.has('protect-sensitive')).toBe(false);
    // Its sibling PreToolUse Write|Edit hook must survive
    expect(stems.has('protect-templates')).toBe(true);
    expect(stems.size).toBe(5);
  });

  it('should drop all directory-gated hooks when permission-guards is disabled', () => {
    // Arrange — permission-guards claims `claude/hooks/`, so it gates every
    // hook not claimed by a more specific feature
    const { hookFeatureMap, settings } = realFixtures();

    // Act
    const filtered = filterHooksToEmitted(settings.hooks, hookFeatureMap, {
      feature_permission_guards: false,
    });

    // Assert — only the two specifically-claimed hooks remain
    expect([...referencedStems(filtered)].sort()).toEqual([
      'protect-sensitive',
      'stop-build-check',
    ]);
    expect(Object.keys(filtered).sort()).toEqual(['PreToolUse', 'Stop']);
  });

  it('should never reference a hook that gating would skip, in any single-feature scenario', () => {
    // Arrange — the invariant #185 violated, asserted across every feature
    // that owns a hook rather than a fixed list
    const { hookFeatureMap, settings } = realFixtures();
    const owning = new Set(
      [...Object.values(hookFeatureMap.specific), hookFeatureMap.defaultFeature].filter(Boolean)
    );
    expect(owning.size).toBeGreaterThan(0);

    for (const featureId of owning) {
      const vars = { [`feature_${featureId.replace(/-/g, '_')}`]: false };

      // Act
      const filtered = filterHooksToEmitted(settings.hooks, hookFeatureMap, vars);

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
