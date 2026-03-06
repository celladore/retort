# Strategic Plan: Code Quality Framework Expansion

> Expanding the agentkit-forge code quality assessment to cover TypeScript, HTML,
> CSS, Bash, PowerShell, and their associated linting/testing ecosystems alongside
> the already-documented JavaScript, Python, Rust, and C# stacks.

---

## Table of Contents

1. [Situation Analysis](#1-situation-analysis)
2. [Language & Tool Inventory](#2-language--tool-inventory)
3. [New Language Baselines](#3-new-language-baselines)
4. [Tool Ecosystem Trade-off Analysis](#4-tool-ecosystem-trade-off-analysis)
5. [Template & Engine Integration Points](#5-template--engine-integration-points)
6. [Documentation Update Map](#6-documentation-update-map)
7. [Prioritized Implementation Roadmap](#7-prioritized-implementation-roadmap)

---

## 1. Situation Analysis

### What Exists Today

The code quality assessment (`docs/engineering/08_code_quality_assessment.md`)
currently covers **four language stacks** that mirror `teams.yaml` `techStacks`:

| Stack              | Linting                              | Formatting            | Testing             | Complexity                    |
| ------------------ | ------------------------------------ | --------------------- | ------------------- | ----------------------------- |
| JavaScript/Node.js | ESLint (recommended, not configured) | Prettier (configured) | Vitest (configured) | Proposed thresholds           |
| Python             | ruff, pylint, flake8                 | black                 | pytest              | radon/xenon proposed          |
| Rust               | cargo clippy                         | cargo fmt             | cargo test          | rust-code-analysis proposed   |
| C# / .NET          | Roslyn, StyleCop                     | dotnet format         | xUnit, NUnit        | SonarAnalyzer.CSharp proposed |

### What's Missing

Six language/tool domains are used **within the repository itself** or by
**target projects** but have **no quality baselines** in the assessment:

| Domain                            | Presence in Repo                                                | Presence in Target Projects                       | Current Coverage                                                         |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| **TypeScript** (distinct from JS) | Referenced in rules.yaml, templates, discover.mjs               | Primary frontend/backend language for node stacks | Merged with JavaScript; no TS-specific guidance                          |
| **HTML**                          | Referenced in accessibility rules (WCAG AA), format.md template | Frontend components (`.tsx`, `.jsx` render HTML)  | Only accessibility mentions; no linting baseline                         |
| **CSS/SCSS**                      | discover.mjs detects Tailwind, SASS, Styled Components, Emotion | All frontend projects                             | No quality baselines at all                                              |
| **Bash**                          | 26 `.sh` files: bin wrappers, hook scripts, CI scripts          | DevOps teams, CI pipelines                        | `shellcheck` in ALLOWED_LINTER_BASES but no rules, thresholds, or config |
| **PowerShell**                    | 20 `.ps1` files: bin wrappers, hook scripts                     | Windows DevOps, .NET teams                        | No coverage at all                                                       |
| **YAML/JSON** (config)            | 37 YAML + 20 JSON files; core spec system                       | All projects (CI, config, IaC)                    | markdownlint exists but no YAML/JSON linting                             |

### Why This Matters

1. **TypeScript divergence**: TypeScript-specific tooling (`typescript-eslint`,
   `tsc --noEmit`, `tsconfig.json` strictness) requires distinct guidance from
   plain JavaScript. The current assessment conflates them.

2. **Shell script blind spot**: 46 shell scripts (26 `.sh` + 20 `.ps1`) have
   **zero quality gates**. The CI matrix runs on Windows (PowerShell) and
   Linux/macOS (Bash) but doesn't lint either.

3. **CSS is a framework strength**: `discover.mjs` detects 4 CSS frameworks
   (Tailwind, SASS, Styled Components, Emotion) but the quality framework offers
   no guidance on CSS complexity, naming conventions, or tooling.

4. **Template system gap**: The `language-instructions/` templates generate
   per-language AI guidance. Expanding quality baselines directly improves the
   quality of generated instructions.

---

## 2. Language & Tool Inventory

### 2.1 Complete File-Type Census (This Repository)

| Extension      | Count | Category             | Quality Tools Active               |
| -------------- | ----- | -------------------- | ---------------------------------- |
| `.md`          | 421   | Documentation        | markdownlint-cli2                  |
| `.mjs`         | 51    | JavaScript (ESM)     | Prettier (no ESLint)               |
| `.sh`          | 26    | Bash scripts         | None                               |
| `.yaml`/`.yml` | 37    | Configuration        | None                               |
| `.ps1`         | 20    | PowerShell scripts   | None                               |
| `.json`        | 20    | Configuration/data   | None (validated by spec-validator) |
| `.cmd`         | 9     | Windows CMD wrappers | None                               |
| `.mdc`         | 4     | Cursor rules         | None                               |

### 2.2 Languages Detected by discover.mjs (Target Projects)

| Stack  | Languages              | Frameworks Detected                                                   |
| ------ | ---------------------- | --------------------------------------------------------------------- |
| node   | TypeScript, JavaScript | React, Next.js, Vue, Angular, Svelte, Astro, Express, NestJS, Fastify |
| dotnet | C#, F#                 | ASP.NET Core                                                          |
| rust   | Rust                   | Axum, Actix                                                           |
| python | Python                 | FastAPI, Django, Flask                                                |
| go     | Go                     | (basic detection)                                                     |
| ruby   | Ruby                   | Rails                                                                 |
| java   | Java, Kotlin           | Spring Boot                                                           |

### 2.3 Tool Reference Matrix (Already in Codebase)

Sources: `check.mjs` allowlists, `rules.yaml` conventions, `discover.mjs` detectors,
`format.md` template.

| Tool              | Referenced In                       | Allowlisted     | Has Rules       | Has Config |
| ----------------- | ----------------------------------- | --------------- | --------------- | ---------- |
| ESLint            | rules.yaml, check.mjs, discover.mjs | Yes (linter)    | Yes (ts-lint)   | **No**     |
| Prettier          | rules.yaml, check.mjs, .prettierrc  | Yes (formatter) | Yes (ts-format) | **Yes**    |
| Biome             | format.md template                  | No              | No              | No         |
| typescript-eslint | —                                   | No              | No              | No         |
| stylelint         | check.mjs ALLOWED_LINTER_BASES      | Yes (linter)    | No              | No         |
| shellcheck        | check.mjs ALLOWED_LINTER_BASES      | Yes (linter)    | No              | No         |
| PSScriptAnalyzer  | —                                   | No              | No              | No         |
| htmlhint          | —                                   | No              | No              | No         |
| ruff              | rules.yaml, check.mjs               | Via raw cmd     | Yes (py-lint)   | No         |
| black             | rules.yaml, check.mjs               | Yes (formatter) | Yes (py-format) | No         |
| cargo clippy      | rules.yaml, check.mjs               | Yes (linter)    | Yes (rs-clippy) | No         |
| cargo fmt         | rules.yaml, check.mjs               | Yes (formatter) | Yes (rs-fmt)    | No         |
| dotnet format     | rules.yaml, check.mjs               | Yes (both)      | Yes (dn-format) | No         |
| shfmt             | check.mjs ALLOWED_FORMATTER_BASES   | Yes (formatter) | No              | No         |
| yamllint          | —                                   | No              | No              | No         |
| jsonlint          | —                                   | No              | No              | No         |

---

## 3. New Language Baselines

### 3.1 TypeScript (Distinct from JavaScript)

TypeScript warrants separate treatment because it has unique tooling, type-system
complexity concerns, and stricter configuration requirements.

#### File & Module Size Targets

| Metric                      | Target  | Rationale                                            |
| --------------------------- | ------- | ---------------------------------------------------- |
| File LOC                    | 200-400 | Same as JS; TS type annotations add ~10-15% overhead |
| Interface/type file LOC     | 100-200 | Pure type files should be small and focused          |
| Function LOC                | 20-50   | Same as JS                                           |
| Type parameters per generic | ≤ 3     | Beyond 3 generics, readability drops sharply         |
| Union type variants         | ≤ 7     | Discriminated unions beyond 7 become unwieldy        |

#### Complexity Thresholds

| Metric                   | Green | Yellow | Red  |
| ------------------------ | ----- | ------ | ---- |
| Cyclomatic complexity    | ≤ 10  | 11-20  | > 20 |
| Cognitive complexity     | ≤ 15  | 16-25  | > 25 |
| Type instantiation depth | ≤ 5   | 6-10   | > 10 |

#### Linting Tools

| Tool                           | Role                           | Recommendation                                                                                                                                                                                        |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ESLint + typescript-eslint** | Primary linter                 | **Recommended primary.** Type-aware rules (`no-floating-promises`, `no-misused-promises`, `strict-boolean-expressions`) catch bugs that JS-only ESLint cannot. Use flat config (`eslint.config.mts`). |
| **Biome**                      | Alternative linter + formatter | **Secondary option.** Faster than ESLint (~10-100x), supports TS natively, but smaller rule set. Good for projects prioritizing speed over rule breadth. Already referenced in `format.md` template.  |
| **oxlint**                     | Emerging alternative           | **Watch list.** Written in Rust, extremely fast, growing rule compatibility with ESLint. Not yet mature enough for primary recommendation.                                                            |
| **deno lint**                  | Deno-ecosystem linter          | **Niche.** Only recommend for Deno projects. Not relevant for Node.js stacks.                                                                                                                         |

**Rationale for ESLint as primary:** typescript-eslint provides 100+ type-aware
rules that require the TypeScript compiler's type information. No alternative
currently matches this depth. Biome is the strongest alternative but lacks
type-aware analysis.

#### Testing Frameworks

| Framework      | Role                     | Recommendation                                                                                                                                                                |
| -------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vitest**     | Primary unit/integration | **Recommended primary.** Native ESM, TypeScript support via esbuild, API-compatible with Jest, fastest option for Vite-based projects. Already used by agentkit-forge itself. |
| **Jest**       | Legacy primary           | **Secondary.** Still the most widely used; recommend for brownfield projects already using Jest. CJS-focused; ESM support requires configuration.                             |
| **Playwright** | E2E testing              | **Recommended for E2E.** Cross-browser, auto-wait, TypeScript-first. Already detected by discover.mjs.                                                                        |
| **Cypress**    | Alternative E2E          | **Secondary.** Excellent developer experience but limited to Chromium-based browsers for component testing. Already detected by discover.mjs.                                 |

#### Template Requirements

- `language-instructions/typescript.md` — **already exists** with comprehensive guidance
- `rules/typescript.md` — **already exists** in `.agentkit/templates/claude/rules/`
- **New needed:** TS-specific ESLint config snippet in quality assessment Section 5

#### SOLID & DRY in TypeScript Idioms

- **SRP:** Leverage the module system; separate types/interfaces into `*.types.ts` files
- **OCP:** Use generics and mapped types for extensibility without modification
- **LSP:** Strict interface contracts; use `satisfies` operator for type-safe literals
- **ISP:** Use `Pick<T, K>`, `Omit<T, K>`, and utility types to narrow interfaces
- **DIP:** Use interface-based dependency injection; support both class DI (NestJS) and functional DI patterns
- **DRY:** Use generics, conditional types, and template literal types to eliminate type-level repetition

---

### 3.2 HTML (Including JSX/TSX Templating)

HTML quality is primarily a concern in frontend components (`.tsx`, `.jsx`, `.html`)
and in accessibility compliance.

#### Quality Targets

| Metric                 | Target                       | Rationale                                                                         |
| ---------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Template nesting depth | ≤ 5 levels                   | Deeply nested HTML is hard to maintain and signals component decomposition needed |
| Component render LOC   | ≤ 50 JSX lines               | Long render functions should be split into sub-components                         |
| ARIA completeness      | 100% on interactive elements | WCAG AA compliance requires ARIA on all custom interactive widgets                |

#### Linting Tools

| Tool                       | Role                          | Recommendation                                                                                                                       |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **eslint-plugin-jsx-a11y** | Accessibility linting for JSX | **Recommended primary for React/Preact.** Catches missing `alt`, missing ARIA, invalid roles. Integrates with existing ESLint setup. |
| **HTMLHint**               | Static HTML linting           | **Secondary.** Useful for projects with raw `.html` files (marketing pages, email templates). Not needed for JSX-only projects.      |
| **axe-core**               | Runtime accessibility testing | **Recommended for E2E.** Use via `@axe-core/playwright` or `@axe-core/react` for automated WCAG compliance testing.                  |
| **html-validate**          | Strict HTML validation        | **Niche.** More thorough than HTMLHint but heavier setup. Recommend for projects requiring strict HTML5 spec compliance.             |

**Rationale:** Most HTML in modern stacks is written as JSX/TSX, so
`eslint-plugin-jsx-a11y` covers the primary use case. Raw HTML linting is only
needed for specific project types.

#### Testing Frameworks

| Framework                                      | Role                                     |
| ---------------------------------------------- | ---------------------------------------- |
| **Playwright**                                 | Visual regression + accessibility audits |
| **Testing Library** (`@testing-library/react`) | Component DOM testing                    |
| **Storybook** + **Chromatic**                  | Visual snapshot testing                  |

#### Template Requirements

- No `language-instructions/html.md` exists — **new template needed** if raw HTML
  projects are common; otherwise, HTML guidance lives within the TypeScript
  instruction template's accessibility section (which already exists).
- `rules.yaml` already covers HTML via `ts-wcag-aa` rule — but only for JSX contexts.
  Consider adding an `html` domain for raw HTML projects.

---

### 3.3 CSS / SCSS

#### Quality Targets

| Metric                | Target                | Rationale                                                            |
| --------------------- | --------------------- | -------------------------------------------------------------------- |
| Stylesheet LOC        | ≤ 300                 | Large CSS files signal missing component boundaries                  |
| Selector specificity  | ≤ 3 chained selectors | High specificity leads to unmaintainable override chains             |
| Nesting depth (SCSS)  | ≤ 3                   | Mirrors the BEM convention; deeper nesting creates brittle selectors |
| `!important` count    | 0 (target)            | Every `!important` is a specificity escape hatch; minimize           |
| Unused CSS percentage | < 5%                  | Dead CSS bloats bundles and confuses maintenance                     |

#### Linting Tools

| Tool                         | Role                      | Recommendation                                                                                                                                      |
| ---------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stylelint**                | Primary CSS/SCSS linter   | **Recommended primary.** 170+ rules, configurable, plugin ecosystem (stylelint-order, stylelint-scss). Already in `check.mjs` ALLOWED_LINTER_BASES. |
| **Biome**                    | Alternative (limited CSS) | **Watch list.** Biome's CSS support is experimental as of 2025. Not ready for primary use.                                                          |
| **PurgeCSS / Lightning CSS** | Unused CSS detection      | **Supplementary.** Use in build pipeline to tree-shake unused styles.                                                                               |

**Rationale for Stylelint as primary:** It is the only mature, dedicated CSS linter
with comprehensive rule coverage. Biome's CSS support is not yet production-ready.
Stylelint integrates well with Prettier (use `stylelint-config-prettier` to avoid
conflicts).

#### Testing Frameworks

| Framework             | Role                                        |
| --------------------- | ------------------------------------------- |
| **Chromatic / Percy** | Visual regression testing for style changes |
| **Playwright**        | Cross-browser visual testing                |
| **Storybook**         | Component isolation for visual review       |

#### Template Requirements

- **New `rules.yaml` domain:** `css` — covering selector naming, specificity limits,
  nesting depth, `!important` prohibition, color/spacing token usage
- **New addition to `format.md`:** Already partially present (Prettier handles CSS);
  add Stylelint section
- **discover.mjs enhancement:** Already detects Tailwind, SASS, Styled Components,
  Emotion. Could add stylelint config detection (`.stylelintrc.*`)
- **teams.yaml consideration:** CSS doesn't need its own techStack entry. CSS
  tooling is a sub-concern of the `node` stack for frontend teams.

---

### 3.4 Bash / Shell Scripting

This is the **highest-priority gap for this repository** — 26 `.sh` files with
zero quality gates.

#### Quality Targets

| Metric             | Target | Rationale                                                                            |
| ------------------ | ------ | ------------------------------------------------------------------------------------ |
| Script LOC         | ≤ 200  | Shell scripts over 200 LOC should be rewritten in a real language                    |
| Function LOC       | ≤ 30   | Shell functions should be very short; complex logic belongs elsewhere                |
| Nesting depth      | ≤ 3    | Deeply nested `if`/`for`/`while` in shell is extremely error-prone                   |
| Global variables   | ≤ 5    | Minimize global state; use `local` declarations in functions                         |
| Unquoted variables | 0      | Every `$variable` reference must be quoted (`"$variable"`) to prevent word splitting |

#### Linting Tools

| Tool                                     | Role                    | Recommendation                                                                                                                                                               |
| ---------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ShellCheck**                           | Primary static analyzer | **Recommended primary.** Industry standard; catches quoting bugs, POSIX portability issues, unused variables, unreachable code. Already in `check.mjs` ALLOWED_LINTER_BASES. |
| **shfmt**                                | Formatter               | **Recommended.** Already in `check.mjs` ALLOWED_FORMATTER_BASES. Enforces consistent indentation, binary operator placement, simplification.                                 |
| **Bats** (Bash Automated Testing System) | Testing framework       | **Recommended for complex scripts.** TAP-compliant test runner for Bash.                                                                                                     |

**Rationale for ShellCheck as primary:** No real alternatives exist at the same
quality level. ShellCheck is the `eslint` of shell scripting — comprehensive,
well-maintained, and widely adopted. It catches the class of bugs (unquoted
variables, missing error handling) that cause the most shell script failures.

#### Template Requirements

- **New `rules.yaml` domain:** `shell` — covering ShellCheck compliance, `set -euo pipefail`,
  quoting requirements, function structure
- **New `language-instructions/shell.md`:** Generated AI instruction template for
  Bash/shell scripts
- **teams.yaml consideration:** Shell scripts are owned by the `devops` team. Not a
  separate techStack, but quality rules should apply to `.sh` files in scope.
- **CI integration:** Add ShellCheck to the CI pipeline for the agentkit-forge
  repository itself (26 scripts currently unchecked).

#### Recommended rules.yaml Conventions

```yaml
- domain: shell
  description: >
    Standards for Bash and shell scripts. Covers static analysis,
    error handling, portability, and script structure.
  applies-to:
    - '**/*.sh'
    - '**/*.bash'
    - '.agentkit/bin/*.sh'
    - 'scripts/**/*.sh'
  conventions:
    - id: sh-shellcheck
      rule: 'All shell scripts must pass ShellCheck with no warnings'
      severity: error
      autofix: false
      tool: 'shellcheck'

    - id: sh-strict-mode
      rule: >
        All scripts must use strict mode: set -euo pipefail.
        This catches unset variables, command failures, and pipe failures.
      severity: error
      autofix: false

    - id: sh-shebang
      rule: >
        All scripts must have a shebang line. Use #!/usr/bin/env bash
        for Bash scripts. Never use #!/bin/sh for scripts using Bash features.
      severity: error
      autofix: false

    - id: sh-quote-variables
      rule: >
        All variable expansions must be double-quoted unless intentionally
        performing word splitting. Use "${var}" not $var.
      severity: error
      autofix: false

    - id: sh-format
      rule: 'All scripts must be formatted with shfmt'
      severity: error
      autofix: true
      tool: 'shfmt -w'
```

---

### 3.5 PowerShell

#### Quality Targets

| Metric             | Target                       | Rationale                                                        |
| ------------------ | ---------------------------- | ---------------------------------------------------------------- |
| Script LOC         | ≤ 300                        | PowerShell is more expressive than Bash; slightly higher ceiling |
| Function LOC       | ≤ 50                         | Advanced functions with parameter blocks run longer              |
| Cmdlet parameters  | ≤ 7                          | PowerShell supports rich parameter sets but keep them focused    |
| Comment-based help | Required on public functions | PowerShell convention; enables `Get-Help`                        |

#### Linting Tools

| Tool                 | Role                    | Recommendation                                                                                                                               |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **PSScriptAnalyzer** | Primary static analyzer | **Recommended primary.** Microsoft's official PowerShell linter. 60+ rules covering best practices, security, compatibility, and code style. |
| **Pester**           | Testing framework       | **Recommended.** PowerShell's BDD testing framework. Write `.Tests.ps1` files.                                                               |
| **PSReadLine**       | Interactive formatter   | Editor integration only; not CI-relevant.                                                                                                    |

**Rationale for PSScriptAnalyzer:** It is the only mature PowerShell linter, maintained
by Microsoft, and integrated into VS Code's PowerShell extension. No alternatives exist
at comparable maturity.

#### Template Requirements

- **New `rules.yaml` domain:** `powershell` — covering PSScriptAnalyzer compliance,
  `$ErrorActionPreference = 'Stop'`, parameter validation, verb-noun naming
- **New `language-instructions/powershell.md`:** Generated AI instruction template
- **check.mjs enhancement:** Add `PSScriptAnalyzer` to `ALLOWED_LINTER_BASES`; add
  `Invoke-ScriptAnalyzer` to `resolveLinter()` map
- **CI integration:** PSScriptAnalyzer already works on the Windows matrix runner.
  Add a lint step that runs `Invoke-ScriptAnalyzer -Path scripts/ -Recurse`.

#### Recommended rules.yaml Conventions

```yaml
- domain: powershell
  description: >
    Standards for PowerShell scripts. Covers static analysis,
    error handling, naming conventions, and parameter design.
  applies-to:
    - '**/*.ps1'
    - '**/*.psm1'
    - '**/*.psd1'
  conventions:
    - id: ps-scriptanalyzer
      rule: 'All PowerShell scripts must pass PSScriptAnalyzer with no errors'
      severity: error
      autofix: false
      tool: 'Invoke-ScriptAnalyzer'

    - id: ps-error-action
      rule: >
        All scripts must set $ErrorActionPreference = 'Stop' at the top.
        This ensures errors are not silently swallowed.
      severity: error
      autofix: false

    - id: ps-verb-noun
      rule: >
        All functions must use approved PowerShell verbs (Get-Verb output).
        Function names must follow Verb-Noun convention.
      severity: warning
      autofix: false

    - id: ps-param-validation
      rule: >
        Public function parameters must use [Parameter()] attributes with
        Mandatory, ValidateNotNullOrEmpty, or ValidateSet as appropriate.
      severity: warning
      autofix: false
```

---

### 3.6 YAML / JSON (Configuration Quality)

#### Quality Targets

| Metric                 | Target                                         | Rationale                                             |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| YAML file LOC          | ≤ 500                                          | Large YAML files are error-prone; split into includes |
| JSON nesting depth     | ≤ 5                                            | Deeply nested JSON is hard to navigate                |
| Key naming consistency | snake_case or camelCase (pick one per project) | Inconsistent casing causes bugs in key lookups        |

#### Linting Tools

| Tool                               | Role                   | Recommendation                                                                                                    |
| ---------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **yamllint**                       | YAML linter            | **Recommended.** Checks indentation, line length, truthy values, duplicate keys.                                  |
| **ajv-cli** / **check-jsonschema** | JSON Schema validation | **Recommended for structured configs.** Already partially implemented by `spec-validator.mjs` for agentkit specs. |
| **Prettier**                       | YAML/JSON formatter    | **Already configured.** Prettier formats `.json` and `.yaml` files.                                               |

#### Template Requirements

- Not a separate `rules.yaml` domain — YAML/JSON quality is a cross-cutting concern
  handled by Prettier (formatting) and schema validation (spec-validator).
- **Enhancement opportunity:** Add yamllint to CI for the 37 YAML files in this repo.

---

## 4. Tool Ecosystem Trade-off Analysis

### 4.1 TypeScript/JavaScript Linting: ESLint vs. Biome vs. oxlint

| Criterion              | ESLint + typescript-eslint          | Biome                     | oxlint                         |
| ---------------------- | ----------------------------------- | ------------------------- | ------------------------------ |
| **Rule breadth**       | 300+ rules (with TS plugin)         | ~200 rules                | ~400 rules (ESLint-compatible) |
| **Type-aware rules**   | Yes (requires tsc)                  | No                        | No                             |
| **Performance**        | Slow (100-1000ms/file)              | Fast (1-10ms/file)        | Fastest (Rust-based)           |
| **Formatter included** | No (needs Prettier)                 | Yes (replaces Prettier)   | No                             |
| **Ecosystem maturity** | 10+ years, massive plugin ecosystem | 2 years, growing fast     | 1 year, rapid development      |
| **Config complexity**  | High (flat config helps)            | Low (single `biome.json`) | Low (eslint-compatible)        |
| **CI integration**     | Excellent                           | Good                      | Good                           |

**Decision:**

- **Primary:** ESLint + typescript-eslint — unmatched type-aware analysis
- **Alternative:** Biome — recommend for teams prioritizing speed over type-aware rules
- **Watch:** oxlint — promising but not yet stable enough for primary recommendation

### 4.2 Python Linting: ruff vs. pylint vs. flake8

| Criterion         | ruff                                                            | pylint                          | flake8                   |
| ----------------- | --------------------------------------------------------------- | ------------------------------- | ------------------------ |
| **Performance**   | 10-100x faster (Rust-based)                                     | Slowest                         | Moderate                 |
| **Rule breadth**  | 800+ rules (replaces flake8, isort, pyflakes, pydocstyle, etc.) | 400+ unique rules               | 200+ with plugins        |
| **Autofix**       | Yes (many rules)                                                | No                              | No                       |
| **Formatting**    | Yes (`ruff format` replaces black)                              | No                              | No                       |
| **Type checking** | No (use mypy/pyright)                                           | Basic type inference            | No                       |
| **Config**        | `pyproject.toml` section                                        | `.pylintrc` or `pyproject.toml` | `.flake8` or `setup.cfg` |

**Decision:**

- **Primary:** ruff — replaces multiple tools, fastest, most comprehensive
- **Secondary:** pylint — for teams needing its unique rules (e.g., design smell detection)
- **Deprecated:** flake8 — ruff subsumes all flake8 functionality

This aligns with existing `rules.yaml` which already recommends `ruff check`.

### 4.3 Rust: Clippy vs. Alternatives

| Criterion          | cargo clippy              | rust-analyzer (IDE) | cargo-audit         |
| ------------------ | ------------------------- | ------------------- | ------------------- |
| **Role**           | Linting (500+ lints)      | IDE intelligence    | Dependency security |
| **CI integration** | Excellent (`-D warnings`) | Not CI-relevant     | Excellent           |
| **Autofix**        | Partial (`--fix`)         | IDE-only            | N/A                 |

**Decision:** No real competition. Clippy is the standard Rust linter. Supplement with:

- `cargo-audit` for dependency security
- `cargo-tarpaulin` for coverage
- `cargo-udeps` for unused dependencies

### 4.4 C# / .NET: Roslyn Analyzers vs. SonarAnalyzer

| Criterion                | Roslyn (built-in CA rules) | StyleCop.Analyzers | SonarAnalyzer.CSharp           |
| ------------------------ | -------------------------- | ------------------ | ------------------------------ |
| **Rule breadth**         | ~150 CA rules              | ~200 style rules   | ~400 rules                     |
| **Cognitive complexity** | No                         | No                 | Yes                            |
| **Code smell detection** | Basic                      | No                 | Comprehensive                  |
| **Cost**                 | Free (built-in)            | Free               | Free (OSS) / Paid (SonarCloud) |
| **Config**               | `.editorconfig`            | `.editorconfig`    | `SonarQube` or inline          |

**Decision:**

- **Primary:** Roslyn built-in analyzers + StyleCop — zero cost, zero setup for .NET projects
- **Enhancement:** SonarAnalyzer.CSharp — add for cognitive complexity measurement
- **Dashboard:** SonarCloud — recommend for teams wanting unified multi-language quality views

### 4.5 Shell: ShellCheck — No Real Competition

ShellCheck is the undisputed standard. Alternatives like `checkbashisms` are
complementary (POSIX portability checking) not replacements. shfmt handles
formatting; ShellCheck handles correctness.

### 4.6 CSS: Stylelint as the Only Viable Option

Stylelint is the only mature, dedicated CSS linter. Biome's CSS support is
experimental. Prettier handles formatting. The ecosystem is settled:
Stylelint for rules + Prettier for formatting.

---

## 5. Template & Engine Integration Points

### 5.1 Files That Need Modification

#### rules.yaml (`.agentkit/spec/rules.yaml`)

Add three new domains:

| New Domain   | Conventions to Add                                                                             | Priority                                                     |
| ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `shell`      | sh-shellcheck, sh-strict-mode, sh-shebang, sh-quote-variables, sh-format                       | **High** (26 unchecked files in repo)                        |
| `powershell` | ps-scriptanalyzer, ps-error-action, ps-verb-noun, ps-param-validation                          | **Medium** (20 unchecked files in repo)                      |
| `css`        | css-stylelint, css-no-important, css-naming-convention, css-max-specificity, css-nesting-depth | **Medium** (no CSS in this repo but affects target projects) |

Enhance existing domain:

| Domain       | Enhancement                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript` | Add TS-specific rules: `ts-strict-config` (strictNullChecks, noUncheckedIndexedAccess), `ts-no-enum` (prefer union types), `ts-type-only-imports` |

#### check.mjs (`.agentkit/engines/node/src/check.mjs`)

| Change                           | Details                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Add to `ALLOWED_LINTER_BASES`    | `'psscriptanalyzer'` (or handle via PowerShell invocation)                             |
| Add to `resolveLinter()` map     | `'shellcheck': { cmd: 'shellcheck', check: 'shellcheck **/*.sh', fix: null }`          |
| Add to `resolveLinter()` map     | `'ruff check': { cmd: 'ruff', check: 'ruff check .', fix: 'ruff check --fix .' }`      |
| Add to `resolveFormatter()` map  | `'shfmt': { cmd: 'shfmt', check: 'shfmt -d .', fix: 'shfmt -w .' }`                    |
| Add to `resolveFormatter()` map  | `'ruff format': { cmd: 'ruff', check: 'ruff format --check .', fix: 'ruff format .' }` |
| Add to `ALLOWED_LINTER_BASES`    | `'ruff'` (currently only raw command, not in allowlist)                                |
| Add to `ALLOWED_FORMATTER_BASES` | `'ruff'`                                                                               |

#### discover.mjs (`.agentkit/engines/node/src/discover.mjs`)

| Change                     | Details                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| Add to `TESTING_DETECTORS` | `{ name: 'bats', label: 'Bats', configs: ['test/', '*.bats'] }`        |
| Add to `TESTING_DETECTORS` | `{ name: 'pester', label: 'Pester', configs: ['*.Tests.ps1'] }`        |
| Add CSS linting detection  | Check for `.stylelintrc*` in `configFiles` for the node stack detector |
| Add shell tool detection   | Check for `.shellcheckrc` or `.shellcheck` config                      |

#### teams.yaml (`.agentkit/spec/teams.yaml`)

No new techStack entries recommended. Shell and CSS are sub-concerns of existing
stacks:

- Shell scripts → `devops` team scope
- CSS/SCSS → `frontend` team scope (part of `node` stack)
- PowerShell → `devops` team scope

However, the `devops` team scope should explicitly include shell scripts:

```yaml
- id: devops
  scope:
    [
      '.github/workflows/**',
      'scripts/**',
      'docker/**',
      '**/Dockerfile*',
      '**/*.sh',
      '**/*.ps1',
      '.agentkit/bin/**',
    ]
```

### 5.2 New Template Files Needed

| Template               | Path                                                      | Priority                                               |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Shell instruction      | `.agentkit/templates/language-instructions/shell.md`      | **High**                                               |
| PowerShell instruction | `.agentkit/templates/language-instructions/powershell.md` | **Medium**                                             |
| CSS instruction        | `.agentkit/templates/language-instructions/css.md`        | **Low** (CSS guidance can live in TypeScript template) |
| Shell rules            | `.agentkit/templates/claude/rules/shell.md`               | **High**                                               |
| PowerShell rules       | `.agentkit/templates/claude/rules/powershell.md`          | **Medium**                                             |
| CSS rules              | `.agentkit/templates/claude/rules/css.md`                 | **Low**                                                |

### 5.3 Existing Templates That Need Updates

| Template                              | Change Needed                                                           |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `claude/commands/format.md`           | Add shfmt section for shell scripts                                     |
| `claude/commands/check.md`            | Add ShellCheck and PSScriptAnalyzer to quality gate tables              |
| `claude/rules/typescript.md`          | Add TS-specific rules (strict config, enum avoidance, type imports)     |
| `language-instructions/typescript.md` | Differentiate TS from JS more clearly; add tsconfig strictness guidance |
| `copilot/instructions/quality.md`     | Reference new shell/PS quality standards                                |

---

## 6. Documentation Update Map

### 6.1 Primary Document: Code Quality Assessment

**File:** `docs/engineering/08_code_quality_assessment.md`

Add **Section 7: Extended Language Support** covering:

| Subsection                           | Content                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| 7.1 TypeScript (TS-Specific)         | Type-aware linting, tsconfig strictness, generic complexity, TS vs JS distinctions |
| 7.2 HTML & Accessibility             | JSX/TSX linting, axe-core integration, WCAG compliance automation                  |
| 7.3 CSS / SCSS                       | Stylelint baselines, specificity targets, unused CSS detection                     |
| 7.4 Bash / Shell Scripting           | ShellCheck thresholds, shfmt configuration, strict mode requirements               |
| 7.5 PowerShell                       | PSScriptAnalyzer rules, Pester testing, naming conventions                         |
| 7.6 YAML / JSON Configuration        | yamllint, schema validation, Prettier formatting                                   |
| 7.7 Cross-Language Complexity Matrix | Unified view of thresholds across all 9 language domains                           |

### 6.2 Documents That Reference Code Quality

Each of these files contains references to code quality practices and should be
reviewed for consistency with the expanded framework:

| File                                                                            | Type                | Relevance                                            | Update Needed                                     |
| ------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `docs/engineering/02_coding_standards.md`                                       | Generated template  | Placeholder content for language/style/linter fields | Fill in based on detected stack                   |
| `docs/engineering/03_testing.md`                                                | Generated template  | Testing standards                                    | Reference new testing frameworks (Bats, Pester)   |
| `docs/architecture/decisions/03-tooling-strategy.md`                            | ADR template        | Tooling selection ADR                                | Reference expanded tool baselines                 |
| `docs/architecture/decisions/06-code-quality-maintainability-signal-tooling.md` | ADR template        | Quality tool ADR                                     | Fill weighted matrix with actual tool evaluations |
| `docs/reference/model-guides/model-guide-quality.md`                            | Generated reference | Quality team guide                                   | Reference Section 7 baselines                     |
| `docs/reference/model-guides/model-guide-devops.md`                             | Generated reference | DevOps team guide                                    | Reference shell/PS quality standards              |
| `docs/reference/model-guides/model-guide-frontend.md`                           | Generated reference | Frontend team guide                                  | Reference CSS/HTML quality standards              |
| `docs/reference/model-guides/model-guide-testing.md`                            | Generated reference | Testing team guide                                   | Reference Bats, Pester, axe-core                  |
| `docs/product/PRD-001-llm-decision-engine.md`                                   | PRD                 | References quality scoring                           | Ensure alignment with expanded metrics            |
| `CONTRIBUTING.md`                                                               | Contributor guide   | Code quality expectations                            | Add shell/PS linting requirements                 |

### 6.3 Generated Files (Updated via Spec → Sync)

These are output files regenerated by `agentkit sync`. They update automatically
when the upstream specs and templates change:

| Generated File                                      | Updated By Changing                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| `.claude/rules/typescript.md`                       | `rules.yaml` typescript domain + `templates/claude/rules/typescript.md`           |
| `.claude/rules/shell.md` (**new**)                  | `rules.yaml` shell domain + `templates/claude/rules/shell.md` (**new**)           |
| `.claude/rules/powershell.md` (**new**)             | `rules.yaml` powershell domain + `templates/claude/rules/powershell.md` (**new**) |
| `.claude/rules/css.md` (**new**)                    | `rules.yaml` css domain + `templates/claude/rules/css.md` (**new**)               |
| `.cursor/rules/shell.mdc` (**new**)                 | Same sources, Cursor MDC format                                                   |
| `.github/instructions/languages/shell.md` (**new**) | `templates/language-instructions/shell.md` (**new**)                              |

---

## 7. Prioritized Implementation Roadmap

### Phase 1: High-Impact, Low-Effort (Week 1-2)

These changes address real quality gaps in the agentkit-forge repository itself.

| #   | Action                                                                     | Impact     | Effort | Dependencies                           |
| --- | -------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------- |
| 1   | Add `shell` domain to `rules.yaml` with 5 conventions                      | **High**   | Low    | None                                   |
| 2   | Add ShellCheck CI step for 26 `.sh` files                                  | **High**   | Low    | ShellCheck available on GitHub runners |
| 3   | Add `powershell` domain to `rules.yaml` with 4 conventions                 | **Medium** | Low    | None                                   |
| 4   | Add `ruff` and `shellcheck` to `check.mjs` allowlists and resolver maps    | **High**   | Low    | None (code change in check.mjs)        |
| 5   | Update Section 7 in `08_code_quality_assessment.md` with all new baselines | **High**   | Medium | Sections 3.1-3.6 of this plan          |
| 6   | Add TS-specific rules to `typescript` domain in `rules.yaml`               | **Medium** | Low    | None                                   |

### Phase 2: Template Expansion (Week 3-4)

| #   | Action                                                             | Impact     | Effort | Dependencies |
| --- | ------------------------------------------------------------------ | ---------- | ------ | ------------ |
| 7   | Create `language-instructions/shell.md` template                   | **High**   | Medium | Phase 1 #1   |
| 8   | Create `templates/claude/rules/shell.md` template                  | **High**   | Low    | Phase 1 #1   |
| 9   | Create `language-instructions/powershell.md` template              | **Medium** | Medium | Phase 1 #3   |
| 10  | Create `templates/claude/rules/powershell.md` template             | **Medium** | Low    | Phase 1 #3   |
| 11  | Update `format.md` template with shfmt section                     | **Low**    | Low    | None         |
| 12  | Update `check.md` template with ShellCheck/PSScriptAnalyzer tables | **Medium** | Low    | None         |

### Phase 3: CSS & HTML (Week 5-6)

| #   | Action                                                                   | Impact     | Effort | Dependencies |
| --- | ------------------------------------------------------------------------ | ---------- | ------ | ------------ |
| 13  | Add `css` domain to `rules.yaml` with 5 conventions                      | **Medium** | Low    | None         |
| 14  | Create `templates/claude/rules/css.md` template                          | **Low**    | Low    | Phase 3 #13  |
| 15  | Add Stylelint to `check.mjs` resolver map                                | **Medium** | Low    | None         |
| 16  | Add `eslint-plugin-jsx-a11y` to TypeScript ESLint config recommendations | **Medium** | Low    | None         |
| 17  | Add `.stylelintrc*` detection to `discover.mjs`                          | **Low**    | Low    | None         |

### Phase 4: Documentation Alignment (Week 7-8)

| #   | Action                                                               | Impact       | Effort | Dependencies              |
| --- | -------------------------------------------------------------------- | ------------ | ------ | ------------------------- |
| 18  | Update `CONTRIBUTING.md` with expanded quality expectations          | **Medium**   | Low    | All previous phases       |
| 19  | Update all 10 model guide files for new language references          | **Medium**   | Medium | Phase 1-3                 |
| 20  | Fill in ADR-06 weighted decision matrix with actual tool evaluations | **Medium**   | Medium | Section 4 trade-offs      |
| 21  | Update `02_coding_standards.md` template with stack-detected values  | **Low**      | Medium | Template engine change    |
| 22  | Run `agentkit sync` to regenerate all outputs                        | **Required** | Low    | All spec/template changes |

### Phase 5: CI Pipeline Hardening (Month 3)

| #   | Action                                                      | Impact     | Effort | Dependencies                    |
| --- | ----------------------------------------------------------- | ---------- | ------ | ------------------------------- |
| 23  | Add PSScriptAnalyzer to Windows CI matrix                   | **Medium** | Medium | Phase 1 #3                      |
| 24  | Add yamllint to CI for spec YAML validation                 | **Low**    | Low    | None                            |
| 25  | Add Stylelint to the node techStack quality gate (optional) | **Medium** | Medium | Phase 3 #15                     |
| 26  | Create unified complexity dashboard (SonarCloud or custom)  | **High**   | High   | All language thresholds defined |
| 27  | Add Bats/Pester test detection to `discover.mjs`            | **Low**    | Low    | None                            |

---

## Appendix A: Cross-Language Complexity Matrix

Unified view of recommended thresholds across all language domains:

| Language   | File LOC | Function LOC  | Cyclomatic (Green) | Cognitive (Green) | Nesting Depth  |
| ---------- | -------- | ------------- | ------------------ | ----------------- | -------------- |
| JavaScript | 200-400  | 20-50         | ≤ 10               | ≤ 15              | ≤ 3            |
| TypeScript | 200-400  | 20-50         | ≤ 10               | ≤ 15              | ≤ 3            |
| Python     | 300-500  | 20-40         | ≤ 10               | ≤ 15              | ≤ 3            |
| Rust       | 300-500  | 30-60         | ≤ 15               | ≤ 20              | ≤ 4            |
| C# / .NET  | 200-400  | 15-30         | ≤ 10               | ≤ 15              | ≤ 3            |
| Bash       | ≤ 200    | ≤ 30          | ≤ 8                | ≤ 10              | ≤ 3            |
| PowerShell | ≤ 300    | ≤ 50          | ≤ 10               | ≤ 12              | ≤ 3            |
| CSS/SCSS   | ≤ 300    | N/A           | N/A                | N/A               | ≤ 3 (selector) |
| HTML (JSX) | N/A      | ≤ 50 (render) | N/A                | N/A               | ≤ 5 (template) |

## Appendix B: Tool Installation Quick Reference

```bash
# Shell quality tools
brew install shellcheck shfmt        # macOS
apt-get install shellcheck shfmt     # Ubuntu/Debian

# PowerShell quality tools
Install-Module -Name PSScriptAnalyzer -Force -Scope CurrentUser
Install-Module -Name Pester -Force -Scope CurrentUser

# CSS quality tools (Node.js projects)
pnpm add -D stylelint stylelint-config-standard stylelint-config-prettier

# TypeScript quality (extending existing ESLint)
pnpm add -D typescript-eslint @typescript-eslint/parser eslint-plugin-jsx-a11y

# YAML quality
pip install yamllint
# or
brew install yamllint

# Accessibility testing
pnpm add -D @axe-core/playwright    # For Playwright E2E
pnpm add -D @axe-core/react         # For React component testing
```

## Appendix C: Alignment with Existing check.mjs Architecture

The quality gate runner already supports the extension pattern needed. Each new
tool maps to an existing concept:

```
teams.yaml techStack
  └── linter: 'shellcheck'     →  check.mjs resolveLinter()  →  ALLOWED_LINTER_BASES
  └── formatter: 'shfmt'       →  check.mjs resolveFormatter() → ALLOWED_FORMATTER_BASES
  └── testCommand: 'bats test/' →  check.mjs buildSteps()      →  direct execution
```

No architectural changes to `check.mjs` are needed — only additions to the
resolver maps and allowlists. The security model (allowlists preventing arbitrary
binary execution) is preserved.
