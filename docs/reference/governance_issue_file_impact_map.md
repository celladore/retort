# Governance Issue → File Impact Map (Ready-to-Implement)

## Purpose

Map each open governance issue to the exact files likely to be modified during implementation.
This is planning guidance only; no implementation is performed by this document.

## Open governance issues in scope

- #159 Epic: Router Integration Governance Rollout
- #160 A: Full Render-Target Parity Baseline + Gap Ledger
- #161 B: Command Contract Governance + Hook Audit
- #162 C: FinOps Contract Package
- #163 D: ai-gateway Guidance + Command-Docs Contract
- #164 E: Dependency + Blocker Mapping
- #165 F: Governance Alignment for Command Docs vs Canonical Spec
- #166 G: Release-Readiness Gate Verification
- #167 Branch Governance Rollout Tracker
- #168 Policy: block direct `.agentkit` changes on `dev`/`main`
- #169 Infrastructure: branch protection baseline + default `dev`
- #170 Guardrail: upstream issue link required when `.agentkit/**` is touched

---

## #159 — Router Integration Governance Rollout (Epic)

This is an organizational epic and orchestrates sub-issues `#160`–`#170`.

Epic-level impacted files/components:

- `docs/reference/router_integration_governance_rollout.md` (tracking)
- `docs/reference/governance_issue_file_impact_map.md` (mapping)
- `docs/reference/agentkit_adopter_branch_governance_checklist.md` (adopter process)
- `docs/reference/agentkit_sync_integration_patch_plan.md` (sync integration blueprint)

Ownership:

- Primary: `JustAGhosT/agentkit-forge` maintainers
- Linked downstream: `phoenixvc/ai-gateway`, `phoenixvc/pvc-costops-analytics`

---

## #160 — Full render-target parity baseline + gap ledger

Primary files:

- `.agentkit/engines/node/src/template-utils.mjs`
- `.agentkit/engines/node/src/synchronize.mjs`
- `.agentkit/docs/guides/COMMAND_REFERENCE.md`
- `.agentkit/docs/getting-started/QUICK_START.md`

Supporting outputs:

- `docs/reference/router_integration_governance_rollout.md`
- `docs/reference/governance_issue_file_impact_map.md`

## #161 — Command contract governance (`/mode` `/delegate` `/tasks`) + hook audit

Primary files:

- `.agentkit/spec/commands.yaml`
- `.agentkit/engines/node/src/validate.mjs`
- `.agentkit/docs/guides/COMMAND_REFERENCE.md`
- `.agentkit/docs/getting-started/QUICK_START.md`

Template contract files (expected):

- `.agentkit/templates/claude/commands/mode.md`
- `.agentkit/templates/claude/commands/delegate.md`
- `.agentkit/templates/claude/commands/tasks.md`
- `.agentkit/templates/claude/hooks/guard-destructive-commands.sh`
- `.agentkit/templates/claude/hooks/protect-sensitive.sh`
- `.agentkit/templates/claude/hooks/session-start.sh`
- `.agentkit/templates/claude/hooks/setup-environment.sh`
- `.agentkit/templates/claude/hooks/warn-uncommitted.sh`

## #162 — FinOps contract package

Primary files:

- `.agentkit/spec/rules.yaml`
- `.agentkit/docs/router_specialist/FINOPS_AGENTKIT_INTEGRATION.md`

Potential new/updated docs/templates:

- `.agentkit/docs/FINOPS_PHASE1_SPEC.md` (or equivalent docs template target)
- `.agentkit/spec/commands.yaml` (if adding a dedicated finops command/skill link)
- `docs/reference/router_integration_governance_rollout.md`

## #163 — ai-gateway guidance + command-docs integration contract

Primary files:

- `.agentkit/docs/router_specialist/UPSTREAM_MIGRATION_SPEC.md`
- `.agentkit/docs/router_specialist/UPSTREAM_ISSUE_BODY.md`
- `.agentkit/docs/guides/COMMAND_REFERENCE.md`
- `.agentkit/docs/getting-started/QUICK_START.md`

Potential policy/docs touchpoints:

- `docs/integrations/` docs for adopter-facing guidance

## #164 — Dependency + blocker mapping

Primary files:

- `docs/reference/router_integration_governance_rollout.md`
- `docs/reference/governance_issue_file_impact_map.md`

Tracking integration note:

- `AGENT_BACKLOG.md` is generated; do not edit directly. Track dependencies via issue comments + non-generated tracker docs.

## #165 — Governance alignment: command docs vs canonical spec

Primary files:

- `COMMAND_GUIDE.md`
- `.agentkit/docs/guides/COMMAND_REFERENCE.md`
- `.agentkit/docs/getting-started/QUICK_START.md`
- `.agentkit/spec/commands.yaml`

## #166 — Release-readiness gate verification

Primary files:

- `QUALITY_GATES.md`
- `docs/reference/router_integration_governance_rollout.md`
- `docs/reference/governance_issue_file_impact_map.md`

## #167 — Branch governance rollout tracker

Primary files:

- `docs/reference/router_integration_governance_rollout.md`
- `docs/reference/agentkit_adopter_branch_governance_checklist.md`

## #168 — Policy: block direct `.agentkit/**` changes on `dev`/`main`

Primary files:

- `.github/workflows/branch-protection.yml`
- `CONTRIBUTING.md`
- `README.md` (adopter policy section if needed)

Policy references:

- `.claude/rules/template-protection.md`
- `.github/instructions/kluster-code-verify.instructions.md` (for process consistency only)

## #169 — Branch protection baseline + default `dev`

Primary files:

- `.github/workflows/branch-protection.yml`
- `CONTRIBUTING.md`
- `README.md` (adopter branch strategy/default branch guidance)

## #170 — Immediate guardrail: upstream issue link when `.agentkit/**` is touched

Primary files:

- `.github/workflows/branch-protection.yml`
- `CONTRIBUTING.md`
- `docs/reference/agentkit_adopter_branch_governance_checklist.md`

Expected enforcement behavior:

- If PR touches `.agentkit/**` and lacks upstream issue link in PR body, required check fails with remediation message.

---

## Implementation sequencing summary

1. Baseline and contract audit: `#160`, `#161`, `#165`
2. Domain contracts: `#162`, `#163`
3. Branch-governance controls: `#168`, `#169`, `#170`
4. Dependency and readiness closure: `#164`, `#166`

## Note

Template/spec paths listed here are planning targets only. Apply via issue-first governance and approved implementation sequence.
