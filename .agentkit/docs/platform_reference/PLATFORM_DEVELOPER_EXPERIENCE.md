# Platform Developer Experience

Weighted evaluation of the developer experience (DX) across AI coding platforms.
DX covers how pleasant, efficient, and low-friction it is to use a platform
day-to-day — from first install to productive daily workflow.

> **Last updated:** 2025-02  
> **Methodology:** Scores are 1–10 (10 = best). The weighted total produces
> a normalized rating out of 100.

---

## Table of Contents

1. [DX Metrics](#dx-metrics)
2. [Category Matrix — AI-Native IDEs](#category-matrix--ai-native-ides)
3. [Category Matrix — IDE Extensions](#category-matrix--ide-extensions)
4. [Category Matrix — CLI Agents](#category-matrix--cli-agents)
5. [Category Matrix — Cloud / Autonomous Agents](#category-matrix--cloud--autonomous-agents)
6. [Overall DX Rankings](#overall-dx-rankings)
7. [References](#references)

---

## DX Metrics

| # | Metric | Weight | What It Measures |
|---|--------|--------|-----------------|
| 1 | **Onboarding & Setup** | 20% | Time from download to first productive use — install friction, config requirements, prerequisites |
| 2 | **Workflow Integration** | 25% | How naturally the tool fits into existing dev workflows — git, builds, tests, code review |
| 3 | **UI / Interaction Quality** | 20% | Quality of chat interface, inline suggestions, diff views, error presentation |
| 4 | **Learning Curve** | 15% | How quickly a developer becomes proficient — documentation quality, discoverability |
| 5 | **Feedback Loop Speed** | 10% | How fast the cycle of prompt → result → iterate is — response time, edit-apply UX |
| 6 | **Stability & Reliability** | 10% | Crash frequency, hallucination rate, consistency of behavior across sessions |

### Why These Weights?

- **Workflow Integration (25%)** is highest because the best tool is one that
  disappears into your existing workflow rather than forcing a new one.
- **Onboarding (20%)** matters because high setup friction kills adoption.
- **UI Quality (20%)** directly affects daily satisfaction and productivity.
- **Learning Curve (15%)** determines team-wide adoption speed.
- **Feedback Loop (10%)** and **Stability (10%)** are important but somewhat
  amortized over time.

---

## Category Matrix — AI-Native IDEs

| Metric (Weight) | Cursor | Windsurf | Warp |
|-----------------|--------|----------|------|
| Onboarding & Setup (20%) | 9 | 9 | 8 |
| Workflow Integration (25%) | 8 | 7 | 7 |
| UI / Interaction Quality (20%) | 9 | 8 | 9 |
| Learning Curve (15%) | 8 | 8 | 7 |
| Feedback Loop Speed (10%) | 8 | 7 | 8 |
| Stability & Reliability (10%) | 7 | 7 | 7 |
| **Weighted Score** | **84** | **77** | **77** |
| **DX Rating** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Justification — AI-Native IDEs

**Cursor (84/100)**
- Onboarding: 9 — Download, open project, start coding. Imports VS Code settings [D1]
- Workflow: 8 — Full VS Code compatibility; git, terminals, extensions all work [D1]
- UI: 9 — Tab completion, inline chat, Composer mode — polished and intuitive [D1]
- Learning Curve: 8 — Familiar VS Code base; Cursor-specific features are discoverable [D1]

**Windsurf (77/100)**
- Onboarding: 9 — Similar to Cursor; download and go [D2]
- UI: 8 — Cascade flow is clean; Memories system adds contextual intelligence [D2]
- Workflow: 7 — Good but fewer extensions than Cursor ecosystem [D2]

**Warp (77/100)**
- Onboarding: 8 — Terminal replacement; requires adapting terminal habits [D3]
- UI: 9 — Block-based output, rich rendering, AI-native from ground up [D3]
- Workflow: 7 — Excellent for terminal tasks; less natural for IDE-level coding [D3]

---

## Category Matrix — IDE Extensions

| Metric (Weight) | Copilot | Cline | Roo Code | Continue | Cody | Amazon Q |
|-----------------|---------|-------|----------|----------|------|----------|
| Onboarding & Setup (20%) | 9 | 7 | 7 | 7 | 8 | 7 |
| Workflow Integration (25%) | 9 | 8 | 8 | 7 | 8 | 8 |
| UI / Interaction Quality (20%) | 8 | 7 | 7 | 7 | 7 | 7 |
| Learning Curve (15%) | 9 | 6 | 6 | 6 | 7 | 7 |
| Feedback Loop Speed (10%) | 8 | 7 | 7 | 7 | 7 | 7 |
| Stability & Reliability (10%) | 8 | 7 | 7 | 6 | 7 | 7 |
| **Weighted Score** | **86** | **72** | **72** | **68** | **74** | **73** |
| **DX Rating** | ⭐⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ |

### Justification — IDE Extensions

**GitHub Copilot (86/100)**
- Onboarding: 9 — One-click install in VS Code; GitHub auth is seamless [D4]
- Workflow: 9 — Deepest editor integration: inline, chat, review, PRs [D4]
- Learning Curve: 9 — "It just works" — minimal config needed to be productive [D4]
- Stability: 8 — Mature product with consistent behavior [D4]

**Cline (72/100)**
- Onboarding: 7 — Install extension + configure API key (BYOK friction) [D5]
- Workflow: 8 — Strong agentic workflow; file creation, command execution [D5]
- Learning Curve: 6 — Rule system and modes require time to master [D5]

**Roo Code (72/100)**
- Similar to Cline; custom modes add both power and learning curve [D6]

**Sourcegraph Cody (74/100)**
- Onboarding: 8 — Extension install + Sourcegraph account [D7]
- Workflow: 8 — Code graph intelligence is uniquely valuable for large codebases [D7]

**Amazon Q Developer (73/100)**
- Onboarding: 7 — AWS account requirement adds friction [D8]
- Workflow: 8 — Excellent AWS integration; `/dev` and `/transform` commands [D8]

**Continue (68/100)**
- Onboarding: 7 — Install + configure providers (BYOK friction) [D9]
- UI: 7 — Clean but less polished than Copilot [D9]
- Stability: 6 — Model-dependent quality; local models can be inconsistent [D9]

---

## Category Matrix — CLI Agents

| Metric (Weight) | Claude Code | Codex | Gemini CLI | Aider | Amp | OpenCode |
|-----------------|-------------|-------|------------|-------|-----|----------|
| Onboarding & Setup (20%) | 8 | 7 | 8 | 7 | 7 | 6 |
| Workflow Integration (25%) | 9 | 7 | 7 | 9 | 7 | 6 |
| UI / Interaction Quality (20%) | 8 | 7 | 7 | 7 | 7 | 6 |
| Learning Curve (15%) | 7 | 7 | 7 | 6 | 7 | 6 |
| Feedback Loop Speed (10%) | 7 | 6 | 8 | 7 | 7 | 7 |
| Stability & Reliability (10%) | 8 | 7 | 7 | 8 | 7 | 6 |
| **Weighted Score** | **80** | **69** | **73** | **74** | **70** | **61** |
| **DX Rating** | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐ |

### Justification — CLI Agents

**Claude Code (80/100)**
- Onboarding: 8 — `npm install -g` + API key; quick start [D10]
- Workflow: 9 — Best-in-class git integration, hooks, permissions, subagents [D10]
- UI: 8 — Rich terminal UI; excellent diff presentation [D10]
- Stability: 8 — Consistent, deterministic hooks ensure reliability [D10]

**Aider (74/100)**
- Workflow: 9 — Auto-commits, auto-lint, auto-test integration is superb [D11]
- Learning Curve: 6 — Many config files and modes to learn [D11]
- Stability: 8 — Mature, well-tested with 60+ model backends [D11]

**Gemini CLI (73/100)**
- Onboarding: 8 — Simple npm install; generous free tier reduces friction [D12]
- Feedback Speed: 8 — Fast inference from Google infrastructure [D12]

**Codex (69/100)**
- Onboarding: 7 — Requires OpenAI account and subscription [D13]
- Workflow: 7 — Skills system is powerful but requires setup [D13]

**Amp (70/100)**
- Onboarding: 7 — Terminal + IDE dual mode [D14]

**OpenCode (61/100)**
- Onboarding: 6 — Go-based install; less accessible than npm/pip [D15]
- UI: 6 — Functional terminal UI but less polished than Claude Code [D15]

---

## Category Matrix — Cloud / Autonomous Agents

| Metric (Weight) | Jules | Factory | Codex Cloud | Copilot Agent |
|-----------------|-------|---------|-------------|---------------|
| Onboarding & Setup (20%) | 7 | 5 | 6 | 8 |
| Workflow Integration (25%) | 7 | 7 | 7 | 9 |
| UI / Interaction Quality (20%) | 7 | 6 | 7 | 8 |
| Learning Curve (15%) | 8 | 5 | 6 | 8 |
| Feedback Loop Speed (10%) | 5 | 5 | 5 | 6 |
| Stability & Reliability (10%) | 6 | 6 | 7 | 7 |
| **Weighted Score** | **68** | **57** | **64** | **79** |
| **DX Rating** | ⭐⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

### Justification — Cloud / Autonomous Agents

**Copilot Coding Agent (79/100)**
- Onboarding: 8 — Already in GitHub; assign from issues [D4]
- Workflow: 9 — Native GitHub: issues → branches → PRs → CI [D4]
- Learning Curve: 8 — Familiar GitHub workflow [D4]

**Jules (68/100)**
- Onboarding: 7 — Google account + GitHub access [D16]
- Learning Curve: 8 — Simple: describe task, review PR [D16]
- Feedback Speed: 5 — Asynchronous execution means waiting [D16]

**Codex Cloud (64/100)**
- Feedback Speed: 5 — Cloud execution; minutes per task [D13]

**Factory (57/100)**
- Onboarding: 5 — Enterprise sales process; dashboard configuration [D17]
- Learning Curve: 5 — Enterprise platform with significant setup [D17]

---

## Overall DX Rankings

| Rank | Platform | DX Score | DX Rating |
|------|----------|---------|-----------|
| 1 | GitHub Copilot | 86 | ⭐⭐⭐⭐½ |
| 2 | Cursor IDE | 84 | ⭐⭐⭐⭐ |
| 3 | Claude Code | 80 | ⭐⭐⭐⭐ |
| 4 | Copilot Agent | 79 | ⭐⭐⭐⭐ |
| 5 | Windsurf IDE | 77 | ⭐⭐⭐⭐ |
| 6 | Warp Terminal | 77 | ⭐⭐⭐⭐ |
| 7 | Aider | 74 | ⭐⭐⭐½ |
| 8 | Sourcegraph Cody | 74 | ⭐⭐⭐½ |
| 9 | Amazon Q Developer | 73 | ⭐⭐⭐½ |
| 10 | Gemini CLI | 73 | ⭐⭐⭐½ |
| 11 | Cline | 72 | ⭐⭐⭐½ |
| 12 | Roo Code | 72 | ⭐⭐⭐½ |
| 13 | Amp | 70 | ⭐⭐⭐½ |
| 14 | Codex CLI | 69 | ⭐⭐⭐½ |
| 15 | Jules | 68 | ⭐⭐⭐½ |
| 16 | Continue | 68 | ⭐⭐⭐½ |
| 17 | Codex Cloud | 64 | ⭐⭐⭐ |
| 18 | OpenCode | 61 | ⭐⭐⭐ |
| 19 | Factory | 57 | ⭐⭐⭐ |

---

## References

| ID | Source | URL |
|----|--------|-----|
| D1 | Cursor documentation | https://docs.cursor.com/ |
| D2 | Windsurf documentation | https://docs.windsurf.com/ |
| D3 | Warp documentation | https://docs.warp.dev/ |
| D4 | GitHub Copilot documentation | https://docs.github.com/en/copilot |
| D5 | Cline documentation | https://docs.cline.bot/ |
| D6 | Roo Code documentation | https://docs.roocode.com/ |
| D7 | Sourcegraph Cody documentation | https://sourcegraph.com/docs/cody |
| D8 | Amazon Q Developer documentation | https://docs.aws.amazon.com/amazonq/ |
| D9 | Continue documentation | https://docs.continue.dev/ |
| D10 | Claude Code documentation | https://docs.anthropic.com/en/docs/claude-code |
| D11 | Aider documentation | https://aider.chat/ |
| D12 | Gemini CLI documentation | https://google-gemini.github.io/gemini-cli/ |
| D13 | OpenAI Codex documentation | https://developers.openai.com/codex/ |
| D14 | Amp documentation | https://ampcode.com/docs |
| D15 | OpenCode repository | https://github.com/opencode-ai/opencode |
| D16 | Google Jules | https://jules.google/ |
| D17 | Factory documentation | https://docs.factory.ai/ |

---

## See Also

- [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) — Coding ability evaluation
- [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) — Cost and pricing evaluation
- [PLATFORM_CONSOLIDATED_RATING.md](./PLATFORM_CONSOLIDATED_RATING.md) — Combined final rankings
