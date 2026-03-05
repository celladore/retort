# feat(ci): Add per-commit secret scanning via review command

**Priority:** P2 — Medium
**Labels:** `enhancement`, `ci`, `security`
**Blocked by:** None

---

## Problem

`review-runner.mjs` has robust secret scanning but only runs manually via `agentkit review`. The CI pipeline doesn't scan commits for secrets — it only checks formatting, tests, and drift.

A developer could accidentally commit an AWS key, and CI wouldn't catch it.

---

## Implementation Plan

### Step 1: Add review step to CI validate job (~15 min)

In `.github/workflows/ci.yml`, add after the doctor diagnostics step:

```yaml
- name: Scan for secrets in changes
  run: |
    # Scan the diff between this branch and the base
    if [ "${{ github.event_name }}" = "pull_request" ]; then
      RANGE="${{ github.event.pull_request.base.sha }}..HEAD"
    else
      RANGE="HEAD~1..HEAD"
    fi
    node engines/node/src/cli.mjs review --range "$RANGE"
  working-directory: .agentkit
```

### Step 2: Add review as a PR check (~15 min)

Create a new job in `ci.yml` that runs in parallel with test/validate:

```yaml
secret-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0 # Need full history for diff

    - uses: pnpm/action-setup@v4
      with:
        package_json_file: package.json

    - uses: actions/setup-node@v4
      with:
        node-version: 24
        cache: 'pnpm'
        cache-dependency-path: .agentkit/pnpm-lock.yaml

    - name: Install dependencies
      run: pnpm install --frozen-lockfile
      working-directory: .agentkit

    - name: Secret scan
      run: |
        if [ "${{ github.event_name }}" = "pull_request" ]; then
          node engines/node/src/cli.mjs review --range "${{ github.event.pull_request.base.sha }}..HEAD"
        else
          node engines/node/src/cli.mjs review --range "HEAD~1..HEAD"
        fi
      working-directory: .agentkit
```

### Step 3: Add `--fail-on` flag to review command (~30 min)

Currently `review` exits with code 1 on HIGH severity findings. Add a `--fail-on` flag for CI tuning:

```javascript
// In review-runner.mjs
const failOn = flags['fail-on'] || 'HIGH';
const severityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const shouldFail = allFindings.some((f) => severityOrder[f.severity] >= severityOrder[failOn]);
```

CI can then use: `agentkit review --range $RANGE --fail-on HIGH`

### Step 4: Cache-friendly scanning (~30 min, optional)

For large repos, scanning all files in a range can be slow. Add caching:

```yaml
- name: Cache review results
  uses: actions/cache@v4
  with:
    path: .claude/state/review-cache.json
    key: review-${{ github.sha }}
    restore-keys: review-
```

---

## Acceptance Criteria

- [ ] CI scans for secrets on every push and PR
- [ ] Secret findings fail the CI job
- [ ] PR checks show secret scan status
- [ ] `fetch-depth: 0` ensures full history for range diffs
- [ ] `--fail-on` flag allows CI severity tuning

---

## Related

- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
- Extends: review-runner.mjs
