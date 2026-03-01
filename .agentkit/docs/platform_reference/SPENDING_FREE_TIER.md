# Free Tier Optimization Guide

Maximize AI coding productivity at **$0/month tool cost** by strategically
rotating between free tiers across multiple platforms. This guide covers
which tools to use, when to switch, and how to combine them.

> **Last updated:** 2025-02  
> **Target audience:** Students, hobbyists, open-source contributors,
> developers in regions with limited payment options.

---

## Table of Contents

1. [Free Tier Inventory](#free-tier-inventory)
2. [Daily Workflow Rotation](#daily-workflow-rotation)
3. [When Credits Run Out — Rotation Strategy](#when-credits-run-out--rotation-strategy)
4. [Combining Tools for Full Coverage](#combining-tools-for-full-coverage)
5. [Hidden Costs to Watch](#hidden-costs-to-watch)
6. [Recommended Free Stack](#recommended-free-stack)

---

## Free Tier Inventory

Every platform below offers meaningful free access. Listed in order of value.

| Platform | Free Tier Details | Monthly Limit | Best For |
|----------|------------------|---------------|----------|
| **Trae IDE** | Free GPT-4o + Claude 3.7 access | Soft limits likely apply (fair use) | Full AI IDE experience |
| **Codeium** | Unlimited completions | Unlimited | Fast code completions |
| **Void Editor** | Free forever (BYOK) | Unlimited (API costs) | Privacy-first coding |
| **PearAI** | Open-source + BYOK | Unlimited (API costs) | Bundled AI tools |
| **Aider** | Free tool (BYOK) | Unlimited (API costs) | CLI pair programming |
| **Cline** | Free tool (BYOK) | Unlimited (API costs) | VS Code agentic agent |
| **Roo Code** | Free tool (BYOK) | Unlimited (API costs) | VS Code agentic agent |
| **Continue** | Free tool (BYOK) | Unlimited (API costs) | Multi-IDE assistant |
| **OpenCode** | Free tool (BYOK) | Unlimited (API costs) | Terminal AI |
| **Gemini CLI** | Free with Google account | 60 requests/min (Gemini 2.5 Flash) | CLI agent |
| **GitHub Copilot** | Free tier | 2,000 completions + 50 chat/mo | IDE completions |
| **Zed Editor** | Free tier | 2,000 predictions + 50 prompts/mo | Fast editor + AI |
| **Same.new** | Free tier | 500K tokens/mo | App prototyping |
| **Amazon Q Developer** | Free tier | Limited requests/mo | AWS coding |
| **Amp** | Free tier | Limited | CLI agent |
| **Replit** | Free tier | Limited compute | Cloud IDE |
| **Vercel v0** | Free tier | Limited credits | UI components |
| **Bolt.new** | Free tier | Limited | App prototyping |

### BYOK (Bring Your Own Key) Cost Estimates

If using BYOK tools, your actual cost is the API provider fee:

| Provider | Model | Approx. Cost per 1M Tokens |
|----------|-------|---------------------------|
| Google Gemini (free tier) | Gemini 2.5 Flash | $0 (rate-limited) |
| DeepSeek | DeepSeek-V3 | ~$0.14 input / $0.28 output |
| Anthropic | Claude 3.5 Haiku | ~$0.25 input / $1.25 output |
| OpenAI | GPT-4o Mini | ~$0.15 input / $0.60 output |
| Local (Ollama) | Llama, Qwen, etc. | $0 (hardware cost only) |

**Cheapest API option:** DeepSeek or Gemini Flash give the best quality-per-dollar.

---

## Daily Workflow Rotation

Use different tools for different tasks to maximize free coverage:

```
Morning (coding sessions):
├── Trae IDE — primary editor with free Claude 3.7 + GPT-4o
├── Codeium — fast completions if Trae completions lag
└── Copilot Free — 2K completions for quick edits

Afternoon (complex tasks):
├── Gemini CLI — agentic CLI tasks (free 60 req/min)
├── Cline + DeepSeek API — agentic VS Code ($0.14/1M tokens)
└── Aider + DeepSeek — CLI pair programming

Evening (prototyping):
├── Same.new — rapid app prototyping (500K tokens free)
├── Vercel v0 — React UI components (free credits)
└── Replit — cloud experiments (free tier)
```

---

## When Credits Run Out — Rotation Strategy

When one platform's free tier is exhausted, rotate to the next:

### Phase 1: Primary Free Tools (Unlimited)
1. **Trae IDE** — unlimited GPT-4o + Claude 3.7 (start here)
2. **Codeium** — unlimited completions (always available)
3. **Void/PearAI** — unlimited with BYOK (use DeepSeek for cheapest API)

### Phase 2: Rate-Limited Free Tiers (When Phase 1 needs change)
4. **Gemini CLI** — 60 req/min free (good for bursts of agentic work)
5. **GitHub Copilot Free** — 2K completions + 50 chat messages/month
6. **Zed Editor** — 2K predictions + 50 prompts/month

### Phase 3: Token-Limited Free Tiers (For specific tasks)
7. **Same.new** — 500K tokens/month (for app prototyping only)
8. **Amazon Q Free** — for AWS-specific coding
9. **Amp Free** — for CLI agentic tasks

### Phase 4: BYOK with Cheap APIs (When everything else runs out)
10. **Aider + DeepSeek** — ~$2-5/month for moderate usage
11. **Cline + DeepSeek** — same economics, IDE-based
12. **OpenCode + DeepSeek** — minimal terminal option

### Monthly Reset Strategy

```
Day 1-7:   Use Copilot + Zed free tiers (fresh monthly allowance)
Day 1-30:  Trae IDE as primary (unlimited)
Day 1-30:  Codeium for completions (unlimited)
Day 1-30:  Gemini CLI for agentic tasks (rate-limited, not monthly capped)
Day 15+:   Copilot/Zed likely exhausted → switch to BYOK tools
Day 20+:   Same.new tokens likely low → switch to Bolt.new/Replit free
```

---

## Combining Tools for Full Coverage

The optimal $0/month stack covers all coding scenarios:

| Scenario | Primary Tool | Backup |
|----------|-------------|--------|
| **Daily coding (IDE)** | Trae IDE (free) | PearAI or Void (BYOK) |
| **Code completions** | Codeium (unlimited) | Copilot Free (2K/mo) |
| **Agentic CLI tasks** | Gemini CLI (free) | Aider + DeepSeek (~$0.14/1M) |
| **Agentic IDE tasks** | Cline + DeepSeek | Roo Code + DeepSeek |
| **App prototyping** | Same.new (500K tokens) | Replit Free |
| **UI components** | Vercel v0 (free credits) | Bolt.new (free tier) |
| **AWS-specific** | Amazon Q Free | — |
| **Air-gapped/local** | Void + Ollama ($0) | Aider + Ollama ($0) |

---

## Hidden Costs to Watch

| Trap | How to Avoid |
|------|-------------|
| BYOK API overruns | Set spending caps on API providers ($5/mo max) |
| Trae data concerns | Don't use for proprietary/sensitive code |
| Copilot telemetry | Review privacy settings; disable telemetry |
| Replit storage limits | Keep projects small; export to GitHub |
| Same.new token drain | Use for prototyping only, not daily coding |

---

## Recommended Free Stack

### Minimal Setup (3 tools)

```
1. Trae IDE        — primary AI IDE (free, unlimited)
2. Codeium ext.    — completions in any editor (free, unlimited)
3. Gemini CLI      — agentic CLI tasks (free, rate-limited)
```

**Total: $0/month** — covers IDE + completions + CLI agent

### Full Coverage (6 tools)

```
1. Trae IDE        — primary AI IDE
2. Codeium         — fast completions everywhere
3. Gemini CLI      — agentic CLI tasks
4. Cline + DeepSeek— agentic VS Code tasks (~$2/mo API)
5. Same.new        — rapid app prototyping
6. Copilot Free    — 2K completions + 50 chat/mo bonus
```

**Total: $0–2/month** — comprehensive AI coding coverage

### Privacy-First Setup (4 tools)

```
1. Void Editor     — open-source, no telemetry
2. Aider + Ollama  — fully local CLI agent
3. Cline + Ollama  — fully local VS Code agent
4. Zed Editor Free — fast editor with local predictions
```

**Total: $0/month** — zero data leaves your machine

---

## See Also

- [SPENDING_MINIMUM_SUB.md](./SPENDING_MINIMUM_SUB.md) — $10–25/month guide
- [SPENDING_PREMIUM.md](./SPENDING_PREMIUM.md) — $50–200+/month guide
- [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) — Detailed cost per platform
- [SPENDING_GUIDES.md](./SPENDING_GUIDES.md) — Overview of all spending guides
