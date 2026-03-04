# AgentKit Adopter Branch Governance Checklist

## Purpose

Apply the branch-governance profile to repositories that implement AgentKit Forge until template/spec automation is merged.

## Governance source

- Rollout tracker: [Issue #167](https://github.com/JustAGhosT/agentkit-forge/issues/167)
- Policy issue: [Issue #168](https://github.com/JustAGhosT/agentkit-forge/issues/168)
- Infrastructure issue: [Issue #169](https://github.com/JustAGhosT/agentkit-forge/issues/169)

## Implementation checklist (per adopting repo)

- [ ] Confirm repository is enrolled in AgentKit implementer policy profile.
- [ ] Set default branch to `dev` (with owner approval and migration notice).
- [ ] Enable branch protection for `dev` with required status checks and reviews.
- [ ] Enable branch protection for `main` with required status checks and reviews.
- [ ] Add/enable a required check that blocks direct changes to `.agentkit/**` in PRs targeting `dev` or `main`.
- [ ] Require upstream issue linkage for `.agentkit/**` change requests (must reference `JustAGhosT/agentkit-forge` issue URL).
- [ ] Document exception path for maintainers (emergency only, audited).
- [ ] Update contributor docs in the adopting repo to reflect `dev` default and upstream-first `.agentkit` policy.

## Suggested required checks

- CI test/check pipeline
- Secret scanning
- Branch-governance check (`.agentkit` change gate)
- Conventional commit/PR title check

## PR policy for `.agentkit/**`

If a PR targets `dev` or `main` and includes `.agentkit/**` changes:

1. It must link a tracking issue in `JustAGhosT/agentkit-forge`.
2. If no upstream issue exists, PR must fail with actionable guidance to open one.
3. Local/direct template-source edits are rejected unless explicitly approved under maintainer exception policy.

## Migration notes

For repos currently defaulted to `main`:

- Announce policy shift and freeze window.
- Create `dev` from current `main` tip.
- Set `dev` as default branch.
- Re-target active PRs where needed.
- Reconfirm branch protections and required checks on both branches.

## Automation helper (this repo)

Use these scripts to apply the checklist to an adopting repo:

```powershell
scripts/setup-agentkit-branch-governance.ps1 -Repo <owner/name> -DryRun
scripts/setup-agentkit-branch-governance.ps1 -Repo <owner/name>
```

```bash
bash scripts/setup-agentkit-branch-governance.sh --repo <owner/name> --dry-run
bash scripts/setup-agentkit-branch-governance.sh --repo <owner/name>
```

Optional flags:

- `-SkipDefaultBranch` / `--skip-default-branch`
- `-SkipProtection` / `--skip-protection`

## Verification

- [ ] Both `dev` and `main` are protected.
- [ ] Default branch is `dev`.
- [ ] `.agentkit/**` direct changes are blocked by required checks.
- [ ] Upstream issue-first linkage is enforced and auditable.
