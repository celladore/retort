# Plan: Template Variable Audit & Heuristic Defaults

## 1. Current State Summary

### How template variables flow
```
spec/*.yaml → project-mapping.mjs → synchronize.mjs (vars) → renderTemplate() → generated output
                                         ↑
                            teamVars / agentVars / commandVars
                            (built inline per entity)
```

### Key behaviors
- **Unresolved placeholders are left intact** — `{{unknown}}` stays as literal text in output
- **`{{var|default}}` syntax is supported** — pipe defaults are applied at render time; code-level defaults (`??`, `||`) or `{{#if}}` guards are still recommended where appropriate
- **DEBUG-only warnings** (on `dev`) — unresolved placeholders only warn when `DEBUG=1` is set
- **PR `fix-ci-naming` changes this** — makes warnings always-on (removes DEBUG gate)

---

## 2. Audit Findings

### A. Variables used in templates but NOT wired (would render as unresolved)

| Variable | Used in | Status | Fix |
|----------|---------|--------|-----|
| ~~`teamAccepts`~~ | team-TEMPLATE.md | **Fixed** in this branch | ✅ |
| ~~`teamHandoffChain`~~ | team-TEMPLATE.md | **Fixed** in this branch | ✅ |
| ~~`maxTaskTurns`~~ | team-TEMPLATE.md | **Fixed** in this branch | ✅ |
| ~~`maxHandoffChainDepth`~~ | team-TEMPLATE.md | **Fixed** in this branch | ✅ |
| ~~`maxStagnationTurns`~~ | team-TEMPLATE.md | **Fixed** in this branch | ✅ |
| `containerRuntime` | copilot-instructions.md | **Fixed** in this branch | ✅ |
| `drTestSchedule` | some platform templates | **Fixed** in this branch | ✅ |
| `loggingRetentionDays` | some platform templates | **Fixed** in this branch | ✅ |
| `isSyncBacklog` | sync-backlog template | **Not wired** | Needs mapping |
| `placeholder` / `placeholders` | init templates | Context-specific | May be intentional |

### B. Spec fields that exist in YAML but are never passed as template variables

| Spec field (teams.yaml) | Template var | Status |
|--------------------------|-------------|--------|
| `team.accepts` | `teamAccepts` | **Fixed** in this branch |
| `team.handoff-chain` | `teamHandoffChain` | **Fixed** in this branch |
| `team.max-task-turns` | `maxTaskTurns` | **Fixed** in this branch (new field) |
| `team.max-handoff-chain-depth` | `maxHandoffChainDepth` | **Fixed** in this branch (new field) |
| `team.max-stagnation-turns` | `maxStagnationTurns` | **Fixed** in this branch (new field) |

### C. Variables with missing or weak defaults (used without `{{#if}}` guard)

These variables are used **directly** (no conditional guard) and will render as literal `{{varName}}` if the value is missing:

| Variable | Usage count | Has default in sync? | Risk |
|----------|------------|---------------------|------|
| `repoName` | 126 | ✅ fallback to overlay/dir name | Low |
| `version` | 88 | ✅ from package.json | Low |
| `syncDate` | 74 | ✅ `new Date().toISOString()` | Low |
| `lastModel` | 74 | ✅ env var or `'sync-engine'` | Low |
| `lastAgent` | 74 | ✅ env var or `'agentkit-forge'` | Low |
| `defaultBranch` | 26 | ✅ `'main'` | Low |
| `testingCoverage` | 19 | ❌ No default, used bare | **Medium** — will render `{{testingCoverage}}` |
| `commitConvention` | 7 | ❌ comes from project.yaml only | **Medium** |
| `loggingFramework` | Used bare in sections guarded by `{{#if hasLogging}}` | Indirect guard | Low |
| `errorStrategy` | Used bare in sections guarded by `{{#if hasErrorHandling}}` | Indirect guard | Low |
| `authProvider` | Used bare in `{{#if hasAuth}}` guarded sections | Indirect guard | Low |

### D. Agent variables — all properly wired via `buildAgentVars()`
- `agentName`, `agentId`, `agentCategory`, `agentRole`, `agentFocusList`, `agentResponsibilitiesList`, `agentToolsList`, `agentConventions`, `agentExamples`, `agentAntiPatterns`, `agentDomainRules` — all correctly populated with `||` / empty-string defaults.

### E. Command variables — all properly wired via `buildCommandVars()`
- `commandName`, `commandDescription`, `commandFlags` — correctly populated.

### F. Rule variables — all properly wired
- `ruleDomain`, `ruleDescription`, `ruleAppliesTo`, `ruleConventions` — correctly populated.

---

## 3. Open PRs & Overlap Analysis

### Directly relevant PRs:

| Branch | Description | Overlap |
|--------|-------------|---------|
| `claude/fix-ci-naming-l3Q0C` | Makes placeholder warnings always-on; adds `validateMappingCoverage()` to detect mapping→spec mismatches | **High** — once merged, every unresolved variable will produce a runtime warning. Our fixes preempt those warnings. |
| `feat/sprint-1-check-fixes` | Large refactor of synchronize.mjs (overlay resolution, `aiSynthesisLayer` setting, spec changes) | **Medium** — changes `synchronize.mjs` structure significantly; our teamVars changes may conflict |
| `claude/improve-issue-template-Ci6Wc` | Unifies issue field enums across templates | **Low** — different templates, but touches template engine |
| `copilot/sub-pr-154` | Removes trailing whitespace from generated headers | **Low** — formatting only |

### No overlap:
- `branch-protection-config`, `feature-management-strategy`, `improve-slash-commands`, `cost-management`, `standardize-github-issues` — unrelated to template variable wiring.

---

## 4. Heuristic Improvement Opportunities

### Tier 1: Safe heuristics (can auto-derive from project context)

1. **`maxTaskTurns` based on `teamSize`**
   - `solo` → 15 (less oversight = lower limits)
   - `small` → 25 (default)
   - `medium` / `large` → 35 (more complex tasks)
   - Rationale: larger teams have broader task scopes and more reviewers

2. **`maxHandoffChainDepth` based on team count**
   - `teams.length <= 3` → 3
   - `teams.length <= 6` → 5 (default)
   - `teams.length > 6` → 7
   - Rationale: more teams = more legitimate handoff paths

3. **`maxStagnationTurns` based on `projectPhase`**
   - `greenfield` → 15 (more exploration expected)
   - `active` → 10 (default)
   - `maintenance` / `legacy` → 5 (tighter control, simpler changes)
   - Rationale: greenfield work involves more research turns

4. **`testingCoverage` fallback**
   - If not set in project.yaml, infer from `projectPhase`:
     - `greenfield` → 60
     - `active` → 80
     - `maintenance` → 90
   - Many templates use `{{testingCoverage}}%` without guard

### Tier 2: Suggested defaults (present during `agentkit init` or `agentkit check`)

5. **`commitConvention`** — detect from existing commits or `.commitlintrc`
   - If `conventional-changelog` in devDeps → `conventional`
   - If `.commitlintrc*` exists → `conventional`
   - Default → `conventional` (safe industry standard)

6. **`branchStrategy`** — detect from branch patterns
   - If `release/*` branches exist → `gitflow`
   - If only `main` + feature branches → `github-flow`
   - Default → `github-flow`

7. **`containerRuntime`** — detect from files
   - If `Dockerfile` exists → `docker`
   - If `docker-compose.yml` exists → `docker-compose`
   - Not wired as template var yet

### Tier 3: Structural improvements to the template engine

8. **Add default-value syntax to templates**: `{{var|fallback}}`
   - Would prevent unresolved placeholders without requiring code changes
   - Example: `{{testingCoverage|80}}%`
   - Low complexity change to `replacePlaceholders()` in template-utils.mjs

9. **Add a `spec-defaults.yaml` file**
   - Central place for all default values, read by synchronize.mjs
   - Replaces scattered `??` and `||` defaults in code
   - Makes defaults discoverable and user-overridable

10. **Validate team variable completeness in `agentkit check`**
    - Run `validateMappingCoverage()` (from PR `fix-ci-naming`) against team/agent vars too, not just project mapping
    - Warn if teams.yaml has fields that aren't mapped to any template variable

---

## 5. Recommended Implementation Order

### Phase 1: Fix remaining unwired variables (this PR or follow-up)
- [ ] Wire `containerRuntime` from project.yaml into template vars
- [ ] Wire `drTestSchedule` from project.yaml into template vars
- [ ] Wire `loggingRetentionDays` — already in project-mapping as `logRetentionDays` but template uses `loggingRetentionDays`
- [ ] Verify `isSyncBacklog` is set correctly

### Phase 2: Add safe heuristic defaults (new PR, after `fix-ci-naming` merges)
- [ ] In `synchronize.mjs`, add heuristic fallbacks for `maxTaskTurns`, `maxHandoffChainDepth`, `maxStagnationTurns` based on team/project metadata
- [ ] Add `testingCoverage` phase-based fallback
- [ ] Add `commitConvention` auto-detection

### Phase 3: Template engine enhancement (separate PR)
- [ ] Add `{{var|default}}` pipe syntax to `replacePlaceholders()`
- [ ] Create `spec-defaults.yaml` for centralized defaults
- [ ] Extend `agentkit check` to report unwired template variables

### Phase 4: Coordinate with open PRs
- [ ] Rebase on `fix-ci-naming` once merged (always-on warnings will validate our fixes)
- [ ] Resolve conflicts with `sprint-1-check-fixes` (synchronize.mjs restructuring)

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Heuristic defaults override user intent | Medium | Always prefer explicit spec values; heuristics only fill gaps |
| `{{var|default}}` syntax breaks existing templates | Low | Only activates when `|` present; existing templates untouched |
| Template variable name mismatches (e.g., `loggingRetentionDays` vs `logRetentionDays`) | Medium | Audit all template vars against mapping dest names |
| Merge conflicts with sprint-1 | High | Wait for sprint-1 to merge first, then rebase |
