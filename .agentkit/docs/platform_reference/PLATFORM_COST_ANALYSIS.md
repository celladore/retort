# Platform Cost Analysis

Weighted cost evaluation for AI coding platforms supported by AgentKit Forge.
Pricing models vary widely — from free/open-source to enterprise SaaS — and
the "cheapest" option depends on team size, usage intensity, and required features.

> **Last updated:** 2025-02  
> **Methodology:** Scores are 1–10 (10 = best value). The weighted total
> produces a normalized rating out of 100. Higher = better value for money.

---

## Table of Contents

1. [Pricing Models Overview](#pricing-models-overview)
2. [Cost Metrics](#cost-metrics)
3. [Methodology](#methodology)
4. [Category Matrix — AI-Native IDEs](#category-matrix--ai-native-ides)
5. [Category Matrix — IDE Extensions](#category-matrix--ide-extensions)
6. [Category Matrix — CLI Agents](#category-matrix--cli-agents)
7. [Category Matrix — Cloud / Autonomous Agents](#category-matrix--cloud--autonomous-agents)
8. [Overall Value Rankings](#overall-value-rankings)
9. [References](#references)

---

## Pricing Models Overview

| Platform | Free Tier | Individual | Team/Business | Enterprise | Pricing Model |
|----------|-----------|-----------|---------------|------------|--------------|
| Claude Code | ✅ Limited | $20/mo (Pro) | $30/mo (Team) | Custom | Subscription (usage-capped) |
| Cursor | ✅ 2k completions | $20/mo (Pro) | $40/mo (Business) | Custom | Subscription (usage-capped) |
| Windsurf | ✅ Limited | $15/mo (Pro) | $30/mo (Team) | Custom | Subscription |
| GitHub Copilot | ❌ | $10/mo (Individual) | $19/mo (Business) | $39/mo (Enterprise) | Per-seat subscription |
| Gemini CLI | ✅ Generous | Included in Gemini | — | Google Cloud | API usage (free tier generous) |
| OpenAI Codex | ❌ | $20/mo (ChatGPT Plus) | $25/mo (Team) | $200/mo (Pro) | Subscription + API usage |
| Warp | ✅ Basic | $15/mo | $22/mo (Team) | Custom | Subscription |
| Cline | ✅ Unlimited | Free (BYOK) | Free (BYOK) | Free (BYOK) | Bring-your-own-key (API costs only) |
| Roo Code | ✅ Unlimited | Free (BYOK) | Free (BYOK) | Free (BYOK) | Bring-your-own-key (API costs only) |
| Continue | ✅ Unlimited | Free (BYOK) | Hub pricing | Custom | Open-source + BYOK + Hub tiers |
| Google Jules | ✅ Limited | Gemini subscription | — | Google Cloud | Included in Gemini plans |
| Amazon Q Developer | ✅ Limited | Free (AWS) | $19/mo (Pro) | Custom | Per-user subscription |
| Sourcegraph Cody | ✅ Limited | Free | $9/mo (Pro) | Custom | Per-seat + Sourcegraph instance |
| Aider | ✅ Unlimited | Free (BYOK) | Free (BYOK) | Free (BYOK) | Open-source + BYOK |
| Amp | ✅ Limited | Free | — | Custom | Free tier + enterprise |
| OpenCode | ✅ Unlimited | Free (BYOK) | Free (BYOK) | Free (BYOK) | Open-source + BYOK |
| Factory | ❌ | — | Custom | Custom | Enterprise SaaS |

> **BYOK** = Bring Your Own Key. The tool is free but you pay LLM API costs
> directly (OpenAI, Anthropic, etc.). Typical API cost: $5–50/month for
> moderate usage depending on model choice.

---

## Cost Metrics

| # | Metric | Weight | What It Measures |
|---|--------|--------|-----------------|
| 1 | **Free Tier Generosity** | 20% | How much you can do before paying — completions, messages, features available |
| 2 | **Individual Plan Value** | 25% | Monthly cost vs features for a solo developer |
| 3 | **Team Plan Value** | 20% | Per-seat cost vs collaboration features for small teams (5–20 devs) |
| 4 | **Enterprise Value** | 10% | Cost-effectiveness at scale with SSO, compliance, admin controls |
| 5 | **Cost Predictability** | 15% | Fixed vs usage-based; risk of surprise bills; transparent pricing |
| 6 | **Total Cost of Ownership** | 10% | Hidden costs: API keys, infrastructure, training, migration effort |

### Why These Weights?

- **Individual Plan Value (25%)** is highest because most developers start as
  individual subscribers and this tier has the most competitive landscape.
- **Free Tier (20%)** matters for evaluation, students, open-source contributors,
  and teams that want to try before buying.
- **Team Plan (20%)** is the growth tier where most professional teams operate.
- **Cost Predictability (15%)** guards against BYOK surprise bills and usage spikes.
- **Enterprise (10%)** and **TCO (10%)** matter at scale but are less relevant
  for most evaluators.

---

## Methodology

### Scoring Scale

| Score | Meaning |
|-------|---------|
| 9–10 | Exceptional value — free or very generous for what you get |
| 7–8 | Good value — competitive pricing with strong features |
| 5–6 | Fair — reasonable but not standout |
| 3–4 | Expensive — notable cost relative to alternatives |
| 1–2 | Premium — high cost, justified only for specific enterprise needs |

---

## Category Matrix — AI-Native IDEs

| Metric (Weight) | Cursor | Windsurf | Warp |
|-----------------|--------|----------|------|
| Free Tier Generosity (20%) | 6 | 7 | 7 |
| Individual Plan Value (25%) | 7 | 8 | 7 |
| Team Plan Value (20%) | 6 | 7 | 7 |
| Enterprise Value (10%) | 6 | 6 | 5 |
| Cost Predictability (15%) | 8 | 8 | 8 |
| Total Cost of Ownership (10%) | 7 | 7 | 7 |
| **Weighted Score** | **68** | **73** | **69** |
| **Value Rating** | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ |

### Justification — AI-Native IDEs

**Cursor (68/100)**
- Free Tier: 6 — 2,000 completions/mo is usable but runs out fast for active developers [C1]
- Individual: 7 — $20/mo is standard for the category; strong feature set [C1]
- Team: 6 — $40/mo/seat is the highest in category; justified by features [C1]
- Predictability: 8 — Fixed subscription, no usage surprises [C1]

**Windsurf (73/100)**
- Free Tier: 7 — More generous trial than Cursor [C2]
- Individual: 8 — $15/mo undercuts Cursor while matching core features [C2]
- Team: 7 — $30/mo/seat is competitive for the tier [C2]

**Warp (69/100)**
- Free Tier: 7 — Decent free tier for terminal + AI usage [C3]
- Individual: 7 — $15/mo with AI features included [C3]
- Team: 7 — $22/mo includes Warp Drive team sharing [C3]

---

## Category Matrix — IDE Extensions

| Metric (Weight) | Copilot | Cline | Roo Code | Continue | Cody | Amazon Q |
|-----------------|---------|-------|----------|----------|------|----------|
| Free Tier Generosity (20%) | 4 | 10 | 10 | 10 | 7 | 7 |
| Individual Plan Value (25%) | 8 | 9 | 9 | 9 | 9 | 9 |
| Team Plan Value (20%) | 7 | 9 | 9 | 7 | 8 | 7 |
| Enterprise Value (10%) | 8 | 6 | 6 | 7 | 7 | 8 |
| Cost Predictability (15%) | 9 | 5 | 5 | 5 | 9 | 9 |
| Total Cost of Ownership (10%) | 8 | 6 | 6 | 6 | 7 | 8 |
| **Weighted Score** | **72** | **80** | **80** | **76** | **80** | **79** |
| **Value Rating** | ⭐⭐⭐½ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Justification — IDE Extensions

**GitHub Copilot (72/100)**
- Free Tier: 4 — No meaningful free tier (education/OSS exceptions) [C4]
- Individual: 8 — $10/mo is the lowest fixed-price option in IDE extensions [C4]
- Predictability: 9 — Fixed subscription, no API key management [C4]
- Enterprise: 8 — Strong admin controls, audit logs, policy management [C4]

**Cline (80/100)**
- Free Tier: 10 — Fully free and open-source; unlimited use [C5]
- Individual: 9 — $0 tool cost; only API costs (~$5–30/mo typical) [C5]
- Predictability: 5 — BYOK means variable API costs; power users can spike [C5]

**Roo Code (80/100)**
- Same economics as Cline (open-source fork, BYOK model) [C6]

**Continue (76/100)**
- Free Tier: 10 — Open-source, unlimited local use [C7]
- Team: 7 — Hub/Mission Control adds cost for managed rules [C7]
- Predictability: 5 — BYOK variability for API costs [C7]

**Sourcegraph Cody (80/100)**
- Free Tier: 7 — Generous free tier with limited completions [C8]
- Individual: 9 — Free for individual use; $9/mo Pro adds features [C8]
- Enterprise: 7 — Requires Sourcegraph instance for full code graph [C8]

**Amazon Q Developer (79/100)**
- Free Tier: 7 — Free tier included with AWS account [C9]
- Individual: 9 — Free tier is very usable; $19/mo Pro for power use [C9]
- Enterprise: 8 — Deep AWS integration justifies cost for AWS-heavy teams [C9]

---

## Category Matrix — CLI Agents

| Metric (Weight) | Claude Code | Codex | Gemini CLI | Aider | Amp | OpenCode |
|-----------------|-------------|-------|------------|-------|-----|----------|
| Free Tier Generosity (20%) | 5 | 4 | 9 | 10 | 8 | 10 |
| Individual Plan Value (25%) | 7 | 6 | 9 | 9 | 9 | 10 |
| Team Plan Value (20%) | 6 | 6 | 7 | 8 | 7 | 8 |
| Enterprise Value (10%) | 7 | 7 | 7 | 5 | 6 | 4 |
| Cost Predictability (15%) | 7 | 6 | 8 | 5 | 8 | 5 |
| Total Cost of Ownership (10%) | 7 | 6 | 8 | 7 | 7 | 7 |
| **Weighted Score** | **64** | **59** | **83** | **80** | **79** | **79** |
| **Value Rating** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Justification — CLI Agents

**Claude Code (64/100)**
- Free Tier: 5 — Limited free usage; quickly requires Pro subscription [C10]
- Individual: 7 — $20/mo (Pro) provides good value for the best-in-class agent [C10]
- Team: 6 — $30/mo/seat is premium; justified by capability but costly at scale [C10]
- Predictability: 7 — Subscription-based but usage caps can force tier upgrades [C10]

**OpenAI Codex (59/100)**
- Free Tier: 4 — No meaningful free Codex access [C11]
- Individual: 6 — $20/mo (Plus) with limited Codex; $200/mo (Pro) for full [C11]
- Predictability: 6 — Tiered usage limits; Pro is expensive [C11]

**Gemini CLI (83/100)**
- Free Tier: 9 — Very generous free tier with high rate limits [C12]
- Individual: 9 — Excellent value; free tier covers most individual needs [C12]
- Predictability: 8 — Google's free tier is stable and well-documented [C12]

**Aider (80/100)**
- Free Tier: 10 — Fully open-source, unlimited use [C13]
- Individual: 9 — $0 tool cost; only API costs [C13]
- Predictability: 5 — BYOK cost variability [C13]

**Amp (79/100)**
- Free Tier: 8 — Generous free tier [C14]
- Individual: 9 — Free for most use cases [C14]

**OpenCode (79/100)**
- Free Tier: 10 — Fully open-source [C15]
- Individual: 10 — $0 tool cost [C15]
- Enterprise: 4 — No enterprise features or support [C15]

---

## Category Matrix — Cloud / Autonomous Agents

| Metric (Weight) | Jules | Factory | Codex (Cloud) | Copilot Agent |
|-----------------|-------|---------|---------------|---------------|
| Free Tier Generosity (20%) | 6 | 2 | 4 | 4 |
| Individual Plan Value (25%) | 7 | 3 | 5 | 7 |
| Team Plan Value (20%) | 6 | 5 | 5 | 7 |
| Enterprise Value (10%) | 5 | 7 | 7 | 8 |
| Cost Predictability (15%) | 7 | 4 | 5 | 8 |
| Total Cost of Ownership (10%) | 7 | 4 | 6 | 7 |
| **Weighted Score** | **62** | **38** | **51** | **67** |
| **Value Rating** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐½ | ⭐⭐⭐½ |

### Justification — Cloud / Autonomous Agents

**Google Jules (62/100)**
- Free Tier: 6 — Included with Gemini; limited task quota [C16]
- Individual: 7 — Reasonable if already on a Gemini plan [C16]
- Predictability: 7 — Task-based; usage is somewhat predictable [C16]

**Factory (38/100)**
- Free Tier: 2 — No free tier; enterprise sales-driven [C17]
- Individual: 3 — Not available for individuals [C17]
- Predictability: 4 — Custom pricing; difficult to budget upfront [C17]

**Codex Cloud (51/100)**
- Same subscription as Codex CLI but cloud tasks consume more [C11]
- Pro tier ($200/mo) needed for meaningful autonomous usage [C11]

**Copilot Coding Agent (67/100)**
- Free Tier: 4 — Requires Copilot subscription [C4]
- Individual: 7 — Included in $10/mo Copilot Individual for limited use [C4]
- Team: 7 — Included in Business/Enterprise tiers [C4]
- Predictability: 8 — Fixed subscription; agent tasks have minute limits [C4]

---

## Overall Value Rankings

All platforms ranked by cost-value score.

| Rank | Platform | Cost Score | Value Rating | Pricing Model |
|------|----------|-----------|--------------|--------------|
| 1 | Gemini CLI | 83 | ⭐⭐⭐⭐ | Free tier + API |
| 2 | Cline | 80 | ⭐⭐⭐⭐ | Open-source + BYOK |
| 3 | Roo Code | 80 | ⭐⭐⭐⭐ | Open-source + BYOK |
| 4 | Sourcegraph Cody | 80 | ⭐⭐⭐⭐ | Free + Pro tiers |
| 5 | Aider | 80 | ⭐⭐⭐⭐ | Open-source + BYOK |
| 6 | Amazon Q Developer | 79 | ⭐⭐⭐⭐ | AWS free tier + Pro |
| 7 | Amp | 79 | ⭐⭐⭐⭐ | Free + enterprise |
| 8 | OpenCode | 79 | ⭐⭐⭐⭐ | Open-source + BYOK |
| 9 | Continue | 76 | ⭐⭐⭐⭐ | Open-source + Hub |
| 10 | Windsurf | 73 | ⭐⭐⭐½ | Subscription |
| 11 | Copilot | 72 | ⭐⭐⭐½ | Per-seat subscription |
| 12 | Warp | 69 | ⭐⭐⭐½ | Subscription |
| 13 | Cursor | 68 | ⭐⭐⭐½ | Subscription |
| 14 | Copilot Agent | 67 | ⭐⭐⭐½ | Included in Copilot |
| 15 | Claude Code | 64 | ⭐⭐⭐ | Subscription |
| 16 | Jules | 62 | ⭐⭐⭐ | Gemini plans |
| 17 | Codex | 59 | ⭐⭐⭐ | Subscription + API |
| 18 | Codex Cloud | 51 | ⭐⭐½ | Subscription (Pro) |
| 19 | Factory | 38 | ⭐⭐ | Enterprise SaaS |

---

## References

| ID | Source | URL |
|----|--------|-----|
| C1 | Cursor Pricing | https://cursor.com/pricing |
| C2 | Windsurf Pricing | https://windsurf.com/pricing |
| C3 | Warp Pricing | https://www.warp.dev/pricing |
| C4 | GitHub Copilot Pricing | https://github.com/features/copilot#pricing |
| C5 | Cline — Open-source, BYOK | https://github.com/cline/cline |
| C6 | Roo Code — Open-source, BYOK | https://github.com/RooVetGit/Roo-Code |
| C7 | Continue Pricing | https://www.continue.dev/pricing |
| C8 | Sourcegraph Cody Pricing | https://sourcegraph.com/pricing |
| C9 | Amazon Q Developer Pricing | https://aws.amazon.com/q/developer/pricing/ |
| C10 | Anthropic Claude Pricing | https://www.anthropic.com/pricing |
| C11 | OpenAI Codex / ChatGPT Pricing | https://openai.com/chatgpt/pricing/ |
| C12 | Gemini CLI — Free tier | https://ai.google.dev/pricing |
| C13 | Aider — Open-source | https://github.com/Aider-AI/aider |
| C14 | Amp Pricing | https://ampcode.com/ |
| C15 | OpenCode — Open-source | https://github.com/opencode-ai/opencode |
| C16 | Google Jules Pricing | https://jules.google/ |
| C17 | Factory Pricing | https://www.factory.ai/pricing |

---

## See Also

- [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) — Coding ability evaluation
- [PLATFORM_DEVELOPER_EXPERIENCE.md](./PLATFORM_DEVELOPER_EXPERIENCE.md) — UX and workflow evaluation
- [PLATFORM_CONSOLIDATED_RATING.md](./PLATFORM_CONSOLIDATED_RATING.md) — Combined final rankings
- [Platform Reference README](./README.md) — Platform overview and comparison
