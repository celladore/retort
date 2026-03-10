# INT-001: Intake Agent + /intake Command

**Created**: 2026-03-06
**Priority**: P2
**Status**: not-started
**Category**: intake
**Source**: Extracted from `plan.md` Part 3–4
**History**: —

## Goal

Create a dedicated intake agent (`intake-analyst`) and `/intake` command that converts specification documents (PRDs, functional specs, UI specs, user stories, tech specs, process flows) into structured backlog items in `AGENT_BACKLOG.md`.

## Assumptions & Constraints

- The current workflow has no automated path from specification documents to backlog items
- The Product Manager agent writes PRDs but cannot generate backlog entries from them
- The orchestrator reads `AGENT_BACKLOG.md` but doesn't know how it gets populated
- The intake agent is a **pre-orchestration input stage**, not a replacement for the orchestrator

## Proposed Approach

### Phase 1: Core intake pipeline (P0)

1. Add `intake-analyst` agent to `.agentkit/spec/agents.yaml` (under `product` category)
2. Create `/intake` command in `.agentkit/spec/commands.yaml`
3. Create command template at `.agentkit/templates/claude/commands/intake.md`
4. Create extractor scaffolds in `.agentkit/engines/node/src/extractors/`
5. Run sync to generate agent and command files

### Phase 2: Supporting artifacts (P1)

6. Create `docs/product/INDEX.md` — PRD index with status and affected teams
7. Create `docs/CONVENTIONS.md` — directory layout for each doc type
8. Generate `/team-product` command file (currently missing despite spec existing)
9. Create PRD-to-Team matrix

### Phase 3: Enhancements (P2)

10. Enhance `roadmap-tracker` agent with intake-triggered milestone updates
11. Implement batch intake (`/intake prd --all`)
12. Add staleness detection for backlog items
13. Add dependency graph visualization (Mermaid output)

### Supported Document Types

| Type         | Short ID    | Location                   | Extracts                                        |
| ------------ | ----------- | -------------------------- | ----------------------------------------------- |
| PRD          | `prd`       | `docs/product/PRD-*.md`    | Phases, deliverables, acceptance criteria       |
| Func Spec    | `func-spec` | `docs/architecture/specs/` | Features, business rules, contracts             |
| UI/UX Spec   | `ui-spec`   | `docs/design/UI-*.md`      | Screens, components, interaction flows          |
| User Stories | `stories`   | `docs/product/stories/`    | Epics, stories, acceptance criteria             |
| Tech Spec    | `tech-spec` | `docs/architecture/specs/` | Modules, API contracts, data models             |
| Process Flow | `process`   | `docs/processes/FLOW-*.md` | Steps, decision points, integration touchpoints |

### Command Usage

```
/intake <doc-type> <ID-or-path> [flags]

Flags:
  --dry-run        Show proposed items without writing
  --phase N        Only intake from a specific phase/section
  --team <id>      Only intake items relevant to a specific team
  --append         Add to existing backlog (default)
  --replace        Replace existing items sourced from this document
  --priority-map   Override default priority mapping
```

### Agent Definition

```yaml
- id: intake-analyst
  category: product
  name: Intake Analyst
  role: >
    Reads specification documents (PRDs, functional specs, UI design specs,
    user stories, technical specs, process flows) and extracts actionable
    work items. Maps deliverables to teams, generates AGENT_BACKLOG.md
    entries with priorities and dependencies, and maintains traceability
    from source documents to backlog items.
  accepts: [intake, plan, review]
  depends-on: []
  notifies: [product-manager, roadmap-tracker]
  focus:
    - 'docs/product/**'
    - 'docs/architecture/specs/**'
    - 'docs/design/**'
    - 'docs/processes/**'
    - 'docs/prd/**'
    - 'AGENT_BACKLOG.md'
```

### Known Gaps & Risks

| #   | Gap                                    | Mitigation                                                     |
| --- | -------------------------------------- | -------------------------------------------------------------- |
| 1   | No document format validation          | Validate structure before extraction; warn on missing sections |
| 2   | No idempotency (duplicate intake runs) | Track provenance via source tags, deduplicate on re-intake     |
| 3   | No cross-document dependency detection | Cross-reference `dependsOn` against previously intaken docs    |
| 4   | No partial re-intake after doc edits   | Diff-based re-intake against last-intaken snapshot             |
| 5   | No effort estimation                   | Optional `--estimate` flag for T-shirt sizing                  |
| 6   | Team assignment may be wrong           | Confidence scores; flag low-confidence for human review        |

## Files to Modify

| File                           | Change                           |
| ------------------------------ | -------------------------------- |
| `.agentkit/spec/agents.yaml`   | Add `intake-analyst` agent entry |
| `.agentkit/spec/commands.yaml` | Add `intake` command spec        |

## Files to Create

| File                                                  | Purpose                   |
| ----------------------------------------------------- | ------------------------- |
| `.agentkit/templates/claude/commands/intake.md`       | Command template          |
| `.agentkit/engines/node/src/extractors/prd.mjs`       | PRD extractor             |
| `.agentkit/engines/node/src/extractors/func-spec.mjs` | Functional spec extractor |
| `.agentkit/engines/node/src/extractors/tech-spec.mjs` | Technical spec extractor  |
| `.agentkit/engines/node/src/extractors/ui-spec.mjs`   | UI/UX spec extractor      |
| `.agentkit/engines/node/src/extractors/stories.mjs`   | User stories extractor    |
| `.agentkit/engines/node/src/extractors/process.mjs`   | Process flow extractor    |

## Acceptance Criteria

- [ ] `intake-analyst` agent exists in `agents.yaml`
- [ ] `/intake` command is defined in `commands.yaml`
- [ ] `/intake prd PRD-005 --dry-run` produces structured output
- [ ] Idempotent: running intake twice doesn't create duplicates
- [ ] Team assignment uses `teams.yaml` scope patterns
- [ ] Source traceability tags link backlog items to doc sections

## References

- Source: `plan.md` Parts 3, 4
- Related: BUG-001 (PRD detector path — prerequisite)
- Related: CLI-001 (separate concern — team structure)

---

**Author**: AI (extracted from plan.md)
**Reviewed**: No
