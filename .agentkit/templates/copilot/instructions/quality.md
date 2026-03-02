<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# Copilot Instructions — Quality Assurance

Apply these rules for all quality gate checks, CI configuration, and
code-review activities in **{{projectName}}**.

## Definition of Done

A work item is complete only when **all** of the following pass:

| Gate | Check | Tool |
|------|-------|------|
| Lint | Zero new lint errors | Project linter |
| Type safety | No type errors | tsc / mypy / cargo check |
| Unit tests pass | All tests green | {{#if testingUnit}}{{testingUnit}}{{/if}}{{#unless testingUnit}}project test runner{{/unless}} |
| Coverage threshold | ≥ {{#if testingCoverage}}{{testingCoverage}}{{/if}}{{#unless testingCoverage}}target{{/unless}}% | Coverage tool |
| Integration tests pass | All green | {{#if testingIntegration}}{{testingIntegration}}{{/if}}{{#unless testingIntegration}}project test runner{{/unless}} |
| No secrets in diff | Clean | git-secrets / semgrep |
| PR description complete | Template filled | Manual |
| Code review approved | ≥ 1 approval | GitHub |

## Code Review Checklist

When reviewing a pull request, verify:

- [ ] Logic is correct and handles edge cases
- [ ] Tests cover the new/changed behaviour (not just happy path)
- [ ] No hardcoded secrets, credentials, or PII
- [ ] Public APIs are backwards compatible or migration path documented
- [ ] Error cases are handled and surfaced meaningfully
- [ ] No dead code, commented-out blocks, or debug statements left in
- [ ] Commit messages follow the {{#if commitConvention}}{{commitConvention}}{{/if}}{{#unless commitConvention}}project{{/unless}} commit convention

## Static Analysis

Run the following checks before every commit:

```bash
# Lint (auto-fix where safe)
{{#if stackLanguages}}# Stack: {{stackLanguages}}{{/if}}

# Type check
# tsc --noEmit          (TypeScript)
# mypy --strict .       (Python)
# cargo check           (Rust)
# dotnet build          (.NET)

# Security scan
# npx semgrep --config=auto .
```

## Test Quality Signals

A test is high quality when it:

- **Fails for the right reason** — the assertion targets real behaviour, not
  implementation details.
- **Passes for the right reason** — removing the feature makes it red.
- **Is readable** — a developer unfamiliar with the code can understand what
  is being tested and why.
- **Is deterministic** — running it 100 times always produces the same result.

Reject tests that:

- Assert `true` unconditionally (tautologies).
- Test private or internal methods directly.
- Require a specific execution order to pass.
- Have more than one logical assertion per case (split them).

## Pull Request Quality Standards

### PR Description Must Include

1. **Summary** — one-sentence description of the change.
2. **Motivation** — why this change is needed (link to issue).
3. **Test plan** — how the change was tested (automated + manual).
4. **Breaking changes** — if any, with migration instructions.

### Commit Message Format

Follow the **{{#if commitConvention}}{{commitConvention}}{{/if}}{{#unless commitConvention}}conventional{{/unless}}** commit convention:

```
<type>(<scope>): <short description>

[optional body]

[optional footer — Closes #123]
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`.

## CI Pipeline Quality Gates

The CI pipeline must enforce:

1. Lint — fail on any new lint error.
2. Build — fail if the project does not compile cleanly.
3. Unit tests — fail if any test is red.
4. Coverage — fail if coverage drops below the configured threshold.
5. Security scan — fail on critical or high severity findings.

{{#if testingE2e}}
6. E2E smoke tests — run the `@smoke` suite on every merge to main.
{{/if}}

## Handling Flaky Tests

1. Identify the source of non-determinism (timing, shared state, external call).
2. Fix immediately if straightforward; otherwise quarantine to a separate suite.
3. Create a tracking issue and resolve within two sprints.
4. Never merge a change that makes an existing test flaky.
