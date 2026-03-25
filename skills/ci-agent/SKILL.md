---
name: ci-agent
description: >
  This skill should be used when the user asks to "fix CI", "review the workflow", "add a
  CI check", "set up CI for this repo", "why is the pipeline failing", "optimize GitHub
  Actions", "add deployment automation", "check the pipeline", or "create a new workflow".
  Provides CI/CD triage, workflow review checklists, and new-repo CI scaffold patterns.
version: 0.1.0
---

# CI Agent Skill

CI/CD workflows: triage pipeline failures, review GitHub Actions, scaffold new repos.
Delegates deployment execution to retort's `deploy` skill.

## Failure Triage

When CI is failing:
1. Read the workflow YAML — identify the failing job and step name
2. Diagnose: missing secret? wrong runner? dependency fetch failure? flaky test?
3. Reproduce locally with retort's `check` skill where possible
4. Propose minimal fix — one step at a time, don't refactor the whole workflow

## Workflow Review Checklist

For every `.github/workflows/` file:
- [ ] Triggers: avoid `push: branches: [main]` for expensive jobs — use `pull_request` + schedule
- [ ] Secrets: `${{ secrets.NAME }}` only — never inline values
- [ ] Clone depth: `fetch-depth: 1` unless full history is required
- [ ] Caching: `actions/cache` for `node_modules`, NuGet packages, `~/.cargo`
- [ ] Runner cost: `ubuntu-latest` unless Windows/macOS is genuinely required
- [ ] Concurrency: cancel in-progress runs for PR workflows to avoid queue buildup
- [ ] Summary job: matrix workflows should have a required summary job for branch protection

## New Repo CI Setup

Read `references/workflow-patterns.md` for copy-paste templates:
- Basic CI (lint + typecheck + test)
- .NET multi-project CI with coverage
- TypeScript monorepo with Turborepo
- Terraform plan-only workflow
- Full deploy workflow with environment protection

## Cost-Aware Patterns

High-cost signals to flag during review:
- Windows/macOS runners for tasks that only need bash
- Missing `paths:` filters — full suite runs on README edits
- Matrix × N where N > 4 without a clear reason
- `cache-hit` < 70% indicates cache key thrash

## Additional Resources

### Reference Files

- **`references/workflow-patterns.md`** — Copy-paste CI templates by stack and scenario
