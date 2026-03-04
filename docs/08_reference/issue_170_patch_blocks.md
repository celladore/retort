# Issue #170 Maintainer Patch Blocks (.agentkit Source-of-Truth)

> Pointer: For language-profile presets and verified Phase 2/3 GitHub tracking, see [analysis/language-aware-hooks-phase-plan.md](./analysis/language-aware-hooks-phase-plan.md).

These patch blocks are for maintainers to apply in protected `.agentkit` source paths.
They mirror the runtime implementation already validated in this branch.

## Apply order

1. `.agentkit/templates/github/workflows/branch-protection.yml` (new)
2. `.agentkit/templates/github/scripts/setup-branch-protection.sh`
3. `.agentkit/templates/github/scripts/setup-branch-protection.ps1`
4. `.agentkit/templates/github/scripts/README.md`
5. Run sync and validate

---

## 1) Add workflow template

File: `.agentkit/templates/github/workflows/branch-protection.yml`

Use the same logic as current runtime workflow in `.github/workflows/branch-protection.yml`, including:

- `pull_request` branches: `[main, dev]`
- dynamic secret-scan diff base: `origin/${{ github.event.pull_request.base.ref }}...HEAD`
- guardrail step: fail PR when `.agentkit/**` changed and PR body lacks upstream issue URL matching:
  - `https://github.com/JustAGhosT/agentkit-forge/issues/<number>`

Recommended source for exact content:

- `.github/workflows/branch-protection.yml` in this branch.

---

## 2) Update Bash branch-protection setup script

File: `.agentkit/templates/github/scripts/setup-branch-protection.sh`

### Required changes (Bash)

- Add optional multi-branch mode that applies protections to both `dev` and `main`.
- Add optional `--set-default-dev` flag to switch default branch to `dev`.
- Keep existing `--branch` behavior for backward compatibility.

### Patch intent (Bash key additions)

- New flags:
  - `--both-branches`
  - `--set-default-dev`
- New logic:
  - If `--set-default-dev`, call:
    - `gh api --method PATCH "/repos/$REPO" -f default_branch='dev'`
  - If `--both-branches`, loop `for target in dev main; do ... done` for protection API calls.

---

## 3) Update PowerShell branch-protection setup script

File: `.agentkit/templates/github/scripts/setup-branch-protection.ps1`

### Required changes (PowerShell)

- Add optional switches:
  - `-BothBranches`
  - `-SetDefaultDev`
- Keep existing `-Branch` behavior.

### Patch intent (PowerShell key additions)

- If `-SetDefaultDev`, call:
  - `gh api --method PATCH "/repos/$Repo" -f default_branch='dev'`
- If `-BothBranches`, apply protection payload to both `dev` and `main`.

---

## 4) Update script README template

File: `.agentkit/templates/github/scripts/README.md`

### Required changes (README)

- Document new usage for both scripts:
  - Multi-branch protection (`dev` + `main`)
  - Optional default branch set to `dev`
- Keep legacy single-branch usage examples.

### Example snippet to add

```bash
# Apply to both dev and main, and set default branch to dev
.github/scripts/setup-branch-protection.sh --both-branches --set-default-dev
```

```powershell
# Apply to both dev and main, and set default branch to dev
.github/scripts/setup-branch-protection.ps1 -BothBranches -SetDefaultDev
```

---

## Validation commands

```bash
pnpm -C .agentkit agentkit:sync
```

Then verify generated outputs include expected behavior:

- `.github/workflows/branch-protection.yml`
- `.github/scripts/setup-branch-protection.sh`
- `.github/scripts/setup-branch-protection.ps1`
- `.github/scripts/README.md`

Optional runtime checks:

```bash
.github/scripts/setup-branch-protection.sh --dry-run --both-branches --set-default-dev
```

```powershell
.github/scripts/setup-branch-protection.ps1 -DryRun -BothBranches -SetDefaultDev
```
