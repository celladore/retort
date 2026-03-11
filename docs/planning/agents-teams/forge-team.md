# TeamForge Meta-Team (T11)

## Summary

TeamForge is the foundational meta-team that produces fully specified, tested, and
deployment-ready agent team specifications through a structured multi-agent pipeline.
It is the "team that builds teams."

## Origin

- **Source**: `phoenixvc/cognitive-mesh` issue #130 — TeamForge pipeline architecture
- **Adapted for**: agentkit-forge spec-driven architecture (YAML specs → sync → generated configs)

## Pipeline Architecture

```
Input → InputClarifier → MissionDefiner → RoleArchitect → PromptEngineer
      → FlowDesigner → TeamValidator → Final Output (spec files)
```

## Agents (team-creation category)

| Agent | Role |
|-------|------|
| input-clarifier | Assess raw team creation requests, extract constraints, validate against existing teams |
| mission-definer | Lock team definition: ID, name, focus, scope, accepts, handoff-chain |
| role-architect | Design agent roles, dependencies, notification chains |
| prompt-engineer | Write agent descriptions, domain rules, conventions |
| flow-designer | Design team command, flags, integration points |
| team-validator | Quality gate — cross-reference agents/teams/commands for consistency |

## Team Definition

```yaml
- id: forge
  name: TEAMFORGE
  focus: 'Meta-team — creates, validates, and deploys new agent team specifications'
  scope: ['.agentkit/spec/**', 'docs/planning/agents-teams/**', 'docs/architecture/**']
  accepts: [plan, review, investigate, document]
  handoff-chain: [quality, docs]
```

## Command

`/team-forge --task <create-team|validate-team|audit-teams|update-team>`

## Design Decisions

- **6 agents vs 8**: Simplified from cogmesh's 8-agent pipeline (dropped ResearchAgent
  and ConsistencyValidator as separate agents — their responsibilities are absorbed by
  team-validator and input-clarifier respectively)
- **Sequential pipeline**: Each agent receives all prior outputs as context
- **Quality gate**: team-validator runs last as a cross-cutting consistency check

## Status

- [x] Team definition in `teams.yaml`
- [x] 6 agents in `agents.yaml` (team-creation category)
- [x] `/team-forge` command in `commands.yaml`
- [x] Intake routing: `forge: forge`
- [x] Sync outputs generated for all render targets
- [ ] First real-world validation (Part 3: Strategic Ops team creation)
