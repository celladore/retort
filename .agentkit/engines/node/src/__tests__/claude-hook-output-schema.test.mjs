/**
 * Claude hook output schema conformance
 *
 * Regression fixture for #192, where the generated SessionStart hook emitted
 * `hookSpecificOutput` without the required `hookEventName` discriminator and
 * every session start in an adopter repo failed with:
 *
 *   Hook JSON output validation failed: Invalid input
 *
 * That shipped because nothing asserted the *shape* of any hook's stdout. This
 * fixture covers all hook templates at once rather than only the one that broke.
 *
 * ## What this validates
 *
 * Each template is rendered (both conditional branches — see below) and every
 * `hookSpecificOutput` payload literal is extracted from the rendered text, then
 * checked against the contract Claude Code enforces:
 *
 *   - `hookEventName` is present and non-empty
 *   - it names a real hook event
 *   - it matches the event the hook is actually wired to in settings.json
 *   - per-event required fields are present
 *   - `systemMessage` is not nested inside `hookSpecificOutput` (it is top-level)
 *
 * ## Why static extraction rather than execution
 *
 * Executing the hooks would need `jq` and `pwsh` present on every CI runner, and
 * `session-start` shells out to a dozen `--version` probes (tens of seconds on
 * Windows). Structural checks stay hermetic, fast and deterministic — no external
 * binaries, no network, no timing. The trade-off is that this asserts the payload
 * *literal* in the template, not the bytes a live shell produces; a live-run smoke
 * check of session-start covered that when #192 was fixed.
 *
 * ## Why both conditional branches
 *
 * Retort declares javascript/yaml/markdown, so blocks gated on
 * `hasLanguagePythonEffective`, `hasLanguageRustEffective`,
 * `hasLanguageDotnetEffective` and `hasAnyInfraConfig` never render in retort's
 * own output and ship untested — that is how the duplicate-Python bug (#247)
 * survived alongside #192. Rendering with every flag on and again with every flag
 * off exercises both sides of every conditional, including `{{else}}`.
 */
import { readFileSync, readdirSync } from 'fs';
import { basename, extname, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../template-utils.mjs';

const AGENTKIT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const HOOKS_DIR = resolve(AGENTKIT_ROOT, 'templates', 'claude', 'hooks');
const SETTINGS_TEMPLATE = resolve(AGENTKIT_ROOT, 'templates', 'claude', 'settings.json');

/** Hook events that may carry a `hookSpecificOutput` payload. */
const KNOWN_HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Notification',
  'PreCompact',
  'Stop',
  'SubagentStop',
];

/**
 * Fields each event must carry inside `hookSpecificOutput`. Events absent from
 * this map are wired through top-level `decision`/`reason` instead and are only
 * checked for the `hookEventName` discriminator.
 */
const REQUIRED_FIELDS_BY_EVENT = {
  PreToolUse: ['permissionDecision', 'permissionDecisionReason'],
  PostToolUse: ['additionalContext'],
  UserPromptSubmit: ['additionalContext'],
  SessionStart: ['additionalContext'],
};

/**
 * Top-level-only fields. Nesting these inside `hookSpecificOutput` is silently
 * wrong — the payload parses as JSON but the field is ignored by the consumer.
 */
