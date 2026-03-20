# AgentKit Forge — Internal Documentation

Navigation index for the `.agentkit/docs/` directory. These docs cover the AgentKit Forge framework itself — how it works, how to configure it, and how to extend it.

## Getting Started

| Document                                                | Description                                |
| ------------------------------------------------------- | ------------------------------------------ |
| [QUICK_START](getting-started/QUICK_START.md)           | 15-minute onboarding walkthrough           |
| [CLI_INSTALLATION](getting-started/CLI_INSTALLATION.md) | Prerequisites, install steps, verification |
| [ONBOARDING](getting-started/ONBOARDING.md)             | Full setup guide with system requirements  |

## Core Guides

| Document                                         | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| [COMMAND_REFERENCE](guides/COMMAND_REFERENCE.md) | All slash commands with flags and examples            |
| [TEAM_GUIDE](guides/TEAM_GUIDE.md)               | 10-team structure, decision matrix, handoff patterns  |
| [WORKFLOWS](guides/WORKFLOWS.md)                 | End-to-end scenario walkthroughs (discovery to merge) |
| [AGENTS_REFERENCE](guides/AGENTS_REFERENCE.md)   | 19 agent personas with roles and dependencies         |
| [AGENTS_VS_TEAMS](guides/AGENTS_VS_TEAMS.md)     | Conceptual distinction between agents and teams       |

## Architecture & Internals

| Document                                                 | Description                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| [ARCHITECTURE](architecture/ARCHITECTURE.md)             | Directory structure, validation pipeline, sync engine           |
| [STATE_AND_SESSIONS](architecture/STATE_AND_SESSIONS.md) | Orchestrator state schema, session lifecycle                    |
| [SECURITY_MODEL](architecture/SECURITY_MODEL.md)         | Threat model, mitigations (injection, secrets, destructive ops) |
| [COST_TRACKING](architecture/COST_TRACKING.md)           | Session cost tracking, token usage, roadmap                     |

## Configuration

| Document                                                          | Description                                     |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| [PROJECT_YAML_REFERENCE](configuration/PROJECT_YAML_REFERENCE.md) | `project.yaml` schema reference                 |
| [CUSTOMIZATION](configuration/CUSTOMIZATION.md)                   | Overlay system, merge semantics, scaffold modes |
| [TOOLS](configuration/TOOLS.md)                                   | 11 render targets and output configuration      |
| [AGENTS_MD_GUIDE](configuration/AGENTS_MD_GUIDE.md)               | AGENTS.md standard across platforms             |
| [MCP_A2A_GUIDE](configuration/MCP_A2A_GUIDE.md)                   | MCP server config and A2A protocol              |
| [PLATFORM_REFERENCE](configuration/PLATFORM_REFERENCE.md)         | Platform guide directory index                  |

## Maintenance & Reference

| Document                                                | Description                                      |
| ------------------------------------------------------- | ------------------------------------------------ |
| [MIGRATION_GUIDE](reference/MIGRATION_GUIDE.md)         | Upgrading between framework versions             |
| [TROUBLESHOOTING](reference/TROUBLESHOOTING.md)         | Common issues by category (setup, sync, runtime) |
| [ROADMAP](reference/ROADMAP.md)                         | Near/medium/long-term direction                  |
| [FOLLOW_UP_ISSUES](reference/FOLLOW_UP_ISSUES.md)       | Tracked follow-up items                          |
| [DOCUMENTATION_AUDIT](reference/DOCUMENTATION_AUDIT.md) | Self-audit findings and gap analysis             |

## Subdirectories

| Directory                                             | Contents                                         |
| ----------------------------------------------------- | ------------------------------------------------ |
| [`getting-started/`](getting-started/README.md)       | Installation, setup, and onboarding              |
| [`guides/`](guides/README.md)                         | Commands, teams, workflows, and agent reference  |
| [`architecture/`](architecture/README.md)             | System design, state, security, cost             |
| [`configuration/`](configuration/README.md)           | YAML schema, overlays, render targets, platforms |
| [`reference/`](reference/README.md)                   | Migration, troubleshooting, roadmap, audit       |
| [`platform_reference/`](platform_reference/README.md) | 35 platform-specific guides + 8 analysis docs    |
| [`router_specialist/`](router_specialist/)            | 6 governance/migration reference stubs           |
