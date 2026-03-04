#!/usr/bin/env bash
# =============================================================================
# create-quality-issues.sh — Batch-create GitHub issues for the code quality
# framework expansion plan (docs/06_engineering/09_quality_framework_expansion_plan.md)
#
# Usage:
#   ./scripts/create-quality-issues.sh
#
# Prerequisites:
#   - gh CLI authenticated (gh auth login)
#   - Push access to JustAGhosT/agentkit-forge
# =============================================================================
set -euo pipefail
GH_LAST_ACTION=""

# Make issue creation idempotent by title.
# Intercepts `gh issue create ...` and skips when an issue with the same title already exists.
gh() {
  if [[ "${1:-}" == "issue" && "${2:-}" == "create" ]]; then
    local repo=""
    local title=""
    local args=("$@")
    local i=0

    while [[ $i -lt ${#args[@]} ]]; do
      case "${args[$i]}" in
        --repo)
          i=$((i + 1))
          repo="${args[$i]:-}"
          ;;
        --title)
          i=$((i + 1))
          title="${args[$i]:-}"
          ;;
      esac
      i=$((i + 1))
    done

    if [[ -n "$repo" && -n "$title" ]]; then
      local existing
      existing="$(command gh issue list \
        --repo "$repo" \
        --state all \
        --limit 100 \
        --search "in:title \"$title\"" \
        --json title,url \
        --jq ".[] | select(.title == \"$title\") | .url" 2>/dev/null || true)"

      if [[ -n "$existing" ]]; then
        GH_LAST_ACTION="skipped"
        echo "↷ Skipping existing issue: $title"
        echo "   Existing: $(echo "$existing" | head -n 1)"
        return 0
      fi
    fi

    command gh "$@"
    GH_LAST_ACTION="created"
    return 0
  fi

  command gh "$@"
}

issue_result() {
  local description="$1"
  if [[ "${GH_LAST_ACTION:-}" == "skipped" ]]; then
    echo "  Skipped: $description"
  else
    echo "  Created: $description"
  fi
}

REPO="JustAGhosT/agentkit-forge"
LABEL_QUALITY="quality"
LABEL_DOCS="documentation"
LABEL_CI="ci"
LABEL_ENHANCEMENT="enhancement"

# Ensure labels exist (idempotent)
ensure_label() {
  gh label create "$1" --description "$2" --color "$3" --repo "$REPO" 2>/dev/null || true
}

echo "=== Ensuring labels exist ==="
ensure_label "quality"       "Code quality and static analysis"  "0e8a16"
ensure_label "documentation" "Documentation updates"              "0075ca"
ensure_label "ci"            "Continuous integration"             "5319e7"
ensure_label "enhancement"   "New feature or request"             "a2eeef"
ensure_label "shell"         "Bash/PowerShell scripting"         "c5def5"
ensure_label "css"           "CSS/SCSS/styling"                  "d876e3"
ensure_label "typescript"    "TypeScript-specific"               "3178c6"
ensure_label "phase-1"       "Phase 1: Quick wins (Week 1-2)"   "fbca04"
ensure_label "phase-2"       "Phase 2: Templates (Week 3-4)"    "f9d0c4"
ensure_label "phase-3"       "Phase 3: CSS & HTML (Week 5-6)"   "bfdadc"
ensure_label "phase-4"       "Phase 4: Docs alignment (Week 7-8)" "d4c5f9"
ensure_label "phase-5"       "Phase 5: CI hardening (Month 3)"  "c2e0c6"

echo ""
echo "=== Creating Phase 1 Issues (High-Impact, Low-Effort) ==="

# ---------------------------------------------------------------------------
# ISSUE 1: Shell domain in rules.yaml
# ---------------------------------------------------------------------------
if [[ "${SKIP_ISSUE_1:-0}" != "1" ]]; then
gh issue create --repo "$REPO" \
  --title "feat(rules): add shell scripting domain to rules.yaml" \
  --label "quality,shell,phase-1,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add a `shell` domain to `.agentkit/spec/rules.yaml` with 5 conventions covering ShellCheck compliance, strict mode, shebang requirements, variable quoting, and shfmt formatting.

## Motivation

The repository contains **26 `.sh` files** (bin wrappers, hook scripts, CI scripts) with **zero quality gates**. ShellCheck and shfmt are already allowlisted in `check.mjs` (`ALLOWED_LINTER_BASES`, `ALLOWED_FORMATTER_BASES`) but no rules or enforcement exist.

## Acceptance Criteria

