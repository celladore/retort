---
name: md-agent-yaml
description: Create and update md-agent/v1 YAML sidecars for durable markdown (README.md, docs/**, ADRs, specs). Use when converting markdown to YAML for agents, syncing .agent.yaml sidecars, or when the user runs /md-agent-yaml. Distinct from .readme.yaml directory cards.
---

# md-agent YAML sidecars

Durable markdown gets a sibling `{stem}.agent.yaml` so agents can read structured facts instead of parsing prose.

Do not invent a different shape. Use `schema.yaml` in this skill.

## Two YAML contracts

| File | Scope | Schema |
| --- | --- | --- |
| `.readme.yaml` | No-LSP directory map | `skills/doc-agent/references/readme-yaml-convention.md` |
| `{stem}.agent.yaml` | One durable markdown file | `schema.yaml` in this skill |

Never write md-agent fields into `.readme.yaml`. Never write exploration-map fields (`children`, `entry_points`, `skip`) into `{stem}.agent.yaml`.

## When to run

- After creating or materially editing `README.md`, `docs/**`, ADRs, or specs
- When asked to convert markdown to YAML for AI use

Do not convert `CLAUDE.md`, `AGENTS.md`, plans, skills, handoffs, vendor trees, or generated files.

## File name

`docs/architecture/specs/SPEC-001.md` → `docs/architecture/specs/SPEC-001.agent.yaml`

## Commands

```text
python skills/md-agent-yaml/scripts/md_agent_yaml.py convert <path>
python skills/md-agent-yaml/scripts/md_agent_yaml.py convert --repo
python skills/md-agent-yaml/scripts/md_agent_yaml.py check
```

`convert` writes a stub only when the sidecar is missing. Fill `facts` yourself. Refresh `last_synced` when you change the sidecar.

## Fields

- `title` — first H1 or a short title
- `purpose` — one or two sentences
- `audience` — `agent` and/or `human`
- `facts` — durable claims, not a restatement of the whole document
- `last_synced` — ISO date
