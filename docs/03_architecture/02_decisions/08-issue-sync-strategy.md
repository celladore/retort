# ADR-08: Issue Sync Strategy — Local Docs to GitHub Issues

## Status

**Proposed**

## Date

2026-03-04

## Context

The `gh` CLI is the preferred way to create GitHub Issues, but it is not always
available. Common failure modes include:

- **Air-gapped / sandboxed environments** — no outbound network access.
- **Proxy restrictions** — the local proxy blocks GitHub API traffic.
- **Missing CLI** — `gh` is not installed in the container or VM image.
- **Authentication failures** — expired tokens, SSO re-auth required.

When `gh` is unavailable, developers and agents fall back to creating structured
markdown issue records in `docs/history/issues/` using the existing
`scripts/create-doc.sh issue` workflow. These local docs capture the same
information (severity, symptoms, root cause, impact) but are not visible in the
GitHub Issues tracker until they are synced.

We need a strategy for **when**, **where**, and **how** these local issue docs
get promoted to GitHub Issues once API access is restored.

## Decision

### Sync Mechanism

A dedicated script (`scripts/sync-issues.sh`) reads issue docs from
`docs/history/issues/`, filters for files with `gh_synced: false` in their
Sync Status section, and creates corresponding GitHub Issues via `gh issue
create`. After successful creation the script stamps the local file with:

- `gh_synced: true`
- `gh_issue_number: #<number>`
- `gh_synced_at: <date>`

The script defaults to **dry-run** mode; `--apply` is required to create issues.

### When to Sync

The following trigger points are under consideration. **None are implemented
yet** — this ADR records the decision on which to adopt.

| Trigger | Pros | Cons | Decision |
|---------|------|------|----------|
| **Manual** — developer runs `sync-issues.sh --apply` | Simple, zero infra, full control | Easy to forget | **Adopt — always available** |
| **CI post-merge** — GitHub Action runs on push to default branch | Automatic, no human step | Needs `gh` token in CI, may create duplicates on retries | **Adopt — primary automation** |
| **Session-start hook** — run at Claude Code session start | Catches issues before new work begins | Adds session startup latency, may fail if `gh` still broken | **Defer — evaluate after CI path is proven** |
| **Pre-push git hook** — run before `git push` | Syncs at natural checkpoint | Blocks push on failure, slow for large batches | **Reject — too disruptive** |
| **Scheduled (cron)** — run on a timer | Catches stragglers | Over-engineered for current scale | **Reject — unnecessary complexity** |

**Primary flow:** CI workflow on default branch (`master`) push detects unsynced
issue docs and runs `sync-issues.sh --apply`. If the step fails it is
non-blocking (the push still succeeds) but emits a warning annotation.

**Fallback flow:** Developer or agent manually runs `./scripts/sync-issues.sh
--apply` from any environment where `gh` is available.

### Where (GitHub Action Placement)

The sync step should be a **standalone job** in the existing CI workflow (not
embedded in the test/build matrix) so that:

1. It only runs once per push, not per matrix combination.
2. Failure is isolated and does not block other CI jobs.
3. It can be given the minimal `issues: write` permission scope.

### Idempotency & Deduplication

- The `gh_synced` flag in each file is the source of truth for whether a sync
  has been attempted.
- If a file is already marked `gh_synced: true`, the script skips it.
- If a GitHub Issue was created but the file stamp failed (e.g., crash mid-run),
  the next run will attempt to create a duplicate. Mitigation: the script adds a
  `synced-from-local` label and includes the source filename in the body, making
  duplicates easy to identify and close manually.
- Future improvement: before creating, search existing issues for the source
  filename to avoid duplicates (not in v1).

### Label Strategy

All synced issues receive the `synced-from-local` label. If the local doc has a
recognised severity value, a `severity:<level>` label is also applied. Callers
can pass `--label` for additional labels.

## Consequences

### Positive

- Local issue docs are never lost — they exist in version control regardless of
  `gh` availability.
- GitHub Issues tracker stays up-to-date without manual re-entry.
- Dry-run default prevents accidental bulk issue creation.
- CI automation eliminates the "forgot to sync" failure mode.

### Negative

- Two sources of truth for issue metadata (local doc + GitHub Issue) until we
  decide which is canonical post-sync.
- Labels referenced by the script (`synced-from-local`, `severity:*`) must be
  created in the GitHub repo before first use, or `gh` will create them
  automatically (which may not match desired colours).

### Neutral

- The sync script is intentionally simple (bash + `gh`) with no external
  dependencies beyond what the project already requires.

## Implementation Plan

> **Note:** This ADR captures the strategy. Implementation is tracked separately.

1. **Phase 1 (done):** `scripts/sync-issues.sh` — manual sync script.
2. **Phase 2 (todo):** GitHub Actions workflow job for CI-triggered sync.
3. **Phase 3 (deferred):** Session-start hook integration, evaluated after
   Phase 2 has run in production for ≥ 2 weeks.

## References

- [docs/history/issues/README.md](../../history/issues/README.md)
- [docs/history/README.md](../../history/README.md)
- [scripts/sync-issues.sh](../../../scripts/sync-issues.sh)
- [ADR-01: Adopt AgentKit Forge](./01-adopt-agentkit-forge.md)
