# feat(agent): Add `maintenance-coordinator` agent

**Priority:** P1 — High
**Labels:** `enhancement`, `agent`, `operations`
**Blocked by:** None
**Blocks:** #004 (rules ownership), #005 (script ownership)

---

## Problem

19 agents cover engineering, design, marketing, operations, product, testing, and project management — but no agent owns the **maintenance lifecycle**. `project.yaml` declares `phase: active` with a valid transition to `maintenance`, but when that transition happens there's no coordinator.

Scattered maintenance concerns today:
- `dependency-watcher` monitors dependencies (isolated)
- `environment-manager` handles environment config (isolated)
- `devops` owns CI/CD pipelines
- Nobody owns: `rules.yaml`, maintenance scripts, tech debt tracking, CLI-spec parity

---

## Implementation Plan

### Step 1: Add agent to `agents.yaml` (~15 min)

Append to the operations category in `.agentkit/spec/agents.yaml`:

```yaml
  - id: maintenance-coordinator
    category: operations
    name: Maintenance Coordinator
    role: >
      System maintenance specialist responsible for framework health, rule
      governance, technical debt tracking, script ownership, and coordination
      of maintenance-phase operations. Stewards AgentKit Forge internals and
      ensures CLI, hooks, CI, and generated outputs remain consistent with
      specifications.
    accepts:
      - implement
      - review
      - investigate
    depends-on: []
    notifies:
      - devops
      - test-lead
      - dependency-watcher
    preferred-tools:
      - Read
      - Write
      - Edit
      - Glob
      - Grep
      - Bash
    focus:
      - '.agentkit/spec/rules.yaml'
      - '.agentkit/engines/node/src/**'
      - 'scripts/**'
      - '.github/workflows/**'
      - '.gitattributes'
      - 'CHANGELOG.md'
      - 'CONTRIBUTING.md'
    responsibilities:
      - Own and evolve .agentkit/spec/rules.yaml with quarterly review cadence
      - Maintain scripts/ directory (resolve-merge.sh, update-changelog.sh, etc.)
      - Track technical debt inventory and prioritize remediation
      - Ensure CLI commands match spec definitions (no phantom commands)
      - Validate hook completeness and lifecycle correctness
      - Monitor merge driver health via doctor.mjs diagnostics
      - Coordinate dependency update strategy with dependency-watcher
      - Lead maintenance-phase transition when project.yaml phase changes
```

### Step 2: Run sync to generate outputs (~5 min)

```bash
pnpm -C .agentkit agentkit:sync
```

This generates:
- `.github/agents/maintenance-coordinator.agent.md`
- Updates to `.claude/commands/` referencing the new agent
- Updates to CLAUDE.md agent index

### Step 3: Create agent-specific template content (~30 min)

If the sync template for Copilot agents doesn't auto-generate detailed enough content, supplement `.github/agents/maintenance-coordinator.agent.md` with:

- Maintenance playbooks (dependency update workflow, rule change workflow)
- Interaction patterns with dependency-watcher and devops
- Tech debt tracking format (location: `docs/TECHNICAL_DEBT.md`)
- Quarterly review checklist

### Step 4: Update team assignment (~10 min)

In `.agentkit/spec/teams.yaml`, the `quality` team (cross-cutting) should list `maintenance-coordinator` as a member, or create a dedicated maintenance team scope:

```yaml
  - id: maintenance
    name: MAINTENANCE
    focus: Framework health, rules governance, tech debt
    scope:
      - '.agentkit/**'
      - 'scripts/**'
      - '.github/workflows/**'
    accepts:
      - implement
      - review
      - investigate
    handoff:
      - quality
```

### Step 5: Verify no circular dependencies (~5 min)

Check that adding `notifies: [devops, test-lead, dependency-watcher]` doesn't create a cycle. Current graph:

```
maintenance-coordinator → devops → test-lead → (terminal)
maintenance-coordinator → test-lead → (terminal)
maintenance-coordinator → dependency-watcher → security-auditor, devops
```

The `dependency-watcher → devops` path could create a logical loop if devops notifies back. Verify `devops.notifies` doesn't include maintenance-coordinator.

---

## Acceptance Criteria

- [ ] Agent defined in `agents.yaml` with all fields
- [ ] `agentkit sync` generates `.github/agents/maintenance-coordinator.agent.md`
- [ ] Agent appears in `agentkit discover --output json` output
- [ ] No circular dependency in notifies/depends-on graph
- [ ] Agent focus areas cover: rules.yaml, scripts/, workflows, .gitattributes

---

## Related

- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
- Depends-on for: #004, #005
