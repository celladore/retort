<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown rule for Windsurf Cascade AI. -->
<!-- Docs: https://docs.windsurf.com/windsurf/cascade -->
# Orchestration Workflow

Follow the 5-phase lifecycle for all significant work items.

## Phases
1. **Discovery** — Scan codebase, identify dependencies, map team ownership
2. **Planning** — Define tasks, set acceptance criteria, assign to teams
3. **Implementation** — Execute tasks with small, reversible changes
4. **Validation** — Run quality gates, tests, security scans
5. **Ship** — Final review, merge, deploy

## Teams
- T1-BACKEND — API, services, business logic
- T2-FRONTEND — UI, components, styling
- T3-DATA — Database, models, migrations
- T4-INFRA — Infrastructure as code, cloud resources
- T5-DEVOPS — CI/CD, automation, monitoring
- T6-TESTING — Test strategy, coverage, E2E
- T7-SECURITY — Auth, compliance, vulnerability management
- T8-DOCS — Documentation, ADRs, runbooks
- T9-PRODUCT — Feature specs, PRDs, user stories
- T10-QUALITY — Code review, refactoring, standards

## Coordination
Run `.agentkit/bin/orchestrate` for automated multi-agent coordination.
Each team operates independently but reports status through the orchestrator.
Cross-team dependencies must be declared in the planning phase.