- [ ] Add `shell` domain to `rules.yaml` with `applies-to: ['**/*.sh', '**/*.bash', '.agentkit/bin/*.sh', 'scripts/**/*.sh']`
- [ ] Add 5 conventions: `sh-shellcheck`, `sh-strict-mode`, `sh-shebang`, `sh-quote-variables`, `sh-format`
- [ ] Set `sh-shellcheck` severity to `error` with tool reference `shellcheck`
- [ ] Set `sh-format` severity to `error` with autofix `true` and tool `shfmt -w`
- [ ] Run `agentkit sync` to regenerate outputs
- [ ] Verify generated `.claude/rules/shell.md` is correct

## Reference

- [Quality Framework Expansion Plan, Section 3.4](docs/06_engineering/09_quality_framework_expansion_plan.md#34-bash--shell-scripting)
- Proposed conventions in the plan document

## Complexity

Low — YAML spec addition + sync regeneration
ISSUE_EOF
)"

issue_result "shell domain in rules.yaml"
fi

# ---------------------------------------------------------------------------
# ISSUE 2: ShellCheck CI step
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "ci(quality): add ShellCheck linting for shell scripts" \
  --label "quality,shell,ci,phase-1" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add a ShellCheck linting step to the CI pipeline that validates all 26 `.sh` files in the repository.

## Motivation

Shell scripts are the **largest unlinted code category** in the repo. ShellCheck catches quoting bugs, POSIX portability issues, unused variables, and unreachable code — the most common causes of shell script failures.

## Acceptance Criteria

- [ ] Add ShellCheck step to `.github/workflows/ci.yml` (runs on Ubuntu)
- [ ] Lint all `.sh` files: `scripts/`, `.agentkit/bin/`, `.github/scripts/`
- [ ] Fix any ShellCheck violations found in existing scripts
- [ ] Optionally add shfmt format check step
- [ ] ShellCheck is pre-installed on GitHub-hosted runners — no setup needed

## Proposed CI Step

```yaml
shellcheck:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run ShellCheck
      run: |
        find . -name '*.sh' -not -path '*/node_modules/*' -print0 | \
          xargs -0 shellcheck --severity=warning
```

## Reference

- [Quality Framework Expansion Plan, Phase 1 #2](docs/06_engineering/09_quality_framework_expansion_plan.md#phase-1-high-impact-low-effort-week-1-2)
ISSUE_EOF
)"

issue_result "ShellCheck CI step"

# ---------------------------------------------------------------------------
# ISSUE 3: PowerShell domain in rules.yaml
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(rules): add PowerShell domain to rules.yaml" \
  --label "quality,shell,phase-1,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add a `powershell` domain to `.agentkit/spec/rules.yaml` with 4 conventions covering PSScriptAnalyzer compliance, error handling, verb-noun naming, and parameter validation.

## Motivation

The repository contains **20 `.ps1` files** with no quality gates. These are cross-platform equivalents of the Bash scripts and run on the Windows CI matrix. PSScriptAnalyzer is Microsoft's official PowerShell linter with 60+ rules.

## Acceptance Criteria

- [ ] Add `powershell` domain to `rules.yaml` with `applies-to: ['**/*.ps1', '**/*.psm1', '**/*.psd1']`
- [ ] Add 4 conventions: `ps-scriptanalyzer`, `ps-error-action`, `ps-verb-noun`, `ps-param-validation`
- [ ] Set `ps-scriptanalyzer` severity to `error` with tool reference `Invoke-ScriptAnalyzer`
- [ ] Run `agentkit sync` to regenerate outputs
- [ ] Verify generated rule files are correct

## Reference

- [Quality Framework Expansion Plan, Section 3.5](docs/06_engineering/09_quality_framework_expansion_plan.md#35-powershell)
ISSUE_EOF
)"

issue_result "PowerShell domain in rules.yaml"

# ---------------------------------------------------------------------------
# ISSUE 4: Update check.mjs allowlists and resolvers
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(check): add ruff, shellcheck, and shfmt to quality gate resolvers" \
  --label "quality,phase-1,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Update `check.mjs` resolver maps and allowlists to support additional linting and formatting tools that are already referenced in the spec system but not yet resolvable by the quality gate runner.

## Changes Needed

### ALLOWED_LINTER_BASES — add:
- `ruff` (Python linter; `teams.yaml` declares `ruff check` but the base `ruff` is not in the allowlist)

### ALLOWED_FORMATTER_BASES — add:
- `ruff` (Python formatter; `ruff format` is an alternative to `black`)

### resolveLinter() map — add:
```javascript
'ruff check': { cmd: 'ruff', check: 'ruff check .', fix: 'ruff check --fix .' },
'shellcheck': { cmd: 'shellcheck', check: 'shellcheck **/*.sh', fix: null },
```