const TOP_LEVEL_ONLY_FIELDS = ['systemMessage', 'continue', 'stopReason', 'suppressOutput'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Vars with every conditional enabled, so language- and infra-gated blocks render.
 */
function makeVarsAllOn() {
  return {
    packageManager: 'pnpm',
    languageInferenceSource: 'configured',
    languageInferenceConfidence: 'high',
    showLanguageProfileDiagnostics: true,
    autoSyncOnPush: true,
    hasLanguageJsLikeEffective: true,
    hasLanguagePythonEffective: true,
    hasLanguageRustEffective: true,
    hasLanguageDotnetEffective: true,
    hasAnyInfraConfig: true,
  };
}

/** Vars with every conditional disabled, so `{{else}}` branches render. */
function makeVarsAllOff() {
  return {
    packageManager: 'npm',
    languageInferenceSource: 'heuristic',
    languageInferenceConfidence: 'low',
    showLanguageProfileDiagnostics: false,
    autoSyncOnPush: false,
    hasLanguageJsLikeEffective: false,
    hasLanguagePythonEffective: false,
    hasLanguageRustEffective: false,
    hasLanguageDotnetEffective: false,
    hasAnyInfraConfig: false,
  };
}

/**
 * Finds the balanced `{...}` block starting at `openIndex`, skipping over quoted
 * strings so that braces inside string literals (regex quantifiers such as
 * `{8,}` in the secret-detection patterns) do not unbalance the count.
 */
function matchBalancedBlock(text, openIndex) {
  let depth = 0;
  let quote = null;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }

  return null;
}

/**
 * Extracts every `hookSpecificOutput` payload literal from rendered hook source.
 * Handles the three emit styles in use: a `jq -n` program, a hand-rolled
 * `printf` JSON string, and a PowerShell `@{...}` hashtable.
 */
