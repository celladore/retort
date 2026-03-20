# Strategic Research Report: AI Agent Configuration & Orchestration Landscape

**Date:** 2026-03-17
**Author:** Claude Opus 4.6 (strategic analysis)
**Scope:** Multi-tool AI agent configuration, orchestration frameworks, and developer tooling
**Status:** Complete

---

## Executive Summary

Retort operates at the intersection of two converging markets: **multi-tool agent configuration sync** (getting rules/agents/skills into 15+ AI coding tools) and **multi-agent orchestration** (coordinating teams of agents to complete complex work). These markets are evolving rapidly:

**Key findings:**

1. **The "rules sync" category is commoditising.** Six open-source tools (Ruler, ai-rules-sync, agent-rules, ai-rules, rulesync, SyncAI) now offer basic rules-to-multiple-tools sync. None yet offer agent personas, team orchestration, or quality gates — this is Retort's moat.

2. **AGENTS.md is becoming the de facto instruction standard.** Backed by OpenAI and adopted by 10+ tools, AGENTS.md provides a universal instruction file. However, recent research (ETH Zurich, March 2026) questions its effectiveness — LLM-generated context files may hinder agents.

3. **Agent orchestration frameworks (CrewAI, LangGraph, AG2) solve a different problem.** They orchestrate runtime agent execution (API calls, tool use, conversation flow). Retort orchestrates **development-time agent configuration** (what agents know, what rules they follow, what they can do). These are complementary, not competing.

4. **The market is missing a portable governance layer.** No competitor offers reflective guards — governance rules that agents self-check regardless of platform. This is the innovation from Mystira.workspace that Retort should adopt.

5. **Market size:** The AI coding assistant market is ~$8.5B in 2026 (24% CAGR to $47.3B by 2034). 62% of professional developers use AI coding tools. The configuration/orchestration tooling layer is pre-revenue but growing fast in OSS adoption.

**Strategic recommendation:** Double down on the three capabilities no competitor has: (1) spec-driven multi-tool sync with CI validation, (2) team orchestration with task delegation, and (3) portable governance via reflective guards. Resist the urge to compete on simple rules sync — that's a race to the bottom.

---

## 1. Industry Trends & Direction

### 1.1 The Multi-Tool Reality (2025–2026)

Developers now routinely use 2–4 AI coding tools simultaneously. A typical stack: Cursor for editing, Claude Code for CLI tasks, Copilot for inline completions, Gemini for research. This creates a configuration fragmentation problem — each tool has its own rules format, directory structure, and instruction mechanism.

**Trajectory:** Tool proliferation will continue. JetBrains ACP (Agent Client Protocol), co-developed with Zed Industries, aims to standardise agent-to-IDE communication. Anthropic's MCP standardises tool discovery. But **no protocol standardises agent configuration** — this is the gap Retort fills.

### 1.2 The AGENTS.md Convergence

OpenAI pushed AGENTS.md as an open standard in late 2025. It provides a single markdown file with instructions for AI coding agents — build commands, architecture overview, conventions, security rules. Key adoption:

- Supported natively by: Codex, Kilo Code, Cursor, Windsurf, Builder.io
- Hierarchical: `AGENTS.md` at root, subdirectory `AGENTS.md` overrides
- Complementary to `CLAUDE.md`, `.cursorrules`, etc.

**Critical caveat:** A March 2026 ETH Zurich paper found that LLM-generated AGENTS.md files often **hinder** agent performance. The recommendation: omit auto-generated context files; limit human-written instructions to genuinely non-inferable details. This validates Retort's approach of generating tool-specific output from validated specs rather than dumping everything into one file.

### 1.3 Protocol Standardisation Wave

| Protocol | Owner | Scope | Status |
|----------|-------|-------|--------|
| MCP (Model Context Protocol) | Anthropic | Tool discovery & execution | Widely adopted |
| ACP (Agent Client Protocol) | JetBrains + Zed | Agent-to-IDE communication | Early adoption |
| Agent Protocol | LangChain | Agent runtime API | Moderate adoption |
| AGENTS.md | OpenAI / AAIF | Agent instruction files | Rapid adoption |
| W3C Agent Protocol | W3C CG | Web-standard agent comms | Spec drafting (2026–27) |

**Missing from all protocols:** Agent configuration management, governance rules, cross-session continuity, team orchestration. This is Retort's category.

