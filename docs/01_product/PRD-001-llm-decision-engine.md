# PRD-001: AgentKit Forge LLM Decision Engine

## Status

Draft

## Module / Feature Name

Multi-LLM Agent Model Optimization and Routing in AgentKit Forge

## Marketing Name

AgentKit Forge LLM Decision Engine

## Platform / Mesh Layers

- Forge core orchestration layer (config and app mesh)
- Agent routing layer (agent and team to model mapping)
- AI provider integrations (OpenAI, Anthropic, Google, OSS)
- Cross-platform execution (API, CLI, overlays)

## Primary Personas

- DevOps Engineers
- Infrastructure and Platform Engineers
- Team Leads for code and test automation
- Product Engineers
- Core contributors and OSS adopters

## Core Value Proposition

Deliver optimal model selection per coding agent and team using a
configurable, metrics-driven engine that improves code quality,
productivity, and developer experience with minimal config overhead.

## Priority

P0 (Critical)

## License Tier

- Free: core routing and config matching logic
- Enterprise (future): custom mapping controls and audit extensions

## Readiness

Draft, prepared for review before spec and implementation.

## TL;DR

Build a developer-friendly decision engine that picks the best coding LLM
per agent or team using a configurable weighted matrix and an updatable
knowledge base (scorecards, quirks, features, rationale).

## Problem Statement

LLM options and versions are expanding quickly, each with different
trade-offs in quality, context length, speed, cost, and integration
behavior. Manual per-agent model selection is error-prone and does not
scale.

Without a reliable, updatable mapping system, teams suffer from:

- suboptimal output quality,
- wasted spend,
- configuration drift, and
- lower productivity.

## Core Challenge

Make model selection effortless and accurate for developers by matching
agents to the best-fit LLM for their stack and task while balancing:

- quality,
- cost,
- speed,
- reasoning depth,
- context window,
- compatibility and risk.

## Current State

- Teams hard-code model choices in config files.
- Newest or most popular models are chosen by default.
- Config surfaces fragment over time as tools expand.
- There is no central, trusted model knowledge base.

## Why Now

Model capability and pricing change rapidly. Automated selection is now a
competitive advantage for team productivity, governance, and cost control.

## Goals and Objectives

### Business Goals

- Streamline model routing and mapping for teams.
- Increase AgentKit Forge adoption.
- Improve output quality and delivery speed.
- Establish Forge as a mesh-native source of truth for model selection.

### User Goals

- Use best-fit models per agent with low manual overhead.
- Keep mappings up to date and avoid drift.
- Understand why each model was chosen.

### Non-Goals (Out of Scope)

- Universal LLM marketplace or benchmark hub.
- Full non-coding model ranking in v1.

## Measurable Objectives

| Objective                 | Baseline                    | Target                                                          | Measurement method and scope                                                         | Owner                      | Target date |
| ------------------------- | --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- | ----------- |
| Model-agent optimality    | 0% QA-validated assignments | >=90% of active agents have a QA-accepted model assignment      | Weekly audit of `agent->model` mappings for all active agents in `.agentkit/spec`    | Product Lead + QA Lead     | 2026-05-15  |
| Config update frequency   | 2 updates/month aggregate   | >=3 updates/month aggregate (rolling 30-day window)             | Count merged mapping updates in `.agentkit/spec` and runtime mapping changelog       | Platform Lead              | 2026-06-01  |
| Code quality (lint/tests) | 75% pass rate, 40% coverage | >=85% lint/test pass rate and >=50% coverage for mapping module | CI reports for `llm map` and scorecard modules; measured weekly and reported monthly | Engineering Lead + QA Lead | 2026-06-30  |

Metric legend:

- **GA milestone:** v1 GA date = `2026-05-01`.
- **Mapped:** an agent mapping that passed schema validation and QA acceptance.
- **v1:** scorecards + static mapping release scope in Timeline and Milestones.

## Stakeholders