### resolveFormatter() map — add:
```javascript
'shfmt': { cmd: 'shfmt', check: 'shfmt -d .', fix: 'shfmt -w .' },
'ruff format': { cmd: 'ruff', check: 'ruff format --check .', fix: 'ruff format .' },
```

## Acceptance Criteria

- [ ] Add `ruff` to both `ALLOWED_LINTER_BASES` and `ALLOWED_FORMATTER_BASES`
- [ ] Add `ruff check` and `shellcheck` entries to `resolveLinter()` map
- [ ] Add `shfmt` and `ruff format` entries to `resolveFormatter()` map
- [ ] Update existing unit tests in `check.test.mjs` for new entries
- [ ] Security model preserved: all new entries use known tool bases

## Reference

- [Quality Framework Expansion Plan, Section 5.1](docs/06_engineering/09_quality_framework_expansion_plan.md#51-files-that-need-modification)
ISSUE_EOF
)"

issue_result "check.mjs allowlists and resolvers"

# ---------------------------------------------------------------------------
# ISSUE 5: TypeScript-specific rules enhancement
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(rules): add TypeScript-specific conventions to typescript domain" \
  --label "quality,typescript,phase-1,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Enhance the existing `typescript` domain in `rules.yaml` with TypeScript-specific conventions that go beyond the current JavaScript-focused rules.

## Motivation

The current `typescript` domain conflates JavaScript and TypeScript. TypeScript has unique quality concerns: tsconfig strictness, generic complexity, enum avoidance (prefer union types), and type-only imports. These need explicit rules.

## New Conventions to Add

| ID | Rule | Severity |
|----|------|----------|
| `ts-strict-config` | Enable `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` in tsconfig.json | error |
| `ts-no-enum` | Prefer union types and `as const` objects over TypeScript enums for better tree-shaking and type narrowing | warning |
| `ts-type-only-imports` | Use `import type` for type-only imports to ensure they are erased at compile time | warning |
| `ts-no-assertion` | Avoid type assertions (`as Type`); prefer type guards and narrowing | warning |

## Acceptance Criteria

- [ ] Add 4 new conventions to the `typescript` domain in `rules.yaml`
- [ ] Run `agentkit sync` to regenerate outputs
- [ ] Verify updated `.claude/rules/typescript.md` includes new rules
- [ ] Update `templates/claude/rules/typescript.md` if template-level changes are needed

## Reference

- [Quality Framework Expansion Plan, Section 3.1](docs/06_engineering/09_quality_framework_expansion_plan.md#31-typescript-distinct-from-javascript)
ISSUE_EOF
)"

issue_result "TypeScript-specific rules enhancement"

# ---------------------------------------------------------------------------
# ISSUE 6: Update Section 7 of code quality assessment
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "docs(engineering): add Section 7 — Extended Language Support to quality assessment" \
  --label "quality,documentation,phase-1" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add Section 7 to `docs/06_engineering/08_code_quality_assessment.md` covering all newly supported language domains with their baselines, tools, and complexity thresholds.

## New Subsections

| # | Subsection | Content |
|---|-----------|---------|
| 7.1 | TypeScript (TS-Specific) | Type-aware linting, tsconfig strictness, generic complexity |
| 7.2 | HTML & Accessibility | JSX/TSX linting, axe-core integration, WCAG automation |
| 7.3 | CSS / SCSS | Stylelint baselines, specificity targets, unused CSS detection |
| 7.4 | Bash / Shell Scripting | ShellCheck thresholds, shfmt config, strict mode requirements |
| 7.5 | PowerShell | PSScriptAnalyzer rules, Pester testing, naming conventions |
| 7.6 | YAML / JSON Configuration | yamllint, schema validation, Prettier formatting |
| 7.7 | Cross-Language Complexity Matrix | Unified thresholds for all 9 language domains |

## Acceptance Criteria

- [ ] Add Section 7 with all 7 subsections
- [ ] Update the Table of Contents at the top of the document
- [ ] Include the cross-language complexity matrix (Appendix A from expansion plan)
- [ ] Include tool installation quick reference (Appendix B from expansion plan)
- [ ] Ensure consistency with existing Sections 3.1-3.4

## Source Material

All content is defined in `docs/06_engineering/09_quality_framework_expansion_plan.md`, Sections 3.1-3.6 and Appendices A-C.

## Reference

- [Quality Framework Expansion Plan, Section 6.1](docs/06_engineering/09_quality_framework_expansion_plan.md#61-primary-document-code-quality-assessment)
ISSUE_EOF
)"

issue_result "Section 7 documentation"

echo ""
echo "=== Creating Phase 2 Issues (Template Expansion) ==="

