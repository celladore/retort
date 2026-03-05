# SPEC: spec-defaults.yaml — Centralised Default Values Layer

**Status:** Draft
**Feature ID:** F-SDY
**Author:** Claude (AI-assisted)
**Created:** 2026-03-05
**Related:** `synchronize.mjs`, `template-utils.mjs`, `project-mapping.mjs`, PR `fix-ci-naming`
**Depends on:** PR `fix-ci-naming` (removes DEBUG gate on unresolved-placeholder warnings)

---

## 1. Functional Specification

### 1.1 Problem Statement

Template variable defaults are currently scattered across three locations:

| Location | Mechanism | Example |
|---|---|---|
| `synchronize.mjs` | `vars.x = vars.x \|\| fallback` | `issueTracker: 'github'` |
| `template-utils.mjs` | `{{var\|default}}` pipe syntax | `{{testingCoverage\|80}}` |
| `project-mapping.mjs` | Inline heuristic functions | `inferMaxTaskTurns(teamSize)` |

This fragmentation means:
- Adding a new default requires touching engine code and re-testing.
- Non-developer maintainers can't adjust defaults without modifying JS.
- There's no single inventory of "what defaults are in play."

### 1.2 Goal

Introduce a declarative `spec-defaults.yaml` file that serves as the single source of
truth for template-variable default values. The sync engine reads this file _before_
template rendering and applies defaults for any variable that is `undefined` or `null`
after project-mapping.

### 1.3 User Flow

1. Maintainer edits `.agentkit/spec/spec-defaults.yaml`:
   ```yaml
   # Static defaults — applied when project.yaml doesn't set a value
   issueTracker: github
   commitConvention: conventional
   testingCoverage: 80
   defaultBranch: main

   # Phase-based defaults — applied when project.phase matches
   phase:
     greenfield:
       testingCoverage: 60
       maxStagnationTurns: 15
     active:
       testingCoverage: 80
       maxStagnationTurns: 10
     maintenance:
       testingCoverage: 90
       maxStagnationTurns: 5

   # Team-size-based defaults
   teamSize:
     solo:
       maxTaskTurns: 15
     small:
       maxTaskTurns: 25
     medium:
       maxTaskTurns: 35
     large:
       maxTaskTurns: 35
   ```

2. `agentkit sync` loads spec-defaults.yaml, resolves phase/teamSize conditional
   blocks, and merges into template vars _after_ project-mapping but _before_
   template rendering.

3. `agentkit check` validates that all template variables are either:
   - Set by project.yaml + project-mapping, OR
   - Have a default in spec-defaults.yaml, OR
   - Are guarded by `{{#if}}` in every template that uses them.

### 1.4 Merge Precedence (Highest to Lowest)

1. **Overlay settings** (`overlays/<name>/settings.yaml`) — always wins
2. **project.yaml** via project-mapping — explicit user values
3. **Heuristic inference** (`inferMaxTaskTurns`, etc.) — context-aware
4. **spec-defaults.yaml phase/teamSize blocks** — conditional defaults
5. **spec-defaults.yaml static defaults** — unconditional fallbacks
6. **`{{var|default}}` pipe syntax** — template-level last resort

### 1.5 Edge Cases

- **spec-defaults.yaml missing:** Sync continues with current behaviour (no error).
- **Phase block references unknown phase:** Ignored; static default (if any) applies.
- **Variable set to `null` in project.yaml:** Treated as unset; defaults apply.
- **Variable set to `""` (empty string):** Treated as set; defaults do NOT apply.
- **Conflicting phase + teamSize blocks:** Both applied; teamSize wins for
  team-specific vars, phase wins for project-specific vars (defined by a priority
  list in the schema).

### 1.6 Acceptance Criteria

- [ ] `spec-defaults.yaml` is loaded by sync engine when present.
- [ ] Static defaults fill unset variables.
- [ ] Phase-conditional defaults resolve correctly for all 4 phases.
- [ ] TeamSize-conditional defaults resolve correctly for all 4 sizes.
- [ ] Merge precedence is respected (project.yaml > spec-defaults > pipe).
- [ ] `agentkit check` reports variables that have no default AND no `{{#if}}` guard.
- [ ] Existing heuristic functions in `synchronize.mjs` can be migrated to
      spec-defaults.yaml (backward-compatible).
- [ ] Missing file does not break sync.

---

## 2. Technical Specification

### 2.1 Affected Files

| File | Change |
|---|---|
| `.agentkit/spec/spec-defaults.yaml` | **New file** — default values |
| `.agentkit/engines/node/src/synchronize.mjs` | Load + merge spec-defaults |
| `.agentkit/engines/node/src/template-utils.mjs` | (No change — pipe syntax already exists) |
| `.agentkit/engines/node/src/check.mjs` | Add unresolved-variable audit |
| `.agentkit/engines/node/src/__tests__/spec-defaults.test.mjs` | **New file** — unit tests |
| `.agentkit/engines/node/src/__tests__/sync-integration.test.mjs` | Integration tests |

### 2.2 Schema: `spec-defaults.yaml`

```yaml
# Top-level keys are variable names → static default values
# Except reserved keys: "phase", "teamSize", "teamCount"

<variableName>: <value>          # static default

phase:
  <phaseName>:                   # greenfield | active | maintenance | legacy
    <variableName>: <value>

teamSize:
  <sizeName>:                    # solo | small | medium | large
    <variableName>: <value>

teamCount:                       # ranges keyed by threshold
  "<=3":
    maxHandoffChainDepth: 3
  "<=6":
    maxHandoffChainDepth: 5
  ">6":
    maxHandoffChainDepth: 7
```