### 1.4 Inflection Points (Next 12–24 Months)

1. **Rules sync becomes table stakes.** Every major IDE will support native agent configuration; basic sync tools will lose relevance.
2. **Governance becomes critical.** As agents gain more autonomy (Claude Code, Codex), preventing destructive actions becomes a production concern, not a nice-to-have.
3. **Multi-agent teams go mainstream.** Claude's sub-agent system, Codex's parallel tasks, and Cursor's background agents all point to multi-agent being the default.
4. **Cross-session memory matures.** Agents will need structured handoff, traces, and strategic context — not just chat history.

---

## 2. Best Practices & Standards

### 2.1 Configuration Management

| Practice | Leaders | Adoption |
|----------|---------|----------|
| Single source of truth (YAML/MD → tool-specific output) | Retort, Agent OS, Ruler | Growing |
| Hierarchical instructions (root + subdirectory overrides) | AGENTS.md, CLAUDE.md | Standard |
| CI drift validation (spec vs generated output) | Retort | Unique |
| Reflective guards (portable governance) | Mystira.workspace | Novel |
| `.readme.yaml` (machine-readable metadata) | Mystira.workspace | Novel |

### 2.2 What Industry Leaders Are Implementing

**Block (formerly Square):**
- Open-sourced `ai-rules` for managing rules, commands, and skills across agents
- Built Goose, an open-source autonomous agent with extensible plugin architecture
- Uses AGENTS.md + repeatable "agent skills" as packaged workflows

**Anthropic:**
- Claude Code hooks system for automated enforcement
- Sub-agent architecture for parallel task execution
- MCP for tool discovery standardisation

**GitHub/Microsoft:**
- Copilot agents with `.github/agents/` directory
- Copilot chatmodes for team-based interaction patterns
- CODEOWNERS integration for agent access control

**JetBrains:**
- ACP protocol for agent-IDE interop
- Moving toward agent-neutral IDE support

### 2.3 Emerging Practices Gaining Traction

1. **Spec-driven development** — Define what you want (spec), let agents implement. Agent OS calls this "enhanced specification shaping."
2. **Guard rails as code** — Governance rules checked into the repo alongside the code they protect.
3. **Cross-session traces** — Preserving agent reasoning context across sessions (pioneered by Mystira.workspace).
4. **Token budget awareness** — Monitoring and optimising agent token consumption per operation.
5. **Conventional commit enforcement** — CI-level validation that agents follow commit message conventions.

---

## 3. Competitive Landscape

### 3.1 Competitor Profiles

#### Primary Competitors (Direct)

**1. Ruler** (intellectronica/ruler)
- **What:** CLI tool that syncs a single rules file to 11+ AI coding tool directories
- **Stars:** ~2,500 GitHub stars
- **Mechanism:** Reads `ruler.md` (or config), writes to `.cursor/rules/`, `.claude/CLAUDE.md`, `.github/copilot-instructions.md`, etc.
- **Strengths:** Simple, focused, good tool coverage (11 targets), auto-manages `.gitignore`
- **Weaknesses:** Rules only (no agents, skills, commands, teams), no CI validation, no governance, no orchestration
- **Pricing:** Free, open source (MIT)

**2. Agent OS** (buildermethods/agent-os)
- **What:** System for injecting coding standards into AI-powered development
- **Stars:** Moderate
- **Mechanism:** Discover patterns → document standards → inject into context → shape specifications
- **Strengths:** Standards discovery from existing codebases, spec-driven philosophy, Claude Code integration
- **Weaknesses:** Primarily Claude Code focused, no multi-tool sync engine, no team orchestration, no CI validation
- **Pricing:** Free and open source; paid training via Builder Methods Pro

**3. ai-rules-sync** (lbb00/ai-rules-sync)
- **What:** Sync rules, skills, commands, and subagents across 8+ tools via symlinks
- **Stars:** Growing
- **Mechanism:** Git-based rule storage, symlink sync, web dashboard UI
- **Strengths:** Supports skills and commands (not just rules), multi-repo support, team sharing, web UI
- **Weaknesses:** Symlink-based (fragile on Windows), no spec validation, no governance, no orchestration
- **Pricing:** Free, open source