# ---------------------------------------------------------------------------
# ISSUE 7: Shell language instruction template
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(templates): create shell scripting language instruction template" \
  --label "quality,shell,phase-2,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Create `language-instructions/shell.md` and `claude/rules/shell.md` templates for generating AI assistant guidance on Bash/shell script quality.

## Files to Create

### `.agentkit/templates/language-instructions/shell.md`

Content should cover:
- ShellCheck compliance requirements
- `set -euo pipefail` strict mode
- Variable quoting (`"${var}"`)
- Function structure and naming
- Error handling patterns (`trap`, exit codes)
- Portability considerations (Bash vs POSIX sh)
- Testing with Bats

### `.agentkit/templates/claude/rules/shell.md`

Generated from `rules.yaml` shell domain (created in Phase 1). Should render the 5 conventions into a Claude-readable rule file.

## Acceptance Criteria

- [ ] Create `language-instructions/shell.md` with Handlebars template variables
- [ ] Create `claude/rules/shell.md` with standard rule template structure
- [ ] Ensure templates support `{{#if testingUnit}}` conditionals for Bats
- [ ] Run `agentkit sync` and verify generated output files
- [ ] Verify `.claude/rules/shell.md` and `.github/instructions/languages/shell.md` are generated

## Reference

- [Quality Framework Expansion Plan, Section 5.2](docs/06_engineering/09_quality_framework_expansion_plan.md#52-new-template-files-needed)
ISSUE_EOF
)"

issue_result "Shell language instruction template"

# ---------------------------------------------------------------------------
# ISSUE 8: PowerShell language instruction template
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(templates): create PowerShell language instruction template" \
  --label "quality,shell,phase-2,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Create `language-instructions/powershell.md` and `claude/rules/powershell.md` templates for generating AI assistant guidance on PowerShell script quality.

## Files to Create

### `.agentkit/templates/language-instructions/powershell.md`

Content should cover:
- PSScriptAnalyzer compliance
- `$ErrorActionPreference = 'Stop'` requirement
- Verb-Noun naming convention (approved verbs only)
- Parameter validation attributes (`[Parameter()]`, `[ValidateNotNullOrEmpty()]`)
- Pipeline-friendly function design
- Testing with Pester
- Comment-based help for public functions

### `.agentkit/templates/claude/rules/powershell.md`

Generated from `rules.yaml` powershell domain.

## Acceptance Criteria

- [ ] Create `language-instructions/powershell.md` with Handlebars template variables
- [ ] Create `claude/rules/powershell.md` with standard rule template structure
- [ ] Run `agentkit sync` and verify generated output files
- [ ] Verify `.claude/rules/powershell.md` is generated correctly

## Reference

- [Quality Framework Expansion Plan, Section 5.2](docs/06_engineering/09_quality_framework_expansion_plan.md#52-new-template-files-needed)
ISSUE_EOF
)"

issue_result "PowerShell language instruction template"

# ---------------------------------------------------------------------------
# ISSUE 9: Update format.md and check.md templates
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(templates): update format and check command templates for shell/CSS tools" \
  --label "quality,phase-2,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Update the `/format` and `/check` command templates to include shell scripting tools (shfmt, ShellCheck) and CSS tools (Stylelint) in their detection tables.

## Files to Update

### `templates/claude/commands/format.md`

Add new section:

```markdown
### Shell Scripts

| Signal        | Write Command | Check Command   |
|---------------|---------------|-----------------|
| `*.sh` files | `shfmt -w .`  | `shfmt -d .`    |
```

### `templates/claude/commands/check.md`

Add ShellCheck and PSScriptAnalyzer to the quality gate detection tables:
- ShellCheck for `.sh` files
- PSScriptAnalyzer for `.ps1` files
- Stylelint for `.css`/`.scss` files (if detected)

## Acceptance Criteria

- [ ] Add shfmt section to `format.md`
- [ ] Add ShellCheck, PSScriptAnalyzer, and Stylelint to `check.md` tables
- [ ] Run `agentkit sync` to regenerate
- [ ] Verify generated command files include new tool sections

## Reference

- [Quality Framework Expansion Plan, Section 5.3](docs/06_engineering/09_quality_framework_expansion_plan.md#53-existing-templates-that-need-updates)
ISSUE_EOF
)"

issue_result "Update format and check templates"

echo ""
echo "=== Creating Phase 3 Issues (CSS & HTML) ==="

# ---------------------------------------------------------------------------
# ISSUE 10: CSS domain in rules.yaml
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(rules): add CSS/SCSS domain to rules.yaml" \
  --label "quality,css,phase-3,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add a `css` domain to `.agentkit/spec/rules.yaml` with 5 conventions covering Stylelint compliance, `!important` prohibition, naming conventions, selector specificity limits, and nesting depth.

