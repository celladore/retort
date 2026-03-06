# AgentKit Forge — Internal Documentation

Navigation index for the `.agentkit/docs/` directory. These docs cover the AgentKit Forge framework itself — how it works, how to configure it, and how to extend it.

## Getting Started

| Document | Description |
|----------|-------------|
| [QUICK_START](QUICK_START.md) | 15-minute onboarding walkthrough |
| [CLI_INSTALLATION](CLI_INSTALLATION.md) | Prerequisites, install steps, verification |
| [ONBOARDING](ONBOARDING.md) | Full setup guide with system requirements |

## Core Guides

| Document | Description |
|----------|-------------|
| [COMMAND_REFERENCE](COMMAND_REFERENCE.md) | All slash commands with flags and examples |
| [TEAM_GUIDE](TEAM_GUIDE.md) | 10-team structure, decision matrix, handoff patterns |
| [WORKFLOWS](WORKFLOWS.md) | End-to-end scenario walkthroughs (discovery to merge) |
| [AGENTS_REFERENCE](AGENTS_REFERENCE.md) | 19 agent personas with roles and dependencies |
| [AGENTS_VS_TEAMS](AGENTS_VS_TEAMS.md) | Conceptual distinction between agents and teams |

## Architecture & Internals

| Document | Description |
|----------|-------------|
| [ARCHITECTURE](ARCHITECTURE.md) | Directory structure, validation pipeline, sync engine |
| [STATE_AND_SESSIONS](STATE_AND_SESSIONS.md) | Orchestrator state schema, session lifecycle |
| [SECURITY_MODEL](SECURITY_MODEL.md) | Threat model, mitigations (injection, secrets, destructive ops) |
| [COST_TRACKING](COST_TRACKING.md) | Session cost tracking, token usage, roadmap |

## Configuration

| Document | Description |
|----------|-------------|
| [PROJECT_YAML_REFERENCE](PROJECT_YAML_REFERENCE.md) | `project.yaml` schema reference |
| [CUSTOMIZATION](CUSTOMIZATION.md) | Overlay system, merge semantics, scaffold modes |
| [TOOLS](TOOLS.md) | 11 render targets and output configuration |
| [AGENTS_MD_GUIDE](AGENTS_MD_GUIDE.md) | AGENTS.md standard across platforms |
| [MCP_A2A_GUIDE](MCP_A2A_GUIDE.md) | MCP server config and A2A protocol |

## Maintenance & Reference

| Document | Description |
|----------|-------------|
| [MIGRATION_GUIDE](MIGRATION_GUIDE.md) | Upgrading between framework versions |
| [TROUBLESHOOTING](TROUBLESHOOTING.md) | Common issues by category (setup, sync, runtime) |
| [ROADMAP](ROADMAP.md) | Near/medium/long-term direction |
| [FOLLOW_UP_ISSUES](FOLLOW_UP_ISSUES.md) | Tracked follow-up items |
| [DOCUMENTATION_AUDIT](DOCUMENTATION_AUDIT.md) | Self-audit findings and gap analysis |
| [PLATFORM_REFERENCE](PLATFORM_REFERENCE.md) | Platform guide directory index |

## Subdirectories

| Directory | Contents |
|-----------|----------|
| [`platform_reference/`](platform_reference/README.md) | 35 platform-specific guides + 8 analysis docs (performance, cost, security, spending tiers) |
| [`router_specialist/`](router_specialist/) | 6 governance/migration reference stubs for upstream ownership model |