function extractHookSpecificOutputBlocks(source) {
  const blocks = [];
  const marker = 'hookSpecificOutput';
  let cursor = 0;

  for (;;) {
    const found = source.indexOf(marker, cursor);
    if (found === -1) break;
    cursor = found + marker.length;

    // Skip the assignment glue between the key and its block: a closing quote,
    // `:` or `=`, whitespace, and PowerShell's `@` hashtable sigil.
    let i = cursor;
    while (i < source.length && /["'\s:=@]/.test(source[i])) i += 1;

    if (source[i] === '{') {
      const block = matchBalancedBlock(source, i);
      if (block) {
        blocks.push(block);
        cursor = i + block.length;
      }
    }
  }

  return blocks;
}

/** Reads the `hookEventName` value out of a payload block, if present. */
function readHookEventName(block) {
  const match = block.match(/hookEventName\s*["']?\s*[:=]\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Maps hook script stem -> the event it is wired to, parsed from the settings
 * template. Derived rather than hardcoded so that rewiring a hook without
 * updating its payload fails here.
 */
function loadHookWiring() {
  const raw = readFileSync(SETTINGS_TEMPLATE, 'utf-8');
  const settings = JSON.parse(raw.replace(/\{\{[#/][^}]*\}\}/g, ''));
  const wiring = {};

  for (const [event, matchers] of Object.entries(settings.hooks || {})) {
    for (const matcher of matchers) {
      for (const hook of matcher.hooks || []) {
        for (const ref of String(hook.command || '').matchAll(/([\w-]+)\.(?:sh|ps1)/g)) {
          wiring[ref[1]] = event;
        }
      }
    }
  }

  return wiring;
}

function listHookTemplates() {
  return readdirSync(HOOKS_DIR)
    .filter((name) => ['.sh', '.ps1'].includes(extname(name)))
    .sort();
}

function renderHook(name, vars) {
  const source = readFileSync(resolve(HOOKS_DIR, name), 'utf-8');
  return renderTemplate(source, vars, name);
}

const HOOK_TEMPLATES = listHookTemplates();
const HOOK_WIRING = loadHookWiring();
const VARIANTS = [
  { label: 'all conditionals enabled', vars: makeVarsAllOn() },
  { label: 'all conditionals disabled', vars: makeVarsAllOff() },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('claude hook output schema', () => {
  it('should discover hook templates to validate', () => {
    // Arrange + Act done at module load.

    // Assert — guards against the suite silently passing if the glob breaks.
    expect(HOOK_TEMPLATES.length).toBeGreaterThan(0);
    expect(HOOK_TEMPLATES).toContain('session-start.sh');
    expect(HOOK_TEMPLATES).toContain('session-start.ps1');
  });

  it('should resolve hook wiring from the settings template', () => {
    // Assert — an empty map would make the event cross-check vacuous.
    expect(Object.keys(HOOK_WIRING).length).toBeGreaterThan(0);
    expect(HOOK_WIRING['session-start']).toBe('SessionStart');
  });

  describe.each(VARIANTS)('with $label', ({ vars }) => {
    it.each(HOOK_TEMPLATES)('should leave no unrendered placeholders in %s', (name) => {
      // Arrange + Act
      const rendered = renderHook(name, vars);

      // Assert — an unresolved {{...}} would ship as literal text in the hook.
      expect(rendered).not.toMatch(/\{\{/);
    });

    it.each(HOOK_TEMPLATES)(
      'should declare hookEventName in every hookSpecificOutput payload of %s',
      (name) => {
        // Arrange
        const rendered = renderHook(name, vars);
        const stem = basename(name, extname(name));

        // Act
        const blocks = extractHookSpecificOutputBlocks(rendered);

        // Assert — session-start hooks must emit at least one payload (they are
        // wired to SessionStart, which requires additionalContext). If blocks is
        // empty, the for-loop body never executes and the test passes vacuously.
        if (stem === 'session-start') {
          expect(
            blocks.length,
            `${name}: session-start must emit at least one hookSpecificOutput payload`
          ).toBeGreaterThan(0);
        }

        // Assert — this is the exact defect from #192.
        for (const block of blocks) {
          expect(
            readHookEventName(block),
            `${name}: a hookSpecificOutput payload is missing hookEventName`
          ).not.toBeNull();
        }
      }
    );

    it.each(HOOK_TEMPLATES)('should use a known hook event name in %s', (name) => {
      // Arrange
      const rendered = renderHook(name, vars);

      // Act
      const events = extractHookSpecificOutputBlocks(rendered)
        .map(readHookEventName)
        .filter(Boolean);

      // Assert
      for (const event of events) {
        expect(KNOWN_HOOK_EVENTS, `${name}: unknown hook event "${event}"`).toContain(event);
      }
    });

    it.each(HOOK_TEMPLATES)('should match the event %s is wired to in settings.json', (name) => {
      // Arrange
      const stem = basename(name, extname(name));
      const wiredEvent = HOOK_WIRING[stem];
      const rendered = renderHook(name, vars);

      // Act
      const events = extractHookSpecificOutputBlocks(rendered)
        .map(readHookEventName)
        .filter(Boolean);

      // Assert — unwired hooks (git hooks, feature-gated helpers) have no
      // event to compare against, so there is nothing to check.
      if (!wiredEvent) return;

      for (const event of events) {
        expect(
          event,
          `${name}: emits "${event}" but settings.json wires it to "${wiredEvent}"`
        ).toBe(wiredEvent);
      }
    });

    it.each(HOOK_TEMPLATES)('should include the required fields for its event in %s', (name) => {
      // Arrange
      const rendered = renderHook(name, vars);

      // Act
      const blocks = extractHookSpecificOutputBlocks(rendered);

      // Assert
      for (const block of blocks) {
        const event = readHookEventName(block);
        const required = REQUIRED_FIELDS_BY_EVENT[event] || [];

        for (const field of required) {
          expect(block, `${name}: ${event} payload is missing "${field}"`).toContain(field);
        }
      }
    });

    it.each(HOOK_TEMPLATES)(
      'should keep top-level-only fields out of hookSpecificOutput in %s',
      (name) => {
        // Arrange
        const rendered = renderHook(name, vars);

        // Act
        const blocks = extractHookSpecificOutputBlocks(rendered);

        // Assert — nesting these parses as valid JSON but is silently ignored,
        // so it cannot be caught by a parse check alone.
        for (const block of blocks) {
          for (const field of TOP_LEVEL_ONLY_FIELDS) {
            expect(
              block,
              `${name}: "${field}" belongs at the top level, not inside hookSpecificOutput`
            ).not.toMatch(new RegExp(`\\b${field}\\b\\s*["']?\\s*[:=]`));
          }
        }
      }
    );
  });
});