- Product Owner: Jurie
- Forge engineering team
- LLM integration leads
- DevOps and QA leads
- Early adopter maintainers

## User Personas and Stories

### DevOps Engineer

As a DevOps engineer, I want Forge to recommend and update models for
every coding agent, so pipelines use best-fit models with minimal manual
work.

Acceptance criteria:

- Config proposes a model per agent from stack and team metrics.
- Changes are trackable and reversible.

### Team Lead

As a team lead, I want to prioritize cost for regression suites and quality
for code review agents, with visible rationale.

Acceptance criteria:

- I can tune scoring weights per team and use case.
- The selected model includes a transparent rationale.

### Product Engineer

As a developer, I want confidence in what model an agent uses and why.

Acceptance criteria:

- Docs are clear and actionable.
- Config is editable and safe to change.
- Gotchas and warnings are visible.

## Use Cases and Core Flows

### Primary Use Cases

- Default mapping on initial setup.
- Custom weighting by quality, cost, speed, and context.
- Seamless model switch during outages or upgrades.
- Scorecard review before accepting changes.
- Mapping audit and rollback.

### Core Flow

1. User runs `agentkit init`.
2. Forge detects stack, agents, and available models.
3. Forge proposes mappings with rationale and warnings.
4. User accepts or edits metric weights.
5. Mapping is committed in `.agentkit/spec`.
6. Runtime hooks route tasks by mapping.
7. Changes are auditable via overlay and git diff.

### Edge Cases

- Model unavailable: route to next best compatible model.
- Performance degradation: alert and recommend failover.
- New agents detected: propose default mapping.
- Fast model version churn: mark mappings stale for review.
- Missing data: show uncertainty and allow explicit override.

## Functional Requirements

- Maintain scorecards for supported coding models.
- Weighted decision matrix with configurable metric priorities.
- YAML or JSON mapping config for agent to model assignment.
- CLI support for map and scorecard workflows.
- Knowledge base support for features, quirks, and rationale.
- Audit trail for mapping decisions and model switches.

### Audit Trail Requirements (Mapping and Model Switches)

- **Storage mechanism options:** append-only audit database, immutable object
  store, or git-backed file history.
- **Chosen default (v1):** append-only audit table with write-once records,
  replicated nightly to immutable object storage for tamper-evident retention.
- **Mutability rules:** records are immutable; only annotated follow-up entries
  are allowed (no in-place edits/deletes).
- **Write provenance:** every write stores actor reference, source command/API,
  request ID, and signature/hash chain pointer.
- **Access controls:** RBAC enforced.
  - Read: Product Lead, Platform Lead, Security Lead, Compliance Analyst.
  - Write: Orchestrator service and authorized admins only.
  - Annotate/revoke: Security Lead + Platform Lead (dual approval).
- **PII handling:** no raw usernames in audit records; store pseudonymous
  `actor_ref` values only (hashed/indirect identifiers).

### Scoring Inputs (Default Weights)

- Code generation quality: 5
- Reasoning ability: 4
- Context window: 3
- Cost per 1k tokens: 3
- Speed and throughput: 2
- Compatibility, lock-in, quirks: 1 each

## Non-Functional Requirements

- Config load and reload under 1 second.
- Support 50+ agents per project.
- Safe edit controls for mapping changes.
- Non-blocking fallback if data feeds fail.
- Full change history with rationale, export support, and tamper evidence.

### Full Change History and Governance Requirements

- **Retention policy:**
  - Hot retention: 13 months queryable.
  - Archive retention: 36 months immutable archive.
  - Auto-purge: archive records older than retention unless legal hold applies.
  - GDPR/CCPA deletion requests: apply subject-key tombstoning and remove
    reversible identity links while retaining non-PII compliance evidence.
- **Query and export:** search/filter by `actor_ref`, model, timestamp,
  change-type, and team; support paginated UI plus CSV/JSON exports.
