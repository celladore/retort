# ADR-07: Delivery Strategy (Refined) — AgentKit Forge Distribution

## Status

**Proposed**

## Date

2024-05-31

## Context

AgentKit Forge, a core platform for deploying mesh-native agents at scale, faces rising friction in delivering updates, onboarding new customers, and supporting diverse consumption models. Historically, Forge delivery methods lagged industry and developer best practices, relying on manual binary distribution and ad hoc integrations. This produced pain for both CLI-first engineers and UI-oriented operators, delayed onboarding, and created avoidable support overhead amid growing cloud-native adoption.

**Executive Summary:**
Market analysis, customer interviews, and operational metrics all highlight these delivery inefficiencies as blockers for broader adoption and hamper ecosystem integration efforts. To support customer GTM targets for Q3–Q4 2024—especially for mid-market and enterprise cohorts—Forge must move to a modern, multi-modal distribution model. This ADR formalizes the shift to three distribution mechanisms: npm (modern package distribution), GitHub Actions (automation-centric CI/CD), and PWA (progressive web onboarding), providing consistency, reliability, and seamless migration for varied user segments.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| 1. Manual Binary Downloads | Simple, controls access | Clumsy updates, error prone, high onboarding friction |
| 2. Private Cloud Binary Repo | Access control, audit trail | Opaque, slow release cycles, poor DX, limits innovation |
| 3. npm Package (CLI + SDKs) | Dev workflow native, fast updates, dependency mgmt | CLI alone insufficient for some ops, must maintain npm hygiene |
| 4. GitHub Action as Sole CI | Direct for cloud CI/CD, automation friendly | Breaks on-prem adoption, high dependency on GitHub stack |
| 5. PWA (Progressive Web App) Distribution | Easiest onboarding for UI users, zero install friction | Only viable in greenfield browser environments, weak for CLI users |
| 6. Hybrid: npm + GitHub Action + PWA | Meets needs of all user personas, supports migration, future-proof | Complexity in release ops, higher maintenance |

**Update:** Manual/legacy repos (Options 1/2) are de-emphasized due to the urgency of adoption and total cost of maintenance. Option 6 is prioritized for its capability to unify onboarding while serving diverse environments.

## Key Metrics

| Metric | Baseline | Target |
| --- | --- | --- |
| **Mean Time to First Success (MTTFS)** | 2 days | <2 hours (Q3) |
| **Monthly Active Installs (MAI)** | 175 | 500+ by Q4 |
| **Onboarding Support Tickets** | 12/mo | ≤2/mo post-migration |
| **Upgrade Failure Rate (%)** | 8% | <1% |
| **Net Promoter Score (NPS) for Delivery Experience** | 48 | 65+ |

All metrics are directly tied to customer onboarding friction, expansion pipeline velocity, and developer advocacy goals for 2024.

## Weighted Decision Matrix

| Criteria | Weight | Option 3 (npm) | Option 4 (GitHub Action) | Option 5 (PWA) | Option 6 (Hybrid) |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Onboarding Speed** | 0.25 | 8 | 7 | 9 | 9 |
| **Ecosystem Integration** | 0.20 | 9 | 8 | 5 | 10 |
| **Maintenance Overhead** | 0.15 | 8 | 7 | 8 | 6 |
| **User Persona Coverage** | 0.20 | 6 | 7 | 9 | 10 |
| **Future-Proofing** | 0.10 | 9 | 8 | 6 | 10 |
| **Security & Auditability** | 0.10 | 8 | 9 | 7 | 9 |
| **Weighted Total** | **1.00** | **8.0** | **7.6** | **7.6** | **9.1** |

**Summary:** Weighting reflects current business priorities: adoption velocity, personalization to persona needs, reduction in support burden, and long-term platform/partner extensibility. The Hybrid model outpaces all others.

## Score Justifications

