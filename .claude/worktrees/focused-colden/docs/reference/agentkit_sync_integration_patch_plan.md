# Retort Sync Integration Patch Plan

## Why this exists

This plan provides a maintainer-ready implementation blueprint to move branch-governance guardrails from runtime repo files into Retort sync source-of-truth.

## Target outcome

When adopters run sync, generated outputs include:

- Branch protection workflow guardrail requiring upstream issue link for `.agentkit/**` changes.
- Branch governance setup script support for both `dev` and `main`.
- Default branch automation option for `dev` policy profile.
- Updated onboarding and quick-start guidance.

## Source-of-truth files to update

### Templates

- .agentkit/templates/github/workflows/branch-protection.yml (new)
- .agentkit/templates/github/scripts/setup-branch-protection.sh
- .agentkit/templates/github/scripts/setup-branch-protection.ps1
- .agentkit/templates/github/scripts/README.md

### Docs and references

- .agentkit/docs/getting-started/QUICK_START.md
- .agentkit/docs/getting-started/ONBOARDING.md
- .agentkit/templates/root/QUALITY_GATES.md

### Engine wiring (if needed for render/copy)

- .agentkit/engines/node/src/synchronize.mjs
- .agentkit/engines/node/src/validate.mjs

## Required behavior

### 1) Workflow guardrail

In generated branch-protection workflow:

- Trigger applies to PRs targeting `dev` and `main`.
- If PR touches `.agentkit/**`, PR body must contain upstream issue URL pattern:
  - [https://github.com/phoenixvc/retort/issues/<number>](https://github.com/phoenixvc/retort/issues/<number>)
- On missing link, required check fails with clear remediation message.

### 2) Branch protection script behavior

In generated setup scripts:

- Add profile mode to apply branch protection to both `dev` and `main`.
- Preserve single-branch mode for compatibility.
- Add dry-run support for multi-branch application.

### 3) Default branch policy option

In setup scripts and docs:

- Add optional step to set default branch to `dev`.
- Keep this opt-in or policy-profile controlled to avoid breaking existing repos.

## Suggested acceptance tests

- Sync in a test repo generates workflow with upstream-link guardrail.
- Script dry-run shows both `dev` and `main` branch-protection actions.
- Script apply successfully configures both branches.
- Default branch switch to `dev` works when enabled.
- Validation gate confirms branch-protection workflow presence/consistency where policy profile is enabled.

## Rollout notes

- Existing repos on `main` default need migration comms and PR retarget plan.
- Keep emergency maintainer exception path documented and audited.
- Track rollout under issues #167, #168, #169, #170.
