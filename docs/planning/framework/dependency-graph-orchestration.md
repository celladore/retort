# FW-005: Dependency Graph Integration with Orchestrator & Agent Teams

## Metadata
- **ID**: FW-005
- **Priority**: P2
- **Status**: not-started
- **Created**: 2026-03-06

## Problem Statement

The planning folder has a static dependency graph in `docs/planning/README.md` that describes relationships between work items (e.g., `FO-002 depends on FO-001`). However, the orchestrator and agent teams don't consume this graph — they use their own `depends-on` fields in `agents.yaml` and `blockedBy`/`dependsOn` fields in task files. These are separate systems with no cross-referencing.

This means:
1. The orchestrator can't auto-prioritize based on planning dependencies
2. Planning item status changes don't unblock dependent task assignments
3. Agent teams don't know about cross-domain dependencies
4. The dependency graph is manually maintained and may drift

## Current Dependency Systems

| System | Location | Scope | Consumers |
|--------|----------|-------|-----------|
| Planning graph | `docs/planning/README.md` | Cross-domain work items | Humans only |
| Agent depends-on | `.agentkit/spec/agents.yaml` | Agent notification chains | Sync engine |
| Task dependencies | `.claude/state/tasks/*.json` | Individual task blocking | Orchestrator |
| Backlog priorities | `AGENT_BACKLOG.md` | Work item ordering | Team commands |

## Investigation Areas

### 1. Should the Orchestrator Read the Planning Graph?

**Option A: Orchestrator consumes planning dependencies**
- Parse `docs/planning/README.md` dependency section
- Before assigning work, check if prerequisites are `completed`
- Automatically unblock work when prerequisites finish
- Pro: Single source of truth for strategic dependencies
- Con: Couples orchestrator to a documentation format

**Option B: Planning graph generates task dependencies**
- When a planning item starts, auto-create tasks with `blockedBy` from the graph
- Planning agent (FW-004) maintains the mapping
- Pro: Uses existing task protocol; cleaner separation
- Con: Requires FW-004 planning agent first

**Option C: Bidirectional sync**
- Planning graph and task dependencies stay in sync
- Changes in either direction are propagated
- Pro: Flexibility; humans and agents both update
- Con: Most complex; conflict resolution needed

### 2. Machine-Readable Dependency Graph Format

The current dependency graph is ASCII art in a markdown code block. Options:
- **YAML dependency section** in planning README (structured, parseable)
- **Separate `dependencies.yaml`** file in planning folder
- **Frontmatter in plan files** (each file declares its dependencies)
- **Graph database** (overkill for current scale)

### 3. Cross-Domain Dependency Patterns

Planning items span multiple domains (FinOps → Agents → Cost Governance). The graph needs to express:
- **Hard blocks**: FO-002 cannot start until FO-001 is done
- **Soft blocks**: AT-006 is deferred until FO-001 provides triggers
- **External blocks**: FO-001 depends on an external repo
- **Parallel tracks**: AT-001, AT-002, AT-003 can run simultaneously

## Deliverables

- [ ] Analysis of current dependency patterns across all systems
- [ ] Recommended integration approach (Option A, B, or C)
- [ ] Machine-readable dependency format specification
- [ ] Prototype of orchestrator reading planning dependencies
- [ ] ADR documenting the decision

## Acceptance Criteria

- [ ] Orchestrator can check planning prerequisites before work assignment
- [ ] Completing a planning item automatically surfaces newly unblocked items
- [ ] Dependency graph format is machine-readable and human-readable
- [ ] No manual graph maintenance required for status-driven changes
