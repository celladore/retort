---
description: "Diagnose AgentKit Forge setup and spec quality issues"
allowed-tools: Bash(node *), Bash(find *), Bash(ls *)
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# /doctor

{{commandDescription}}

## Purpose

Diagnose AgentKit Forge setup and spec quality issues quickly.

## Workflow

1. Validate all spec files (`spec-validate`).
2. Verify required template roots exist for active render targets.
3. Check `.agentkit-repo` and overlay alignment.
4. Highlight high-impact missing `project.yaml` fields.
5. Suggest next actions sorted by impact.

## Output

- Overall status: PASS/WARN/FAIL
- Findings list with severity
- Suggested command sequence to remediate
