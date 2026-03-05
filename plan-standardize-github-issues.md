# Plan: Standardize GitHub Issues & Consolidated Backlog

> **Branch:** `claude/standardize-github-issues-YgacS`
> **Date:** 2026-03-04
> **Status:** IMPLEMENTED

---

## Problem Statement

When adopting AgentKit Forge into an existing repository, GitHub issues (and
potentially Linear issues) already exist in various formats, labels, and states.
There is no automated mechanism to:

1. **Ingest** existing external issues into the local `AGENT_BACKLOG.md` format
2. **Normalize** heterogeneous issue fields (labels, milestones, assignees,
   projects) into the canonical backlog item schema
3. **Surface a consolidated view** of work items from all sources (external
   tracker + local discovery + healthcheck + code TODOs + review findings) via a
   CLI or future UI
4. **Trigger this automatically** when a configuration flag is enabled during
   adoption (like `infraEval` gates `/infra-eval`)

The existing `/sync-backlog` command template describes the *intent* but lacks
runtime implementation — it's a prompt-only slash command with no CLI handler.

---

## Lessons From Existing Patterns & Open Branches

### What already works well

| Pattern | Location | Lesson |
|---------|----------|--------|
| Feature-flag gating | `evaluation.infraEval` in `project.yaml` → `hasInfraEval` template var → conditional command rendering | Use the same pattern: add a `process.intake.autoImport` flag |
| Tracker-neutral abstraction | `sync-backlog.md` template uses `{{issueTracker}}` and delegates to `gh` or `linear` CLI | Keep the adapter pattern; add runtime adapter implementations |
| Intake ownership flow | `teams.yaml` → `intake.ownerTeam`, `operationsTeam`, `routing`, `escalation` | Already defined — reuse as-is for team assignment during normalization |
| Task protocol (A2A-lite) | `.claude/state/tasks/` JSON files with lifecycle states | Use same schema for ingested issues to enable orchestrator integration |
| Template variable propagation | `project-mapping.mjs` flattens `project.yaml` → Handlebars vars | Extend with new intake/import vars |
| Post-sync validation matrix | Documented in `docs/08_reference/issue_intake_ownership_and_invocation_flow.md` | Extend the matrix with the new command/feature checks |
| Command definition pattern | `commands.yaml` → template → sync → multi-platform output | Follow exactly for the new `import-issues` command |
| History document pattern | `/document-history` creates institutional memory | Auto-create a history doc after bulk import |

### Gaps identified from branch history