**4. agent-rules** (jeejeeguan/agent-rules)
- **What:** Centralise rules in `AGENT_RULES.md`, auto-sync to each agent's directory via CI
- **Stars:** Small
- **Mechanism:** CI pipeline copies single file to `.claude/CLAUDE.md`, `.codex/AGENTS.md`, `.gemini/GEMINI.md`, etc.
- **Strengths:** CI-first approach (sync on push), backup before overwrite
- **Weaknesses:** One-file-fits-all (no per-tool customisation), no spec YAML, no agents/skills/commands, no orchestration
- **Pricing:** Free, open source

**5. Block ai-rules** (block/ai-rules)
- **What:** Manage AI rules, commands, and skills across multiple agents from one place
- **Stars:** Notable (Block/Square backing)
- **Mechanism:** Centralised configuration with distribution
- **Strengths:** Enterprise backing (Block/Square), supports commands and skills
- **Weaknesses:** Less mature than Ruler, limited orchestration
- **Pricing:** Free, open source

#### Secondary Competitors (Adjacent)

**6. AGENTS.md (standard)**
- Not a tool but a standard. Competes by making per-tool configuration seem unnecessary — "just write one AGENTS.md." In practice, tools interpret it differently, and it doesn't cover governance, orchestration, or cross-session continuity.

**7. LIDR-academy/ai-specs**
- Comprehensive development rules and AI agent configurations designed to work with multiple copilots. Portable, importable into any project. More of a "rules library" than a sync tool.

**8. snowdreamtech/template**
- Enterprise-grade template claiming 50+ AI IDE support. Single source of truth for rules, workflows, and configurations. Template-based (copy/fork) rather than sync-engine-based.

#### Runtime Orchestration (Different Category)

**CrewAI, LangGraph, AG2 (AutoGen), Semantic Kernel** — These orchestrate agent *execution* at runtime (API calls, conversations, tool use). They don't manage agent *configuration* in repositories. Complementary to Retort, not competing.

### 3.2 Competitive Evaluation Matrix

| Dimension | Retort | Ruler | Agent OS | ai-rules-sync | agent-rules | Block ai-rules | AGENTS.md |
|-----------|---------------|-------|----------|---------------|-------------|----------------|-----------|
| **Multi-tool output** | 15+ targets | 11 targets | 1 (Claude) | 8+ targets | 5 targets | Multi | 1 file |
| **Spec-driven (YAML → output)** | Yes | No (MD only) | Partial | No | No | Partial | N/A |
| **Agent personas** | 39 agents | None | None | None | None | None | None |
| **Team orchestration** | 13 teams + task protocol | None | None | None | None | None | None |
| **Skills/commands** | 30+ skills, 42 commands | None | Standards | Skills, commands | None | Commands, skills | None |
| **CI drift validation** | Yes | None | None | None | CI copy | None | None |
| **Governance (hooks)** | 14 shell hooks | None | None | None | None | None | None |
| **Governance (guards)** | Roadmap (Phase 2) | None | None | None | None | None | None |
| **Quality gates** | 5-phase lifecycle | None | None | None | None | None | None |
| **Cross-session traces** | Roadmap (Phase 4) | None | None | None | None | None | None |
| **`.readme.yaml`** | Roadmap (Phase 3) | None | None | None | None | None | None |
| **Maturity** | Production | Stable | Active | Active | Early | Active | Standard |
| **Effort to adopt** | Medium | Low | Low | Low | Low | Low | Trivial |
| **Lock-in risk** | Medium (Node.js engine) | Low | Low | Low | Low | Low | None |

### 3.3 Competitive Positioning Map

```
                    Complex (orchestration, teams, governance)
                              │
                              │  ★ Retort
                              │
                              │
               ──────────────┼──────────────
         Few tools            │           Many tools
                              │
                Agent OS ●    │    ● Ruler
                              │    ● ai-rules-sync
                              │    ● Block ai-rules
                              │
                              │  ○ agent-rules
                              │  ○ AGENTS.md
                              │
                    Simple (rules sync only)
```

Retort occupies the **upper-right quadrant** — many tools + complex capabilities. No competitor is close. The risk is that the lower-right quadrant (many tools + simple) commoditises and "good enough" wins for most teams.

---

## 4. SWOT Analysis

### Strengths

