# Code Quality Assessment: Refactoring, SOLID, DRY, Complexity & Class Size

> Comprehensive analysis of code quality practices in the agentkit-forge repository,
> with language-specific baselines and actionable integration recommendations.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Language & Stack-Specific Baselines](#3-language--stack-specific-baselines)
4. [Integration Strategy](#4-integration-strategy)
5. [Configuration Opportunities](#5-configuration-opportunities)
6. [Prioritized Roadmap](#6-prioritized-roadmap)

---

## 1. Executive Summary

AgentKit Forge is a Node.js (ESM) build-time framework that generates AI-tool
configurations from YAML specs. The codebase is **well-structured** with strong
foundations: comprehensive test coverage (23 test files for 24 source modules),
CI/CD with drift checks, conventional commits, and an established rules system.

However, the analysis reveals **five key gaps** between current practice and
industry best practices for code quality discipline:

| Gap | Severity | Current State | Target State |
|-----|----------|---------------|--------------|
| No complexity metrics enforcement | High | No cyclomatic/cognitive complexity gates | Automated thresholds in CI |
| No ESLint configuration | High | Referenced in `rules.yaml` but no config file exists | Fully configured with complexity rules |
| Large file sizes | Medium | `synchronize.mjs` at 1,732 LOC with 41+ functions | Modules under 400 LOC |
| No code coverage enforcement in CI | Medium | Tests exist but no coverage threshold gate | 80% minimum enforced in CI |
| DRY violations in sync helpers | Low | ~15 sync functions with repeated template patterns | Shared abstraction for common pattern |

**Bottom line:** The team has built excellent _specification-level_ quality rules
(in `rules.yaml`) but has not yet fully applied those same standards to the forge
engine itself, nor automated their enforcement through static analysis tooling.

---

## 2. Current State Assessment

### 2.1 What's Working Well

**Strong testing culture:**
- 23 test files covering all 24 source modules (96% module coverage)
- Integration tests (`sync-integration.test.mjs` at 1,115 LOC) validate end-to-end flows
- Extended timeouts (30s) accommodate real filesystem I/O in integration tests
- Test naming follows `<module>.test.mjs` convention consistently

**Robust CI/CD pipeline (8 workflows):**
- `ci.yml`: Cross-platform matrix (Ubuntu/Windows/macOS), frozen lockfiles
- `branch-protection.yml`: Conventional commits enforcement, secret scanning
- `codeql.yml`: Weekly SAST for JavaScript
- `semgrep.yml`: Custom security rules (no `eval()`, no `child_process.exec()` with untrusted input)
- Drift check: `git diff --quiet` after sync prevents generated file desynchronization

**Excellent specification system:**
- `rules.yaml` defines 60+ conventions across 12 domains (TypeScript, .NET, Python, Rust, IaC, security, testing, git workflow, CI/CD, dependency management, documentation, agent conduct)
- Severity levels (critical, error, warning) with autofix flags
- Tool references for each automated rule

**Dependency discipline:**
- Only 2 production dependencies (`@clack/prompts`, `js-yaml`)
- Renovate configured with weekly cadence, SHA-pinned Actions, auto-merge for minor/patch
- `--frozen-lockfile` enforced in all CI jobs

### 2.2 Gaps Identified

#### Gap 1: No Static Analysis (ESLint) Configuration

`rules.yaml` references `eslint --fix` (rule `ts-lint`) and VSCode recommends
`dbaeumer.vscode-eslint`, but **no ESLint configuration file exists** anywhere in
the repository. This means:

- The linting rule is aspirational, not enforced
- No complexity thresholds are gated
- No unused variable detection, no import ordering, no consistent coding patterns

**Impact:** High. ESLint is the single most impactful tool for JavaScript/Node.js
code quality and is trivial to add.

#### Gap 2: No Complexity Metrics

No cyclomatic complexity, cognitive complexity, or function-length limits are
configured or measured anywhere. The largest function (`runSync` in
`synchronize.mjs`) spans 650+ lines including inline orchestration logic.

Current engine file sizes:

| File | LOC | Functions | Concern |
|------|-----|-----------|---------|
| `synchronize.mjs` | 1,732 | 41 | Sync pipeline + all tool-specific sync helpers |
| `discover.mjs` | 1,106 | — | Tech stack detection |
| `spec-validator.mjs` | 1,027 | — | YAML schema validation |
| `task-protocol.mjs` | 956 | — | Task delegation protocol |
| `init.mjs` | 898 | — | Interactive init wizard |
| `orchestrator.mjs` | 890 | — | Multi-team state machine |

Five files exceed 800 LOC. For a Node.js CLI with ESM modules, the recommended
ceiling is **300-400 LOC per module** (see Section 3.1).

#### Gap 3: DRY Violations in Sync Helpers

`synchronize.mjs` contains ~15 sync helper functions that follow an identical
pattern:

```javascript
async function sync<ToolName>(templatesDir, tmpDir, vars, version, repoName, spec) {
  const tplPath = join(templatesDir, '<tool>', '<template>');
  if (!existsSync(tplPath)) return;
  const template = await readTemplateText(tplPath);
  // ... iterate items, render template, insert header, write output
}
```

Functions like `syncCursorTeams`, `syncWindsurfTeams`, `syncCursorCommands`,
`syncWindsurfCommands`, `syncCopilotPrompts`, `syncClaudeCommands`,
`syncCodexSkills`, `syncClineRules`, etc. share 80%+ structural similarity.

A single higher-order `syncTemplatedItems()` function could eliminate this
repetition while preserving per-tool customization through configuration objects.

#### Gap 4: No Code Coverage Gate in CI

`rules.yaml` specifies `qa-coverage-threshold` ("coverage must not decrease")
and references `vitest run --coverage`, but:

- `vitest.config.mjs` has no coverage configuration
- `ci.yml` runs `pnpm test` without `--coverage`
- No coverage threshold is enforced
- No coverage reporting to PR comments

#### Gap 5: SOLID Principle Adherence

**Single Responsibility:** `synchronize.mjs` violates SRP by combining:
- I/O utilities (read/write helpers)
- Template variable construction
- 15+ tool-specific sync strategies
- Main orchestration logic
- Manifest management and stale file cleanup

**Open/Closed Principle:** Adding a new AI tool requires modifying
`synchronize.mjs` directly (adding a new `sync<Tool>` function and wiring it
into `runSync`). A plugin/registry pattern would allow extension without
modification.

**Dependency Inversion:** Functions receive raw file paths and use `existsSync`
/ `readFileSync` directly, making them hard to test without real filesystem I/O.
The 30-second test timeout is a symptom of this coupling.

---

## 3. Language & Stack-Specific Baselines

AgentKit Forge's `teams.yaml` defines four tech stacks: **Node.js (JavaScript/TypeScript)**, **.NET (C#)**, **Rust**, and **Python**. The engine itself is pure JavaScript (ESM). Below are research-backed baselines for each.

### 3.1 JavaScript / TypeScript (Node.js)

This is the **primary language** of the agentkit-forge engine.

#### File & Class Size Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| File/module LOC | 200-400 | ESM modules should be cohesive units; beyond 400 LOC signals multiple responsibilities |
| Function LOC | 20-50 | Functions over 50 lines are hard to reason about; beyond 75 is a code smell |
| Function parameters | ≤ 4 | More than 4 params suggests the function does too much or needs an options object |
| Nesting depth | ≤ 3 | Deep nesting reduces readability; extract to named functions |
| Exports per module | ≤ 10 | More than 10 exports indicates the module should be split |

#### Complexity Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Cyclomatic complexity (per function) | ≤ 10 | 11-20 | > 20 |
| Cognitive complexity (per function) | ≤ 15 | 16-25 | > 25 |
| Max file complexity (sum) | ≤ 100 | 101-200 | > 200 |

#### Recommended Tooling

| Tool | Purpose | Config |
|------|---------|--------|
| **ESLint** (flat config) | Linting + complexity | `eslint.config.mjs` |
| **Prettier** | Formatting (already configured) | `.prettierrc` (exists) |
| **typescript-eslint** | Type-aware linting (if TS added) | Extend ESLint flat config |
| **eslint-plugin-sonarjs** | Cognitive complexity, code smells | Rules in ESLint config |
| **knip** | Dead code / unused exports detection | `knip.json` |
| **c8 / istanbul** | Code coverage (via Vitest) | `vitest.config.mjs` coverage section |

#### SOLID & DRY in JavaScript Idioms

- **SRP:** One module = one purpose. Use barrel files (`index.mjs`) for public API.
- **OCP:** Use higher-order functions, strategy pattern, or plugin registries.
- **LSP:** Use TypeScript interfaces or JSDoc `@typedef` for consistent contracts.
- **ISP:** Export only what consumers need; keep internals private.
- **DIP:** Accept dependencies as function parameters (constructor injection for classes). Avoid direct `fs` calls in business logic.
- **DRY:** Extract repeated patterns into configurable higher-order functions, not classes.

### 3.2 Python

#### File & Class Size Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Module LOC | 300-500 | Python modules tend larger due to docstrings; PEP 8 doesn't set a max but 500 is a practical ceiling |
| Class LOC | 200-300 | Python classes should be cohesive; beyond 300 suggests extraction |
| Function/method LOC | 20-40 | PEP 8 recommends small functions; beyond 40 lines is a smell |
| Function parameters | ≤ 5 | Use dataclasses or typed dicts for complex parameter sets |

#### Complexity Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Cyclomatic complexity | ≤ 10 | 11-15 | > 15 |
| Cognitive complexity | ≤ 15 | 16-25 | > 25 |
| Maintainability index | ≥ 20 | 10-19 | < 10 |

#### Recommended Tooling

| Tool | Purpose |
|------|---------|
| **ruff** | Linting + formatting (already in rules.yaml) — replaces flake8, isort, pyflakes |
| **black** | Formatting (already in rules.yaml) |
| **mypy --strict** | Type checking (already in rules.yaml) |
| **radon** | Cyclomatic complexity and maintainability index |
| **xenon** | Complexity monitoring with threshold enforcement |
| **pytest-cov** | Coverage with threshold enforcement |
| **bandit** | Security-focused static analysis |
| **vulture** | Dead code detection |

#### SOLID & DRY in Python Idioms

- **SRP:** One module, one purpose. Use packages (directories with `__init__.py`) for grouping.
- **OCP:** Use `typing.Protocol` for structural subtyping; ABC for formal contracts.
- **DIP:** Use `typing.Protocol` at module boundaries; inject IO dependencies.
- **DRY:** Use decorators, context managers, and generator functions for repeated patterns.

### 3.3 Rust

#### File & Class Size Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Module LOC | 300-500 | Rust modules include type definitions; 500 LOC is a practical ceiling |
| Function LOC | 30-60 | Rust functions tend longer due to pattern matching; 60 LOC is reasonable |
| Impl block LOC | 200-400 | Large impl blocks should use separate files or traits |
| Struct fields | ≤ 7 | Beyond 7 fields suggests the struct should be decomposed |

#### Complexity Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Cyclomatic complexity | ≤ 15 | 16-25 | > 25 |
| Cognitive complexity | ≤ 20 | 21-30 | > 30 |

Note: Rust thresholds are higher than JS/Python because pattern matching, lifetime
annotations, and error propagation chains add syntactic complexity without
proportional cognitive load.

#### Recommended Tooling

| Tool | Purpose |
|------|---------|
| **cargo clippy** | Linting (already in rules.yaml as `rs-clippy`) |
| **cargo fmt** | Formatting (already in rules.yaml as `rs-fmt`) |
| **cargo-tarpaulin** | Code coverage |
| **cargo-audit** | Dependency vulnerability scanning |
| **cargo-udeps** | Unused dependency detection |
| **cargo-geiger** | Unsafe code metrics |
| **rust-code-analysis** | Cyclomatic/cognitive complexity (Mozilla tool) |

#### SOLID & DRY in Rust Idioms

- **SRP:** One module = one type + its impl. Use mod.rs to organize.
- **OCP:** Traits for extension; generic functions for polymorphism.
- **LSP:** Trait objects with consistent contracts.
- **ISP:** Small, focused traits over large monolithic ones.
- **DIP:** Trait bounds on function parameters; `impl Trait` return types.
- **DRY:** Use macros, generics, and trait default implementations.

### 3.4 .NET / C#

#### File & Class Size Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| File LOC | 200-400 | One class per file; C# conventions favor small, focused classes |
| Class LOC | 150-300 | Microsoft guidelines suggest under 300 LOC for most classes |
| Method LOC | 15-30 | Short methods are the strongest indicator of maintainable C# code |
| Method parameters | ≤ 4 | Use records or DTOs for complex parameter sets |

#### Complexity Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Cyclomatic complexity (method) | ≤ 10 | 11-20 | > 20 |
| Cognitive complexity (method) | ≤ 15 | 16-25 | > 25 |
| Class coupling | ≤ 10 | 11-20 | > 20 |
| Depth of inheritance | ≤ 3 | 4-5 | > 5 |

#### Recommended Tooling

| Tool | Purpose |
|------|---------|
| **dotnet format** | Formatting (already in rules.yaml) |
| **Roslyn analyzers** | Built-in code analysis (CA rules) |
| **StyleCop.Analyzers** | Code style enforcement |
| **SonarAnalyzer.CSharp** | Cognitive complexity, code smells |
| **JetBrains dotCover / coverlet** | Code coverage |
| **NDepend** | Architecture validation, dependency graphs |
| **Roslynator** | 500+ refactoring analyzers |

#### SOLID & DRY in C# Idioms

- **SRP:** One class per file, one responsibility per class. Use partial classes sparingly.
- **OCP:** Use interfaces and dependency injection; `sealed` by default for concrete classes.
- **ISP:** Small interfaces; prefer `IReadOnlyCollection<T>` over `IList<T>` when mutation isn't needed.
- **DIP:** Constructor injection via `IServiceCollection`; already in rules.yaml as `dn-dependency-injection`.
- **DRY:** Use extension methods, generic constraints, and source generators.

---

## 4. Integration Strategy

### 4.1 Code Review Checklists

Add these items to the PR review process (in `CONTRIBUTING.md` or a dedicated
review checklist template):

**Complexity & Size:**
- [ ] No new function exceeds 50 LOC (JS) / 40 LOC (Python) / 60 LOC (Rust) / 30 LOC (C#)
- [ ] No new file exceeds 400 LOC (JS) / 500 LOC (Python/Rust) / 400 LOC (C#)
- [ ] No function has cyclomatic complexity > 10
- [ ] Nesting depth does not exceed 3 levels

**SOLID Principles:**
- [ ] Each new module has a single, clear responsibility
- [ ] New functionality can be extended without modifying existing modules
- [ ] Dependencies are injected, not hardcoded (especially IO operations)
- [ ] Interfaces/protocols are focused and minimal

**DRY:**
- [ ] No significant code duplication introduced (>5 lines repeated 3+ times)
- [ ] Common patterns use shared abstractions
- [ ] Configuration over repetition where patterns vary only by data

**Refactoring:**
- [ ] Boy Scout Rule: code around the change is left cleaner than found (within scope)
- [ ] Extract Method applied for any inline logic block with a comment explaining "what"
- [ ] Magic numbers replaced with named constants

### 4.2 Automated Tooling & CI/CD Pipeline

#### Immediate: Add ESLint to the Engine

Create `eslint.config.mjs` in `.agentkit/` with complexity gates:

```javascript
// .agentkit/eslint.config.mjs
import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  js.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ['engines/node/src/**/*.mjs'],
    rules: {
      // Complexity gates
      'complexity': ['warn', { max: 15 }],
      'max-depth': ['warn', { max: 3 }],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', { max: 4 }],

      // SonarJS cognitive complexity
      'sonarjs/cognitive-complexity': ['warn', 15],

      // Code smells
      'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'warn',

      // Best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
    },
  },
  {
    files: ['engines/node/src/__tests__/**/*.mjs'],
    rules: {
      // Relax rules for test files
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'no-console': 'off',
    },
  },
];
```

#### Immediate: Add Coverage to Vitest

Update `vitest.config.mjs`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80,
      },
      include: ['engines/node/src/**/*.mjs'],
      exclude: ['engines/node/src/__tests__/**'],
    },
  },
});
```

#### Immediate: Add Lint Step to CI

Add to `ci.yml` (before the test job):

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        package_json_file: package.json
    - uses: actions/setup-node@v4
      with:
        node-version: 24
        cache: 'pnpm'
        cache-dependency-path: .agentkit/pnpm-lock.yaml
    - run: pnpm install --frozen-lockfile
      working-directory: .agentkit
    - run: pnpm lint
      working-directory: .agentkit
```

### 4.3 Team Workflows & Training

**Weekly complexity review (15 min):**
Run `npx eslint engines/node/src/ --format json` and review the top 10 most
complex functions. Assign refactoring tickets for any function exceeding the
"red" threshold.

**Refactoring sprints:**
Dedicate 10-15% of each sprint to technical debt reduction, focused on:
1. Splitting oversized modules (start with `synchronize.mjs`)
2. Extracting repeated sync patterns into a shared helper
3. Introducing dependency injection for filesystem operations

**Knowledge sharing:**
- Add complexity metrics to the PR template ("Complexity delta: +/-")
- Document refactoring patterns specific to the codebase in `docs/06_engineering/`
- Run quarterly "complexity audits" comparing metrics over time

### 4.4 Architecture Recommendations

#### Refactor `synchronize.mjs` (Highest Impact)

Split into focused modules:

```
engines/node/src/
  sync/
    index.mjs              # Public API: runSync()
    io.mjs                 # readYaml, readText, writeOutput, walkDir, ensureDir
    variables.mjs          # buildCommandVars, buildAgentVars, buildRuleVars
    manifest.mjs           # Manifest tracking and stale file cleanup
    registry.mjs           # Tool sync plugin registry
    tools/
      claude.mjs           # syncClaudeSettings, syncClaudeCommands, etc.
      cursor.mjs           # syncCursorTeams, syncCursorCommands
      windsurf.mjs         # syncWindsurfTeams, syncWindsurfCommands
      copilot.mjs          # syncCopilot, syncCopilotPrompts, etc.
      gemini.mjs           # syncGemini
      codex.mjs            # syncCodexSkills
      cline.mjs            # syncClineRules
      warp.mjs             # syncWarp
      roo.mjs              # syncRoo
      common.mjs           # Shared syncTemplatedItems() pattern
```

This transformation would:
- Reduce the largest module from 1,732 LOC to ~200 LOC per module
- Enable the Open/Closed Principle: new tools register in `registry.mjs`
- Make each tool's sync logic independently testable
- Eliminate the DRY violations across sync helpers

#### Introduce a Sync Plugin Pattern

```javascript
// sync/common.mjs
export function createTemplatedSync({ templateDir, templateFile, itemsKey, outputPath }) {
  return async function syncItems(templatesDir, tmpDir, vars, version, repoName, spec) {
    const tplPath = join(templatesDir, templateDir, templateFile);
    if (!existsSync(tplPath)) return;
    const template = await readTemplateText(tplPath);
    for (const item of spec[itemsKey] || []) {
      const itemVars = { ...vars, ...buildItemVars(item) };
      const rendered = renderTemplate(template, itemVars, tplPath);
      const withHeader = insertHeader(rendered, '.md', version, repoName);
      const outPath = typeof outputPath === 'function' ? outputPath(item) : outputPath;
      await writeOutput(join(tmpDir, outPath), withHeader);
    }
  };
}
```

---

## 5. Configuration Opportunities

### 5.1 ESLint (New — Does Not Exist Yet)

**Priority: Critical.** This is the single highest-impact addition.

```bash
# Install
cd .agentkit
pnpm add -D eslint @eslint/js eslint-plugin-sonarjs

# Add scripts to package.json
# "lint": "eslint engines/node/src/",
# "lint:fix": "eslint engines/node/src/ --fix"
```

Key rules to configure:

| Rule | Value | Purpose |
|------|-------|---------|
| `complexity` | `max: 15` | Cyclomatic complexity ceiling |
| `max-depth` | `max: 3` | Nesting depth limit |
| `max-lines-per-function` | `max: 60` | Function size limit |
| `max-lines` | `max: 500` | File size limit |
| `max-params` | `max: 4` | Parameter count limit |
| `sonarjs/cognitive-complexity` | `15` | Cognitive complexity (more intuitive than cyclomatic) |
| `sonarjs/no-identical-functions` | `warn` | Detect copy-paste functions |
| `sonarjs/no-duplicate-string` | `threshold: 3` | Detect repeated string literals |
| `no-eval` | `error` | Security (mirrors Semgrep rule) |
| `eqeqeq` | `always` | Prevent loose equality bugs |

### 5.2 Prettier (Already Configured)

Current configuration in `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Status:** Well-configured. No changes needed. The `printWidth: 100` is a
reasonable ceiling for readability.

### 5.3 Vitest Coverage (New — Not Configured)

Add `@vitest/coverage-v8` and configure thresholds:

```bash
cd .agentkit
pnpm add -D @vitest/coverage-v8
```

Recommended thresholds (starting conservative, tighten over time):

| Metric | Phase 1 (now) | Phase 2 (3 months) | Phase 3 (6 months) |
|--------|--------------|-------------------|-------------------|
| Lines | 70% | 80% | 85% |
| Functions | 65% | 75% | 80% |
| Branches | 60% | 70% | 75% |
| Statements | 70% | 80% | 85% |

### 5.4 Markdownlint (Already Configured)

Current `.markdownlint.json`:
```json
{
  "MD013": false,
  "MD033": false,
  "MD041": false
}
```

**Status:** Appropriate for a project that uses HTML in markdown (AI tool
templates) and doesn't enforce line length.

### 5.5 Semgrep (Already Configured)

Current rules in `.semgrep/semgrep.yml`:
- No `eval()` usage
- No `child_process.exec()` with untrusted input

**Enhancement opportunity:** Add rules for:
- Path traversal detection (relevant to the sync engine's file operations)
- Prototype pollution patterns
- Regular expression denial of service (ReDoS)

### 5.6 CodeQL (Already Configured)

Scans JavaScript weekly and on push to `main`. Configuration in
`.github/codeql/codeql-config.yml` targets `engines/node/src/` and
`.github/workflows/`.

**Status:** Well-configured. Consider adding `security-and-quality` query suite
(default is `security-extended`).

### 5.7 Renovate (Already Configured)

Weekly schedule, platform auto-merge for minor/patch, SHA-pinned Actions.

**Status:** Excellent configuration. No changes needed.

### 5.8 SonarQube / SonarCloud (Not Present — Recommended)

For teams using the multi-stack setup (Node + .NET + Python + Rust), SonarCloud
provides unified dashboards with:
- Cognitive complexity scoring across all languages
- Code duplication percentage
- Technical debt estimation
- Quality gate enforcement
- PR decoration with inline comments

Configuration via `sonar-project.properties`:
```properties
sonar.projectKey=agentkit-forge
sonar.sources=.agentkit/engines/node/src
sonar.tests=.agentkit/engines/node/src/__tests__
sonar.javascript.lcov.reportPaths=.agentkit/coverage/lcov.info
sonar.qualitygate.wait=true
```

---

## 6. Prioritized Roadmap

### Phase 1: Quick Wins (Week 1-2)

| Action | Impact | Effort | Details |
|--------|--------|--------|---------|
| Add ESLint with complexity rules | **High** | Low | Create `eslint.config.mjs`, add `lint` script, add CI step |
| Add Vitest coverage thresholds | **High** | Low | Install `@vitest/coverage-v8`, configure 70% initial threshold |
| Add lint + coverage CI steps | **High** | Low | Two new CI jobs: `lint` and `coverage` |
| Update `package.json` scripts | Medium | Trivial | Add `lint`, `lint:fix`, `test:coverage` scripts |

### Phase 2: Structural Improvements (Week 3-6)

| Action | Impact | Effort | Details |
|--------|--------|--------|---------|
| Extract sync IO utilities | **High** | Medium | Move `readYaml`, `readText`, `writeOutput`, `walkDir` to `sync/io.mjs` |
| Extract variable builders | Medium | Medium | Move `buildCommandVars`, `buildAgentVars`, `buildRuleVars` to `sync/variables.mjs` |
| Create shared sync pattern | **High** | Medium | `createTemplatedSync()` in `sync/common.mjs` to eliminate 15 repetitive functions |
| Add PR template with complexity checklist | Medium | Low | `.github/PULL_REQUEST_TEMPLATE.md` with size/complexity items |

### Phase 3: Architecture (Month 2-3)

| Action | Impact | Effort | Details |
|--------|--------|--------|---------|
| Split `synchronize.mjs` into `sync/` directory | **High** | High | See Section 4.4 architecture diagram |
| Introduce tool sync registry | **High** | High | Plugin pattern for Open/Closed compliance |
| Abstract filesystem operations | Medium | Medium | Inject `fs` operations for testability without real I/O |
| Add SonarCloud integration | Medium | Medium | Unified quality dashboard across all supported languages |
| Add knip for dead code detection | Low | Low | Detect unused exports, dependencies, and files |

### Phase 4: Multi-Stack Enforcement (Month 3-6)

| Action | Impact | Effort | Details |
|--------|--------|--------|---------|
| Configure ruff + radon for Python stacks | Medium | Low | Add `pyproject.toml` section with complexity thresholds |
| Configure Roslyn analyzers for .NET stacks | Medium | Low | Add `.editorconfig` CA rules |
| Configure clippy complexity lints for Rust | Medium | Low | Add `clippy.toml` with threshold overrides |
| Add complexity metrics to quality gate runner | **High** | Medium | Extend `check.mjs` to measure and report complexity |
| Quarterly complexity audit automation | Medium | Medium | Scheduled CI job comparing metrics over time |

---

## Appendix A: Metric Summary for Current Codebase

### Engine Source Files (by LOC, descending)

| File | LOC | Functions | Test File | Test LOC |
|------|-----|-----------|-----------|----------|
| synchronize.mjs | 1,732 | 41 | sync-integration.test.mjs | 1,115 |
| discover.mjs | 1,106 | — | discover.test.mjs | — |
| spec-validator.mjs | 1,027 | — | spec-validator.test.mjs | 649 |
| task-protocol.mjs | 956 | — | task-protocol.test.mjs | 670 |
| init.mjs | 898 | — | init.test.mjs | 576 |
| orchestrator.mjs | 890 | — | orchestrator.test.mjs | 409 |
| cost-tracker.mjs | 616 | — | cost-tracker.test.mjs | — |
| template-utils.mjs | 594 | — | template-utils.test.mjs | 934 |
| cli.mjs | 578 | — | cli.test.mjs | — |
| check.mjs | 397 | — | check.test.mjs | — |
| review-runner.mjs | 386 | — | review-runner.test.mjs | 396 |
| project-mapping.mjs | 336 | — | — | — |
| tool-manager.mjs | 282 | — | add-remove.test.mjs | 400 |
| runner.mjs | 274 | — | runner.test.mjs | — |

**Total source:** 11,806 LOC across 24 modules
**Total tests:** 7,864 LOC across 23 test files
**Test-to-source ratio:** 0.67:1 (good; 0.5-1.0 is healthy)

### Files Exceeding Recommended Thresholds

| File | LOC | Threshold (400) | Over by |
|------|-----|-----------------|---------|
| synchronize.mjs | 1,732 | 400 | **333%** |
| discover.mjs | 1,106 | 400 | **177%** |
| spec-validator.mjs | 1,027 | 400 | **157%** |
| task-protocol.mjs | 956 | 400 | **139%** |
| init.mjs | 898 | 400 | **125%** |
| orchestrator.mjs | 890 | 400 | **123%** |
| cost-tracker.mjs | 616 | 400 | **54%** |
| template-utils.mjs | 594 | 400 | **49%** |
| cli.mjs | 578 | 400 | **45%** |

---

## Appendix B: rules.yaml Coverage Assessment

How well does the engine codebase itself follow its own rules.yaml?

| Rule | Status | Notes |
|------|--------|-------|
| ts-lint (ESLint) | **NOT ENFORCED** | No ESLint config exists |
| ts-format (Prettier) | Enforced | `.prettierrc` configured, VSCode format-on-save |
| ts-explicit-types | N/A | Codebase is JavaScript, not TypeScript |
| ts-no-any | N/A | JavaScript; would apply if migrated to TS |
| ts-no-console | **NOT ENFORCED** | `console.log` used throughout for CLI output (acceptable for CLI tools) |
| ts-strict-null | N/A | JavaScript; no strict null checking |
| qa-coverage-threshold | **NOT ENFORCED** | No coverage gate in CI |
| qa-test-naming | Enforced | Consistent `<module>.test.mjs` pattern |
| qa-aaa-pattern | Partially | Tests generally follow AAA but not formally verified |
| qa-no-sleep | Enforced | No sleep calls found in tests |
| sec-no-secrets | Enforced | Secret scanning in CI + Semgrep rules |
| gw-conventional-commits | Enforced | CI checks PR titles |
| ci-quality-gates | **PARTIAL** | lint step missing from CI |
| ci-reproducible-builds | Enforced | `--frozen-lockfile` everywhere |
| dep-pin-versions | Enforced | Renovate manages version bumps |

---

## Appendix C: Quick-Start Commands

```bash
# Install ESLint and coverage tools
cd .agentkit
pnpm add -D eslint @eslint/js eslint-plugin-sonarjs @vitest/coverage-v8

# Run lint (after creating eslint.config.mjs)
pnpm lint

# Run tests with coverage
pnpm test -- --coverage

# Check complexity of a specific file
npx eslint engines/node/src/synchronize.mjs --format stylish

# Find functions exceeding complexity threshold
npx eslint engines/node/src/ --format json | jq '.[] | .messages[] | select(.ruleId == "complexity")'
```
