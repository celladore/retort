# Platform Consolidated Rating & Recommendations

Combines all key decision factors — coding performance, cost, developer
experience, customization, privacy/security, and team/enterprise readiness —
into a single weighted score with actionable recommendations for different
use cases.

> **Last updated:** 2025-02  
> **Methodology:** Each dimension score (from its dedicated evaluation document)
> is normalized to 0–100 and combined using the weights below.

---

## Table of Contents

1. [Decision Dimensions & Weights](#decision-dimensions--weights)
2. [Consolidated Scoring Matrix](#consolidated-scoring-matrix)
3. [Final Rankings](#final-rankings)
4. [Use-Case Recommendations](#use-case-recommendations)
5. [Platform Profiles](#platform-profiles)
6. [Key Conclusions](#key-conclusions)
7. [How to Use This Guide](#how-to-use-this-guide)

---

## Decision Dimensions & Weights

| # | Dimension | Weight | Evaluation Document | What It Covers |
|---|-----------|--------|-------------------|---------------|
| 1 | **Coding Performance** | 30% | [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) | Code correctness, context understanding, multi-file editing, autonomy |
| 2 | **Developer Experience** | 20% | [PLATFORM_DEVELOPER_EXPERIENCE.md](./PLATFORM_DEVELOPER_EXPERIENCE.md) | Onboarding, workflow integration, UI quality, learning curve |
| 3 | **Cost & Value** | 20% | [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) | Free tier, plan value, predictability, total cost of ownership |
| 4 | **Customization** | 10% | [PLATFORM_CUSTOMIZATION.md](./PLATFORM_CUSTOMIZATION.md) | Instruction depth, AGENTS.md, activation controls, MCP, model flex |
| 5 | **Privacy & Security** | 10% | [PLATFORM_PRIVACY_SECURITY.md](./PLATFORM_PRIVACY_SECURITY.md) | Data residency, retention, local option, compliance, audit |
| 6 | **Team & Enterprise** | 10% | [PLATFORM_TEAM_ENTERPRISE.md](./PLATFORM_TEAM_ENTERPRISE.md) | Collaboration, governance, SSO, org policies, scalability |

### Why These Weights?

- **Coding Performance (30%)** is the primary purpose of a coding tool —
  if it doesn't produce good code, nothing else matters.
- **Developer Experience (20%)** determines daily productivity and team
  adoption — a great tool with bad UX won't get used.
- **Cost (20%)** is a hard constraint for most teams — the best tool you
  can't afford is useless.
- **Customization, Privacy, Enterprise (10% each)** are important modifiers
  that elevate or disqualify platforms depending on your context. Enterprise
  buyers may want to increase these weights.

---

## Consolidated Scoring Matrix

Dimension scores sourced from each evaluation document, combined with weights.

| Platform | Perf (30%) | DX (20%) | Cost (20%) | Custom (10%) | Privacy (10%) | Enterprise (10%) | **Weighted Total** |
|----------|-----------|---------|-----------|-------------|--------------|-----------------|-------------------|
| Claude Code | 89 | 80 | 64 | 84 | 66 | 68 | **78** |
| Cursor IDE | 77 | 84 | 68 | 79 | 63 | 63 | **74** |
| GitHub Copilot | 78 | 86 | 72 | 76 | 74 | 88 | **79** |
| Windsurf IDE | 69 | 77 | 73 | 62 | 55 | 51 | **68** |
| OpenAI Codex | 79 | 69 | 59 | 67 | 62 | 50 | **67** |
| Gemini CLI | 73 | 73 | 83 | 59 | 59 | 50 | **71** |
| Warp Terminal | 63 | 77 | 69 | 62 | 51 | 54 | **65** |
| Cline | 73 | 72 | 80 | 68 | 62 | 32 | **69** |
| Roo Code | 73 | 72 | 80 | 75 | 62 | 34 | **70** |
| Continue | 61 | 68 | 76 | 72 | 64 | 50 | **66** |
| Google Jules | 71 | 68 | 62 | 41 | 49 | 43 | **62** |
| Amazon Q Developer | 70 | 73 | 79 | 56 | 79 | 86 | **74** |
| Sourcegraph Cody | 68 | 74 | 80 | 58 | 66 | 72 | **71** |
| Aider | 76 | 74 | 80 | 62 | 62 | 30 | **70** |
| Amp | 72 | 70 | 79 | 52 | 48 | 42 | **65** |
| OpenCode | 56 | 61 | 79 | 51 | 61 | 22 | **58** |
| Factory | 72 | 57 | 38 | 47 | 52 | 71 | **57** |

### Calculation Method

```
Weighted Total = (Perf × 0.30) + (DX × 0.20) + (Cost × 0.20)
               + (Custom × 0.10) + (Privacy × 0.10) + (Enterprise × 0.10)
```

---

## Final Rankings

| Rank | Platform | Score | Rating | Best For |
|------|----------|-------|--------|----------|
| 1 | **GitHub Copilot** | 79 | ⭐⭐⭐⭐ | Enterprise teams, GitHub-centric workflows |
| 2 | **Claude Code** | 78 | ⭐⭐⭐⭐ | Maximum coding power, complex multi-file tasks |
| 3 | **Amazon Q Developer** | 74 | ⭐⭐⭐½ | AWS teams, security-conscious enterprises |
| 4 | **Cursor IDE** | 74 | ⭐⭐⭐½ | Visual coding, AI-native IDE experience |
| 5 | **Gemini CLI** | 71 | ⭐⭐⭐½ | Budget-conscious developers, Google ecosystem |
| 6 | **Sourcegraph Cody** | 71 | ⭐⭐⭐½ | Large codebases, cross-repo understanding |
| 7 | **Roo Code** | 70 | ⭐⭐⭐½ | Budget teams wanting agentic IDE extension |
| 8 | **Aider** | 70 | ⭐⭐⭐½ | Open-source purists, terminal-native devs |
| 9 | **Cline** | 69 | ⭐⭐⭐½ | Budget teams, VS Code agentic workflows |
| 10 | **Windsurf IDE** | 68 | ⭐⭐⭐½ | Cursor alternative at lower price |
| 11 | **OpenAI Codex** | 67 | ⭐⭐⭐½ | OpenAI ecosystem, autonomous cloud tasks |
| 12 | **Continue** | 66 | ⭐⭐⭐½ | Model-agnostic teams, JetBrains users |
| 13 | **Warp Terminal** | 65 | ⭐⭐⭐ | Terminal-first developers, DevOps |
| 14 | **Amp** | 65 | ⭐⭐⭐ | Sourcegraph users, autonomous CLI tasks |
| 15 | **Google Jules** | 62 | ⭐⭐⭐ | Hands-off bug fixes, async coding |
| 16 | **OpenCode** | 58 | ⭐⭐⭐ | Go developers, minimal setup |
| 17 | **Factory** | 57 | ⭐⭐⭐ | Enterprise autonomous development at scale |

---

## Use-Case Recommendations

### 🏢 Enterprise Team (50+ developers)

**Recommended:** GitHub Copilot Enterprise or Amazon Q Developer

| Requirement | Winner | Why |
|------------|--------|-----|
| Best admin controls | GitHub Copilot | Full org management, audit logs, SSO, policy enforcement |
| AWS-heavy stack | Amazon Q Developer | Deep AWS integration, security scanning, IAM controls |
| Maximum compliance | Amazon Q Developer | FedRAMP, SOC 2, ISO 27001, HIPAA — built on AWS |
| GitHub-centric CI/CD | GitHub Copilot | Native issues → PRs → CI → deploy workflow |

**Configuration:** Deploy both GitHub Copilot (for IDE + Coding Agent) and
Amazon Q (for AWS-specific tasks). Use AgentKit Forge to generate instructions
for both simultaneously via `renderTargets: [copilot]` + `AGENTS.md`.

---

### 👨‍💻 Individual Developer / Freelancer

**Recommended:** Claude Code (power) or Aider (budget)

| Requirement | Winner | Why |
|------------|--------|-----|
| Maximum coding ability | Claude Code | Highest SWE-bench scores, richest config system |
| Budget-conscious | Aider + Gemini CLI | Free/open-source tools with top-tier model access |
| Visual IDE preference | Cursor IDE | Best AI-native IDE experience |
| Terminal preference | Claude Code | Best CLI agent with hooks, subagents, skills |

**Budget tier:** Aider (free) + Gemini CLI (free tier) gives strong capability
at $0/month tool cost (API costs of $5–20/month depending on model choice).

**Premium tier:** Claude Code ($20/month) provides the strongest single-tool
experience for a professional developer.

---

### 🚀 Startup (5–20 developers)

**Recommended:** Cursor IDE + Cline/Roo Code

| Requirement | Winner | Why |
|------------|--------|-----|
| IDE + Agent combo | Cursor + Cline | Cursor for IDE rules; Cline for agentic tasks in VS Code |
| Cost-effective team | Roo Code + Aider | Open-source stack with BYOK; $0 tool cost |
| Shared conventions | Any + AgentKit Forge | Generate AGENTS.md + platform-specific rules for consistency |
| Fast prototyping | Cursor IDE | Quick iteration with Composer mode and inline chat |

**Approach:** Use AgentKit Forge to generate shared AGENTS.md and
platform-specific rules. Let developers choose their preferred tool — the
shared rules ensure consistency regardless of platform choice.

---

### 🔒 Regulated Industry (Healthcare, Finance, Defense)

**Recommended:** Amazon Q Developer or Cline/Roo Code with local models

| Requirement | Winner | Why |
|------------|--------|-----|
| Data stays in-house | Cline + local model | Full air-gapped setup with Ollama/local LLM |
| AWS + compliance | Amazon Q Developer | FedRAMP, HIPAA, SOC 2 with AWS region control |
| Audit trail | GitHub Copilot Enterprise | Audit API, usage tracking, policy enforcement |
| Zero code retention | Cursor (Privacy Mode) | Privacy Mode disables cloud code storage |

**Important:** For classified work, only Cline, Roo Code, Continue, Aider, and
OpenCode can run fully local with no external API calls.

---

### 🤖 Autonomous / Hands-Off Development

**Recommended:** GitHub Copilot Coding Agent or OpenAI Codex

| Requirement | Winner | Why |
|------------|--------|-----|
| Issue → PR pipeline | Copilot Coding Agent | Assign issues, auto-creates branches and PRs |
| Sandboxed execution | OpenAI Codex | Cloud sandbox with full repo access |
| Async bug fixes | Google Jules | Fire-and-forget task execution |
| End-to-end SDLC | Factory | Enterprise autonomous development pipeline |

---

### 📖 Open-Source / Budget-Zero

**Recommended:** Aider + Cline + AgentKit Forge

| Platform | Monthly Cost | What You Get |
|----------|-------------|-------------|
| Aider | $0 (tool) + API costs | Best open-source CLI agent; 60+ model support |
| Cline | $0 (tool) + API costs | Best open-source IDE extension agent |
| Gemini CLI | $0 (free tier) | Generous free API access |
| OpenCode | $0 (tool) + API costs | Minimal but functional terminal AI |
| Continue | $0 (tool) + API costs | Multi-IDE open-source assistant |

**Tip:** Combine Gemini CLI's free tier (for routine tasks) with Aider using
a paid model (for complex tasks) to minimize costs.

---

## Platform Profiles

### Tier 1 — Best Overall (Score ≥ 75)

| Platform | Strength | Weakness |
|----------|----------|----------|
| **GitHub Copilot** (79) | Best enterprise, deepest GitHub integration, great DX | Locked models, no MCP, higher cost |
| **Claude Code** (78) | Best coding performance, richest customization | Anthropic-only models, premium pricing |

### Tier 2 — Strong Contenders (Score 68–74)

| Platform | Strength | Weakness |
|----------|----------|----------|
| **Amazon Q Developer** (74) | Best compliance/security, AWS integration | AWS-centric, limited model choice |
| **Cursor IDE** (74) | Best AI-native IDE, great DX, strong customization | Subscription cost, no free tier for power use |
| **Gemini CLI** (71) | Best value (free), fast | Gemini-only models, limited config depth |
| **Sourcegraph Cody** (71) | Best code graph intelligence, good value | Requires Sourcegraph for full power |
| **Roo Code** (70) | Strong agentic + customization, budget-friendly | No enterprise features, BYOK variability |
| **Aider** (70) | Best model flexibility, open-source, great git integration | No enterprise features, CLI only |
| **Cline** (69) | Budget agentic IDE, cross-tool compatibility | No enterprise features, BYOK variability |
| **Windsurf IDE** (68) | Good IDE at lower price than Cursor | Fewer customization options, no AGENTS.md |

### Tier 3 — Specialized / Emerging (Score 57–67)

| Platform | Strength | Weakness |
|----------|----------|----------|
| **OpenAI Codex** (67) | Strong autonomous cloud agent, Skills system | Expensive (Pro tier), limited config beyond AGENTS.md |
| **Continue** (66) | Best model flexibility (BYOK), multi-IDE | Weaker coding performance, no AGENTS.md |
| **Warp Terminal** (65) | Excellent terminal UX, team sharing | Limited IDE-level coding, fewer features |
| **Amp** (65) | Free, autonomous, Sourcegraph-backed | Less mature, limited customization |
| **Google Jules** (62) | Fully autonomous, fire-and-forget | Limited customization, async-only |
| **OpenCode** (58) | Free, open-source, local model support | Early stage, limited features |
| **Factory** (57) | Full SDLC automation | Enterprise-only, expensive, opaque pricing |

---

## Key Conclusions

### 1. No Single Platform Wins Everything

No platform scores highest across all six dimensions. GitHub Copilot leads
in enterprise and DX but trails in coding performance. Claude Code leads in
performance and customization but is expensive. The best strategy is often
a **multi-platform approach** using AgentKit Forge to maintain consistent
instructions across all tools.

### 2. AGENTS.md Is the Great Equalizer

With 13 of 17 platforms supporting `AGENTS.md` natively, investing in a
comprehensive AGENTS.md file (via AgentKit Forge) provides immediate value
across your entire tool portfolio. Even if you switch platforms, your
project context travels with you.

### 3. Cost and Performance Are Inversely Correlated

The highest-performing platforms (Claude Code, Codex) are the most expensive.
The most cost-effective platforms (Aider, Cline, Gemini CLI) are open-source
or have generous free tiers. The sweet spot depends on your budget and the
complexity of your coding tasks.

### 4. Enterprise Needs Narrow the Field Dramatically

Only GitHub Copilot, Amazon Q Developer, and (to a lesser extent)
Sourcegraph Cody and Factory meet serious enterprise requirements (SSO,
audit, compliance, org policies). If these features are mandatory, your
choices are limited regardless of coding performance scores.

### 5. The BYOK Model Is a Double-Edged Sword

Open-source BYOK tools (Cline, Roo Code, Aider, Continue, OpenCode) offer
maximum flexibility and lowest tool cost. But they shift cost unpredictability
to API usage, require self-management of keys and providers, and provide no
vendor support SLA. For teams that can manage this complexity, BYOK is
often the best value.

### 6. AI-Native IDEs vs IDE Extensions Is a Workflow Decision

- Choose an **AI-Native IDE** (Cursor, Windsurf) if you want AI deeply
  woven into every interaction and are willing to switch editors.
- Choose an **IDE Extension** (Copilot, Cline, Roo Code) if you want to
  stay in your existing VS Code/JetBrains setup.
- Choose a **CLI Agent** (Claude Code, Aider, Gemini CLI) if you prefer
  terminal-native workflows or need the strongest coding performance.

### 7. Recommended Starting Stack

For a team beginning their AI coding journey:

1. **Generate** `AGENTS.md` with AgentKit Forge (universal coverage)
2. **Deploy** GitHub Copilot as the baseline (best DX, lowest friction)
3. **Add** Claude Code or Aider for complex/agentic tasks (power users)
4. **Evaluate** Cursor or Windsurf for developers who want an AI-native IDE

---

## How to Use This Guide

1. **Identify your priority dimensions** — adjust weights if your team
   values cost over performance, or privacy over DX.
2. **Filter by hard constraints** — eliminate platforms that fail on
   must-have requirements (e.g., "must support SSO" eliminates open-source).
3. **Compare within your category** — an IDE extension and a CLI agent
   serve different workflows; compare within category first.
4. **Try before committing** — most platforms have free tiers or trials.
   Use the scoring as a shortlist, then validate with real usage.
5. **Use AgentKit Forge** — regardless of platform choice, generate
   AGENTS.md + platform-specific rules for consistent AI behavior.

---

## See Also

- [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) — Coding ability evaluation
- [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) — Cost and pricing evaluation
- [PLATFORM_DEVELOPER_EXPERIENCE.md](./PLATFORM_DEVELOPER_EXPERIENCE.md) — UX and workflow evaluation
- [PLATFORM_CUSTOMIZATION.md](./PLATFORM_CUSTOMIZATION.md) — Extensibility evaluation
- [PLATFORM_PRIVACY_SECURITY.md](./PLATFORM_PRIVACY_SECURITY.md) — Privacy and security evaluation
- [PLATFORM_TEAM_ENTERPRISE.md](./PLATFORM_TEAM_ENTERPRISE.md) — Team and enterprise evaluation
- [Platform Reference README](./README.md) — Platform overview and comparison
- [INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md) — Phased plan to address platform gaps
