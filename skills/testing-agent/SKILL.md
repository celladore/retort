---
name: testing-agent
description: >
  This skill should be used when the user asks to "run tests", "generate tests",
  "check coverage", "write tests for X", "what tests are missing", "triage test
  failures", "fix failing tests", or mentions xUnit, Vitest, cargo test, dotnet test.
  Provides the full testing workflow across .NET, TypeScript, and Rust stacks.
version: 0.1.0
---

# Testing Agent

Cross-stack testing workflow for .NET (xUnit), TypeScript (Vitest), and Rust (cargo test). Covers test generation, execution, triage, and coverage analysis.

## Agents

Two agents handle the testing workflow:

- **test-generator** — finds untested code, proposes a test plan, writes tests after approval
- **coverage-guard** — monitors coverage across changed files, advises when thresholds are at risk

Invoke them explicitly (`use the test-generator agent`) or they activate on matching phrases.

## Running Tests

### Stack Detection

Detect the right test command from project signals:

| Signal | Command |
|---|---|
| `*.csproj` with xUnit refs | `dotnet test` |
| `vitest` in `package.json` | `pnpm test` or `pnpm vitest run` |
| `Cargo.toml` in crate root | `cargo test` |

Always run from the appropriate root (solution root for .NET, package root for TS, crate root for Rust).

### Scoped vs Full Suite

- **Scoped** (preferred): run only the affected project or package
- **Full suite**: use when a cross-cutting change is suspected or before a PR

Context determines scope — a single service change warrants scoped; a shared library change warrants full.

### Failure Triage

When tests fail:
1. Read the full error output — do not truncate
2. Identify whether the failure is: compilation error, assertion failure, or test infrastructure issue
3. For assertion failures: check if the implementation changed or the test is stale
4. Propose a fix — flag if fixing requires changing production code

## Coverage Analysis

Run coverage commands from `references/mystira-stacks.md` for stack-specific flags.

Minimum workflow before a PR:
1. Identify files changed in the branch (`git diff main --name-only`)
2. Run coverage for affected projects
3. Report files below threshold
4. Suggest test-generator for gaps

## Session Start

At session start in a new project, coverage-guard will ask for a coverage threshold if one isn't in `.claude/retort.local.md`. Answer once — it won't ask again that session.

## Settings File

Create `.claude/retort.local.md` in any repo to configure per-project behaviour:

```yaml
coverage_threshold: 80
test_style: unit-only
coverage_check: on_demand
baseline_branch: main
```

## Additional Resources

- **`references/mystira-stacks.md`** — Mystira-specific test commands, paths, xUnit/Vitest/cargo conventions
