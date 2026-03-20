# Agent Catalog

All agent personas defined in `.agentkit/spec/agents.yaml`, organized by category.
These agents are loaded into team commands based on category-to-team matching or
explicit `agents` field in `teams.yaml`.

## Category → Team Mapping

| Category           | Loaded by Team Command                           | Status                                            |
| ------------------ | ------------------------------------------------ | ------------------------------------------------- |
| engineering        | — (agents not category-matched to a single team) | Individual agents used directly                   |
| design             | —                                                | Not team-mapped                                   |
| marketing          | —                                                | Not team-mapped                                   |
| operations         | —                                                | Not team-mapped                                   |
| product            | `/team-product`                                  | Active                                            |
| testing            | `/team-testing`                                  | Active                                            |
| project-management | —                                                | Not team-mapped (PM agents available as personas) |
| feature-management | —                                                | Not team-mapped                                   |

## Engineering Agents

| ID         | Name                    | Role                                                     |
| ---------- | ----------------------- | -------------------------------------------------------- |
| `backend`  | Backend Engineer        | API design, service implementation, core business logic  |
| `frontend` | Frontend Engineer       | UI components, client-side state, accessibility          |
| `data`     | Data Engineer           | Database design, migrations, query optimization          |
| `devops`   | DevOps Engineer         | CI/CD pipelines, containerization, deployment automation |
| `infra`    | Infrastructure Engineer | IaC, cloud resources, networking, security hardening     |

## Design Agents

| ID               | Name           | Role                                              |
| ---------------- | -------------- | ------------------------------------------------- |
| `brand-guardian` | Brand Guardian | Brand consistency, design tokens, visual identity |
| `ui-designer`    | UI Designer    | Component design, layout, UX patterns             |

## Marketing Agents

| ID                   | Name               | Role                                                   |
| -------------------- | ------------------ | ------------------------------------------------------ |
| `content-strategist` | Content Strategist | Content planning, copywriting, messaging               |
| `growth-analyst`     | Growth Analyst     | Analytics, conversion optimization, growth experiments |

## Operations Agents

| ID                      | Name                  | Role                                                              |
| ----------------------- | --------------------- | ----------------------------------------------------------------- |
| `dependency-watcher`    | Dependency Watcher    | Supply chain security, version management, vulnerability tracking |
| `environment-manager`   | Environment Manager   | Environment configuration, secrets management                     |
| `security-auditor`      | Security Auditor      | Security reviews, compliance checks, threat modeling              |
| `retrospective-analyst` | Retrospective Analyst | Session analysis, lessons learned, process improvement            |

## Product Agents (loaded by `/team-product`)

| ID                  | Name              | Role                                                               |
| ------------------- | ----------------- | ------------------------------------------------------------------ |
| `product-manager`   | Product Manager   | Feature prioritization, PRD creation, stakeholder alignment        |
| `roadmap-tracker`   | Roadmap Tracker   | Timeline management, milestone tracking, dependency mapping        |
| `expansion-analyst` | Expansion Analyst | Gap identification, improvement opportunities, capability analysis |

## Testing Agents (loaded by `/team-testing`)

| ID                   | Name               | Role                                                       |
| -------------------- | ------------------ | ---------------------------------------------------------- |
| `test-lead`          | Test Lead          | Test strategy, coverage planning, quality standards        |
| `coverage-tracker`   | Coverage Tracker   | Coverage analysis, gap identification, regression tracking |
| `integration-tester` | Integration Tester | Cross-module testing, API contract verification            |

## Project Management Agents

| ID                | Name            | Role                                                        |
| ----------------- | --------------- | ----------------------------------------------------------- |
| `project-shipper` | Project Shipper | Delivery tracking, risk register, task lifecycle management |
| `release-manager` | Release Manager | Release coordination, changelog, deployment readiness       |

## Feature Management Agents

| ID            | Name                          | Role                                                   |
| ------------- | ----------------------------- | ------------------------------------------------------ |
| `feature-ops` | Feature Operations Specialist | Feature flag management, rollout strategy, A/B testing |

## How Agents Are Loaded

The sync engine resolves agents to teams using `resolveTeamAgents()`:

1. **Explicit mapping**: If a team has `agents: [id1, id2]` in `teams.yaml`,
   those specific agents are loaded
2. **Category fallback**: If no explicit mapping, agents whose category name
   matches the team ID are loaded (e.g., `product` category → `/team-product`)

To add agents to a team, either:

- Add agent IDs to the team's `agents` field in `.agentkit/spec/teams.yaml`
- Name the agent's category to match the target team ID

After changes, run `pnpm -C .agentkit agentkit:sync` to regenerate team commands.
