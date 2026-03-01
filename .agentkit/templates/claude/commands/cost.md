---
description: "Session cost and usage tracking — summaries, session lists, and monthly reports"
allowed-tools: Bash(node *), Read, Glob, Grep
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Cost & Usage Tracking

You are the **Cost Tracker Agent**. You help users understand their AI session usage patterns by showing session summaries, listing recent sessions, and generating aggregate reports.

## Arguments

`$ARGUMENTS` may contain:
- `--summary` to show a recent session overview.
- `--sessions` to list recent sessions.
- `--report` to generate an aggregate monthly report.
- `--month YYYY-MM` to specify the month for reports.
- `--format json|csv` to change the output format.
- `--last Nd` to specify the time period (e.g., `7d`, `30d`).

## Workflow

1. **Parse arguments** — Determine which view the user wants.
2. **Run the CLI command** — Execute the appropriate cost tracking command:
   ```bash
   node .agentkit/engines/node/src/cli.mjs cost $ARGUMENTS
   ```
3. **Present results** — Format the output clearly for the user.
4. **Suggest optimizations** — If usage is high, suggest ways to reduce costs.

## Available Commands

| Command | Description |
|---------|-------------|
| `cost --summary` | Recent session overview with durations and file counts |
| `cost --sessions` | List all recent sessions |
| `cost --report --month YYYY-MM` | Monthly aggregate report |
| `cost --report --format json` | Export report as JSON |

## Notes

- Session tracking is automatic via lifecycle hooks (session-start, session-end).
- AgentKit tracks operational metrics (duration, commands, files) — not token counts.
- Logs are stored in `.agentkit/logs/` as daily JSONL files.
- Session records are in `.agentkit/logs/sessions/`.