### 2.3 Implementation

#### 2.3.1 New Function: `loadSpecDefaults(agentkitRoot, projectPhase, teamSize, teamCount)`

```js
// synchronize.mjs — new function
import { readYaml } from './yaml-utils.mjs';

function loadSpecDefaults(agentkitRoot, projectPhase, teamSize, teamCount) {
  const filePath = resolve(agentkitRoot, 'spec', 'spec-defaults.yaml');
  const raw = readYaml(filePath);
  if (!raw) return {};

  const defaults = {};
  const RESERVED = new Set(['phase', 'teamSize', 'teamCount']);

  // 1. Static defaults (lowest priority)
  for (const [key, val] of Object.entries(raw)) {
    if (!RESERVED.has(key)) defaults[key] = val;
  }

  // 2. Phase-conditional overrides
  if (projectPhase && raw.phase?.[projectPhase]) {
    Object.assign(defaults, raw.phase[projectPhase]);
  }

  // 3. TeamSize-conditional overrides
  if (teamSize && raw.teamSize?.[teamSize]) {
    Object.assign(defaults, raw.teamSize[teamSize]);
  }

  // 4. TeamCount-conditional overrides (range matching)
  if (teamCount != null && raw.teamCount) {
    for (const [rangeKey, vals] of Object.entries(raw.teamCount)) {
      if (matchesRange(rangeKey, teamCount)) {
        Object.assign(defaults, vals);
        break; // first match wins (most specific)
      }
    }
  }

  return defaults;
}

function matchesRange(rangeKey, value) {
  const m = rangeKey.match(/^(<=?|>=?|==?)(\d+)$/);
  if (!m) return false;
  const [, op, num] = m;
  const n = parseInt(num, 10);
  switch (op) {
    case '<=': return value <= n;
    case '<':  return value < n;
    case '>=': return value >= n;
    case '>':  return value > n;
    case '=':
    case '==': return value === n;
    default:   return false;
  }
}
```

#### 2.3.2 Integration in `synchronize()`

Insert after project-mapping, before overlay merge:

```js
// In synchronize() — after projectVars is built
const specDefaults = loadSpecDefaults(
  agentkitRoot,
  projectSpec?.phase,
  projectSpec?.process?.teamSize,
  teamsSpec?.teams?.length
);

// Apply defaults: only fill vars that are undefined/null
for (const [key, val] of Object.entries(specDefaults)) {
  if (vars[key] === undefined || vars[key] === null) {
    vars[key] = val;
  }
}
```

#### 2.3.3 Migration Path

Once `spec-defaults.yaml` is implemented, the inline heuristic functions
(`inferMaxTaskTurns`, `inferMaxStagnationTurns`, `inferTestingCoverage`,
`inferMaxHandoffChainDepth`) can be migrated to the YAML file and the JS functions
removed. This is a backward-compatible change since the YAML produces the same values.

The migration should happen in a follow-up PR to keep the initial PR focused.

#### 2.3.4 `agentkit check` Enhancement

Add a new check phase:

```js
// check.mjs — new audit
function auditUnresolvedDefaults(templates, projectVars, specDefaults) {
  const allVars = { ...specDefaults, ...projectVars };
  const issues = [];

  for (const template of templates) {
    // Find all {{varName}} references (excluding block syntax)
    const refs = template.content.match(/\{\{(?!#|\/|else)([a-zA-Z_]\w*)\}\}/g) || [];
    for (const ref of refs) {
      const varName = ref.slice(2, -2);
      if (allVars[varName] === undefined) {
        // Check if guarded by {{#if varName}}
        const guarded = template.content.includes(`{{#if ${varName}}}`);
        if (!guarded) {
          issues.push({ template: template.path, variable: varName });
        }
      }
    }
  }
  return issues;
}
```

### 2.4 Coordination with `fix-ci-naming` PR

The `fix-ci-naming` PR removes the `DEBUG` gate on unresolved-placeholder warnings,
making them always visible. This is a prerequisite because:

1. Without always-on warnings, users won't know which variables need defaults.
2. The `agentkit check` audit builds on the same warning infrastructure.

**Merge order:** `fix-ci-naming` first, then `spec-defaults.yaml`.

### 2.5 Testing Strategy

| Test Case | Setup | Expected |
|---|---|---|
| Static defaults applied | spec-defaults.yaml with `issueTracker: github`, no project.yaml value | `vars.issueTracker === 'github'` |
| project.yaml wins over defaults | Both set `testingCoverage` | project.yaml value used |
| Phase-conditional applied | phase=greenfield, default coverage=60 | `vars.testingCoverage === '60'` |
| TeamSize-conditional applied | teamSize=solo, default turns=15 | `vars.maxTaskTurns === 15` |
| TeamCount range matching | teamCount=4, range `<=6` | `vars.maxHandoffChainDepth === 5` |
| Missing file | No spec-defaults.yaml | Sync succeeds, no defaults applied |
| Empty file | Empty spec-defaults.yaml | Sync succeeds, no defaults applied |
| Unknown phase | phase=`alpha` | Static defaults only |

### 2.6 Rollout Plan

1. **Phase A:** Ship `spec-defaults.yaml` with static + phase + teamSize blocks.
   Migrate existing inline defaults from `synchronize.mjs`.
2. **Phase B:** Add `teamCount` range matching. Add `agentkit check` audit.
3. **Phase C:** Remove inline heuristic functions (breaking change for anyone who
   imported them — unlikely since they're module-private).