- **Role-filtered views:** exports and dashboards must apply RBAC filtering.
- **Compliance checklist linkage:** privacy controls in this section and
  `Telemetry Privacy` are required before v1 release sign-off.

## Mesh Layer Mapping

| Forge Layer            | Role                               |
| ---------------------- | ---------------------------------- |
| Config Mapping Layer   | Stores and loads agent-model specs |
| Orchestration Layer    | Routes tasks by mapping at runtime |
| Docs and Overlay Layer | Surfaces scorecards and warnings   |

## APIs and Integrations

### Required APIs

- Internal config API for reading and writing mapping files.
- CLI commands for mapping and scorecards.
- Model metadata endpoints for latest capability and cost data.
- Detailed contracts: `docs/02_specs/PRD-004-technical-api-contracts.md`

### External Dependencies

- LLM providers (OpenAI, Anthropic, Google, OSS)
- Benchmark or scoring data feeds
- Code quality analysis plugins
- Auth and rate-limit middleware for provider integration clients

## Data Model Example

```yaml
agents:
  - name: codebot
    llm: claude-3-5-sonnet  # Replace with current recommended Anthropic model at deployment time
    rationale: Best for code generation and large context tasks.
    weights:
      quality: 5
      reasoning: 4
      cost: 3
      speed: 2
      context: 3
      compatibility: 1
      lock_in: 1
      quirks: 1
    audit_trail:
      - version: v1.2
        changed_by_ref: usr_7f3c9a2e (pseudonymous actor reference)
        date: 2026-03-03
```

> **Note:** The `llm` value is illustrative. Configure the current recommended model from your provider at deployment/configuration time.

## UX and Entry Points

- CLI: `agentkit init`, `agentkit llm map`, `agentkit llm scorecard`
- Documentation: `docs/LLMs.md` and PRD references
- Overlay and UI support planned in v2+

## Accessibility

- Plaintext-first documentation output
- Colorblind-friendly scorecard tables
- WCAG 2.1 AA alignment where applicable

## Success Metrics

### Leading Indicators

- Default proposal acceptance rate
- Custom mapping frequency
- Time to first optimal mapping

### Lagging Indicators

- Lint and test quality improvements
- Average model cost per task
- Developer satisfaction and NPS
- Reduction in config-related support tickets

## Measurement Plan

- CLI event logs and mapping commit stats
- Quality and cost telemetry via plugins
- Dashboards for adoption, drift, and issue trends
- Review cadence: biweekly and quarterly

### Telemetry Privacy

Collected telemetry (v1 scope):

- `actor_ref` (pseudonymous identifier, never raw username)
- timestamp (UTC)
- event type (`mapping_created`, `mapping_updated`, `fallback_triggered`, etc.)
- model ID before/after change
- team/agent identifiers
- request ID / command source

Privacy and compliance controls:

- **Consent:** explicit opt-in text in setup flow; consent event logged with
  timestamp and policy version.
- **Anonymization/pseudonymization:** user identity stored as one-way hashed reference. Compute `actor_ref` using a keyed hash or KDF (e.g., HMAC-SHA256 with a stored global salt/pepper, or preferably per-user salt + HMAC/PBKDF2/Argon2) rather than raw SHA256(username). Per-user salt prevents dictionary/rainbow attacks. Salts/pepper and HMAC keys: store in KMS or secure secrets store with rotation policy. **Deletion workflow:** hash incoming username with the same salt/key to find `actor_ref`, then tombstone matching records. No reversible lookup table is needed.
- **Retention/deletion:** apply retention policy from Non-Functional
  requirements; support GDPR/CCPA deletion request workflow via actor-key
  unlinking + tombstone record.
- **Access control:** RBAC-restricted telemetry access with audit logging.
- **Legal review:** Product Lead + Legal must sign off before v1 release.

This section is normative for GDPR/CCPA handling and supersedes placeholders.
Open Questions tracks the legal sign-off gate only.

## Timeline and Milestones

