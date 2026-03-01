# SWE-bench Verified Leaderboard — February 2026

**Summary date:** 2026-02-28
**Source quality:** Search snippet + independent benchmark operator
**Primary sources:**

- SWE-bench leaderboard — <https://www.swebench.com/>
- SWE-Bench Leaderboard February 2026 — <https://www.marc0.dev/en/leaderboard>
- Simon Willison's SWE-bench Feb 2026 update — <https://simonwillison.net/2026/Feb/19/swe-bench/>
- Vals.ai SWE-bench tracker — <https://www.vals.ai/benchmarks/swebench>

> **Access note:** Direct page fetch was blocked from this environment.
> Content is reconstructed from search result snippets and secondary
> aggregator pages (marc0.dev, vals.ai).

---

## What SWE-bench Verified measures

SWE-bench Verified is a curated subset of the original SWE-bench dataset
(real GitHub issues with automated test suites). A model passes a problem
if its generated patch causes all associated tests to pass. *Verified*
means the test suite is confirmed to be correct and non-trivially
solvable, removing noisy or under-specified issues from the original set.

The benchmark is widely regarded as the most credible public measure of
code-repair capability because:

- Issues come from real-world open-source Python repositories.
- Evaluation is automated and reproducible with a unified harness.
- Results cannot be gamed by simple memorisation — problems require
  understanding test failures and generating working diffs.

---

## Top 15 results (February 2026)

| Rank | Model | Provider | Verified Score |
| ---: | --- | --- | ---: |
| 1 | Claude Opus 4.5 | Anthropic | 80.9 % |
| 2 | Claude Opus 4.6 | Anthropic | 80.8 % |
| 3 | MiniMax M2.5 | MiniMax | 80.2 % |
| 4 | GPT-5.2 | OpenAI | 80.0 % |
| 5 | Gemini 3 Flash | Google | 78.0 % |
| 6 | GLM-5 | Zhipu AI | 77.8 % |
| 7 | Claude Sonnet 4.5 | Anthropic | 77.2 % |
| 8 | Kimi K2.5 | Moonshot AI | 76.8 % |
| 9 | Gemini 3 Pro | Google | 76.2 % |
| 10 | GPT-5.1 | OpenAI | 74.9 % |
| 11–12 | Qwen3-Coder-Next, Grok 4 | Alibaba, xAI | ~74 % |
| 13 | DeepSeek V3.2 | DeepSeek | 73.0 % |
| 14–15 | GPT-OSS 120B, others | OpenAI OSS | ~71 % |

---

## Key observations from this benchmark cycle

**Anthropic maintains the top two slots.** Claude Opus 4.5 and 4.6 are
essentially tied. The gap between #1 and #4 (GPT-5.2) is only
~0.9 percentage points — statistically narrow. All four top models are
considered equivalent for most practical purposes.

**Open-weight models are rapidly closing the gap.** MiniMax M2.5 (#3 at
80.2 %) is an open-weight model, demonstrating that the performance gap
between open and closed models has collapsed at the very top of the
leaderboard. GLM-5 (#6 at 77.8 %) and Kimi K2.5 (#8 at 76.8 %) further
reinforce this trend.

**Google Gemini 3 Flash outperforms Gemini 3 Pro** (#5 vs #9). This
counter-intuitive result is consistent with prior benchmark cycles where
Flash variants' tighter focus on coding tasks outperforms the larger but
more general Pro variants.

**DeepSeek V3.2 remains the best open-source self-hostable option** at
73.0 %, but trails the open-weight (API-accessed) models above it.

**Benchmark harness matters.** Results can vary materially depending on
agent scaffold (SWE-agent, Moatless, OpenHands, etc.). The leaderboard
numbers above are for the published scaffold reported by each team;
internal AgentKit evaluations using a custom scaffold may differ.

---

## Implications for AgentKit Forge model guides

- The Tier 1 choices in the team guides (Claude Opus 4.6, GPT-5.3 Codex
  High) are consistent with this leaderboard.
- MiniMax M2.5 warrants promotion from *intake* to a scored Tier 2 slot
  in the Backend and Cost-Aware guide sections, pending tokens/problem
  data.
- GLM-5 and Kimi K2.5 should be tracked in the model-families dossiers
  with independent benchmark quality tags.
- DeepSeek V3.2 remains the recommended self-hosted fallback for
  cost-constrained or air-gapped deployments.
