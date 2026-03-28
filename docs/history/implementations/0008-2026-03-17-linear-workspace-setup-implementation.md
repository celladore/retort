# Linear PhoenixVC Workspace Setup - Historical Summary

**Completed**: 2026-03-17
**Duration**: Single session (~2 hours)
**Status**: ✅ **SUCCESSFULLY COMPLETED** (with pending manual items)
**PR**: N/A — Configuration-only, no code changes

## Overview

Set up the Linear PhoenixVC workspace with 7 sub-teams, label-based routing, issue templates, workflow automations, auto-triage via Tembo, and a Notion intake agent. This creates a structured workflow where new issues are automatically enriched with context (codebase, Notion, Sentry), labeled, prioritized, and routed to the appropriate team for action.

## Implementation Summary

### Projects/Components Affected

- ✅ **Linear PhoenixVC Workspace** — 7 sub-teams created with distinct purposes
- ✅ **Label System** — 2 label groups (Routing + Type) with 13 labels total
- ✅ **Issue Templates** — 8 templates at workspace level with default properties
- ✅ **Workflow Automations** — PR-to-status mapping, auto-close stale issues
- ✅ **Tembo Auto-Triage** — "Enrich Linear Issue" automation with routing logic
- ✅ **Notion Intake Agent** — Automated Notion → Linear filing with research, dedup, and routing
- ✅ **Issue Statuses** — 6 custom statuses added (Investigating, Findings Ready, Testing, Waiting, Passed, Failed)

### Key Changes Made

1. **Team Structure** — Created Coding (COD), Research (RES), QA (QA), Ops (OPS), Design (DES), Docs (DOC), Support (SUP) as sub-teams under PhoenixVC (PHO)
2. **Label-Based Routing** — Each ticket gets 1 Routing label (determines team) + 1 Type label (Bug/Feature/Improvement/chore)
3. **Auto-Triage via Tembo** — Claude Code Opus 4.6 agent enriches every new issue and applies routing labels + moves to correct team
4. **Templates with Defaults** — Each template auto-sets Team and Labels via default properties
5. **Triage Enabled** — All teams have triage enabled, assigned to Jurie Smit
6. **Workspace Agent Guidance** — Drafted instructions for Linear's AI agents section

### Issues Resolved

- **No routing system**: Previously, all issues landed in one bucket with no clear assignment → Now label-based routing auto-assigns to teams
- **No agent differentiation**: Unclear which AI agent to use for what → Now Codex/Cursor/Copilot for coding, Tembo/ChatGPT/Solo for research, Stilla for design
- **No enrichment**: Issues created with minimal context → Tembo now enriches with codebase/Notion/Sentry context

## Implementation Approach

### Phase 1: Team & Label Design

Analyzed available Linear integrations (8 agents, 30+ available). Designed 5 teams based on work type, not tool type. Created label groups for routing and classification.

### Phase 2: Configuration

Created teams, labels (via GraphQL API — some worked, some required manual creation), statuses (added to parent team for inheritance), and templates (workspace level with default properties).

### Phase 3: Automation

Extended existing Tembo "Enrich Linear Issue" automation to also apply routing labels, type labels, priority, and move issues to the correct team.

## Results

### Configuration

- **Teams**: 7 sub-teams + 1 parent = 8 total
- **Labels**: 13 workspace-level labels in 2 groups
- **Templates**: 8 issue templates with default properties
- **Statuses**: 14 total (8 default + 6 custom)
- **Automations**: PR→status mapping, auto-close stale, Tembo enrichment + routing

### Agent Assignment

| Team     | Primary Agents                                                     |
| -------- | ------------------------------------------------------------------ |
| Coding   | Codex (autonomous), Cursor (interactive), GitHub Copilot (PR gen)  |
| Research | Tembo (orchestrator), ChatGPT (deep research), Solo (codebase Q&A) |
| QA       | Ranger (recommended), Tusk (recommended) — not yet enabled         |
| Ops      | GitHub integration (broken auth)                                   |
| Design   | Stilla (meeting context + drafts)                                  |
| Docs     | Claude Code, Notion AI                                             |
| Support  | Intercom (MCP), ChatGPT                                            |

## Lessons Learned

### Technical Insights

- Linear sub-teams cannot have their own workflow states — they inherit from the parent team
- Linear's MCP OAuth connects to whichever workspace you select during auth flow — re-auth needed to switch workspaces
- Label groups should be created at workspace level, not team level, for cross-team visibility
- Tembo's "Auto" repo setting can cause wrong-repo context — use explicit repo selection

### Process Improvements

- Templates with default properties (Team + Labels) reduce manual routing to zero
- Every ticket needs exactly 2 labels (1 routing + 1 type) for the system to work
- Cost awareness: Opus 4.6 for every new issue is expensive — Sonnet is sufficient for enrichment

### Best Practices Established

- Create labels at workspace level with descriptive group names
- Use templates' default properties to auto-route, not workflow automations
- Keep team count small (7) — more teams = more routing complexity
- Single triage owner (human) as safety net until automation is proven

## Future Considerations

- Enable Ranger and Tusk agents for QA team when budget allows
- Fix GitHub integration auth in Tembo for Auto Fix CI, Enrich GitHub Issue, PR Review automations
- Switch Tembo agent from Opus to Sonnet for cost reduction
- Re-authorize Linear MCP plugin to PhoenixVC workspace
- Evaluate whether to add CodeRabbit for automated PR reviews
- Consider adding priority-based assignment within teams (e.g., Urgent bugs → Codex for speed)

## Pending Manual Items

- [ ] Revoke "Claude MCP key" Linear API key (shared in chat)
- [ ] Fix GitHub auth in Tembo
- [ ] Change Tembo repo from "Auto" to explicit
- [ ] Paste workspace agent guidance into Linear Settings → Agents
- [ ] Change stale close from 6 months to 3 months
- [ ] Enable auto-close parent issues
- [ ] Re-authorize Linear MCP to PhoenixVC workspace

## Related Documentation

- **Session Memory**: `~/.claude/projects/.../memory/MEMORY.md` — Linear section added
- **MCP Knowledge Graph**: 12 entities + 11 relations saved covering full workspace config
- **Notion Intake Agent**: `docs/integrations/04_notion-linear-intake-agent.md` — Full agent instructions

---

**Implementation Team**: Claude Code + Jurie Smit (manual UI config)
**Review Status**: Operational — Tembo enrichment running, routing labels created
**Next Steps**: Fix GitHub auth in Tembo, revoke exposed API key, switch to Sonnet model