## Motivation

`discover.mjs` already detects 4 CSS frameworks (Tailwind, SASS, Styled Components, Emotion) and `stylelint` is already in `check.mjs` `ALLOWED_LINTER_BASES`, but no rules or quality baselines exist for CSS/SCSS.

## New Conventions

| ID | Rule | Severity |
|----|------|----------|
| `css-stylelint` | All CSS/SCSS must pass Stylelint with project configuration | error |
| `css-no-important` | Avoid `!important`; fix specificity issues instead | warning |
| `css-naming-convention` | Follow BEM or project naming convention for class names | warning |
| `css-max-specificity` | Selectors must not exceed 3 chained levels | warning |
| `css-nesting-depth` | SCSS nesting must not exceed 3 levels | error |

## Acceptance Criteria

- [ ] Add `css` domain to `rules.yaml` with `applies-to: ['**/*.css', '**/*.scss', '**/*.less']`
- [ ] Add 5 conventions with appropriate severities
- [ ] Create `templates/claude/rules/css.md` template
- [ ] Run `agentkit sync` and verify output
- [ ] Add Stylelint to `resolveLinter()` map in `check.mjs`:
  `'stylelint': { cmd: 'stylelint', check: 'stylelint "**/*.css"', fix: 'stylelint --fix "**/*.css"' }`

## Reference

- [Quality Framework Expansion Plan, Section 3.3](docs/06_engineering/09_quality_framework_expansion_plan.md#33-css--scss)
ISSUE_EOF
)"

issue_result "CSS domain in rules.yaml"

# ---------------------------------------------------------------------------
# ISSUE 11: JSX accessibility linting
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(rules): add eslint-plugin-jsx-a11y to TypeScript ESLint recommendations" \
  --label "quality,typescript,phase-3,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add `eslint-plugin-jsx-a11y` as a recommended ESLint plugin for React/JSX projects in the TypeScript quality baselines, and recommend `axe-core` for E2E accessibility testing.

## Motivation

The `ts-wcag-aa` rule in `rules.yaml` requires WCAG AA compliance for UI components but provides no automated enforcement tooling. `eslint-plugin-jsx-a11y` catches 30+ accessibility issues at lint time.

## Changes Needed

1. **Update `08_code_quality_assessment.md` Section 3.1** — add `eslint-plugin-jsx-a11y` to recommended tooling table
2. **Update `templates/language-instructions/typescript.md`** — add accessibility linting guidance
3. **Update `rules.yaml` `ts-wcag-aa`** — add tool reference to `eslint-plugin-jsx-a11y`
4. **Document `axe-core`** integration for Playwright E2E accessibility testing

## Acceptance Criteria

- [ ] `eslint-plugin-jsx-a11y` documented as recommended for JSX projects
- [ ] `@axe-core/playwright` documented for E2E accessibility testing
- [ ] `ts-wcag-aa` rule updated with tool references
- [ ] TypeScript instruction template updated with accessibility linting section

## Reference

- [Quality Framework Expansion Plan, Section 3.2](docs/06_engineering/09_quality_framework_expansion_plan.md#32-html-including-jsxtsx-templating)
ISSUE_EOF
)"

issue_result "JSX accessibility linting"

# ---------------------------------------------------------------------------
# ISSUE 12: discover.mjs enhancements
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(discover): add detection for Stylelint, ShellCheck, Bats, and Pester" \
  --label "quality,phase-3,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Extend `discover.mjs` to detect additional quality tools that the expanded framework now supports.

## New Detections

### Tool Config Detection (add to `STACK_DETECTORS` configFiles or new section)
- `.stylelintrc*` — Stylelint configuration
- `.shellcheckrc` — ShellCheck configuration

### Testing Framework Detection (add to `TESTING_DETECTORS`)
- `{ name: 'bats', label: 'Bats', configs: ['test/*.bats', '*.bats'] }` — Bash test framework
- `{ name: 'pester', label: 'Pester', configs: ['*.Tests.ps1'] }` — PowerShell test framework

## Acceptance Criteria

- [ ] Add Stylelint config detection to node stack detector `configFiles`
- [ ] Add ShellCheck config detection
- [ ] Add Bats to `TESTING_DETECTORS`
- [ ] Add Pester to `TESTING_DETECTORS`
- [ ] Update `discover.test.mjs` with test cases for new detections
- [ ] Verify `agentkit discover` reports new tools when config files are present

## Reference

- [Quality Framework Expansion Plan, Section 5.1](docs/06_engineering/09_quality_framework_expansion_plan.md#51-files-that-need-modification)
ISSUE_EOF
)"

