# Aider Polyglot Leaderboard — 2025 Results

**Summary date:** 2026-02-28
**Source quality:** Independent benchmark (fetched via search aggregation)
**Primary sources:**

- Official Aider LLM Leaderboards — <https://aider.chat/docs/leaderboards/>
- Aider Polyglot — LLMdb.com — <https://llmdb.com/benchmarks/aider-polyglot>
- Aider-Polyglot — ai-stats.phaseo.app — <https://ai-stats.phaseo.app/benchmarks/aider-polyglot>
- Epoch.ai Aider Polyglot tracker — <https://epoch.ai/benchmarks/aider-polyglot>
- Simon Willison on Claude 3.7 Sonnet polyglot results — <https://simonwillison.net/2025/Feb/25/aider-polyglot-leaderboard/>

> **Access note:** Direct page fetch for aider.chat was blocked.
> Data below is from search snippet content and secondary aggregators
> that mirror the leaderboard.

---

## What the Aider Polyglot benchmark measures

The Aider polyglot leaderboard benchmarks LLMs on **code editing across
multiple programming languages**. Key design decisions:

- **Problems:** 225 of the hardest Exercism problems, selected to avoid
  score saturation seen on Python-only benchmarks.
- **Languages:** C++, Go, Java, JavaScript, Python, Rust.
- **Attempts:** Each model gets 2 attempts. After a failed first attempt
  it receives unit test output and can retry — measuring both initial
  solve rate and iterative-correction ability.
- **Pass rate:** Percentage of problems where all tests pass after two
  attempts.
- **Cost reported:** Total inference cost for running the full benchmark
  suite, enabling cost-efficiency comparison.

The benchmark was calibrated so top models score between 50 % and 90 %,
maintaining gradation among advanced models.

---

## Top results (2025)

| Rank | Model | Provider | Pass Rate |
| ---: | --- | --- | ---: |
| 1 | GPT-5 (high reasoning) | OpenAI | 88.0 % |
| 2 | GPT-5 (medium) | OpenAI | 86.7 % |
| 3 | o3-pro (high) | OpenAI | 84.9 % |
| 4 | Gemini 2.5 Pro | Google | 83.1 % |
| 5 | Claude 3.7 Sonnet (32k thinking) | Anthropic | 64.9 % |
| 6 | Claude 3.7 Sonnet (plain) | Anthropic | 60.4 % |
| — | DeepSeek-R1 | DeepSeek | ~71 % |

> **Note on Refact.ai:** Refact.ai Agent reported 93.3 % on the Aider
> polyglot benchmark using a fully autonomous IDE-integrated workflow
> (plan → code → test loop without human intervention). This is higher
> than standard Aider leaderboard entries, likely due to the agentic
> scaffold rather than raw model capability. Source:
> <https://refact.ai/blog/2025/refact-ai-agent-achieves-93-3-on-aider-polyglot-benchmark/>

---

## Key observations

**OpenAI GPT-5 leads by a wide margin.** GPT-5 (high) at 88 % is ~5 pp
ahead of Gemini 2.5 Pro and ~23 pp ahead of Claude 3.7 Sonnet in plain
mode. This is a stronger OpenAI lead than seen on SWE-bench Verified,
suggesting GPT-5 is particularly well-optimised for multi-language code
editing workflows.

**Gemini 2.5 Pro is a strong second-tier option.** At 83.1 % it is
competitive with GPT-5 family models and well ahead of Claude on this
benchmark.

**Claude 3.7 Sonnet scores much lower here than on SWE-bench.** The
64.9 % with extended thinking tokens (and 60.4 % plain) contrasts with
the SWE-bench Verified ~77–80 % range for the Claude 4.x family. This
suggests Claude's strength is more in repository-level reasoning than in
isolated polyglot code-edit tasks.

**Thinking tokens matter substantially for Claude.** The gap between
plain (60.4 %) and 32k thinking-token mode (64.9 %) is ~4.5 pp —
a meaningful uplift, but Claude still trails GPT-5 on this benchmark.

**Agentic scaffolding inflates scores.** The Refact.ai 93.3 % result
highlights that the *workflow* (plan, code, test, iterate) is often more
important than the underlying model. This is consistent with the
AgentKit Forge design principle of optimising the agent harness alongside
model selection.

---

## Cost-efficiency observations

The Aider leaderboard also reports total inference cost per benchmark run.
Key data points available in the dossiers:

- GPT-5.2 Codex (high config): $29.08 for 225 problems → ~$0.13/problem
- o3 (high): ~$23.10 for 225 problems → ~$0.10/problem
- Codex is cited by SWE-rebench as notably token-efficient
  (~579 K tokens/problem vs ~2 M for Claude Opus)

---

## Implications for AgentKit Forge model guides

- GPT-5.2 / 5.3 Codex High justifies its Tier 1 placement in Backend
  and Security guides despite a weaker long-context story — it wins on
  raw code-edit speed and cost per problem.
- Gemini 2.5 Pro's Frontend Tier 1 primary default is well-supported by
  its strong polyglot pass rate.
- Claude Opus 4.x should remain primary where multi-file reasoning and
  large context are needed, but should not be assumed best for all coding
  scenarios — GPT-5 family and Gemini are stronger on narrow code-edit tasks.
- The agentic scaffold (how AgentKit Forge chains tool calls) may have
  more impact on end-to-end results than the ±5 % differences between
  top-tier models.
