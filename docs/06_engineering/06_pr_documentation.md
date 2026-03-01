# PR Documentation Strategy

## Overview

Standardized process for documenting completed PRs and implementations.
This ensures comprehensive historical context and effective knowledge transfer.

## When to Create Documentation

### Required (High Impact)

- **Architecture Decisions**: Any ADR implementation
- **Major Refactoring**: Changes affecting many components or significant lines of code
- **New Features**: Significant new functionality or services
- **Performance Improvements**: Major optimizations with measurable results
- **Security Changes**: Authentication, authorization, or security fixes
- **Infrastructure Changes**: CI/CD, deployment, or environment updates
- **Breaking Changes**: API changes that require client updates

### Recommended (Medium Impact)

- **Bug Fixes**: Complex or critical bug resolutions
- **Library Upgrades**: Major version upgrades with migration challenges
- **Tooling Changes**: New development tools or process improvements
- **Test Improvements**: Significant test coverage or strategy changes

### Optional (Low Impact)

- **Minor Features**: Small enhancements or UI improvements
- **Simple Bug Fixes**: Straightforward fixes with minimal impact
- **Configuration Changes**: Minor configuration or environment updates

## Documentation Templates

Templates are provided in `docs/history/`:

| Type | Template | Directory |
|------|----------|-----------|
| Implementation | `TEMPLATE-implementation.md` | `docs/history/implementations/` |
| Bug Fix | `TEMPLATE-bugfix.md` | `docs/history/bug-fixes/` |
| Feature | `TEMPLATE-feature.md` | `docs/history/features/` |
| Migration | `TEMPLATE-migration.md` | `docs/history/migrations/` |

## Creating Documentation

Use the provided script to generate a new document with the correct sequential number:

```bash
# Bash
./scripts/create-doc.sh implementation "My Feature" 42
./scripts/create-doc.sh bugfix "Null Reference Error" 43
./scripts/create-doc.sh feature "User Auth" 44
./scripts/create-doc.sh migration "Upgrade to React 19" 45
```

```powershell
# PowerShell
./scripts/create-doc.ps1 implementation "My Feature" 42
```

## File Naming Convention

```
XXXX-YYYY-MM-DD-[title]-[type].md
```

- `XXXX` — sequential 4-digit number from `docs/history/.index.json`
- `YYYY-MM-DD` — completion date
- `[title]` — kebab-case title (sanitized)
- `[type]` — `implementation`, `bugfix`, `feature`, or `migration`

**Examples:**

```
docs/history/implementations/0001-2026-02-28-treat-warnings-as-errors-implementation.md
docs/history/bug-fixes/0001-2026-03-01-null-reference-bugfix.md
docs/history/features/0001-2026-03-01-user-authentication-feature.md
```

## Documentation Process

### 1. Pre-PR Planning

- Assess the change impact level
- Select the appropriate template
- Start documentation during development

### 2. During Development

- Track progress as milestones are reached
- Record important technical decisions
- Note problems encountered and solutions

### 3. PR Completion

- Finalize all template sections
- Review for accuracy and completeness
- Add to the appropriate `docs/history/` subdirectory

### 4. Post-Merge

- Update cross-references in related ADRs
- Ensure team awareness of new documentation

## PR Checklist Integration

The PR template includes a documentation checklist. For changes classified as
"High Impact", documentation is required before merging, including a
`CHANGELOG.md` entry.

## Changelog Integration

Creating a history document via `./scripts/create-doc.sh` automatically adds
an entry to `CHANGELOG.md` under the `[Unreleased]` section:

| History Doc Type | Changelog Section |
|------------------|-------------------|
| `feature` | `Added` |
| `implementation` | `Added` |
| `bugfix` | `Fixed` |
| `migration` | `Changed` |

To add a changelog entry independently:

```bash
./scripts/update-changelog.sh Added "New feature description" 42 \
  "docs/history/features/0001-2026-03-01-my-feature-feature.md"
```

See [07_changelog.md](./07_changelog.md) for changelog best practices and
optional automation tooling (release-please, conventional-changelog, git-cliff).

## GitHub Actions Enforcement

Two workflows support this process:

- **`documentation-validation.yml`** — Validates documentation exists for
  high-impact PRs (runs on pull requests)
- **`documentation-quality.yml`** — Checks formatting and structure of history
  docs (runs on push to `docs/history/**`)

## Quality Standards

- Fill in all `[bracketed]` placeholder sections
- Link to related ADRs where applicable
- Use proper markdown formatting
- Include quantitative metrics where possible

## References

- [History Index](../../history/README.md)
- [Git Workflow](./04_git_workflow.md)