- **Onboarding Speed:** PWA and Hybrid excel by enabling zero-friction starts for UI professionals and automation-ready journeys for devs; npm is workflow native but CLI-only.
- **Ecosystem Integration:** Hybrid unlocks all future integrations (npm for devs, Actions for CI, PWA for SSO and browser auth); others are siloed.
- **Maintenance Overhead:** Hybrid is higher cost, but justified by cross-persona coverage; npm and PWA are lightweight but narrow.
- **User Persona Coverage:** Only Hybrid enables direct workflows for both CLI-first and operator personas; others cater to one camp.
- **Future-Proofing:** Hybrid allows incremental extensibility without lock-in to a single distribution mode.
- **Security & Auditability:** All modern methods score highly, but Hybrid reduces risk by avoiding over-indexing on GitHub-only access (key for regulated installs).

## Decision

**Executive Recommendation:** Adopt the Hybrid distribution model (npm + GitHub Action + PWA) as the baseline, launching all three as Generally Available for new installs. This ensures fast onboarding, automation-centric distribution, and a browser-native experience.

| Layer | Purpose |
| --- | --- |
| **npm (Node package)** | Primary for CLI and SDK distribution, developer-focused. |
| **GitHub Action** | Official path for CI-driven installs and upgrades; the only supported CI for new deployments. |
| **PWA** | General Availability for UI-driven onboarding; targeted for greenfield projects, zero-dependency browser installs only. |

All legacy/manual mechanisms to be deprecated by end of Q3 2024.

## Implementation Plan

### Phase 1 (June–July 2024)

- npm package publication pipeline, verification, and monitor baseline metrics
- GA release of PWA for greenfield customers; strict separation from legacy install flows

### Phase 2 (August 2024)

- GitHub Action made mandatory for CI/CD installs; documentation updates and champion enablement
- Migration guides and CLI tooling for user self-service onboarding

### Milestones

| Milestone | Date |
| --- | --- |
| Hybrid launch GA | 2024-08-01 |
| Legacy deprecation (manual/cloud binary) | 2024-09-30 |
| PWA: GA for all browser-based onboarding | 2024-09-30 |

**Note:** PWA has NO support for CLI migration.

### Ecosystem Support

- Roadmap inclusion: Partner repository support
- (Stub) Feature: Automated compatibility checks for major mesh-native runtimes

## Consumer Experience After Migration

### CLI-First Personas

**Install AgentKit Forge via npm:**
```bash
npm install -g agentkit-forge
```

- Immediate CLI and SDK access with autoupdate support

**Automated CI workflows through the official GitHub Action:**
- Integrated with organizational CI pipelines
- Semaphore for successful install/regression

### UI-Driven Personas

- Access PWA via web portal (SSO or OAuth)
- One-click onboarding; instant provisioning of project environment
- Self-service help and live chat within browser app

**Workflow:**
Day-zero onboarding: minimal manual steps, rapid path to first agent deployed or registered.

## Consequences

### Positive

- Adoption acceleration across all major target personas
- Fewer onboarding and upgrade failures, reducing L2/L3 support load
- Eliminates friction for greenfield PWA users and aligns with modern developer expectations
- Enables future extensibility (e.g., IDE plugins, third-party ecosystem hooks)

### Negative

- Increased operational complexity temporarily during migration
- Need for additional internal process alignment (release, security, audit)
- Unavoidable short-term cost to maintain three distribution channels

**In summary:**
Adopting the Hybrid model unlocks growth and developer satisfaction, at the cost of a controlled, time-limited increase in support and operational complexity.

## Risks and Mitigations

| Risk | Probability | Business Impact | Mitigation |
| --- | --- | --- | --- |
| npm registry outages or delays | Medium | Medium | Dual-publish critical updates; status monitoring; fallback guides |
| GitHub Actions ecosystem disruption | Low | High | Maintain validated fallback/manual install path during launch |
| PWA browser support fragmentation | Medium | Medium | Restrict PWA to tested browsers (Chrome, Edge), clear communication |
| Release process overhead (Hybrid complexity) | High | Medium | Use monorepo + CI pipelines for update alignment, automate most ops |
| User confusion during transition | Medium | Medium | Clear migration comms, in-product prompts and guides |
| Security vulnerabilities in third-party routes | Medium | High | Continuous dependency scanning and SAST, formal security review process |

## References

- AgentKit Forge Architectural Overview (Doc A1-Overview.pdf)
- CI/CD Integration Guide
- Ecosystem Compatibility Matrix
- Internal Security and Audit Policy
- Mesh-Native Distribution Survey (March 2024)
