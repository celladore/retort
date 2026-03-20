# fix(spec): Document 8 CLI-only commands missing from commands.yaml

**Priority:** P2 — Medium
**Labels:** `spec-drift`, `documentation`
**Blocked by:** None

---

## Problem

8 commands exist in CLI (`VALID_COMMANDS`, cli.mjs:26-48) but are **not defined** in `commands.yaml`. This is the reverse of #001 — commands work but aren't spec'd.

| CLI Command     | Handler              | Why It's Missing                                |
| --------------- | -------------------- | ----------------------------------------------- |
| `init`          | `init.mjs`           | Framework-internal, not a user workflow command |
| `sync`          | `synchronize.mjs`    | Framework-internal                              |
| `spec-validate` | `spec-validator.mjs` | Framework-internal                              |
| `add`           | `tool-manager.mjs`   | Tool management utility                         |
| `remove`        | `tool-manager.mjs`   | Tool management utility                         |
| `list`          | `tool-manager.mjs`   | Tool management utility                         |
| `tasks`         | `task-cli.mjs`       | Task management utility                         |
| `delegate`      | `task-cli.mjs`       | Task management utility                         |

---

## Implementation Plan

### Option A: Add to commands.yaml (Recommended)

Add a new `framework` type category to `commands.yaml`:

```yaml
framework:
  - name: init
    type: framework
    description: >
      Initialize the current repository as an Retort project.
      Creates .agentkit-repo marker and initial overlay configuration.
    flags:
      - name: overlay
        type: string
        description: Overlay template to apply

  - name: sync
    type: framework
    description: >
      Render AI tool configurations from specs and templates. Generates
      .claude/, .cursor/, .windsurf/, .github/ outputs and manages
      .gitattributes merge drivers.
    flags:
      - name: dry-run
        type: bool
        description: Show what would change without writing
      - name: quiet
        type: bool
        description: Suppress informational output

  - name: spec-validate
    type: framework
    description: >
      Validate all YAML spec files against expected schemas. Checks
      agents.yaml, commands.yaml, teams.yaml, and rules.yaml.

  - name: add
    type: framework
    description: Add an AI tool target (claude, cursor, windsurf, copilot, etc.)
    flags:
      - name: tool
        type: string
        description: Tool name to add

  - name: remove
    type: framework
    description: Remove an AI tool target.
    flags:
      - name: tool
        type: string
        description: Tool name to remove

  - name: list
    type: framework
    description: List configured AI tool targets and their status.

  - name: tasks
    type: framework
    description: >
      List and inspect delegated tasks. Supports filtering by status,
      assignee, type, and priority.
    flags:
      - name: status
        type: string
        description: Filter by status (submitted, working, completed, delivered)
      - name: assignee
        type: string
        description: Filter by assigned team
      - name: id
        type: string
        description: Show detail for a specific task
      - name: process-handoffs
        type: bool
        description: Process completed tasks' handoff chains

  - name: delegate
    type: framework
    description: >
      Create a delegated task assigned to a team or agent.
    flags:
      - name: to
        type: string
        required: true
        description: Target team or agent (comma-separated for multiple)
      - name: title
        type: string
        required: true
        description: Task title
      - name: type
        type: enum
        values: [implement, review, plan, investigate, test, document]
        description: Task type
      - name: priority
        type: enum
        values: [P0, P1, P2, P3]
        description: Task priority
```

### Option B: Document as intentionally framework-internal

Add a comment block at the top of `commands.yaml`:

```yaml
# NOTE: The following CLI commands are framework-internal and intentionally
# not listed in this spec file. They are always available via the CLI:
#   init, sync, spec-validate, add, remove, list, tasks, delegate
# These commands manage the Retort framework itself, not project workflows.
```

### Step: Add validate.mjs check for spec-CLI parity (~30 min)

In `validate.mjs`, add a check that cross-references `VALID_COMMANDS` against `commands.yaml`:

```javascript
// Phase: CLI-Spec parity
const specCommands = [...workflowCommands, ...utilityCommands, ...teamCommands].map(c => c.name);
const cliCommands = ['init', 'sync', 'validate', ...]; // Read from VALID_COMMANDS
const inCliNotSpec = cliCommands.filter(c => !specCommands.includes(c) && !FRAMEWORK_COMMANDS.includes(c));
const inSpecNotCli = specCommands.filter(c => !cliCommands.includes(c));
// Warn on mismatches
```

---

## Acceptance Criteria

- [x] All 8 commands either added to `commands.yaml` or documented as intentionally excluded
  - `init` added as `type: framework` with full prompt/flags documentation
  - `sync` updated from `type: utility` to `type: framework`; AgentKit Forge → Retort rename
  - `spec-validate`, `add`, `remove`, `list`, `tasks`, `delegate` documented in header NOTE block
  - `spec-validator.mjs` updated to accept `framework` as a valid command type
- [ ] `validate.mjs` checks for CLI-spec command parity
- [ ] No drift warning when running `agentkit validate`

## Implementation Notes (2026-03-20)

Partial implementation complete as part of `feat/kit-domain-selection-onboarding`:
- `type: framework` added to `VALID_COMMAND_TYPES` in `spec-validator.mjs`
- `init` command added to `commands.yaml` with kit selection documentation
- `sync` type corrected; header documents intentionally-excluded CLI commands
- Remaining: `validate.mjs` CLI-spec parity check (deferred)

---

## Related

- Inverse of: #001 (commands in spec without CLI handlers)
- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
