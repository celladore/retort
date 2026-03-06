# Budget Guard Remediation Plan

**Date**: 2026-03-05
**Branch**: `claude/cost-management-infrastructure-qt4PM`
**Status**: Proposed
**Priority**: P1 (security-critical finding requires immediate attention)

---

## Context

A structured review of the cost management infrastructure (budget-guard module, shell
hook, and supporting specs) identified findings across 10 quality criteria. This plan
organises the remediation into four phases, ordered by risk and dependency.

### Protected File Constraint

The two primary files requiring changes live in protected directories:

| File                    | Directory                           | Protection                      |
| ----------------------- | ----------------------------------- | ------------------------------- |
| `budget-guard.mjs`      | `.agentkit/engines/node/src/`       | PreToolUse hook blocks AI edits |
| `budget-guard-check.sh` | `.agentkit/templates/claude/hooks/` | PreToolUse hook blocks AI edits |

These must be edited by a human contributor or with the template-protection hook
temporarily disabled. The generated output at `.claude/hooks/budget-guard-check.sh`
will need a sync regeneration after the template is updated.

---

## Phase 1: Security & Critical Correctness (P1)

**Goal**: Eliminate the command injection vulnerability and the falsy-zero bug.
**Estimated scope**: 2 files, ~30 lines changed, 5+ new tests.

### 1.1 CRITICAL: Command injection in shell hook

**File**: `.agentkit/templates/claude/hooks/budget-guard-check.sh` (lines 43-51)
**File**: `.claude/hooks/budget-guard-check.sh` (lines 46-54, generated)

**Problem**: `AGENTKIT_ROOT` is interpolated directly into a `node -e` string.
A directory path containing `'; <payload>; '` achieves arbitrary code execution.

**Fix**: Pass `AGENTKIT_ROOT` as an environment variable instead of interpolating
it into the inline script.

```bash
# BEFORE (vulnerable)
RESULT=$(node --input-type=module -e "
import { evaluateForHook } from '${AGENTKIT_ROOT}/engines/node/src/budget-guard.mjs';
...
")

# AFTER (safe)
RESULT=$(AGENTKIT_ROOT="$AGENTKIT_ROOT" node --input-type=module -e "
const root = process.env.AGENTKIT_ROOT;
const { evaluateForHook } = await import(root + '/engines/node/src/budget-guard.mjs');
try {
  const result = evaluateForHook(root);
  console.log(JSON.stringify(result));
} catch {
  console.log('{\"decision\":\"allow\"}');
}
" 2>/dev/null) || RESULT='{"decision":"allow"}'
```

### 1.2 HIGH: Shell JSON construction via string interpolation

**File**: `.agentkit/templates/claude/hooks/budget-guard-check.sh` (lines 58-68)
**File**: `.claude/hooks/budget-guard-check.sh` (lines 59-69, generated)

**Problem**: `$REASON` and `$WARNING` are injected into JSON via string interpolation.
Malicious content in session files could inject JSON keys or break parsing.

**Fix**: Use `jq` for JSON construction (already a dependency — used on line 57).

```bash
# BEFORE (vulnerable)
echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"

# AFTER (safe)
jq -n --arg reason "$REASON" '{"decision":"block","reason":$reason}'
```

Apply the same pattern for the warning output on line 66.

### 1.3 HIGH: Falsy-zero bug — `||` instead of `??`

**File**: `.agentkit/engines/node/src/budget-guard.mjs`
**Lines**: 169, 182, 199, 214, 250, 271, 285, 299

**Problem**: The `||` operator is used for policy defaults. If a user explicitly sets
a limit to `0` (e.g., `warnAtPercent: 0` or `maxCommands: 0`), the falsy `0` value
falls through to the default instead of being respected.

**Fix**: Replace `||` with `??` (nullish coalescing) in all 8 occurrences:

```javascript
// BEFORE
const warnPct = (policy.session?.warnAtPercent || 80) / 100;
const maxMin = policy.session?.maxDurationMinutes || DEFAULT_POLICY.session.maxDurationMinutes;

// AFTER
const warnPct = (policy.session?.warnAtPercent ?? 80) / 100;
const maxMin = policy.session?.maxDurationMinutes ?? DEFAULT_POLICY.session.maxDurationMinutes;
```

### 1.4 HIGH: Regex YAML fallback cannot distinguish nested keys

**File**: `.agentkit/engines/node/src/budget-guard.mjs` (lines 90-118)

**Problem**: `extractBudgetPolicyRegex` uses flat regex matching.
`warnAtPercent` appears under both `session:` and `daily:` — the regex always
returns the first match for both, making `daily.warnAtPercent` incorrect.

**Fix**: Add section-aware extraction that scans within the appropriate YAML block,
or (simpler) document that the regex fallback is approximate and only used when
`js-yaml` is unavailable. If fixing properly:

```javascript
function extractBudgetPolicyRegex(content) {
  if (!/^budgetPolicy:/m.test(content)) return null;

  // Extract section-scoped values
  const getSection = (sectionName) => {
    const sectionMatch = content.match(
      new RegExp(`${sectionName}:\\s*\\n((?:[ \\t]+\\w+:.*\\n?)*)`)
    );
    if (!sectionMatch) return {};
    const block = sectionMatch[1];
    const getNum = (key) => {
      const m = block.match(new RegExp(`${key}:\\s*(\\d+)`));
      return m ? parseInt(m[1], 10) : undefined;
    };
    return {
      maxDurationMinutes: getNum('maxDurationMinutes'),
      maxCommands: getNum('maxCommands'),
      maxFilesModified: getNum('maxFilesModified'),
      maxSessions: getNum('maxSessions'),
      maxTotalDurationMinutes: getNum('maxTotalDurationMinutes'),
      maxTotalCommands: getNum('maxTotalCommands'),
      warnAtPercent: getNum('warnAtPercent'),
    };
  };

  const getStr = (key) => {
    const m = content.match(new RegExp(`${key}:\\s*([\\w]+)`));
    return m ? m[1] : undefined;
  };

  return {
    session: getSection('session'),
    daily: getSection('daily'),
    enforcement: getStr('enforcement'),
  };
}
```

### Phase 1 Tests to Add

| Test                                                                                               | File                    |
| -------------------------------------------------------------------------------------------------- | ----------------------- |
| Policy with `maxCommands: 0` respects the zero value                                               | `budget-guard.test.mjs` |
| Policy with `warnAtPercent: 0` disables warnings                                                   | `budget-guard.test.mjs` |
| Regex extraction returns correct `daily.warnAtPercent` when different from `session.warnAtPercent` | `budget-guard.test.mjs` |
| deepMerge preserves `0` values (does not treat as null)                                            | `budget-guard.test.mjs` |

### Phase 1 Validation

```bash
# After applying fixes:
pnpm -C .agentkit vitest run src/__tests__/budget-guard.test.mjs
pnpm -C .agentkit agentkit:sync   # regenerate .claude/hooks/budget-guard-check.sh
```

---

## Phase 2: Correctness & Robustness (P2)

**Goal**: Fix remaining correctness issues and harden error handling.
**Estimated scope**: 1 file, ~20 lines changed, 4+ new tests.

### 2.1 MEDIUM: Duration rounding accumulation

**File**: `.agentkit/engines/node/src/budget-guard.mjs` (lines 259-266)

**Problem**: `Math.round(s.durationMs / 60_000)` is applied per-session before
summing. Across many short sessions, rounding error accumulates.

**Fix**: Sum milliseconds first, convert to minutes once.

```javascript
// BEFORE
for (const s of todaySessions) {
  if (s.durationMs) {
    metrics.totalDurationMinutes += Math.round(s.durationMs / 60_000);
  }
  ...
}

// AFTER
let totalMs = 0;
for (const s of todaySessions) {
  if (s.durationMs) {
    totalMs += s.durationMs;
  } else if (s.startTime && s.status === 'active') {
    totalMs += Date.now() - new Date(s.startTime).getTime();
  }
  metrics.totalCommands += Array.isArray(s.commandsRun) ? s.commandsRun.length : 0;
}
metrics.totalDurationMinutes = Math.round(totalMs / 60_000);
```

### 2.2 MEDIUM: Midnight boundary race in `getTodaySessions`

**File**: `.agentkit/engines/node/src/budget-guard.mjs` (lines 474, 486)

**Problem**: `new Date()` is called twice — once for `todayPrefix` (line 474) and
once for the `startTime` comparison (line 486). If invoked at 23:59:59.999, these
could return different dates.

**Fix**: Capture the date string once at the top of the function.

```javascript
function getTodaySessions(agentkitRoot) {
  const sessDir = resolve(agentkitRoot, 'logs', 'sessions');
  if (!existsSync(sessDir)) return [];

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPrefix = todayStr.replace(/-/g, '');
  // ... use todayStr and todayPrefix consistently
}
```

### 2.3 LOW: `deepMerge` prototype pollution guard

**File**: `.agentkit/engines/node/src/budget-guard.mjs` (lines 120-136)

**Problem**: `deepMerge` iterates `Object.keys(overrides)` without filtering
`__proto__`, `constructor`, or `prototype`. Currently mitigated by js-yaml's safe
loading, but a defense-in-depth guard is cheap.

**Fix**: Add a key filter.

```javascript
function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (overrides[key] === undefined || overrides[key] === null) continue;
    // ... rest unchanged
  }
  return result;
}
```

### Phase 2 Tests to Add