issue_result "discover.mjs enhancements"

echo ""
echo "=== Creating Phase 4 Issues (Documentation Alignment) ==="

# ---------------------------------------------------------------------------
# ISSUE 13: CONTRIBUTING.md update
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "docs(contributing): add shell/PowerShell quality expectations" \
  --label "documentation,phase-4" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Update `CONTRIBUTING.md` to include quality expectations for shell and PowerShell scripts, and reference the expanded code quality baselines.

## Changes Needed

1. Add a **Shell Scripts** section covering:
   - ShellCheck must pass with no warnings
   - Scripts must use `set -euo pipefail`
   - All variables must be quoted
   - shfmt formatting required

2. Add a **PowerShell Scripts** section covering:
   - PSScriptAnalyzer must pass with no errors
   - `$ErrorActionPreference = 'Stop'` required
   - Verb-Noun naming convention

3. Reference `docs/06_engineering/08_code_quality_assessment.md` for full quality baselines

## Acceptance Criteria

- [ ] Shell quality expectations added to CONTRIBUTING.md
- [ ] PowerShell quality expectations added to CONTRIBUTING.md
- [ ] Cross-reference to quality assessment document added
- [ ] PR review checklist updated if applicable

## Reference

- [Quality Framework Expansion Plan, Section 6.2](docs/06_engineering/09_quality_framework_expansion_plan.md#62-documents-that-reference-code-quality)
ISSUE_EOF
)"

issue_result "CONTRIBUTING.md update"

# ---------------------------------------------------------------------------
# ISSUE 14: Model guide updates
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "docs(reference): update model guides with new language quality references" \
  --label "documentation,phase-4" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Update the 10 model guide files in `docs/08_reference/model-guides/` to reference the expanded quality baselines for shell, PowerShell, CSS, and TypeScript-specific practices.

## Files to Update

| File | Update Needed |
|------|---------------|
| `model-guide-quality.md` | Reference all new language baselines in Section 7 |
| `model-guide-devops.md` | Reference shell/PowerShell quality standards |
| `model-guide-frontend.md` | Reference CSS/HTML quality standards, Stylelint, jsx-a11y |
| `model-guide-testing.md` | Reference Bats, Pester, axe-core testing frameworks |
| `model-guide-backend.md` | Reference TypeScript-specific rules |
| `model-guide-infra.md` | Reference shell scripting standards for IaC scripts |
| `model-guide-security.md` | Reference ShellCheck security rules |
| `model-guide-docs.md` | Reference YAML/JSON quality standards |
| `model-guide-data.md` | Minor — reference Python quality updates |
| `model-guide-product.md` | No changes needed |

## Acceptance Criteria

- [ ] All 9 relevant model guides updated with new quality references
- [ ] References point to correct sections in `08_code_quality_assessment.md`
- [ ] Generated files regenerated via `agentkit sync` if templates are modified

## Note

These are generated files — if the templates in `.agentkit/templates/` generate these guides, the templates should be updated instead and sync should regenerate them.

## Reference

- [Quality Framework Expansion Plan, Section 6.2](docs/06_engineering/09_quality_framework_expansion_plan.md#62-documents-that-reference-code-quality)
ISSUE_EOF
)"

issue_result "Model guide updates"

# ---------------------------------------------------------------------------
# ISSUE 15: ADR-06 weighted decision matrix
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "docs(adr): fill ADR-06 weighted decision matrix with tool evaluations" \
  --label "documentation,quality,phase-4" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Fill in the empty weighted decision matrix in `docs/03_architecture/02_decisions/06-code-quality-maintainability-signal-tooling.md` with actual tool evaluations based on the trade-off analysis completed in the quality framework expansion plan.

## Current State

The ADR has placeholder content:
- Status: Proposed
- Weighted matrix: all cells empty
- Repo-specific inputs: placeholders (`<selected_quality_baseline>`)

## Proposed Content

Use the tool trade-off analysis from Section 4 of the expansion plan to fill the matrix. Suggested options:

| Option | Description |
|--------|-------------|
| A | ESLint + typescript-eslint + Prettier (type-aware, ecosystem depth) |
| B | Biome (speed-first, unified lint+format) |
| C | SonarCloud (unified multi-language dashboard) |
| D | ESLint + SonarCloud hybrid (best-of-both) |

Score using the existing criteria: quality signal breadth, precision, CI fit, developer experience, cost + lock-in.

## Acceptance Criteria

- [ ] Weighted decision matrix filled with scores for 4 options
- [ ] Status changed from "Proposed" to "Accepted"
- [ ] Repo-specific inputs section filled with chosen tools
- [ ] Decision rationale documented

