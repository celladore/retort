# Reference

This section collects authoritative reference material for the
AgentKit Forge project: project glossary, FAQ, changelog, contribution
guidelines, YAML configuration reference, AI session records, and the
full LLM intelligence layer ÔÇö benchmark dossiers, per-team model guides,
and decision-engine analysis.

## Contents

### Project Reference Files

| File | Description |
| --- | --- |
| [01_glossary.md](./01_glossary.md) | Terms and definitions used across all docs |
| [02_faq.md](./02_faq.md) | Frequently asked questions about the project |
| [03_changelog.md](./03_changelog.md) | Version history and release notes |
| [04_contributing.md](./04_contributing.md) | Contribution guidelines and code of conduct |
| [05_project_yaml_reference.md](./05_project_yaml_reference.md) | Complete `project.yaml` field reference |

### AI and LLM Reference

| Subfolder | Description |
| --- | --- |
| [ai_handoffs/](./ai_handoffs/) | AI session handoff records for continuity between agent sessions |
| [model-families/](./model-families/) | Benchmark dossiers for 16 LLM families with signals from SWE-bench, Aider, and SWE-rebench |
| [model-guides/](./model-guides/) | Scored, ranked model recommendations for each of the 10 engineering teams |
| [analysis/](./analysis/) | Decision-engine analysis: model quirks inventory and quirks scoring implementation |
| [research/](./research/) | Summaries of external benchmark and model selection research articles |

## Content Inventory

### `model-families/` ÔÇö 16 dossiers

Each file covers one model family. Fields captured per model:
cost multiplier, tokens/problem, SWE-bench Verified score, Aider
polyglot pass rate, SWE-rebench rank, coding ability summary, decision
readiness, and when-to-use guidance.

Families tracked: **Anthropic Claude** ┬À **OpenAI GPT/Codex** ┬À
**Google Gemini** ┬À **Qwen** ┬À **MiniMax** ┬À **xAI Grok** ┬À **GLM** ┬À
**Kimi** ┬À **DeepSeek** ┬À **Mistral / Codestral** ┬À **Meta Llama** ┬À
**Cohere Command** ┬À **Amazon Nova** ┬À **IBM Granite** ┬À
**Cursor Composer** ┬À **Windsurf SWE**

Source quality tags used: *Fetched* ┬À *Search snippet* ┬À
*Vendor claim* ┬À *Independent benchmark*

### `model-guides/` ÔÇö 10 team guides

Each guide covers one engineering team. Fields captured per guide:
team focus area, file scope globs, handoff chain, weighting profile
(6 metrics summing to 100 %), scoring contract formula, cost evidence
method, ranked model tiers with scores, decision policy, and a new-model
intake table.

Teams covered: **Backend** ┬À **Frontend** ┬À **Data** ┬À **Infra** ┬À
**DevOps** ┬À **Testing** ┬À **Security** ┬À **Docs** ┬À **Product** ┬À
**Quality**

### `analysis/` ÔÇö 2 implementation docs

- **model-quirks-analysis.md** ÔÇö Model-specific quirk catalogue for
  Claude, GPT/Codex, Gemini, DeepSeek, Mistral/Codestral, Kimi,
  MiniMax, GLM, Llama, Grok, and Amazon Nova. Each entry lists
  strengths, known issues, and operational quirks.
- **quirks-scoring-implementation.md** ÔÇö Concrete numerical scoring
  plan for the quirks dimension in the decision engine.
  Defines per-quirk ┬▒score values and integration with the weighted
  formula.

### `research/` ÔÇö external article summaries

Summarised research supporting the benchmark data in this section.
See [research/README.md](./research/README.md) for the index.

---

## Observations and Conclusions

After analysing all files in this section, the following patterns stand out:

### Coverage is broad but evidence depth is uneven

The 16 model-family dossiers track a wide competitive landscape. However,
only a subset of models have independently verified benchmark data
(primarily Claude, OpenAI GPT/Codex, Gemini, and DeepSeek). Many entries
in the dossiers are marked *Vendor claim* or *Search snippet*,
particularly for newer entrants (Kimi, MiniMax, GLM, Amazon Nova,
IBM Granite). The scoring contracts in the team guides acknowledge this
via `Not evaluated` fields and a fallback cost-evidence policy.

### Claude Opus 4.6 and GPT-5.3 Codex dominate Tier 1 across teams

Seven of the ten team guides assign `Claude Opus 4.6` as the primary
default. `GPT-5.3 Codex High` takes primary default in Security and
Product. `Gemini 2.5 Pro` is the primary default for Frontend. This
distribution reflects Claude's strength on long-context, multi-file
reasoning (SWE-bench Verified ~81 %) and GPT Codex's token-efficiency
advantage (~0.6 M tokens/problem vs ~2 M for Claude on SWE-rebench).