Project start date: **2026-03-03**

> **Note:** All milestone dates below are absolute and derived from the project start date.

| Phase               | Scope                                                                                                               | Target                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| v1 feature-complete | Scorecards, static config, docs                                                                                     | 2026-03-31            |
| v1 GA               | Scorecards, static config, docs (audit trails, RBAC, compliance controls, GDPR/CCPA workflows deferred to post-v1) | 2026-05-01            |
| v2                  | Dynamic mapping, feedback loop, optional UI                                                                         | 2026-06-15            |
| v3+                 | Marketplace and expanded benchmarks                                                                                 | Target month: 2026-11 |

> **Note:** Scorecard automation and non-blocking compliance integrations (e.g., third-party audit feeds) remain backlog items for post-v1 GA.

## Constraints and Dependencies

### Technical Constraints

- API rate limits and provider availability
- YAML and JSON parser reliability
- Token and context behavior variability
- Data caching and refresh behavior

### Business Constraints

- FOSS core must remain viable
- Zero-config onboarding must remain available
- Benchmark update budget required

## Risks and Mitigations

| Risk                      | Impact | Likelihood | Mitigation                            |
| ------------------------- | ------ | ---------- | ------------------------------------- |
| LLM churn and instability | Medium | High       | Automated scorecard refresh loops     |
| Stale metrics             | High   | Medium     | Scheduled review and manual override  |
| Team weight misalignment  | Medium | Medium     | Editable weights and rationale docs   |
| Vendor lock-in            | High   | Low        | Polyglot support and fallback routing |

## Open Questions

| Question                                                                                       | Status                              | Owner(s)                    | Target Resolution                            | Acceptance Criteria                                                                                       | Impact if Unresolved           |
| ---------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------ |
| How should scorecards auto-refresh?                                                            | Resolved (v1)                       | Platform Lead               | 2026-03-14 (before v1 architecture freeze)   | CI scheduled job + manual override command; automation owner: Platform Lead; manual override path via CLI | Lower trust in recommendations |
| Are stack-specific biases material?                                                            | Blocked pending question resolution | Engineering Lead, QA Lead   | 2026-03-21 (v1 assessment gate)              | v1 stack-bias assessment completed with mitigations and published assumptions                             | Suboptimal model choices       |
| How will telemetry handle consent, anonymisation, retention, and legal compliance (GDPR/CCPA)? | Blocked pending legal sign-off      | Product Lead, Legal Counsel | Before v1 release (no later than 2026-03-28) | Legal sign-off recorded for Telemetry Privacy policy and deletion-request workflow                        | Legal risk, user trust issues  |

## Appendix

### Competitive Positioning

| Product                  | Centralized Mapping | Coding Scorecards | Drift Detection | Gotcha Docs |
| ------------------------ | ------------------- | ----------------- | --------------- | ----------- |
| AgentKit Forge           | Yes                 | Yes               | Planned         | Yes         |
| LangChain                | No                  | Partial           | No              | No          |
| OSS Agent Bundles        | No                  | No                | No              | No          |
| Enterprise RAG Platforms | Yes                 | Partial           | Yes             | Partial     |

### Scorecard Refresh and Lifecycle Policy (v1)

- **Minimum refresh frequency:** weekly scheduled refresh (every Monday 08:00
  UTC) plus on-demand refresh after major provider release notes.
- **Authoritative sources:**
  - Independent benchmarks (SWE-bench, Aider, SWE-rebench where available)
  - Vendor release notes and model cards
  - Internal CI telemetry (pass rate, latency, cost-per-success)
- **Source registry:** capture sources and fetch timestamp in
  `docs/08_reference/model-families/*.md` and scorecard ingestion logs.
- **New model onboarding process:**
  1. Intake request by Platform Lead.
  2. Required benchmark set executed (SWE-bench slice, Aider subset, latency and cost run).
  3. Metadata fields completed: provider, model ID, context, pricing, tool support,
     reliability confidence, source quality.
  4. QA + Product approval before ranking inclusion.