| Test                                                               | File                    |
| ------------------------------------------------------------------ | ----------------------- |
| Duration rounding: 10 sessions of 90s each = 15 min (not 10 or 20) | `budget-guard.test.mjs` |
| `getTodaySessions` with mixed today/yesterday sessions             | `budget-guard.test.mjs` |
| `deepMerge` rejects `__proto__` keys                               | `budget-guard.test.mjs` |
| Malformed session JSON is skipped without crashing                 | `budget-guard.test.mjs` |

---

## Phase 3: Performance & Test Coverage (P2-P3)

**Goal**: Reduce per-invocation overhead, fill remaining test gaps.
**Estimated scope**: 1-2 files, ~15 lines changed, 6+ new tests.

### 3.1 MEDIUM: Date-prefix filtering for session files

**File**: `.agentkit/engines/node/src/budget-guard.mjs` (lines 475-477)

**Problem**: `getTodaySessions` reads every session file in the directory, then
filters by date. For long-running projects this is O(N) on all historical sessions.

**Fix**: Filter filenames by today's date prefix before reading file content.

```javascript
const todayPrefix = todayStr.replace(/-/g, '');
const files = readdirSync(sessDir).filter(
  (f) => f.startsWith('session-') && f.endsWith('.json') && f.includes(todayPrefix) // filename pre-filter
);
```

Sessions whose filenames don't contain the date prefix still need a content check,
but this eliminates the majority of reads for historical sessions.

### 3.2 MEDIUM: Node.js startup overhead in shell hook

**File**: `.agentkit/templates/claude/hooks/budget-guard-check.sh`

**Problem**: A full Node.js process spawns on every PreToolUse call (50-200ms
overhead). For a typical session with hundreds of tool calls, this adds up.

**Options** (for future consideration):

1. Cache the result for N seconds (e.g., write a timestamp + result file, skip
   re-evaluation if < 30s old)
2. Move to a long-running sidecar process
3. Accept the overhead (simplest, current behavior)

**Recommendation**: Add a simple TTL cache file check at the top of the shell hook.
If `.agentkit/logs/.budget-cache` exists and is < 30s old, echo its content and exit.

### 3.3 Test gaps to fill

| Test                                                    | Priority |
| ------------------------------------------------------- | -------- |
| Corrupt/truncated session JSON is handled gracefully    | P2       |
| Empty session directory returns empty array             | P2       |
| `runBudgetStatus` output includes correct metric values | P2       |
| Session with `commandsRun: null` (not array) is handled | P3       |
| Session with missing `startTime` is handled             | P3       |
| `logBudgetEvent` creates directory if missing           | P3       |

---

## Phase 4: Documentation & Cleanup (P3)

**Goal**: Consolidate duplicate issues, cross-reference docs, tidy up.
**Estimated scope**: Documentation only, no code changes.

### 4.1 Consolidate duplicate issue specs

**Action**: Merge `cost-budget-flag-template-update.md` and
`cost-budget-cli-flag-partial.md` into a single issue. They describe the same gap
(the `--budget` flag not being rendered in the command template).

### 4.2 Cross-reference architect agent analysis

**Action**: Add a reference from `agent-team-restructuring-gaps.md` to
`architect-agent-analysis.md` and `docs-quality-teams-missing-agents.md` to reduce
overlap confusion.

### 4.3 Update line number references

**Action**: Replace hard-coded line numbers in issue specs with function/section
name references that survive refactoring (e.g., "in `checkSessionBudget`, the
duration check block" instead of "line 182").

### 4.4 Note on timestamp-only drift

The 39 generated files showing `last_updated: 2026-03-04 -> 2026-03-05` are cosmetic
drift from re-running sync. No action needed — this is expected behavior.

---

## Execution Order

```
Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 4
(block)     (block)     (parallel)  (parallel)
```

- **Phase 1** must complete before merge (security-critical).
- **Phase 2** should complete before merge (correctness).
- **Phase 3** can be done post-merge as a follow-up PR.
- **Phase 4** can be done in parallel with Phase 3.

## Files Modified Summary

| Phase | File                                                         | Lines Changed (est.) |
| ----- | ------------------------------------------------------------ | -------------------- |
| 1     | `.agentkit/templates/claude/hooks/budget-guard-check.sh`     | ~15                  |
| 1     | `.agentkit/engines/node/src/budget-guard.mjs`                | ~15                  |
| 1-3   | `.agentkit/engines/node/src/__tests__/budget-guard.test.mjs` | ~80                  |
| 2     | `.agentkit/engines/node/src/budget-guard.mjs`                | ~20                  |
| 3     | `.agentkit/engines/node/src/budget-guard.mjs`                | ~10                  |
| 3     | `.agentkit/templates/claude/hooks/budget-guard-check.sh`     | ~10                  |
| 4     | `docs/issues/*.md`                                           | documentation only   |

## Post-Fix Validation

After all phases:

```bash
pnpm -C .agentkit vitest run                    # all tests pass
pnpm -C .agentkit agentkit:sync                 # regenerate outputs
git diff --quiet                                 # no unexpected drift
```
