---
{{#if commandDescription}}
description: {{escapeYamlString commandDescription}}
{{/if~}}
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git *), Bash(ls *), Bash(mkdir *), WebFetch
generated_by: '{{lastAgent}}'
last_model: '{{lastModel}}'
last_updated: '{{syncDate}}'
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Portfolio Builder

{{commandDescription}}

## Arguments

`$ARGUMENTS` may contain any combination of:

- `--name "<title>"` — human-readable project title (default: repo name)
- `--slug <slug>` — directory slug under `docs/portfolio/`
- `--notes <path>` — markdown/text notes to ground the case study
- `--slides <path>` — pitch deck (PDF or markdown) to mine for narrative
- `--demo-url <url>` — live demo URL to reference
- `--video-url <url>` — existing demo video URL to reference
- `--audience "<role>"` — target audience for the LinkedIn post
- `--only <artifact>` — one of `case-study | readme | demo | linkedin`
- `--dry-run` — print intended outputs without writing files

If no arguments are provided, run all phases against the current repo and
prompt the user only when discovery cannot answer a required question.

{{commandPrompt}}

## Output Summary

When done, print a table:

| Artifact     | Path                                         | Notes                |
| ------------ | -------------------------------------------- | -------------------- |
| Case study   | `docs/portfolio/<slug>/case-study.md`        | PAARL-framed         |
| README block | `docs/portfolio/<slug>/readme-section.md`    | Paste into README.md |
| Demo plan    | `docs/portfolio/<slug>/demo-script.md`       | 60-second storyboard |
| LinkedIn     | `docs/portfolio/<slug>/linkedin-post.md`     | Publish-ready draft  |
| Index        | `docs/portfolio/<slug>/README.md`            | Links to the above   |