- **Deprecation workflow:**
  - Mark model as deprecated when provider EOL, repeated reliability failure, or
    security/compliance concern is confirmed.
  - Publish deprecation notice in scorecard and model guide release notes.
  - Move deprecated models to archive section in next refresh cycle.
- **Auto-refresh implementation (resolved for v1):** CI scheduled job + manual
  override command. v1 owner: Platform Lead. v1->v2 evolution owner: Product Lead.

### Example Coding Scorecard Snapshot

> **Last Updated:** February 2026 — verify current model capabilities before deployment. ⚠️ **Warning:** Model capabilities evolve rapidly. This table shows illustrative scoring patterns; live data is maintained in the model family dossiers and team guides. See the "Rapidly Changing Model Capabilities" and "Model Capability Verification" sections for guidance on verifying up-to-date performance before deployment.

| Model                     | Code Quality | Reasoning | Context | Cost | Speed | Compatibility | Lock-in | Quirks                                                                      |
| ------------------------- | ------------ | --------- | ------- | ---- | ----- | ------------- | ------- | --------------------------------------------------------------------------- |
| GPT-4o                    | TBD          | TBD       | 128K    | $$   | TBD   | High          | Low     | Rate-limit spikes, extensive profile variants, token efficiency             |
| Claude 3.5 Sonnet         | TBD          | TBD       | 200K    | $$   | TBD   | High          | Low     | Native MCP support, verbose near high context, consistent quality           |
| Claude 3 Opus             | TBD          | TBD       | 200K    | $$$  | TBD   | High          | Medium  | Very verbose near high context, 1M context beta, premium pricing            |
| Gemini 2.5 Pro            | TBD          | TBD       | 1M      | $$   | TBD   | High          | Low     | Massive context, Flash>Pro performance inversion, regional variability      |
| Gemini Ultra (deprecated) | TBD          | TBD       | 128K    | $$   | TBD   | Medium        | Medium  | Historical only, API quota constraints, documentation timeouts              |
| DeepSeek V3.2             | TBD          | TBD       | 128K    | $    | TBD   | Medium        | Low     | Highest token efficiency, chat/reasoner split, limited Transformers support |
| Grok Code Fast 1          | TBD          | TBD       | 128K    | $    | TBD   | Medium        | Low     | "Max fun" mode, vendor-reported only, tool-use training, open weights       |
| GLM-5                     | TBD          | TBD       | 1M      | $    | TBD   | Medium        | None    | Cheapest API pricing, APAC multilingual advantage, documentation gaps       |
| Codestral 25.08           | TBD          | TBD       | 128K    | $$   | TBD   | High          | Low     | Strong FIM support, European data residency, low-latency focus              |
| Command A                 | TBD          | TBD       | 128K    | $$   | TBD   | High          | Medium  | Enterprise RAG specialist, platform dependencies, embedding strength        |

*Note: Model names reflect current API conventions as of Feb 2026. "Gemini Ultra" is deprecated; current Gemini family includes Gemini 1.5/2.0/3.x variants. Authoritative data maintained in model family dossiers.*

**Data population plan (v1):**

- **Ownership:** Platform Lead owns benchmark data collection; Engineering Lead owns integration with scorecard API.
- **Minimum viable metrics:** Code Quality (SWE-bench verified), Reasoning (Aider), Speed (tokens/sec), Cost (effective cost), Context (window size), Compatibility (tool coverage).
- **Data sources:** Public benchmarks (SWE-bench, Aider), vendor API documentation, internal throughput measurements.
- **Timeline:** Initial population by 2026-03-15; quarterly refresh cycles after v1 GA.

### Recommendations

- Keep scorecards current and coding-focused.
- Document switching criteria with rationale.
- Track gotchas for defaults and fallback behavior.
- Maintain compact SWOT snapshots for major model families.
