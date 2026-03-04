# fix(spec): Sync check.mjs formatter/linter allowlists with spec

**Priority:** P3 — Low
**Labels:** `bug`, `spec-drift`, `security`
**Blocked by:** None

---

## Problem

`check.mjs` has hardcoded security allowlists for formatters (lines 102-115) and linters (lines 191-201) that prevent arbitrary binary execution from a compromised spec. But `commands.yaml` doesn't document this constraint.

**Allowlisted formatters:** prettier, black, cargo, dotnet, gofmt, rustfmt, clang-format, autopep8, yapf, isort, shfmt, stylua

**Allowlisted linters:** eslint, cargo, pylint, flake8, rubocop, golangci-lint, tslint, stylelint, shellcheck

If a team adds a new tech stack with an unlisted formatter (e.g., `ktlint` for Kotlin), it will **silently be skipped** with only a console.warn.

---

## Implementation Plan

### Step 1: Document allowlists in commands.yaml (~15 min)

Add to the `check` command spec:

```yaml
- name: check
  type: workflow
  # ... existing fields ...
  security:
    description: >
      For safety, only allowlisted formatter and linter binaries are executed.
      Unknown tools are silently skipped to prevent arbitrary code execution
      from a compromised spec file.
    allowed-formatters:
      - prettier
      - black
      - cargo fmt
      - dotnet format
      - gofmt
      - rustfmt
      - clang-format
      - autopep8
      - yapf
      - isort
      - shfmt
      - stylua
    allowed-linters:
      - eslint
      - cargo clippy
      - pylint
      - flake8
      - rubocop
      - golangci-lint
      - tslint
      - stylelint
      - shellcheck
```

### Step 2: Make check.mjs read allowlists from spec (~1 hour)

Instead of hardcoding, read from `commands.yaml` or a dedicated `security.yaml`:

```javascript
function loadAllowlists(agentkitRoot) {
  const specPath = resolve(agentkitRoot, 'spec', 'commands.yaml');
  const spec = yaml.load(readFileSync(specPath, 'utf-8'));
  const checkCmd = spec.workflow.find((c) => c.name === 'check');
  return {
    formatters: new Set(checkCmd?.security?.['allowed-formatters'] || []),
    linters: new Set(checkCmd?.security?.['allowed-linters'] || []),
  };
}
```

### Step 3: Add doctor.mjs check for unknown tools (~30 min)

In `doctor.mjs`, compare teams.yaml tech stack tools against the allowlist:

```javascript
// For each tech stack:
//   If stack.formatter not in allowlist → warning
//   If stack.linter not in allowlist → warning
```

This makes the "silent skip" visible during diagnostics.

---

## Acceptance Criteria

- [ ] Allowlists documented in `commands.yaml` or dedicated spec file
- [ ] `check.mjs` reads allowlists from spec (not hardcoded)
- [ ] `doctor.mjs` warns when tech stack tools aren't in the allowlist
- [ ] Adding a new formatter/linter requires a spec change (reviewable via PR)

---

## Related

- Contradiction #3
- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
