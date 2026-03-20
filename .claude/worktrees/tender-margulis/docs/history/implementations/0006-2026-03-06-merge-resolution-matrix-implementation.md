# Merge Resolution Matrix (for review before applying)

Branch: `perf/sync-async-io-13346281603775877437`
Base merge target: `origin/main`
Status: **Proposal only** (no new resolutions applied from this matrix yet)

## Decision Legend

- **KEEP_OURS**: Keep branch version from `perf/sync-async-io-13346281603775877437`
- **KEEP_THEIRS**: Keep incoming `origin/main` version
- **MANUAL_MERGE**: Hand-merge required (logic/spec conflict)

## 1) Engine / source conflicts (manual by design)

| Path                                                          | Proposed Decision | Motivation                                                                                                                                  |
| ------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agentkit/engines/node/src/__tests__/cost-tracker.test.mjs`  | MANUAL_MERGE      | Test expectations likely changed on both branches; must preserve branch intent and upstream fixes.                                          |
| `.agentkit/engines/node/src/__tests__/task-protocol.test.mjs` | MANUAL_MERGE      | Branch protocol changes and upstream updates both likely meaningful.                                                                        |
| `.agentkit/engines/node/src/discover.mjs`                     | MANUAL_MERGE      | Runtime behavior file; cannot safely prefer either side blindly.                                                                            |
| `.agentkit/engines/node/src/orchestrator.mjs`                 | MANUAL_MERGE      | High-risk orchestrator logic requires semantic merge.                                                                                       |
| `.agentkit/engines/node/src/runner.mjs`                       | MANUAL_MERGE      | Execution-path logic likely diverged; needs intent-level merge.                                                                             |
| `.agentkit/engines/node/src/sync.mjs`                         | MANUAL_MERGE      | File deletion/modification conflict indicates structural changes on both sides.                                                             |
| `.agentkit/engines/node/src/synchronize.mjs`                  | MANUAL_MERGE      | Core sync implementation touched in both branches.                                                                                          |
| `.agentkit/engines/node/src/task-protocol.mjs`                | MANUAL_MERGE      | Protocol semantics are branch-critical and upstream-evolving.                                                                               |
| `.agentkit/spec/docs.yaml`                                    | MANUAL_MERGE      | Contains concurrent ADR/path policy edits; must preserve intentional ADR-path corrections while accepting relevant upstream schema updates. |

## 2) Lock/config conflicts

| Path                          | Proposed Decision | Motivation                                                                                                            |
| ----------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `.agentkit/package-lock.json` | KEEP_THEIRS       | Lockfile should align with latest upstream dependency graph; regenerate if needed post-merge.                         |
| `.gemini/config.yaml`         | KEEP_THEIRS       | Generated/tooling config; upstream should be source of truth, then local adjustments can be re-applied intentionally. |

## 3) Generated skill packs from upstream

| Path Group                                           | Proposed Decision | Motivation                                                                              |
| ---------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `.agents/skills/**/SKILL.md` (all 19 unmerged files) | KEEP_THEIRS       | These are generated framework assets; upstream canonical state reduces churn and drift. |

Affected files:

- `.agents/skills/build/SKILL.md`
- `.agents/skills/check/SKILL.md`
- `.agents/skills/cost/SKILL.md`
- `.agents/skills/deploy/SKILL.md`
- `.agents/skills/discover/SKILL.md`
- `.agents/skills/doctor/SKILL.md`
- `.agents/skills/format/SKILL.md`
- `.agents/skills/handoff/SKILL.md`
- `.agents/skills/healthcheck/SKILL.md`
- `.agents/skills/orchestrate/SKILL.md`
- `.agents/skills/plan/SKILL.md`
- `.agents/skills/preflight/SKILL.md`
- `.agents/skills/project-review/SKILL.md`
- `.agents/skills/review/SKILL.md`
- `.agents/skills/scaffold/SKILL.md`
- `.agents/skills/security/SKILL.md`
- `.agents/skills/sync-backlog/SKILL.md`
- `.agents/skills/test/SKILL.md`
- `.agents/skills/validate/SKILL.md`

## 4) GitHub generated agent/chatmode/prompt packs

| Path Group                                       | Proposed Decision | Motivation                                                        |
| ------------------------------------------------ | ----------------- | ----------------------------------------------------------------- |
| `.github/agents/*.agent.md` (all unmerged)       | KEEP_THEIRS       | Generated Copilot agent metadata; upstream consistency preferred. |
| `.github/chatmodes/*.chatmode.md` (all unmerged) | KEEP_THEIRS       | Generated chatmodes should match latest upstream structure.       |
| `.github/prompts/*.prompt.md` (all unmerged)     | KEEP_THEIRS       | Generated prompts are framework-managed artifacts.                |

Affected `.github/agents/*` files:

- `backend.agent.md`, `brand-guardian.agent.md`, `content-strategist.agent.md`, `coverage-tracker.agent.md`, `data.agent.md`, `dependency-watcher.agent.md`, `devops.agent.md`, `environment-manager.agent.md`, `frontend.agent.md`, `growth-analyst.agent.md`, `infra.agent.md`, `integration-tester.agent.md`, `product-manager.agent.md`, `project-shipper.agent.md`, `release-manager.agent.md`, `roadmap-tracker.agent.md`, `security-auditor.agent.md`, `test-lead.agent.md`, `ui-designer.agent.md`

Affected `.github/chatmodes/*` files:

- `team-backend.chatmode.md`, `team-data.chatmode.md`, `team-devops.chatmode.md`, `team-docs.chatmode.md`, `team-frontend.chatmode.md`, `team-infra.chatmode.md`, `team-product.chatmode.md`, `team-quality.chatmode.md`, `team-security.chatmode.md`, `team-testing.chatmode.md`

Affected `.github/prompts/*` files:

- `build.prompt.md`, `check.prompt.md`, `cost.prompt.md`, `deploy.prompt.md`, `discover.prompt.md`, `doctor.prompt.md`, `format.prompt.md`, `handoff.prompt.md`, `healthcheck.prompt.md`, `orchestrate.prompt.md`, `plan.prompt.md`, `preflight.prompt.md`, `project-review.prompt.md`, `review.prompt.md`, `scaffold.prompt.md`, `security.prompt.md`, `sync-backlog.prompt.md`, `test.prompt.md`, `validate.prompt.md`

## 5) Docs README merge-add/merge-add conflicts

| Path                                | Proposed Decision | Motivation                                                           |
| ----------------------------------- | ----------------- | -------------------------------------------------------------------- |
| `docs/product/README.md`            | KEEP_THEIRS       | Generated index file; prefer latest upstream generation baseline.    |
| `docs/architecture/specs/README.md` | KEEP_THEIRS       | Generated index file; upstream reflects current structure migration. |
| `docs/architecture/README.md`       | KEEP_THEIRS       | Generated index file and likely path-normalized upstream.            |
| `docs/api/README.md`                | KEEP_THEIRS       | Generated index file; preserve upstream consistency.                 |
| `docs/operations/README.md`         | KEEP_THEIRS       | Generated index file; preserve upstream consistency.                 |
| `docs/engineering/README.md`        | KEEP_THEIRS       | Generated index file; preserve upstream consistency.                 |
| `docs/integrations/README.md`       | KEEP_THEIRS       | Generated index file; preserve upstream consistency.                 |
| `docs/reference/README.md`          | KEEP_THEIRS       | Generated index file; preserve upstream consistency.                 |

## 6) Special note on `.agentkit/spec/docs.yaml`

This is the only non-generated policy file in conflict where prior intentional changes exist in this branch.

### Proposed merge intent

- Keep upstream structural/spec improvements from `origin/main`.
- Preserve branch intent that corrected ADR path references to `docs/architecture/decisions/` where still valid.
- Resolve by hand and explicitly verify all `categories` and `adrRanges` paths are internally consistent.

## 7) What this matrix avoids

- No blanket "templates are immutable" rule.
- No blanket "core source is ours" rule.
- Every unresolved path is explicitly categorized with motivation.

## 8) Approval checkpoint

If you approve this matrix, next step is to apply resolutions exactly as listed, then report:

1. Remaining unresolved files (should only be intentional manual files, then zero),
2. `git status --short --branch`,
3. Any post-merge regeneration/test deltas.
