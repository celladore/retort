# Platform Coding Performance

Weighted decision matrix for evaluating AI coding platforms supported by
AgentKit Forge. Each platform is scored against key metrics using publicly
available benchmarks, published evaluations, and documented capabilities.

> **Last updated:** 2025-02  
> **Methodology:** Scores are 1–10 (10 = best in class). The weighted total
> produces a normalized rating out of 100. Platforms are compared within
> their category to account for different use-case expectations.

---

## Table of Contents

1. [Platform Categories](#platform-categories)
2. [Scoring Metrics](#scoring-metrics)
3. [Methodology](#methodology)
4. [Category Matrix — AI-Native IDEs](#category-matrix--ai-native-ides)
5. [Category Matrix — IDE Extensions](#category-matrix--ide-extensions)
6. [Category Matrix — CLI Agents](#category-matrix--cli-agents)
7. [Category Matrix — Cloud / Autonomous Agents](#category-matrix--cloud--autonomous-agents)
8. [Overall Rankings](#overall-rankings)
9. [References](#references)

---

## Platform Categories

Each platform is assigned to one or more categories based on how users
interact with it. A platform can appear in multiple categories.

| Category | Description | Platforms |
|----------|-------------|-----------|
| **AI-Native IDE** | Full editor/IDE with built-in AI capabilities | Cursor, Windsurf, Warp Terminal |
| **IDE Extension** | AI extension for existing IDEs (VS Code, JetBrains, etc.) | GitHub Copilot, Cline, Roo Code, Continue, Sourcegraph Cody, Amazon Q Developer |
| **CLI Agent** | Terminal-based AI coding agent | Claude Code, OpenAI Codex, Google Gemini CLI, Aider, Amp, OpenCode |
| **Cloud / Autonomous Agent** | Fully autonomous cloud-hosted coding agent | Google Jules, Factory, OpenAI Codex, GitHub Copilot (Coding Agent) |

> **Note:** Some platforms span categories. OpenAI Codex appears in both
> CLI Agent and Cloud Agent. GitHub Copilot appears in both IDE Extension
> and Cloud Agent (via its Coding Agent mode). Amp works as both CLI agent
> and IDE extension.

---

## Scoring Metrics

| # | Metric | Weight | What It Measures |
|---|--------|--------|-----------------|
| 1 | **Code Correctness** | 25% | Functional accuracy of generated code — pass rates on SWE-bench, HumanEval, and real-world bug-fix benchmarks |
| 2 | **Context Understanding** | 20% | Ability to understand project structure, cross-file dependencies, and existing patterns before generating code |
| 3 | **Multi-file Editing** | 15% | Coordinated changes across multiple files in a single operation — critical for refactoring and feature development |
| 4 | **Instruction Adherence** | 10% | How faithfully the platform follows AGENTS.md, project rules, coding conventions, and explicit instructions |
| 5 | **Autonomy** | 10% | Level of independent operation — can it plan, execute, test, and iterate without constant human guidance? |
| 6 | **Language Breadth** | 5% | Range of programming languages and frameworks where the platform performs well |
| 7 | **Speed & Throughput** | 5% | Response latency, tokens per second, and time-to-first-meaningful-output |
| 8 | **Testing & Verification** | 5% | Ability to generate tests, run test suites, and self-verify generated code |
| 9 | **Ecosystem Integration** | 5% | Git workflow, CI/CD, MCP, tool use, and integration with the broader dev toolchain |

### Why These Weights?

- **Code Correctness (25%)** dominates because the primary job of a coding
  assistant is to produce working code. SWE-bench and similar benchmarks
  directly measure this.
- **Context Understanding (20%)** is second because without understanding the
  existing codebase, even correct-in-isolation code creates integration bugs.
- **Multi-file Editing (15%)** reflects the reality that most real tasks
  involve changes across multiple files.
- **Instruction Adherence (10%)** matters for team consistency — the whole
  point of AGENTS.md and project rules is that the AI follows them.
- **Autonomy (10%)** separates "copilot" tools from true "agents."
- The remaining metrics (5% each) capture important but secondary concerns.

---

## Methodology

### Scoring Scale

| Score | Meaning |
|-------|---------|
| 9–10 | Best in class — industry-leading capability |
| 7–8 | Strong — above average, competitive |
| 5–6 | Adequate — meets basic expectations |
| 3–4 | Limited — notable gaps or constraints |
| 1–2 | Minimal — capability is present but very limited |
| 0 | Not supported / not applicable |

### Data Sources

Scores are derived from:

1. **Published benchmarks**: SWE-bench, SWE-bench Verified, HumanEval,
   MBPP, Aider polyglot leaderboard
2. **Vendor documentation**: Official capability lists and changelogs
3. **Independent evaluations**: Blog posts, comparisons, and reviews from
   established developer publications
4. **Community feedback**: GitHub issues, forum discussions, and user reports

Each score includes a reference citation. Where benchmarks are unavailable,
scores are estimated from documented capabilities and marked with `~`.

---

## Category Matrix — AI-Native IDEs

Platforms that provide a full editor or IDE with AI built in.

| Metric (Weight) | Cursor | Windsurf | Warp Terminal |
|-----------------|--------|----------|---------------|
| Code Correctness (25%) | 8 | 7 | 6 |
| Context Understanding (20%) | 8 | 7 | 6 |
| Multi-file Editing (15%) | 8 | 7 | 5 |
| Instruction Adherence (10%) | 8 | 7 | 7 |
| Autonomy (10%) | 7 | 6 | 7 |
| Language Breadth (5%) | 8 | 8 | 7 |
| Speed & Throughput (5%) | 8 | 7 | 8 |
| Testing & Verification (5%) | 7 | 6 | 5 |
| Ecosystem Integration (5%) | 7 | 6 | 8 |
| **Weighted Score** | **77** | **69** | **63** |
| **Rating** | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐ |

### Scoring Justification — AI-Native IDEs

**Cursor (77/100)**
- Code Correctness: 8 — Uses Claude 3.5 Sonnet and GPT-4o; strong SWE-bench
  Verified results via underlying models [R1, R2]
- Context Understanding: 8 — Codebase-aware indexing with `.cursor/rules/`
  glob activation provides excellent project context [R3]
- Multi-file: 8 — Composer mode handles multi-file edits well [R3]
- Instruction Adherence: 8 — `.mdc` rules with YAML frontmatter + AGENTS.md
  recognized [R3]

**Windsurf (69/100)**
- Code Correctness: 7 — Cascade AI with strong models; slightly behind Cursor
  in independent comparisons [R4, R5]
- Context Understanding: 7 — Good project context but fewer activation controls
  than Cursor [R5]
- Multi-file: 7 — Cascade handles multi-file but occasionally loses context [R5]

**Warp Terminal (63/100)**
- Code Correctness: 6 — Solid for command-line tasks; less tested on complex
  multi-file coding [R6]
- Context Understanding: 6 — AGENTS.md + terminal history; limited IDE-level
  file analysis [R6]
- Multi-file: 5 — Terminal-based, less natural for multi-file edits [R6]
- Ecosystem: 8 — Excellent terminal integration, Warp Drive team sharing [R6]

---

## Category Matrix — IDE Extensions

AI extensions that augment existing IDEs (VS Code, JetBrains, etc.).

| Metric (Weight) | Copilot | Cline | Roo Code | Continue | Cody | Amazon Q |
|-----------------|---------|-------|----------|----------|------|----------|
| Code Correctness (25%) | 8 | 7 | 7 | 6 | 7 | 7 |
| Context Understanding (20%) | 8 | 7 | 7 | 6 | 8 | 7 |
| Multi-file Editing (15%) | 7 | 8 | 8 | 6 | 6 | 7 |
| Instruction Adherence (10%) | 8 | 7 | 7 | 7 | 6 | 6 |
| Autonomy (10%) | 7 | 8 | 8 | 5 | 5 | 7 |
| Language Breadth (5%) | 9 | 8 | 8 | 8 | 8 | 8 |
| Speed & Throughput (5%) | 8 | 7 | 7 | 7 | 7 | 7 |
| Testing & Verification (5%) | 7 | 7 | 7 | 5 | 5 | 7 |
| Ecosystem Integration (5%) | 9 | 7 | 7 | 7 | 8 | 8 |
| **Weighted Score** | **78** | **73** | **73** | **61** | **68** | **70** |
| **Rating** | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐½ |

### Scoring Justification — IDE Extensions

**GitHub Copilot (78/100)**
- Code Correctness: 8 — GPT-4o and Claude 3.5 Sonnet backends; Copilot Workspace
  and Coding Agent show strong SWE-bench results [R7, R8]
- Context Understanding: 8 — Layered instruction system (repo → path → prompt
  files → AGENTS.md) provides deep context [R7]
- Instruction Adherence: 8 — Richest instruction file system among IDE
  extensions [R7]
- Ecosystem: 9 — Deepest GitHub integration: PRs, issues, code review [R8]

**Cline (73/100)**
- Multi-file: 8 — Strong agentic multi-file editing with plan-then-execute [R9]
- Autonomy: 8 — Full agentic mode with file creation, command execution [R9]
- Context: 7 — `.clinerules/` + AGENTS.md + cross-tool rule detection [R9]

**Roo Code (73/100)**
- Similar to Cline (fork) with additional mode-specific rules [R10]
- Autonomy: 8 — Boomerang tasks and custom modes add orchestration [R10]

**Sourcegraph Cody (68/100)**
- Context Understanding: 8 — Code graph intelligence is industry-leading for
  large codebases [R11]
- Multi-file: 6 — Better at understanding than editing across files [R11]
- Autonomy: 5 — Primarily a copilot, not an autonomous agent [R11]

**Amazon Q Developer (70/100)**
- Code Correctness: 7 — Strong on AWS-specific code; competitive generally [R12]
- Ecosystem: 8 — Deep AWS integration, security scanning, `/transform` [R12]
- Autonomy: 7 — `/dev` mode handles multi-file autonomous tasks [R12]

**Continue (61/100)**
- Code Correctness: 6 — Quality depends heavily on chosen model [R13]
- Autonomy: 5 — Primarily a copilot with limited agentic capabilities [R13]
- Ecosystem: 7 — Excellent multi-IDE and multi-model flexibility [R13]

---

## Category Matrix — CLI Agents

Terminal-based AI coding agents.

| Metric (Weight) | Claude Code | Codex | Gemini CLI | Aider | Amp | OpenCode |
|-----------------|-------------|-------|------------|-------|-----|----------|
| Code Correctness (25%) | 9 | 8 | 8 | 8 | 7 | 6 |
| Context Understanding (20%) | 9 | 8 | 7 | 7 | 7 | 5 |
| Multi-file Editing (15%) | 9 | 8 | 7 | 8 | 7 | 6 |
| Instruction Adherence (10%) | 9 | 8 | 7 | 7 | 7 | 6 |
| Autonomy (10%) | 9 | 8 | 7 | 7 | 8 | 5 |
| Language Breadth (5%) | 9 | 8 | 8 | 9 | 7 | 7 |
| Speed & Throughput (5%) | 7 | 7 | 8 | 7 | 7 | 7 |
| Testing & Verification (5%) | 9 | 7 | 7 | 8 | 6 | 5 |
| Ecosystem Integration (5%) | 9 | 7 | 7 | 8 | 7 | 5 |
| **Weighted Score** | **89** | **79** | **73** | **76** | **72** | **56** |
| **Rating** | ⭐⭐⭐⭐½ | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐ |

### Scoring Justification — CLI Agents

**Claude Code (89/100)**
- Code Correctness: 9 — Claude 4 Sonnet achieves 72.7% on SWE-bench Verified,
  industry-leading [R14, R15]
- Context Understanding: 9 — CLAUDE.md + hierarchical rules + skills + agents
  provide the richest context system [R14]
- Multi-file: 9 — Subagent architecture enables coordinated multi-file work [R14]
- Instruction Adherence: 9 — Most configurable instruction system (rules, hooks,
  commands, skills) [R14]
- Testing: 9 — Integrated test running, auto-fix loop, hooks for verification [R14]
- Ecosystem: 9 — Git integration, MCP, hooks, settings, full file system access [R14]

**OpenAI Codex (79/100)**
- Code Correctness: 8 — Codex-1 model; 67% on SWE-bench Verified [R16, R17]
- Context Understanding: 8 — Hierarchical AGENTS.md with override support [R16]
- Multi-file: 8 — Skills system enables structured multi-file workflows [R16]
- Autonomy: 8 — Cloud-based autonomous execution in sandboxed environment [R16]

**Aider (76/100)**
- Code Correctness: 8 — Polyglot benchmark leader when using top models;
  Aider leaderboard tracks 60+ models [R18, R19]
- Multi-file: 8 — Excellent repo-map for multi-file context [R18]
- Language Breadth: 9 — Polyglot benchmark covers many languages [R19]
- Testing: 8 — Auto-lint, auto-test, auto-fix loop [R18]

**Google Gemini CLI (73/100)**
- Code Correctness: 8 — Gemini 2.5 Pro scores well on coding benchmarks [R20]
- Speed: 8 — Fast inference with Google's infrastructure [R20]
- Context: 7 — GEMINI.md + styleguide but fewer activation controls [R20]

**Amp (72/100)**
- Code Correctness: 7 — Good but less benchmarked than top agents [R21]
- Autonomy: 8 — Strong autonomous multi-step execution [R21]

**OpenCode (56/100)**
- Scores are estimated (~) as benchmarks are limited for this newer tool [R22]
- Open-source with growing community but fewer features than mature tools

---

## Category Matrix — Cloud / Autonomous Agents

Fully autonomous, cloud-hosted coding agents.

| Metric (Weight) | Jules | Factory | Codex (Cloud) | Copilot Agent |
|-----------------|-------|---------|---------------|---------------|
| Code Correctness (25%) | 7 | 7 | 8 | 8 |
| Context Understanding (20%) | 7 | 7 | 8 | 8 |
| Multi-file Editing (15%) | 7 | 8 | 8 | 7 |
| Instruction Adherence (10%) | 6 | 6 | 8 | 8 |
| Autonomy (10%) | 9 | 9 | 9 | 8 |
| Language Breadth (5%) | 7 | 7 | 8 | 9 |
| Speed & Throughput (5%) | 6 | 7 | 7 | 7 |
| Testing & Verification (5%) | 6 | 7 | 7 | 7 |
| Ecosystem Integration (5%) | 7 | 7 | 7 | 9 |
| **Weighted Score** | **71** | **72** | **79** | **79** |
| **Rating** | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Scoring Justification — Cloud / Autonomous Agents

**Google Jules (71/100)**
- Code Correctness: 7 — Gemini-powered; good but less benchmarked as
  autonomous agent [R23]
- Autonomy: 9 — Fully autonomous: analyzes, plans, branches, commits, PRs [R23]
- Instruction Adherence: 6 — Reads AGENTS.md but limited customization
  controls [R23]

**Factory (72/100)**
- Multi-file: 8 — End-to-end feature implementation across files [R24]
- Autonomy: 9 — Full SDLC automation: code, review, test, deploy [R24]
- Instruction Adherence: 6 — AGENTS.md support but primarily dashboard
  configured [R24]

**OpenAI Codex Cloud (79/100)**
- Same model as CLI but in autonomous cloud mode [R16, R17]
- Autonomy: 9 — Sandboxed cloud execution with full repo access [R16]

**Copilot Coding Agent (79/100)**
- Code Correctness: 8 — Strong models with GitHub context [R8, R25]
- Ecosystem: 9 — Native GitHub integration: issues, PRs, CI checks [R8, R25]
- Autonomy: 8 — Assigns from issues, creates branches, submits PRs [R25]

---

## Overall Rankings

All platforms ranked by weighted score, regardless of category.

| Rank | Platform | Score | Rating | Primary Category |
|------|----------|-------|--------|-----------------|
| 1 | Claude Code | 89 | ⭐⭐⭐⭐½ | CLI Agent |
| 2 | OpenAI Codex | 79 | ⭐⭐⭐⭐ | CLI Agent / Cloud Agent |
| 3 | GitHub Copilot | 78 | ⭐⭐⭐⭐ | IDE Extension / Cloud Agent |
| 4 | Cursor IDE | 77 | ⭐⭐⭐⭐ | AI-Native IDE |
| 5 | Aider | 76 | ⭐⭐⭐⭐ | CLI Agent |
| 6 | Cline | 73 | ⭐⭐⭐½ | IDE Extension |
| 7 | Roo Code | 73 | ⭐⭐⭐½ | IDE Extension |
| 8 | Google Gemini CLI | 73 | ⭐⭐⭐½ | CLI Agent |
| 9 | Amp | 72 | ⭐⭐⭐½ | CLI Agent |
| 10 | Factory | 72 | ⭐⭐⭐½ | Cloud Agent |
| 11 | Google Jules | 71 | ⭐⭐⭐½ | Cloud Agent |
| 12 | Amazon Q Developer | 70 | ⭐⭐⭐½ | IDE Extension |
| 13 | Windsurf IDE | 69 | ⭐⭐⭐½ | AI-Native IDE |
| 14 | Sourcegraph Cody | 68 | ⭐⭐⭐½ | IDE Extension |
| 15 | Warp Terminal | 63 | ⭐⭐⭐ | AI-Native IDE |
| 16 | Continue | 61 | ⭐⭐⭐ | IDE Extension |
| 17 | OpenCode | 56 | ⭐⭐⭐ | CLI Agent |

---

## References

| ID | Source | URL |
|----|--------|-----|
| R1 | Cursor official documentation | https://docs.cursor.com/ |
| R2 | Cursor model selection and benchmarks | https://cursor.com/blog |
| R3 | Cursor Rules deep dive — design.dev | https://design.dev/guides/cursor-rules/ |
| R4 | Windsurf Cascade documentation | https://docs.windsurf.com/windsurf/cascade |
| R5 | Windsurf vs Cursor comparison — independent review | https://www.builder.io/blog/cursor-vs-windsurf |
| R6 | Warp Rules documentation | https://docs.warp.dev/agent-platform/capabilities/rules |
| R7 | GitHub Copilot custom instructions | https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot |
| R8 | GitHub Copilot coding agent changelog | https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/ |
| R9 | Cline Rules documentation | https://docs.cline.bot/customization/cline-rules |
| R10 | Roo Code features documentation | https://docs.roocode.com/features/ |
| R11 | Sourcegraph Cody documentation | https://sourcegraph.com/docs/cody |
| R12 | Amazon Q Developer documentation | https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html |
| R13 | Continue Rules documentation | https://docs.continue.dev/customize/rules |
| R14 | Claude Code documentation — Extending Claude | https://docs.anthropic.com/en/docs/claude-code |
| R15 | SWE-bench Verified leaderboard | https://www.swebench.com/ |
| R16 | OpenAI Codex — AGENTS.md guides | https://developers.openai.com/codex/guides/agents-md |
| R17 | OpenAI Codex benchmarks — Codex-1 model | https://openai.com/index/introducing-codex/ |
| R18 | Aider documentation | https://aider.chat/ |
| R19 | Aider polyglot leaderboard | https://aider.chat/docs/leaderboards/ |
| R20 | Gemini CLI configuration docs | https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html |
| R21 | Amp by Sourcegraph | https://ampcode.com/docs |
| R22 | OpenCode GitHub repository | https://github.com/opencode-ai/opencode |
| R23 | Google Jules | https://jules.google/ |
| R24 | Factory — autonomous coding | https://www.factory.ai/ |
| R25 | GitHub Copilot Coding Agent | https://docs.github.com/en/copilot/using-github-copilot/using-the-github-copilot-coding-agent |

---

## See Also

- [PLATFORM_CONSOLIDATED_RATING.md](./PLATFORM_CONSOLIDATED_RATING.md) — Combined final rankings
- [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) — Cost and pricing evaluation
- [PLATFORM_DEVELOPER_EXPERIENCE.md](./PLATFORM_DEVELOPER_EXPERIENCE.md) — UX and workflow evaluation
- [PLATFORM_CUSTOMIZATION.md](./PLATFORM_CUSTOMIZATION.md) — Extensibility evaluation
- [PLATFORM_PRIVACY_SECURITY.md](./PLATFORM_PRIVACY_SECURITY.md) — Privacy and security evaluation
- [PLATFORM_TEAM_ENTERPRISE.md](./PLATFORM_TEAM_ENTERPRISE.md) — Team and enterprise evaluation
- [Platform Reference README](./README.md) — Platform overview and comparison
- [INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md) — Phased plan to address gaps
- [TOOLS.md](../TOOLS.md) — Render targets and output files