### Cost coverage is the weakest dimension

The `tokens/problem` metric is missing for the majority of models. The
fallback policy (keep cost score unchanged, mark as `Not evaluated`) is
correct but means cost scores are largely inherited rather than derived.
Until tokens-per-problem data is populated from runtime telemetry,
cost comparisons between models are only indicative.

### The 10-team / 6-metric weighting framework is internally consistent

All guides use the same six metrics (code_quality, reasoning, cost,
context, speed, compatibility) with team-specific weights that reflect
logical priorities: Security upweights reasoning (30 %) and compatibility
(20 %); Frontend upweights speed for iteration; Infra and Backend
upweights context for large config files and monorepos. The framework is
ready for automated score recalculation once telemetry is connected.

### Newly tracked models need validation before promotion

Each guide contains a new-model intake table (Gemini 3 Flash, Gemini 3 Pro,
Gemini 3.1 Pro, GLM 4.7 beta, etc.) flagged as pending scorecard metrics.
These should be promoted to scored tiers only after at least one
independent benchmark point plus one runtime metric, as specified in the
model-families README.

### The quirks dimension is structurally sound but not yet wired

The quirks scoring implementation defines per-model numerical values and
integrates with the weighted formula, but the decision-engine config
does not yet reference these scores programmatically. Connecting the
quirks values to the runtime config is the most actionable near-term
improvement.

---

## Top 10 Coding Model Selections ÔÇö Team Mapping

Composite ranking derived from SWE-bench Verified scores, Aider polyglot
pass rates, SWE-rebench token efficiency, and the per-team guide Tier 1
scores in this repository (as of 2026-02). Each row lists which teams
use this model as primary or strong-alternative default.

| Rank | Model | Provider | SWE-bench Verified | Aider Polyglot | Primary for Teams | Notes |
| ---: | --- | --- | ---: | ---: | --- | --- |
| 1 | **Claude Opus 4.6** | Anthropic | ~81 % | ÔÇö | Backend, Data, DevOps, Docs, Infra, Quality, Testing | Best for deep multi-file reasoning and large context |
| 2 | **GPT-5.3 Codex High** | OpenAI | ~80 % | ~88 % (5.2 family) | Security, Product | Highest token efficiency; premium agentic coding |
| 3 | **Claude Sonnet 4.6** | Anthropic | ~80 % | ÔÇö | All teams (Tier 2) | Near-Opus quality at ~60 % cost; best value choice |
| 4 | **GPT-5.2 High Thinking** | OpenAI | ~80 % | 88 % | Backend, Frontend | Strong architecture reasoning; balanced cost |
| 5 | **Gemini 2.5 Pro** | Google | ~76 % | 83 % | Frontend (primary), Backend, Infra | 1 M context; best for large monorepos and UI |
| 6 | **SWE-Llama** | Meta / fine-tune | ÔÇö | ÔÇö | Testing, Quality, Frontend | Coding and test specialisation; open-weight option |
| 7 | **o3** | OpenAI | ÔÇö | ÔÇö | Backend, Frontend, Infra (Tier 3) | Low cost, stable output; best budget fallback |
| 8 | **DeepSeek V3.2** | DeepSeek | ~73 % | ~71 % | ÔÇö (intake) | Best open-source/self-hosted option; very low cost |
| 9 | **GLM-5** | Zhipu AI | ~78 % | ÔÇö | Backend (regional fallback) | On-prem / regulated industry; open-source |
| 10 | **MiniMax M2.5** | MiniMax | ~80 % | ÔÇö | Backend (cost-aware), APAC | Open-weight; competitive SWE-bench score |

> **Benchmark sources:** SWE-bench Verified leaderboard (Feb 2026)
> ÔÇö [swebench.com](https://www.swebench.com/); SWE-rebench token
> efficiency ÔÇö [swe-rebench.com](https://swe-rebench.com/);
> Aider polyglot pass rates ÔÇö
> [aider.chat/docs/leaderboards](https://aider.chat/docs/leaderboards/).
> See [research/](./research/) for article summaries.

---

## Related

- [Engineering Setup](../06_engineering/01_setup.md)
- [Contributing](../../CONTRIBUTING.md)
- [PRD-001: LLM Decision Engine](../01_product/PRD-001-llm-decision-engine.md)
- [PRD-002: LLM Selection Scorecard Guide](../01_product/PRD-002-llm-selection-scorecard-guide.md)