## Reference

- [Quality Framework Expansion Plan, Section 4](docs/06_engineering/09_quality_framework_expansion_plan.md#4-tool-ecosystem-trade-off-analysis)
ISSUE_EOF
)"

issue_result "ADR-06 weighted decision matrix"

echo ""
echo "=== Creating Phase 5 Issues (CI Pipeline Hardening) ==="

# ---------------------------------------------------------------------------
# ISSUE 16: PSScriptAnalyzer in Windows CI
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "ci(quality): add PSScriptAnalyzer linting for PowerShell scripts" \
  --label "quality,shell,ci,phase-5" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add a PSScriptAnalyzer linting step to the CI pipeline that validates all 20 `.ps1` files, running on the Windows matrix runner.

## Motivation

PowerShell scripts are tested on the Windows CI matrix but never linted. PSScriptAnalyzer catches common issues: missing error handling, unapproved verbs, deprecated cmdlets, security anti-patterns.

## Proposed CI Step

```yaml
powershell-lint:
  runs-on: windows-latest
  steps:
    - uses: actions/checkout@v4
    - name: Install PSScriptAnalyzer
      shell: pwsh
      run: Install-Module -Name PSScriptAnalyzer -Force -Scope CurrentUser
    - name: Run PSScriptAnalyzer
      shell: pwsh
      run: |
        $results = Get-ChildItem -Recurse -Filter '*.ps1' |
          Where-Object { $_.FullName -notmatch 'node_modules' } |
          ForEach-Object { Invoke-ScriptAnalyzer -Path $_.FullName -Severity Warning }
        if ($results) {
          $results | Format-Table -AutoSize
          exit 1
        }
```

## Acceptance Criteria

- [ ] Add PSScriptAnalyzer step to CI (Windows runner)
- [ ] Fix any PSScriptAnalyzer violations in existing 20 `.ps1` files
- [ ] Add `PSScriptAnalyzer` to `check.mjs` `ALLOWED_LINTER_BASES`
- [ ] Document PSScriptAnalyzer in the quality assessment

## Reference

- [Quality Framework Expansion Plan, Phase 5 #23](docs/06_engineering/09_quality_framework_expansion_plan.md#phase-5-ci-pipeline-hardening-month-3)
ISSUE_EOF
)"

issue_result "PSScriptAnalyzer in Windows CI"

# ---------------------------------------------------------------------------
# ISSUE 17: yamllint CI step
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "ci(quality): add yamllint for YAML spec validation" \
  --label "quality,ci,phase-5" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Add yamllint to the CI pipeline to validate the 37 YAML files in the repository for consistent formatting, indentation, and common YAML pitfalls (truthy values, duplicate keys).

## Motivation

YAML files are the core spec system for agentkit-forge. Malformed YAML can cause silent sync failures. While `spec-validator.mjs` validates schema, it doesn't catch formatting issues like inconsistent indentation or trailing whitespace.

## Proposed CI Step

```yaml
yaml-lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Install yamllint
      run: pip install yamllint
    - name: Run yamllint
      run: yamllint -c .yamllint.yml .
```

### Suggested `.yamllint.yml` config:
```yaml
extends: default
rules:
  line-length:
    max: 200
  truthy:
    allowed-values: ['true', 'false', 'yes', 'no']
  document-start: disable
  comments:
    min-spaces-from-content: 1
```

## Acceptance Criteria

- [ ] Create `.yamllint.yml` configuration
- [ ] Add yamllint step to CI
- [ ] Fix any yamllint violations in existing YAML files
- [ ] Exclude `pnpm-lock.yaml` from linting

## Reference

- [Quality Framework Expansion Plan, Section 3.6](docs/06_engineering/09_quality_framework_expansion_plan.md#36-yaml--json-configuration-quality)
ISSUE_EOF
)"

issue_result "yamllint CI step"

# ---------------------------------------------------------------------------
# ISSUE 18: Unified complexity dashboard
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "feat(quality): evaluate SonarCloud for unified multi-language quality dashboard" \
  --label "quality,phase-5,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Summary

Evaluate and optionally integrate SonarCloud as a unified quality dashboard that provides cognitive complexity scoring, code duplication detection, and technical debt estimation across all supported languages.

## Why SonarCloud

| Capability | Benefit |
|-----------|---------|
| Cognitive complexity | Single metric across JS/TS, Python, Rust, C#, shell |
| Code duplication | Detect copy-paste across files |
| Technical debt | Time-based estimation of maintenance cost |
| Quality gates | Block PRs that degrade quality |
| PR decoration | Inline comments on issues |
| Historical tracking | Trend analysis over time |

## Alternatives Considered