| Gap | Evidence | Resolution |
|-----|----------|------------|
| No runtime handler for `sync-backlog` | `sync-backlog` exists in `commands.yaml` and spec validation but has no entry in `VALID_COMMANDS` and no handler in `cli.mjs` | Add CLI route and runtime handler that calls the new sync engine |
| No GitHub issue fetcher | `gh issue list` is in allowed-tools but no code calls it | Implement `github-adapter.mjs` that shells out to `gh` |
| No field normalization layer | Sync-backlog template describes it as prose, not code | Implement `issue-normalizer.mjs` with canonical schema |
| No consolidated view command | Backlog is only `AGENT_BACKLOG.md` (markdown table) | Add `backlog` CLI command with `--format` (table/json/yaml) output |
| Feature flag provider is `null` | `crosscutting.featureFlags.provider: null` | Use `project.yaml` flags directly (same pattern as `infraEval`) — no external provider needed |
| Linear integration placeholder | Mentioned in docs but no adapter code | Implement `linear-adapter.mjs` stub with clear interface |

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    project.yaml                         │
│  process.intake.autoImport: true                        │
│  process.issueTracker: github                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              agentkit import-issues                     │
│  (or triggered by agentkit init when autoImport=true)   │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│ github-adapter   │     │ linear-adapter   │
│ (gh issue list)  │     │ (stub/MCP)       │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └───────────┬────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│              issue-normalizer.mjs                       │
│  Raw issue → Canonical BacklogItem schema               │
│  - Field mapping (labels→priority, assignee→team, etc.) │
│  - Deduplication against existing AGENT_BACKLOG.md       │
│  - Team assignment via intake.routing rules              │
│  - Priority inference from labels/severity               │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│ AGENT_BACKLOG.md │     │ events.log       │
│ (local backlog)  │     │ (audit trail)    │
└──────────────────┘     └──────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              agentkit backlog                            │
│  Consolidated view: external + local sources             │
│  --format table|json|yaml|csv                             │
│  --team <filter>                                         │
│  --priority <filter>                                     │
│  --source <filter> (github|linear|discovery|todo|review) │
└─────────────────────────────────────────────────────────┘
```

### Canonical BacklogItem Schema

```javascript
{
  // Identity
  id: "bi-20260304-001-abc123",         // Local backlog item ID
  externalId: "GH#42",                  // External tracker reference
  externalUrl: "https://github.com/org/repo/issues/42",

  // Classification
  title: "Fix authentication timeout on token refresh",
  priority: "P1",                       // P0|P1|P2|P3
  status: "open",                       // open|in-progress|completed|blocked|deferred
  phase: "Planning",                    // Discovery|Planning|Implementation|Validation|Ship

  // Ownership
  team: "backend",                      // Assigned team from teams.yaml
  assignee: null,                       // Optional human assignee
  source: "github",                     // github|linear|discovery|healthcheck|todo|review|manual

  // Description
  what: "JWT refresh tokens expire silently, causing 401 cascades",
  why: "Users get logged out mid-session with no recovery path",
  acceptance: [
    "Token refresh returns new access token before expiry",
    "Failed refresh shows user-friendly re-auth prompt"
  ],
  files: ["src/auth/token-refresh.ts", "src/middleware/auth.ts"],

  // Metadata from external tracker
  labels: ["bug", "auth", "P1"],
  milestone: "v2.1",
  createdAt: "2026-02-15T10:00:00Z",
  updatedAt: "2026-03-01T14:30:00Z",
  closedAt: null,

  // Sync state
  lastSyncedAt: "2026-03-04T12:00:00Z",
  syncDirection: "pull",                // pull|push|bidirectional
  dirty: false                          // true if local changes not yet pushed
}
```

---

## Implementation Plan

### Phase 1: Schema & Configuration (spec layer)

**Files to modify:**

1. **`.agentkit/spec/project.yaml`** — Add intake auto-import flag:
   ```yaml
   process:
     intake:
       autoImport: false          # NEW — enable to auto-import on adoption
       importLabelsMap:           # NEW — map tracker labels to priorities
         bug: P1
         critical: P0
         enhancement: P2
         documentation: P3
         security: P0
       importStateMap:            # NEW — map tracker states to backlog status
         open: open
         closed: completed
       importTeamMap:             # NEW — map tracker labels/assignees to teams
         backend: backend
         frontend: frontend
         api: backend
         ui: frontend
         database: data
         infra: infra
         ci: devops
         test: testing
         security: security
         docs: docs
   ```

2. **`.agentkit/spec/commands.yaml`** — Add `import-issues` command and `backlog` command:
   ```yaml
   commands:
   - name: import-issues
     type: workflow
     description: >
       Imports issues from the configured external tracker (GitHub or Linear),
       normalizes fields to the canonical backlog schema, deduplicates against
       existing items, assigns teams via intake routing rules, and writes to
       AGENT_BACKLOG.md. Always available; when process.intake.autoImport is
       true, it also runs automatically during intake/init, otherwise it must
       be invoked explicitly.
     flags:
       - name: --tracker
         description: 'Override tracker (github, linear)'
         type: string
         default: null
         enum: [github, linear]
       - name: --state
         description: 'Import issues in this state (open, closed, all)'
         type: string
         default: 'open'
         enum: [open, closed, all]
       - name: --labels
         description: 'Filter by labels (comma-separated)'
         type: string
         default: null
       - name: --since
         description: 'Only import issues updated since (ISO date)'
         type: string
         default: null
       - name: --dry-run
         description: 'Show what would be imported without writing'
         type: boolean
         default: false
       - name: --limit
         description: 'Maximum number of issues to import'
         type: integer
         default: 100
     allowed-tools:
       - Read
       - Write
       - Edit
       - Glob
       - Grep
       - Bash

   - name: backlog
     type: utility
     description: >
       Displays a consolidated backlog view from all sources (external tracker,
       discovery, healthcheck, code TODOs, review findings, manual entries).
       Supports filtering and multiple output formats for CLI and future UI
       consumption.
     flags:
       - name: --format
         description: 'Output format: table, json, yaml, csv'
         type: string
         default: 'table'
         enum: [table, json, yaml, csv]
       - name: --team
         description: 'Filter by team'
         type: string
         default: null
       - name: --priority
         description: 'Filter by priority (P0, P1, P2, P3)'
         type: string
         default: null
       - name: --source
         description: 'Filter by source (github, linear, discovery, todo, review, manual)'
         type: string
         default: null
       - name: --status
         description: 'Filter by status (open, in-progress, completed, blocked)'
         type: string
         default: null
       - name: --sort
         description: 'Sort by field (priority, team, source, updated)'
         type: string
         default: 'priority'
     allowed-tools:
       - Read
       - Glob
       - Grep
   ```

3. **`.agentkit/spec/teams.yaml`** — No changes needed (intake config already
   present).

### Phase 2: Spec Validation (engine layer)

**Files to modify:**

4. **`.agentkit/engines/node/src/spec-validator.mjs`** — Add validation rules:
   - `process.intake.autoImport` must be boolean
   - `process.intake.importLabelsMap` values must be valid priorities (P0-P3)
   - `process.intake.importStateMap` values must be valid statuses
   - `process.intake.importTeamMap` values must reference valid team IDs from
     `teams.yaml`
   - Warn if `autoImport: true` but `issueTracker: none`

5. **`.agentkit/engines/node/src/project-mapping.mjs`** — Add variable mappings:
   - `process.intake.autoImport` → `hasAutoImport`
   - `process.intake.importLabelsMap` → `importLabelsMap` (serialized)
   - `process.intake.importStateMap` → `importStateMap`
   - `process.intake.importTeamMap` → `importTeamMap`

### Phase 3: Runtime Adapters (engine layer — new files)

6. **`.agentkit/engines/node/src/tracker-adapter.mjs`** — Adapter interface:
   ```javascript
   // Tracker adapter contract
   // fetchIssues(options) → Promise<RawIssue[]>
   // pushUpdate(issueId, update) → Promise<void>
   // getAvailableLabels() → Promise<string[]>
   export function createAdapter(tracker, projectRoot) { ... }
   ```

7. **`.agentkit/engines/node/src/github-adapter.mjs`** — GitHub implementation:
   - Uses `gh issue list --json` to fetch issues with all fields
   - Handles pagination via `--limit`
   - Supports `--state`, `--label`, `--since` filters
   - Returns raw issue JSON array
   - Checks `gh auth status` before executing
   - Graceful error handling when `gh` is not installed

8. **`.agentkit/engines/node/src/linear-adapter.mjs`** — Linear stub:
   - Implements the same interface
   - Throws a clear "not yet implemented" error with guidance
   - Documents the expected MCP/CLI integration point

### Phase 4: Normalizer (engine layer — new file)

9. **`.agentkit/engines/node/src/issue-normalizer.mjs`**:
   - `normalizeIssue(rawIssue, config)` → `BacklogItem`
   - Priority inference: check labels against `importLabelsMap`, fall back to
     heuristics (e.g., "bug" → P1, "enhancement" → P2)
   - Team assignment: check labels against `importTeamMap`, then fall back to
     `intake.ownerTeam`
   - Status mapping: use `importStateMap`
   - Field extraction: title, body → what/why, milestone → phase
   - Acceptance criteria extraction: scan issue body for checkbox lists
   - File path extraction: scan issue body for file references
   - `deduplicateAgainstBacklog(items, existingBacklog)` — match by
     `externalId` or fuzzy title match

### Phase 5: Backlog Persistence (engine layer — new file)

10. **`.agentkit/engines/node/src/backlog-store.mjs`**:
    - `readBacklog(projectRoot)` → parse `AGENT_BACKLOG.md` into structured data
    - `writeBacklog(projectRoot, items)` → render `AGENT_BACKLOG.md` from data
    - `mergeItems(existing, incoming)` → merge with dedup + preserve manual items
    - `readBacklogJson(projectRoot)` → read `.claude/state/backlog.json` (new
      structured store)
    - `writeBacklogJson(projectRoot, items)` → write structured JSON alongside
      markdown
    - The JSON store (`backlog.json`) is the machine-readable source; the
      markdown is the human-readable view

### Phase 6: CLI Handlers (engine layer)

11. **`.agentkit/engines/node/src/import-issues.mjs`** — Runtime handler:
    - Read project config to determine tracker
    - Check if `autoImport` is enabled (or if `--force` flag is passed)
    - Create adapter for configured tracker
    - Fetch issues with filters
    - Normalize each issue
    - Deduplicate against existing backlog
    - Write merged backlog (both JSON and Markdown)
    - Append to `events.log`
    - Print summary (imported N, skipped M duplicates, assigned to K teams)

12. **`.agentkit/engines/node/src/backlog-viewer.mjs`** — Consolidated view:
    - Read backlog JSON
    - Apply filters (team, priority, source, status)
    - Sort by selected field
    - Output in selected format:
      - `table`: formatted ASCII table for terminal
      - `json`: raw JSON array
      - `yaml`: YAML document
      - `csv`: CSV for spreadsheet import

13. **`.agentkit/engines/node/src/cli.mjs`** — Add CLI routes:
    ```javascript
    case 'import-issues': {
      const { runImportIssues } = await import('./import-issues.mjs');
      await runImportIssues({ agentkitRoot, projectRoot, flags });
      break;
    }
    case 'backlog': {
      const { runBacklogViewer } = await import('./backlog-viewer.mjs');
      await runBacklogViewer({ agentkitRoot, projectRoot, flags });
      break;
    }
    case 'sync-backlog': {
      const { runSyncBacklog } = await import('./sync-backlog-runner.mjs');
      await runSyncBacklog({ agentkitRoot, projectRoot, flags });
      break;
    }
    ```

### Phase 7: Init Integration (adoption trigger)

14. **`.agentkit/engines/node/src/init.mjs`** — Add adoption hook:
    - After overlay creation, check if `process.intake.autoImport` is true
    - If true and `issueTracker` is not `none`:
      - Prompt user: "Import existing issues from GitHub? (Y/n)"
      - If yes, run `import-issues` with default options
      - Show summary and allow user to review before committing

### Phase 8: Sync-Backlog Runtime (extends existing template)

15. **`.agentkit/engines/node/src/sync-backlog-runner.mjs`** — Orchestrated sync:
    - Combines all sources (calls individual collectors):
      1. External tracker (via `import-issues` logic)
      2. Discovery findings (via `agentkit discover` results)
      3. Healthcheck results (parse `orchestrator.json`)
      4. Code TODOs (grep codebase)
      5. Review findings (parse `events.log`)
    - Runs normalization and dedup
    - Writes consolidated backlog
    - Supports `--direction push` to create issues from local-only items

### Phase 9: Templates & Multi-Platform Parity

16. **`.agentkit/templates/claude/commands/import-issues.md`** — Claude command template
17. **`.agentkit/templates/claude/commands/backlog.md`** — Claude command template
18. Update all platform templates to include the new commands:
    - Copilot: `.github/prompts/import-issues.prompt.md`, `.github/prompts/backlog.prompt.md`
    - Cursor: `.cursor/commands/import-issues.md`, `.cursor/commands/backlog.md`
    - Windsurf: `.windsurf/commands/import-issues.md`, `.windsurf/commands/backlog.md`
    - Codex: `.agents/skills/import-issues/SKILL.md`, `.agents/skills/backlog/SKILL.md`

    (These are auto-generated by `agentkit sync` from the command templates.)

### Phase 10: Tests

19. **`.agentkit/engines/node/src/__tests__/issue-normalizer.test.mjs`**:
    - Test priority inference from labels
    - Test team assignment from labels
    - Test status mapping
    - Test acceptance criteria extraction from issue body
    - Test deduplication logic
    - Test handling of missing/malformed fields

20. **`.agentkit/engines/node/src/__tests__/github-adapter.test.mjs`**:
    - Test `gh` CLI argument construction
    - Test JSON parsing of `gh issue list` output
    - Test error handling (gh not installed, not authenticated, API errors)
    - Test pagination and limit handling

21. **`.agentkit/engines/node/src/__tests__/backlog-store.test.mjs`**:
    - Test markdown parsing of AGENT_BACKLOG.md
    - Test markdown rendering
    - Test JSON read/write
    - Test merge with dedup
    - Test preservation of manual items

22. **`.agentkit/engines/node/src/__tests__/backlog-viewer.test.mjs`**:
    - Test filter combinations
    - Test sort ordering
    - Test output format correctness (table, json, yaml, csv)

23. **`.agentkit/engines/node/src/__tests__/import-issues.test.mjs`**:
    - Integration test: mock gh → normalize → write backlog
    - Test dry-run mode
    - Test autoImport flag gating
    - Test events.log append

### Phase 11: Documentation & Validation

24. **`docs/08_reference/issue_intake_ownership_and_invocation_flow.md`** — Update:
    - Add `import-issues` and `backlog` to the invocation flow
    - Add to the smoke matrix
    - Document the `autoImport` flag behavior

25. Run the full validation matrix:
    - `pnpm -C .agentkit agentkit:spec-validate`
    - `pnpm -C .agentkit agentkit:sync`
    - `pnpm -C .agentkit agentkit:validate`
    - `pnpm -C .agentkit test`
    - Verify determinism (sync twice, no drift)

---

## Consolidated Backlog Fields (Future UI/CLI Contract)

The `agentkit backlog --format json` output will serve as the API contract for
any future UI. Each item includes:

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `id` | string | generated | Local backlog item ID |
| `externalId` | string? | tracker | e.g., "GH#42", "LIN-123" |
| `externalUrl` | string? | tracker | Link to external issue |
| `title` | string | tracker/local | Issue title |
| `priority` | enum | inferred | P0, P1, P2, P3 |
| `status` | enum | mapped | open, in-progress, completed, blocked, deferred |
| `phase` | enum | inferred | Discovery, Planning, Implementation, Validation, Ship |
| `team` | string | routed | Team ID from teams.yaml |
| `assignee` | string? | tracker | Human assignee name |
| `source` | enum | detected | github, linear, discovery, healthcheck, todo, review, manual |
| `what` | string | extracted | What needs to be done |
| `why` | string | extracted | Why it matters |
| `acceptance` | string[] | extracted | Acceptance criteria |
| `files` | string[] | extracted | Likely files to touch |
| `labels` | string[] | tracker | Original tracker labels |
| `milestone` | string? | tracker | Milestone/sprint |
| `createdAt` | ISO date | tracker | Creation timestamp |
| `updatedAt` | ISO date | tracker | Last update timestamp |
| `lastSyncedAt` | ISO date | local | Last sync timestamp |
| `dirty` | boolean | local | Local changes not yet pushed |

---

## Flag-Gating Behavior

Following the `infraEval` pattern:

1. `process.intake.autoImport: false` (default) — `import-issues` command exists
   but requires explicit invocation
2. `process.intake.autoImport: true` — `agentkit init` automatically runs
   import after overlay setup; `/sync-backlog` includes external tracker pull by
   default
3. `process.issueTracker: none` — all external tracker operations are no-ops;
   local-only backlog management still works

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `gh` CLI not installed or not authenticated | Check `gh auth status` before attempting; provide clear error message with setup instructions |
| Rate limiting on GitHub API | Respect `--limit` flag; implement exponential backoff; cache results in `.claude/state/` |
| Large repos with 1000+ issues | Default `--limit 100`; support `--since` for incremental sync |
| Label/priority mapping is wrong | Make mapping fully configurable in `project.yaml`; provide `--dry-run` to preview before writing |
| Existing AGENT_BACKLOG.md has manual items | Preserve items without `externalId`; never delete manually-added items |
| Breaking changes to backlog format | Version the backlog JSON schema; migration path for existing files |

---

## Implementation Order

```
Phase 1-2: Schema + Validation     ← Foundation (no runtime changes)
Phase 3-4: Adapters + Normalizer   ← Core logic (testable in isolation)
Phase 5:   Backlog Store           ← Persistence layer
Phase 6:   CLI Handlers            ← Wire it all together
Phase 7:   Init Integration        ← Adoption trigger
Phase 8:   Sync-Backlog Runtime    ← Full orchestrated flow
Phase 9:   Templates               ← Multi-platform parity
Phase 10:  Tests                   ← Can start in parallel with Phase 3+
Phase 11:  Docs + Validation       ← Final verification
```

Estimated file count: ~15 new files, ~6 modified files.

---

## Success Criteria

- [ ] `agentkit import-issues` fetches GitHub issues and writes normalized items
      to `AGENT_BACKLOG.md` and `.claude/state/backlog.json`
- [ ] `agentkit backlog --format json` outputs all items from all sources with
      the full field set documented above
- [ ] `agentkit backlog --team backend --priority P0` filters correctly
- [ ] `agentkit init` with `autoImport: true` triggers import during adoption
- [ ] `/sync-backlog` runtime handler combines external + local sources
- [ ] All existing tests continue to pass
- [ ] New tests cover normalizer, adapters, store, and viewer
- [ ] `agentkit spec-validate` passes with new schema fields
- [ ] `agentkit sync` + `agentkit validate` pass with new commands
- [ ] Deterministic: running sync twice produces no diff