| Strength | Evidence | Strategic Value |
|----------|----------|-----------------|
| **Only spec-driven multi-tool engine with CI validation** | 15+ output targets, drift check in CI | Hard to replicate — requires deep knowledge of each tool's format |
| **Team orchestration is unique** | 13 teams, task delegation protocol, fan-out/chain handoff | No competitor offers development-time team coordination |
| **39 agent personas** | Categorised agents with defined roles, responsibilities, context | Competitors offer rules; Forge offers full agent definitions |
| **Quality gate framework** | 5-phase lifecycle with enforcement at each transition | Connects agent config to delivery discipline |
| **Proven at scale** | Deployed across 6+ repos (chaufher, PuffWise, etc.) in production | Not theoretical — validated in real projects |
| **Deep tool format knowledge** | Supports `.mdc` (Cursor), `.chatmode.md` (Copilot), `.agent.md` (GitHub), skill YAML, etc. | Barrier to entry — each format has undocumented quirks |

### Weaknesses

| Weakness | Impact | Mitigation Path |
|----------|--------|-----------------|
| **High adoption effort** | New users face `.agentkit/` directory, spec YAML, sync engine, hooks — steep learning curve vs "just add a `ruler.md`" | Guided `/start` command, progressive disclosure, "lite mode" |
| **Node.js dependency** | Sync engine requires Node.js/pnpm — excludes Python-only or Rust-only teams | Consider standalone binary (Go/Rust) or WASM-based engine |
| **No portable governance** | Shell hooks only work for Claude Code; other tools bypass governance | Reflective guards (Phase 2 roadmap) |
| **Generated file noise** | 300+ generated files across tool targets; PRs are overwhelming (see: PR #428 with 444 files) | Smarter sync (hash-based skip), `.gitattributes` to collapse diffs |
| **No schema versioning** | Format changes would break existing consumers with no migration path | Add `version` field to all generated frontmatter |
| **Timestamp churn** | Every sync bumps `last_updated` on all files even when content unchanged | Content-hash-based timestamps (only update if content actually changed) |

### Opportunities

| Opportunity | Market Signal | Action |
|-------------|--------------|--------|
| **Portable governance (guards)** | No competitor offers this; Mystira.workspace validated the pattern | ADR-10 Phase 2 — adopt reflective guards |
| **`.readme.yaml` standard** | Token cost is a growing concern (62% of devs use AI tools daily) | ADR-10 Phase 3 — generate machine-readable metadata |
| **ETH Zurich finding re: AGENTS.md** | Auto-generated context files may hinder agents | Position Forge's spec-validated, tool-specific output as superior to "dump everything in AGENTS.md" |
| **Enterprise demand for governance** | 90% of Fortune 100 use AI coding tools; compliance is lagging | Governance-as-code offering for enterprise teams |
| **Cross-session memory** | No tool solves agent continuity well; `/handoff` is a start | ADR-10 Phase 4 — traces + roadmaps |
| **Plugin marketplace** | Claude Code plugins, Cursor extensions, Copilot agents are all growing | Package team definitions as distributable plugins |
| **Standard body participation** | W3C Agent Protocol CG, AAIF — no configuration standard exists yet | Propose `.agents/` convention to AAIF or W3C |

### Threats

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| **IDE-native configuration** | High | Medium | IDEs add built-in agent config → sync tools become less needed. Counter: Forge syncs *across* IDEs, which IDE-native can't do |
| **AGENTS.md becomes sufficient** | Medium | High | If tools converge on one format, multi-tool sync loses value. Counter: Forge offers orchestration, governance, and team coordination beyond rules sync |
| **Ruler reaches feature parity** | Low | Medium | Ruler adds agents, skills, CI validation. Counter: Deep format knowledge and spec-driven architecture are hard to replicate |
| **Enterprise vendor enters** | Medium | High | GitHub/JetBrains build native multi-tool config. Counter: Move fast on governance and orchestration — features enterprises want but vendors are slow to ship |
| **Adoption friction kills growth** | Medium | High | Teams choose "good enough" simple tools over Forge's power. Counter: Lite mode, progressive adoption, one-command onboarding |

---

## 5. KPI Framework & Metrics Dashboard

### 5.1 Key Performance Indicators

| # | KPI | Current Baseline | Target (6mo) | Measurement Method |
|---|-----|-----------------|--------------|-------------------|
| 1 | **Onboarded repos** | 6 | 15 | Count of repos with `.agentkit/` and passing CI drift check |
| 2 | **Tool targets supported** | 15 | 18 | Count of render targets in sync engine |
| 3 | **Agent persona count** | 39 | 45 | Count of agent definitions in spec |
| 4 | **Team count** | 13 | 13 | Stable — quality over quantity |
| 5 | **CI drift check pass rate** | ~90% (manual observation) | 99% | Ratio of drift-check-passing PRs to total PRs |
| 6 | **Governance coverage** | Hooks only (1 platform) | Guards + hooks (all platforms) | Count of platforms with automated or reflective governance |
| 7 | **Adoption effort (time to first sync)** | ~30 min | <10 min | Time from `git clone` to first successful `agentkit:sync` |
| 8 | **Generated file churn ratio** | High (all files bump on sync) | <10% (content-changed only) | Ratio of content-changed files to timestamp-only-changed files per sync |
| 9 | **Cross-session trace coverage** | 0% | 50% | Percentage of sessions that produce a structured trace |
| 10 | **PR review noise ratio** | 444 files for 3 docs (PR #428) | <50 files for docs-only changes | Count of files in PR vs count of meaningful changes |
| 11 | **External contributor onboarding** | 0 external contributors | 3 | Count of non-org contributors with merged PRs |
| 12 | **Competitive feature gap** | 6+ unique features | 8+ unique features | Count of features in evaluation matrix where Forge = "Yes" and all competitors = "None" |

### 5.2 Benchmarks Against Competitors

| KPI | Retort | Ruler | Agent OS | ai-rules-sync |
|-----|---------------|-------|----------|---------------|
| Tool targets | **15** | 11 | 1 | 8 |
| Adoption effort | 30 min | **2 min** | 5 min | 5 min |
| Governance platforms | 1 | 0 | 0 | 0 |
| CI validation | **Yes** | No | No | No |
| Agent definitions | **39** | 0 | 0 | 0 |
| Team orchestration | **13 teams** | 0 | 0 | 0 |
| GitHub stars | ~50 | ~2,500 | ~200 | ~300 |
| Generated file noise | High | **None** | None | None |

### 5.3 Scoring Methodology

Each KPI maps to a SWOT quadrant:

| SWOT Category | KPIs | Weight |
|---------------|------|--------|
| **Strengths (protect)** | #2, #3, #4, #5, #12 | 30% |
| **Weaknesses (fix)** | #7, #8, #10 | 30% |
| **Opportunities (pursue)** | #6, #9, #11 | 25% |
| **Threats (monitor)** | #1, #12 | 15% |

**Scoring per KPI:** 0 = below baseline, 1 = at baseline, 2 = at target, 3 = exceeds target.

**Composite score** = weighted average × 33.3 (normalised to 100).

**Current estimated score:** ~55/100 (strong on strengths, weak on adoption friction and file churn).

### 5.4 Tracking Dashboard Template

```
┌─────────────────────────────────────────────────────────┐
│ Retort — Strategic Health Dashboard              │
│ Last updated: YYYY-MM-DD                                │
├──────────────────┬──────────┬──────────┬────────────────┤
│ Metric           │ Current  │ Target   │ Status         │
├──────────────────┼──────────┼──────────┼────────────────┤
│ Onboarded repos  │ 6        │ 15       │ 🟡 40%        │
│ Tool targets     │ 15       │ 18       │ 🟢 83%        │
│ Agent personas   │ 39       │ 45       │ 🟢 87%        │
│ CI pass rate     │ ~90%     │ 99%      │ 🟡 91%        │
│ Governance plat. │ 1        │ all      │ 🔴 17%        │
│ Time to 1st sync │ 30 min   │ 10 min   │ 🔴 33%        │
│ File churn ratio │ high     │ <10%     │ 🔴 5%         │
│ Trace coverage   │ 0%       │ 50%      │ 🔴 0%         │
│ PR noise ratio   │ 444:3    │ 50:3     │ 🔴 1%         │
│ Ext contributors │ 0        │ 3        │ 🔴 0%         │
│ Feature gap      │ 6+       │ 8+       │ 🟢 75%        │
├──────────────────┴──────────┴──────────┴────────────────┤
│ Composite Score: 55/100                                  │
│ Priority: Fix file churn → Reduce adoption friction     │
│           → Add portable governance → Attract externals │
└─────────────────────────────────────────────────────────┘
```

### 5.5 Priority Matrix (What to Fix First)

Based on the metrics, the prioritised action list for product/strategy teams:

| Priority | Action | KPIs Improved | Effort | Impact |
|----------|--------|---------------|--------|--------|
| **P0** | Content-hash-based sync (skip unchanged files) | #8, #10 | Medium | High — eliminates the #1 user complaint (noisy PRs) |
| **P0** | One-command onboarding (`npx retort init`) | #7, #11 | Medium | High — reduces adoption barrier from 30min to <5min |
| **P1** | Reflective guards (ADR-10 Phase 2) | #6, #12 | Medium | High — unique feature, governance for all platforms |
| **P1** | `.readme.yaml` generation (ADR-10 Phase 3) | #12 | Low | Medium — token cost reduction, machine-readable metadata |
| **P2** | Cross-session traces (ADR-10 Phase 4) | #9 | Low-Med | Medium — agent continuity improvement |
| **P2** | Publish as distributable package (npm/brew) | #7, #11 | Medium | High — prerequisite for external adoption |
| **P3** | Schema formalisation (ADR-10 Phase 5) | #11, #12 | Medium | Medium — enables ecosystem adoption |

---

## 6. Actionable Recommendations

### For Executive Leadership

1. **Position Retort as the "Terraform for AI agents"** — infrastructure-as-code for agent configuration. This resonates with enterprises who already think in IaC terms.
2. **The competitive moat is orchestration + governance, not rules sync.** Rules sync is commoditising. Invest in the features competitors can't easily replicate: team orchestration, quality gates, and portable governance.
3. **The ETH Zurich finding is an opportunity.** Auto-generated AGENTS.md files hurt agent performance. Position Forge's spec-validated, tool-specific output as the evidence-based alternative.

### For Product/Strategy

1. **Fix the noise problem first.** PR #428 had 444 files for 3 meaningful docs. Content-hash-based sync that skips unchanged files would dramatically improve the developer experience.
2. **Ship a "lite mode."** Not every team needs 13 teams and 39 agents. Offer a minimal config that generates basic rules for 3–5 tools from a single YAML file. Progressive disclosure to full power.
3. **Adopt the `.agents/` hub pattern.** Per ADR-10, this gives every AI tool a shared discovery point. Ship Phase 1 to validate before investing in Phases 2–5.

### For R&D/Technical

1. **Implement content-hash-based timestamps.** Only bump `last_updated` when file content actually changes. This is the single highest-impact technical change.
2. **Build guard-to-hook generation.** Reflective guards (markdown) as the canonical source; shell hooks generated from guards for tools that support automation.
3. **Publish JSON Schemas.** For guards, traces, `.readme.yaml`, and agent persona definitions. Enables IDE validation, external tool integration, and ecosystem adoption.
4. **Consider a standalone binary.** The Node.js/pnpm dependency limits adoption. A Go or Rust binary (or WASM) would make `retort` installable via `brew`, `cargo`, or `go install` with zero runtime dependencies.

---

## Sources

- [AGENTS.md specification](https://agents.md/)
- [AGENTS.md GitHub repository](https://github.com/agentsmd/agents.md)
- [ETH Zurich — Reassessing AGENTS.md value (InfoQ)](https://www.infoq.com/news/2026/03/agents-context-file-value-review/)
- [Ruler — apply rules to all coding agents](https://github.com/intellectronica/ruler)
- [Agent OS — coding standards for AI development](https://buildermethods.com/agent-os)
- [ai-rules-sync](https://github.com/lbb00/ai-rules-sync)
- [agent-rules (AGENT_RULES.md sync)](https://github.com/jeejeeguan/agent-rules)
- [Block ai-rules](https://github.com/block/ai-rules)
- [JetBrains ACP](https://www.adwaitx.com/jetbrains-acp-ai-agent-ide-integration/)
- [AI coding market statistics 2026](https://www.getpanto.ai/blog/ai-coding-assistant-statistics)
- [Agentic coding 2026 guide](https://halallens.no/en/blog/agentic-coding-in-2026-the-complete-guide-to-plugins-multi-model-orchestration-and-ai-agent-teams)
- [AI agent protocols guide](https://www.ruh.ai/blogs/ai-agent-protocols-2026-complete-guide)
- [OpenAI Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md/)
- [Best multi-agent frameworks 2026](https://gurusup.com/blog/best-multi-agent-frameworks-2026)
- [Anthropic 2026 Agentic Coding Trends Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf)
