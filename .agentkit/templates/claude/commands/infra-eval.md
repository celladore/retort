---
description: "Risk-aware infrastructure and codebase evaluation against reliability, cost, and scale"
allowed-tools: Read, Glob, Grep, Bash, WebSearch, WebFetch
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# /infra-eval — Infrastructure & Codebase Fitness Evaluation

{{#unless hasInfraEval}}
> **This command is not enabled.** To enable infrastructure evaluation, set `evaluation.infraEval: true` in your project's `.agentkit/spec/project.yaml`, then run `pnpm -C .agentkit agentkit:sync` to regenerate.

Stop here. Do not proceed with the evaluation.
{{/unless}}

{{#if hasInfraEval}}
You are an expert infrastructure architect and reliability engineer performing a **risk-aware evaluation** of **{{projectName}}** against reliability, cost, and scale fitness.

{{#if projectDescription}}
**Project:** {{projectDescription}}
{{/if}}

## Purpose

Provide a repeatable, risk-aware evaluation of the project's infrastructure and codebase against reliability, cost, and scale — in context of the project's phase (`{{projectPhase}}`), stack, and operational maturity.

---

## 1. Evaluation Rules (Read This First)

- Scores are **0–5**, not 1–10
- **Evidence is mandatory** for scores ≥3
- **Hard gates override totals** (a single red gate = overall FAIL)
- This evaluates **fitness for purpose**, not code aesthetics

### Scoring Scale

| Score | Meaning |
|-------|---------|
| 0 | Missing / dangerous |
| 1 | Exists but fragile or ad-hoc |
| 2 | Basic, manual, partially reliable |
| 3 | Solid, standardized, mostly reliable |
| 4 | Strong, automated, routinely validated |
| 5 | Proven, boring, battle-tested |

---

## 2. Hard Gates (Non-Negotiable)

If **any** gate fails → Overall Status = **FAIL**, regardless of score.

| Gate | Condition |
|------|-----------|
| G1 | No tested backup restore for critical data |
| G2 | No cost attribution or explanation for last billing cycle |
| G3 | No content moderation audit trail (if AI or user-generated content is present) |
| G4 | No rollback strategy for production deployments |
| G5 | Identity/role boundaries not technically enforced (if multi-role system) |

{{#if evalCustomGates}}
### Project-Specific Custom Gates

The following additional hard gates are configured for this project:

{{evalCustomGates}}
{{/if}}

> **Evaluator note:** Gate G3 applies only if AI-generated or user-generated content exists. Gate G5 applies only if the system has distinct user roles. Mark gates as N/A with justification if they don't apply.

---

## 3. Weighted Evaluation Dimensions

### A. Reliability & Resilience (User Journeys) — {{#if evalWeightReliability}}{{evalWeightReliability}}{{else}}18{{/if}}%

Focus: critical user journeys, fault tolerance, backup discipline.

| Criteria | Notes / Evidence |
|----------|-----------------|
| Defined critical user journeys | |
| Graceful degradation modes | |
| Multi-AZ / fault tolerance | |
| Backup + restore testing | |
| Dependency failure handling (AI, storage, auth) | |

{{#if hasMonitoring}}
**Known monitoring:** {{monitoringProvider}}
{{/if}}
{{#if hasDr}}
**DR config:** RPO={{drRpoHours}}h, RTO={{drRtoHours}}h, Backup={{drBackupSchedule}}
{{/if}}

### B. Cost Efficiency & Unit Economics — {{#if evalWeightCost}}{{evalWeightCost}}{{else}}16{{/if}}%

Focus: survival under growth.

| Criteria | Notes / Evidence |
|----------|-----------------|
| Cost attribution (per service / namespace / env) | |
| Unit cost visibility (per core operation) | |
| Autoscaling & right-sizing discipline | |
| AI usage controls & caching | |
| Cost alerts / budgets / kill-switches | |

{{#if cloudProvider}}
**Cloud provider:** {{cloudProvider}}
{{/if}}

### C. Security, Privacy & Compliance — {{#if evalWeightSecurity}}{{evalWeightSecurity}}{{else}}14{{/if}}%

Focus: trust, compliance readiness, reputational risk.

| Criteria | Notes / Evidence |
|----------|-----------------|
| Identity separation (role boundaries) | |
| Consent & data minimization | |
| Secrets management | |
| Content moderation pipeline (if applicable) | |
| Auditability of content & decisions | |

{{#if hasAuth}}
**Auth:** {{authProvider}} ({{authStrategy}}){{#if hasRbac}}, RBAC enabled{{/if}}
{{/if}}
{{#if hasCompliance}}
**Compliance framework:** {{complianceFramework}}
{{/if}}

### D. Infrastructure & Delivery Safety — {{#if evalWeightInfra}}{{evalWeightInfra}}{{else}}12{{/if}}%

| Criteria | Notes / Evidence |
|----------|-----------------|
| IaC state isolation & hygiene | |
| Environment parity | |
| Deployment strategy (blue/green, canary, rollback) | |
| Database migration safety | |
| IaC review & plan discipline | |

{{#if hasAnyInfraConfig}}
**IaC toolchain:** {{infraIacToolchain}}
{{#if infraStateBackend}}**State backend:** {{infraStateBackend}}{{/if}}
{{/if}}
{{#if hasDbMigrations}}
**DB migrations:** {{dbMigrations}}
{{/if}}

### E. Scalability Path (10×–50×) — {{#if evalWeightScale}}{{evalWeightScale}}{{else}}12{{/if}}%

Focus: ceilings, not benchmarks.

| Criteria | Notes / Evidence |
|----------|-----------------|
| Identified first bottlenecks | |
| Async vs sync boundaries | |
| Stateless scaling where possible | |
| CDN & asset delivery strategy | |
| AI throughput constraints understood | |

{{#if architecturePattern}}
**Architecture:** {{architecturePattern}}
{{/if}}
{{#if hasContainerized}}
**Containerized:** yes
{{/if}}

### F. Architecture Quality — {{#if evalWeightArch}}{{evalWeightArch}}{{else}}10{{/if}}%

Focus: ability to evolve without rewrites.

| Criteria | Notes / Evidence |
|----------|-----------------|
| Clear domain boundaries | |
| Dependency direction discipline | |
| Replaceability of major components | |
| Avoidance of premature over-abstraction | |

### G. Code Quality — {{#if evalWeightCode}}{{evalWeightCode}}{{else}}10{{/if}}%

Focus: refactorability, not perfection.

| Criteria | Notes / Evidence |
|----------|-----------------|
| Readability & consistency | |
| Complexity hotspots identified | |
| Meaningful test coverage | |
| Tech debt visibility | |

{{#if testingCoverage}}
**Coverage target:** {{testingCoverage}}%
{{/if}}
{{#if hasStaticAnalysis}}
**Static analysis:** {{testingStaticAnalysis}}
{{/if}}

### H. Operational Maturity & Observability — {{#if evalWeightOps}}{{evalWeightOps}}{{else}}8{{/if}}%

Focus: small-team survivability.

| Criteria | Notes / Evidence |
|----------|-----------------|
| End-to-end tracing (frontend → API → worker) | |
| Pipeline-level visibility | |
| Alert quality (signal > noise) | |
| Incident readiness (runbooks) | |

{{#if hasAnyMonitoring}}
**Monitoring:** {{monitoringProvider}}{{#if hasAlerting}}, Alerting: {{alertingProvider}}{{/if}}{{#if hasTracing}}, Tracing: {{tracingProvider}}{{/if}}
{{/if}}

---

## 4. Score Summary

Fill this table after completing all dimension assessments:

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Reliability & Resilience | {{#if evalWeightReliability}}{{evalWeightReliability}}{{else}}18{{/if}}% | | |
| Cost Efficiency | {{#if evalWeightCost}}{{evalWeightCost}}{{else}}16{{/if}}% | | |
| Security & Compliance | {{#if evalWeightSecurity}}{{evalWeightSecurity}}{{else}}14{{/if}}% | | |
| Infra & Delivery Safety | {{#if evalWeightInfra}}{{evalWeightInfra}}{{else}}12{{/if}}% | | |
| Scalability Path | {{#if evalWeightScale}}{{evalWeightScale}}{{else}}12{{/if}}% | | |
| Architecture Quality | {{#if evalWeightArch}}{{evalWeightArch}}{{else}}10{{/if}}% | | |
| Code Quality | {{#if evalWeightCode}}{{evalWeightCode}}{{else}}10{{/if}}% | | |
| Operational Maturity | {{#if evalWeightOps}}{{evalWeightOps}}{{else}}8{{/if}}% | | |
| **TOTAL** | **100%** | | **/100** |

---

## 5. Required Narrative Sections (Do Not Skip)

### A. Scale Ceiling Narrative

What breaks first at 10×? At 50×? Map to specific components, services, or data paths.

### B. Top 5 Risk Drivers

Ranked by **impact × likelihood**, not effort. Each risk must reference specific evidence found during evaluation.

### C. Top 5 Fixes by ROI

Effort vs risk reduction. Each fix should map to one or more evaluation dimensions.

---

## 6. Interpretation Guide

| Score | Meaning |
|-------|---------|
| <50 | Unsafe, fragile |
| 50–65 | High risk, needs focus |
| 65–75 | Healthy startup platform |
| 75–85 | Strong, approaching scale readiness |
| >85 | Likely over-engineered (verify honesty) |

---

## 7. How This Artifact Should Be Used

- Quarterly reassessment
- Before major funding rounds
- Before major architectural bets
- To compare options, not egos

---

## Evaluation Process

1. **Scan the codebase** using Glob, Grep, and Read to gather evidence for each dimension
2. **Check infrastructure configs** — Terraform/IaC files, CI/CD pipelines, Docker configs, K8s manifests
3. **Review deployment configs** — rollback strategies, environment separation, secrets management
4. **Assess observability** — logging, monitoring, alerting, tracing setup
5. **Evaluate hard gates first** — if any fail, report FAIL immediately with remediation guidance
6. **Score each dimension** with evidence citations (file paths, line numbers)
7. **Produce the summary table** and narrative sections
8. **Output the completed evaluation** to `docs/evaluations/infra-eval-<date>.md`

---

## Shared State (read before evaluation, write after)

- **Read:** `AGENT_BACKLOG.md`, `.claude/state/orchestrator.json`
- **Append to:** `.claude/state/events.log` — atomic, newline-terminated JSON entries only.
  - **Schema:** `{"timestamp":"<RFC3339>","event_type":"infra_eval_completed","data":{"overall_score":<number>,"hard_gates_passed":<boolean>,"dimension_scores":{...}}}`

## Output Format

Emit two required outputs:

1. **stdout (minimal):** Single-line JSON:
```json
{"action":"infra_eval_completed","phase":"evaluation","overall_score":72,"hard_gates_passed":true,"dimension_scores":{"reliability":3,"cost":4,"security":3,"infra":3,"scalability":3,"architecture":4,"code":4,"ops":3}}
```

2. **events.log (envelope):** Append full JSON envelope with metadata per standard schema.
{{/if}}