- **CodeClimate** — similar capabilities but less language breadth
- **Custom ESLint + radon + clippy** reporting — more work, more flexible
- **GitHub code scanning + CodeQL** — already configured but limited to security

## Acceptance Criteria

- [ ] Evaluate SonarCloud free tier for open-source projects
- [ ] Create `sonar-project.properties` with correct source/test paths
- [ ] Add SonarCloud GitHub Action to CI
- [ ] Configure quality gate thresholds matching our baselines
- [ ] Document decision in ADR-06

## Proposed Configuration

```properties
sonar.projectKey=agentkit-forge
sonar.organization=justaghost
sonar.sources=.agentkit/engines/node/src
sonar.tests=.agentkit/engines/node/src/__tests__
sonar.javascript.lcov.reportPaths=.agentkit/coverage/lcov.info
sonar.qualitygate.wait=true
```

## Reference

- [Code Quality Assessment, Section 5.8](docs/06_engineering/08_code_quality_assessment.md)
- [Quality Framework Expansion Plan, Phase 5 #26](docs/06_engineering/09_quality_framework_expansion_plan.md#phase-5-ci-pipeline-hardening-month-3)
ISSUE_EOF
)"

issue_result "SonarCloud evaluation"

# ---------------------------------------------------------------------------
# ISSUE 19: Epic / tracking issue
# ---------------------------------------------------------------------------
gh issue create --repo "$REPO" \
  --title "epic: code quality framework expansion — 6 new language domains" \
  --label "quality,enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Epic: Code Quality Framework Expansion

Expand the code quality assessment framework to cover **6 additional language domains**: TypeScript (distinct from JS), HTML/JSX accessibility, CSS/SCSS, Bash, PowerShell, and YAML/JSON configuration.

## Planning Documents

- [Code Quality Assessment](docs/06_engineering/08_code_quality_assessment.md) — current baselines for JS, Python, Rust, C#
- [Quality Framework Expansion Plan](docs/06_engineering/09_quality_framework_expansion_plan.md) — strategic plan for this epic

## Phase 1: High-Impact, Low-Effort (Week 1-2)
- [ ] Add `shell` domain to `rules.yaml` with 5 conventions
- [ ] Add ShellCheck CI step for 26 `.sh` files
- [ ] Add `powershell` domain to `rules.yaml` with 4 conventions
- [ ] Update `check.mjs` allowlists and resolvers for ruff, shellcheck, shfmt
- [ ] Add TypeScript-specific conventions to typescript domain
- [ ] Add Section 7 to quality assessment document

## Phase 2: Template Expansion (Week 3-4)
- [ ] Create shell language instruction + rules templates
- [ ] Create PowerShell language instruction + rules templates
- [ ] Update format.md and check.md command templates

## Phase 3: CSS & HTML (Week 5-6)
- [ ] Add `css` domain to `rules.yaml`
- [ ] Add `eslint-plugin-jsx-a11y` to TypeScript ESLint recommendations
- [ ] Extend `discover.mjs` with Stylelint, ShellCheck, Bats, Pester detection

## Phase 4: Documentation Alignment (Week 7-8)
- [ ] Update CONTRIBUTING.md with shell/PowerShell expectations
- [ ] Update 10 model guide files
- [ ] Fill ADR-06 weighted decision matrix

## Phase 5: CI Pipeline Hardening (Month 3)
- [ ] Add PSScriptAnalyzer to Windows CI
- [ ] Add yamllint for YAML validation
- [ ] Evaluate SonarCloud for unified quality dashboard

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Languages with quality baselines | 4 | 9 (+125%) |
| Shell scripts with linting | 0/26 | 26/26 (100%) |
| PowerShell scripts with linting | 0/20 | 20/20 (100%) |
| Tools in check.mjs resolvers | 8 | 14 (+75%) |
| rules.yaml domains | 12 | 15 (+25%) |
ISSUE_EOF
)"

issue_result "Epic tracking issue"

echo ""
echo "=== All 19 issues created successfully ==="
echo ""
echo "Issues processed:"
echo "  Phase 1 (6): Shell rules, ShellCheck CI, PowerShell rules, check.mjs update, TS rules, Section 7 docs"
echo "  Phase 2 (3): Shell templates, PowerShell templates, format/check template updates"
echo "  Phase 3 (3): CSS rules, JSX a11y, discover.mjs enhancements"
echo "  Phase 4 (3): CONTRIBUTING.md, model guides, ADR-06 matrix"
echo "  Phase 5 (3): PSScriptAnalyzer CI, yamllint CI, SonarCloud evaluation"
echo "  Epic  (1): Tracking issue with full checklist"
echo ""
echo "Total: 19 issues"