# Platform Privacy & Security

Weighted evaluation of privacy and security characteristics for AI coding
platforms. Covers data handling, code confidentiality, compliance posture,
and control over where code is processed.

> **Last updated:** 2025-02  
> **Methodology:** Scores are 1–10 (10 = strongest privacy/security). The
> weighted total produces a normalized rating out of 100.

---

## Table of Contents

1. [Privacy & Security Metrics](#privacy--security-metrics)
2. [Data Handling Overview](#data-handling-overview)
3. [Category Matrix — AI-Native IDEs](#category-matrix--ai-native-ides)
4. [Category Matrix — IDE Extensions](#category-matrix--ide-extensions)
5. [Category Matrix — CLI Agents](#category-matrix--cli-agents)
6. [Category Matrix — Cloud / Autonomous Agents](#category-matrix--cloud--autonomous-agents)
7. [Overall Privacy Rankings](#overall-privacy-rankings)
8. [References](#references)

---

## Privacy & Security Metrics

| # | Metric | Weight | What It Measures |
|---|--------|--------|-----------------|
| 1 | **Data Residency Control** | 20% | Can you control where code is processed? On-premises, region-locked, or vendor-controlled? |
| 2 | **Code Retention Policy** | 20% | Does the vendor retain, log, or train on your code? Zero-retention vs indefinite storage |
| 3 | **Local / Air-gapped Option** | 15% | Can the tool run fully local or air-gapped? Important for classified or regulated codebases |
| 4 | **Authentication & Access** | 15% | SSO, MFA, RBAC, API key management, session controls |
| 5 | **Compliance Certifications** | 15% | SOC 2, ISO 27001, GDPR, HIPAA, FedRAMP — formal certifications held |
| 6 | **Audit & Transparency** | 15% | Audit logs, usage tracking, data flow transparency, incident disclosure |

### Why These Weights?

- **Data Residency (20%)** and **Code Retention (20%)** are highest because
  where code goes and how long it stays are the top concerns for enterprises.
- **Local Option (15%)** matters for regulated industries (defense, healthcare,
  finance) that cannot send code to third-party clouds.
- **Auth, Compliance, Audit (15% each)** are the enterprise governance pillars.

---

## Data Handling Overview

| Platform | Code Sent to Cloud | Training on Code | Zero-Retention Option | Local/Air-gapped |
|----------|--------------------|------------------|-----------------------|-----------------|
| Claude Code | ✅ Anthropic API | ❌ (opt-out by default) | ✅ Enterprise | ❌ |
| Cursor | ✅ Model provider | ❌ (Privacy Mode) | ✅ Privacy Mode | ❌ |
| Windsurf | ✅ Codeium/model | ❌ (stated policy) | ⚠️ Enterprise | ❌ |
| GitHub Copilot | ✅ GitHub/OpenAI | ❌ (Business/Enterprise) | ✅ Business tier | ❌ |
| Gemini CLI | ✅ Google API | ❌ (API terms) | ⚠️ Vertex AI | ❌ |
| OpenAI Codex | ✅ OpenAI API | ❌ (API terms) | ⚠️ Enterprise | ❌ |
| Warp | ✅ Warp/model | ❌ (stated policy) | ⚠️ Enterprise | ❌ |
| Cline | ✅ BYOK provider | Depends on provider | Depends on provider | ✅ (with local model) |
| Roo Code | ✅ BYOK provider | Depends on provider | Depends on provider | ✅ (with local model) |
| Continue | ✅ BYOK provider | Depends on provider | Depends on provider | ✅ (with local model) |
| Jules | ✅ Google Cloud | ❌ (API terms) | ❌ | ❌ |
| Amazon Q | ✅ AWS | ❌ (stated policy) | ✅ Enterprise | ❌ |
| Cody | ✅ Sourcegraph | ❌ (stated policy) | ⚠️ Self-hosted | ⚠️ (self-hosted) |
| Aider | ✅ BYOK provider | Depends on provider | Depends on provider | ✅ (with local model) |
| Amp | ✅ Sourcegraph | ❌ (stated policy) | ❌ | ❌ |
| OpenCode | ✅ BYOK provider | Depends on provider | Depends on provider | ✅ (with local model) |
| Factory | ✅ Factory cloud | ❌ (enterprise terms) | ⚠️ Enterprise | ❌ |

---

## Category Matrix — AI-Native IDEs

| Metric (Weight) | Cursor | Windsurf | Warp |
|-----------------|--------|----------|------|
| Data Residency Control (20%) | 6 | 5 | 5 |
| Code Retention Policy (20%) | 8 | 7 | 6 |
| Local / Air-gapped (15%) | 3 | 3 | 3 |
| Authentication & Access (15%) | 7 | 6 | 6 |
| Compliance Certifications (15%) | 7 | 6 | 5 |
| Audit & Transparency (15%) | 6 | 5 | 5 |
| **Weighted Score** | **63** | **55** | **51** |
| **Privacy Rating** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐½ |

### Justification — AI-Native IDEs

**Cursor (63/100)**
- Retention: 8 — Privacy Mode available; disables cloud code storage [S1]
- Compliance: 7 — SOC 2 Type II certified [S1]
- Local: 3 — Cloud-based models only; no local model support [S1]

**Windsurf (55/100)**
- Retention: 7 — No-training policy stated [S2]
- Compliance: 6 — Growing compliance program [S2]

**Warp (51/100)**
- Residency: 5 — Cloud-processed; limited control [S3]
- Compliance: 5 — Younger product; fewer certifications [S3]

---

## Category Matrix — IDE Extensions

| Metric (Weight) | Copilot | Cline | Roo Code | Continue | Cody | Amazon Q |
|-----------------|---------|-------|----------|----------|------|----------|
| Data Residency (20%) | 7 | 7 | 7 | 8 | 7 | 9 |
| Code Retention (20%) | 8 | 7 | 7 | 7 | 7 | 8 |
| Local / Air-gapped (15%) | 3 | 8 | 8 | 9 | 5 | 3 |
| Authentication (15%) | 9 | 5 | 5 | 5 | 7 | 9 |
| Compliance (15%) | 9 | 4 | 4 | 4 | 7 | 9 |
| Audit (15%) | 8 | 4 | 4 | 4 | 6 | 8 |
| **Weighted Score** | **74** | **62** | **62** | **64** | **66** | **79** |
| **Privacy Rating** | ⭐⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐⭐ |

### Justification — IDE Extensions

**Amazon Q Developer (79/100)**
- Residency: 9 — AWS region control; data stays in your AWS account [S8]
- Auth: 9 — IAM, SSO, MFA, fine-grained policies [S8]
- Compliance: 9 — SOC 2, ISO 27001, HIPAA, FedRAMP [S8]

**GitHub Copilot (74/100)**
- Retention: 8 — Business/Enterprise tiers guarantee no training on code [S4]
- Auth: 9 — GitHub SSO, org policies, seat management [S4]
- Compliance: 9 — SOC 2, ISO 27001, GDPR [S4]
- Local: 3 — No local model option [S4]

**Sourcegraph Cody (66/100)**
- Local: 5 — Self-hosted Sourcegraph enables on-premises code graph [S7]
- Compliance: 7 — SOC 2 certified [S7]

**Continue (64/100)**
- Local: 9 — Full local model support (Ollama, llama.cpp) [S9]
- Residency: 8 — BYOK with choice of provider and region [S9]
- Compliance: 4 — Open-source; no vendor compliance certifications [S9]

**Cline / Roo Code (62/100)**
- Local: 8 — Local models via Ollama or LM Studio [S5, S6]
- BYOK privacy depends entirely on chosen provider [S5, S6]

---

## Category Matrix — CLI Agents

| Metric (Weight) | Claude Code | Codex | Gemini CLI | Aider | Amp | OpenCode |
|-----------------|-------------|-------|------------|-------|-----|----------|
| Data Residency (20%) | 6 | 6 | 6 | 8 | 5 | 8 |
| Code Retention (20%) | 8 | 7 | 7 | 7 | 6 | 7 |
| Local / Air-gapped (15%) | 3 | 3 | 3 | 9 | 3 | 9 |
| Authentication (15%) | 7 | 7 | 6 | 4 | 5 | 4 |
| Compliance (15%) | 8 | 7 | 7 | 3 | 5 | 3 |
| Audit (15%) | 7 | 6 | 5 | 4 | 4 | 3 |
| **Weighted Score** | **66** | **62** | **59** | **62** | **48** | **61** |
| **Privacy Rating** | ⭐⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐½ | ⭐⭐⭐ |

### Justification — CLI Agents

**Claude Code (66/100)**
- Retention: 8 — No training by default; enterprise zero-retention [S10]
- Compliance: 8 — SOC 2 Type II, GDPR compliant [S10]
- Local: 3 — Claude models only; no local option [S10]

**Aider (62/100)**
- Local: 9 — Full local model support; can be completely air-gapped [S12]
- Residency: 8 — BYOK; choose any provider/region [S12]
- Compliance: 3 — Open-source; no vendor certifications [S12]

**OpenCode (61/100)**
- Local: 9 — Supports local models [S15]
- Compliance: 3 — Early-stage open-source [S15]

---

## Category Matrix — Cloud / Autonomous Agents

| Metric (Weight) | Jules | Factory | Codex Cloud | Copilot Agent |
|-----------------|-------|---------|-------------|---------------|
| Data Residency (20%) | 5 | 5 | 6 | 7 |
| Code Retention (20%) | 6 | 6 | 7 | 8 |
| Local / Air-gapped (15%) | 1 | 1 | 1 | 1 |
| Authentication (15%) | 6 | 7 | 7 | 9 |
| Compliance (15%) | 6 | 6 | 7 | 9 |
| Audit (15%) | 5 | 6 | 6 | 8 |
| **Weighted Score** | **49** | **52** | **57** | **69** |
| **Privacy Rating** | ⭐⭐½ | ⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐½ |

> Cloud agents inherently score lower on local/air-gapped (1) since they
> require cloud execution by design.

---

## Overall Privacy Rankings

| Rank | Platform | Score | Rating |
|------|----------|-------|--------|
| 1 | Amazon Q Developer | 79 | ⭐⭐⭐⭐ |
| 2 | GitHub Copilot | 74 | ⭐⭐⭐½ |
| 3 | Copilot Agent | 69 | ⭐⭐⭐½ |
| 4 | Claude Code | 66 | ⭐⭐⭐½ |
| 5 | Sourcegraph Cody | 66 | ⭐⭐⭐½ |
| 6 | Continue | 64 | ⭐⭐⭐ |
| 7 | Cursor IDE | 63 | ⭐⭐⭐ |
| 8 | Aider | 62 | ⭐⭐⭐ |
| 9 | Cline | 62 | ⭐⭐⭐ |
| 10 | Roo Code | 62 | ⭐⭐⭐ |
| 11 | Codex CLI | 62 | ⭐⭐⭐ |
| 12 | OpenCode | 61 | ⭐⭐⭐ |
| 13 | Gemini CLI | 59 | ⭐⭐⭐ |
| 14 | Codex Cloud | 57 | ⭐⭐⭐ |
| 15 | Windsurf IDE | 55 | ⭐⭐⭐ |
| 16 | Factory | 52 | ⭐⭐½ |
| 17 | Warp Terminal | 51 | ⭐⭐½ |
| 18 | Jules | 49 | ⭐⭐½ |
| 19 | Amp | 48 | ⭐⭐½ |

---

## References

| ID | Source | URL |
|----|--------|-----|
| S1 | Cursor Privacy & Security | https://cursor.com/privacy |
| S2 | Windsurf Privacy Policy | https://windsurf.com/privacy |
| S3 | Warp Privacy & Security | https://www.warp.dev/security |
| S4 | GitHub Copilot Trust Center | https://resources.github.com/copilot-trust-center/ |
| S5 | Cline Privacy | https://docs.cline.bot/ |
| S6 | Roo Code Privacy | https://docs.roocode.com/ |
| S7 | Sourcegraph Security | https://sourcegraph.com/security |
| S8 | Amazon Q Security & Compliance | https://aws.amazon.com/q/developer/security/ |
| S9 | Continue Privacy | https://docs.continue.dev/ |
| S10 | Anthropic Security | https://www.anthropic.com/security |
| S11 | OpenAI Security | https://openai.com/security |
| S12 | Aider Privacy (BYOK) | https://aider.chat/docs/config.html |
| S13 | Google Gemini Privacy | https://ai.google.dev/terms |
| S14 | Amp / Sourcegraph Security | https://sourcegraph.com/security |
| S15 | OpenCode (open-source) | https://github.com/opencode-ai/opencode |

---

## See Also

- [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) — Coding ability evaluation
- [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) — Cost and pricing evaluation
- [PLATFORM_CONSOLIDATED_RATING.md](./PLATFORM_CONSOLIDATED_RATING.md) — Combined final rankings
