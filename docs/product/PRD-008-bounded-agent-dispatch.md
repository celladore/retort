# PRD-008: Organization-Wide Bounded Agent Dispatch

**Status:** Proposed  
**Target:** R13  
**Product owner:** PhoenixVC agent-platform governance  
**Technical owner:** Retort  
**Consumers:** Baton, Cognitive Mesh, Sluice, mcp-org, Mystira, and every MCP service that launches or forwards agent work  
**Related:** [Retort PR #574](https://github.com/phoenixvc/retort/pull/574), ADR-15 Native
Agent Dispatch (proposed on that branch), and
[Sluice `sluice.agent-workflow.v1`](https://github.com/phoenixvc/sluice/blob/dev/docs/contracts/agent-workflow-model-policy.md)

## Executive summary

PhoenixVC agents can delegate work through several runtimes and services. Today those systems
use different concepts for task scope, inherited conversation history, model routing, worktree
isolation, audit correlation, and delegation depth. A task may be described as "bounded" while
still inheriting an entire parent conversation or forwarding more context to a provider than the
child needs.

This product establishes one portable bounded-dispatch contract. Every agent dispatch has a
specific objective, owned scope, explicit context mode, bounded delegation depth, and durable
audit identity. Runtime-specific controls such as Codex `fork_turns` or Claude subagent settings
are adapters behind the contract, not fields exposed as the organization-wide vocabulary.

The safe default is an isolated, self-contained dispatch assembled from a task brief and explicit
artifact references. Full parent transcripts are never inherited implicitly.

## Problem

The current ecosystem has five related gaps:

1. **Scope and context are conflated.** A narrow task can still receive a broad transcript.
2. **Runtime terminology leaks into product contracts.** A Codex setting cannot be consumed by
   Claude, Cognitive Mesh, or an MCP service without bespoke interpretation.
3. **Delegation is not consistently auditable.** Model usage, task state, and agent messages
   cannot always be joined to the dispatch that caused them.
4. **Provider boundaries see inconsistent metadata.** Gateways need safe, low-cardinality policy
   fields, not task text, personal data, or transcript contents.
5. **Nested dispatch can multiply cost and authority.** Depth, fan-out, write ownership, and
   provider policy are not governed as one decision.

Observed runtime validation already rejects some invalid combinations, such as changing the
specialist type while inheriting a full parent history. Relying on runtime errors produces retries,
inconsistent behavior, and accidental over-sharing instead of a deliberate dispatch policy.

## Product principles

1. **Every task is bounded.** It has one objective, explicit ownership, constraints, and an
   expected result.
2. **Context is least-necessary.** Context is constructed for the child; it is not copied from the
   parent by default.
3. **Artifacts beat transcripts.** Durable task files, specifications, diffs, traces, and test
   results are preferred over conversational history.
4. **Policy is portable; adapters are runtime-specific.** The contract expresses intent while
   each runtime resolves it into native controls.
5. **Authority never expands silently.** A child cannot gain broader write scope, data access,
   model access, or delegation depth than its parent.
6. **Audit metadata is content-free.** Correlation and policy fields may cross service boundaries;
   prompts, credentials, personal data, and free-form task text do not become telemetry labels.
7. **Absence is restrictive.** Missing or unknown policy cannot resolve to full-history dispatch.

## Users and stakeholders

| Stakeholder                   | Need                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------- |
| Orchestrating agent           | Delegate focused work without manually learning every runtime flag              |
| Specialist agent              | Receive sufficient context, explicit ownership, and a clear completion contract |
| Human operator                | Understand who delegated what, with which authority, model, and evidence        |
| Security and privacy reviewer | Prove that secrets, personal data, and unrelated history were not propagated    |
| FinOps operator               | Attribute model usage and nested fan-out to a task and dispatch tree            |
| MCP/service developer         | Implement one versioned envelope rather than a different contract per consumer  |
| Runtime adapter owner         | Map portable intent to native controls and report the resolved policy           |

## Goals

- Define a versioned `org.dispatch.v1` envelope for agent work.
- Make isolated context the default for new dispatches.
- Distinguish isolated investigation, recent-context work, durable continuation, causal lineage,
  authority nesting, and equivalent-authority handoff.
- Bound nested delegation and prevent child authority from exceeding parent authority.
- Correlate Baton tasks, Cognitive Mesh agent tasks, Sluice model usage, and mcp-org audit records.
- Provide a staged observe-to-enforce migration for existing integrations.
- Support Claude, Codex, Cognitive Mesh, MCP services, and future runtimes without changing the
  product vocabulary.

## Non-goals

- Replacing Baton as the task graph.
- Replacing Retort's agent definitions or task-file lifecycle.
- Choosing the best model for a task; this contract constrains routing but does not implement the
  routing algorithm.
- Standardizing the content or storage format of every artifact.
- Sending the full dispatch envelope through model-provider metadata.
- Applying agent-dispatch requirements to ordinary interactive inference or read-only MCP calls.
- Defining token or financial budgets when no owner has explicitly set one.

## Context modes

| Mode           | Permitted context                                                                     | Intended use                                                            |
| -------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `isolated`     | Task brief, constraints, owned resources, and explicit artifact references            | Explorers, reviewers, specialists, parallel work, closeout synthesis    |
| `recent`       | Everything in `isolated` plus a small, declared number of immediately preceding turns | Work depending on a recent user correction or unresolved local exchange |
| `continuation` | Durable checkpoint and artifacts from the same agent identity and logical run         | Resuming interrupted work or a deliberate follow-up round               |

Normative rules:

- `isolated` is the default.
- `recent` defaults to at most three preceding turns. A runtime may enforce a lower limit.
- `continuation` does not mean "copy the parent transcript." It requires a prior dispatch or run
  identifier and a durable checkpoint.
- There is no portable `full` mode. A runtime that supports full-history inheritance may use it
  only internally for an unchanged same-agent continuation and must still report the resolved
  mode as `continuation`, plus the content-free history mechanism and resolved turn count. An audit
  record must never make full-history exposure look equivalent to checkpoint-only continuation.
- A dispatch may narrow its declared context at invocation time. Broadening requires an
  authoritative approval decision with an authenticated approver and recorded bounded reason; caller
  prose alone is not approval.

## Core user stories

### Bounded specialist dispatch

As an orchestrator, I can assign a specialist one objective and owned path set, with isolated
context and referenced artifacts, so the specialist does not receive unrelated session history.

### Safe continuation

As an agent resuming interrupted work, I can load the prior durable checkpoint and artifacts
without inheriting conversations from unrelated work completed later in the parent session.

### Provider-safe routing

As a gateway operator, I can enforce model, provider, context-size, and data-residency policy from
low-cardinality dispatch metadata without logging the task or prompt.

### Cross-system audit

As an operator, I can start from a Baton task and follow its dispatch tree through Cognitive Mesh,
Sluice usage events, and mcp-org audit records using stable identifiers.

### Predictable failure

As a developer, I receive a structured validation error before work starts when the objective,
scope, context mode, parent relationship, or delegation depth is invalid.

## Functional requirements

### FR-1: Versioned envelope

Every dispatch-capable boundary must accept or construct a versioned envelope. Version
`org.dispatch.v1` is additive and forward-compatible: consumers ignore unknown optional fields but
reject unknown major versions when enforcement is enabled.

### FR-2: Bounded task definition

Each dispatch must include:

- a stable dispatch ID;
- one objective;
- an operation kind;
- owned resources or an explicit read-only scope;
- constraints and expected output;
- context mode;
- current and maximum delegation depth;
- trace correlation.

Causal predecessor, authority parent, and continuation relationships are separate. Only a true
delegated child increments authority depth; same-agent continuation and equivalent-authority handoff
retain depth, and repeated root fan-out remains a set of direct children.

### FR-3: Context construction

Dispatchers construct child context according to the selected mode. Passing a parent context
object by reference or wholesale serialization is non-compliant unless it has first been projected
through the policy.

### FR-4: Authority monotonicity

A child may not expand:

- owned resources or allowed actions;
- write capability;
- data classification or residency allowance;
- provider/model allowance;
- maximum delegation depth;
- external-effect authority.

Scope mode and projected context are part of this comparison. A write-bounded child under a
read-only authority basis is rejected. Context broadening requires an independently resolved
authority decision and audit record; it is never inferred from caller prose.

### FR-5: Artifact references

Artifacts are referenced by stable URI or repository-relative path with media type, classification,
purpose, and an immutable digest resolved before launch. Dispatchers validate access and content
identity before launch. Cross-boundary, confidential, and restricted references carry the digest in
the forwarded request. Artifact contents are loaded by the child only when needed.

### FR-6: Runtime resolution

Adapters must record both requested and resolved policy. Examples include the resolved Codex
history fork, Claude isolation/tool restrictions, Cognitive Mesh context projection, and Sluice
model alias.

### FR-7: Audit correlation

The following identifiers must be joinable where those systems participate:

- dispatch, root dispatch, causal predecessor, authority parent, and continuation IDs;
- `taskId` and `runId`;
- `traceId`;
- agent identity;
- requested and resolved context mode;
- current delegation depth;
- resolved model/provider where a model call occurs.

### FR-8: Provider-safe projection

Only the safe projection defined by the technical specification may enter Sluice request metadata.
Per-dispatch identifiers remain audit, trace, and usage-event fields rather than metric labels.
Metrics use only bounded enumerations and registered policy IDs. Objectives, paths, prompts,
artifact content, personal data, credentials, and free-form constraints are excluded.

### FR-9: Structured rejection

Validation failures use stable reason codes, including:

- `DISPATCH_OBJECTIVE_REQUIRED`;
- `DISPATCH_SCOPE_REQUIRED`;
- `DISPATCH_CONTEXT_MODE_INVALID`;
- `DISPATCH_PARENT_REQUIRED`;
- `DISPATCH_DEPTH_EXCEEDED`;
- `DISPATCH_AUTHORITY_EXPANSION`;
- `DISPATCH_ARTIFACT_UNAVAILABLE`;
- `DISPATCH_POLICY_VERSION_UNSUPPORTED`;
- `DISPATCH_PROVIDER_POLICY_DENIED`;
- `DISPATCH_PARENT_UNTRUSTED`;
- `DISPATCH_ID_CONFLICT`;
- `DISPATCH_CHECKPOINT_EXPIRED`;
- `DISPATCH_CLASSIFICATION_UNMAPPED`.

### FR-10: Compatibility and rollout

Consumers must support observe, warn, and enforce modes. Observe mode never invents compliant
values; it records missing fields as missing. Enforcement is enabled per boundary after telemetry
shows its first-party callers have migrated.

## Component outcomes

| Component          | Product outcome                                                                   |
| ------------------ | --------------------------------------------------------------------------------- |
| Retort             | Canonical authoring schema, defaults, validators, and runtime adapter guidance    |
| Baton              | Dispatch intent and resolved-run state persisted alongside task/run relationships |
| Cognitive Mesh     | Typed policy on `AgentTask`; child context projection and authority enforcement   |
| Sluice             | Safe metadata projection, routing/data-egress enforcement, and usage attribution  |
| mcp-org            | Organization-wide audit correlation and policy adoption health                    |
| Mystira            | Repository guidance and compliant specialist dispatch patterns                    |
| Other MCP services | Required envelope for tools that launch, schedule, or forward work                |

## Security and privacy requirements

- Secrets and credentials must never appear in the envelope, task artifacts, telemetry metadata,
  or rejection details.
- Personal data and free-form user input remain content, not labels or identifiers.
- Artifact access follows the caller's existing authorization; a reference is not a capability.
- Dispatch metadata is treated as untrusted input at every service boundary.
- Provider routing must respect declared data residency and classification.
- Logs must avoid objective text, prompt text, artifact contents, and raw context.
- High-impact external effects continue to require the authorization rules of the owning system;
  a valid dispatch envelope does not grant approval.

## Success measures

- 100% of first-party dispatch-capable boundaries support `org.dispatch.v1` before enforcement.
- 100% of new specialist dispatches declare a context mode and bounded scope.
- 0 implicit full-transcript specialist dispatches after enforcement.
- 100% of model usage generated by agent dispatches correlates to a dispatch ID and trace ID.
- 100% of rejected authority expansions produce a stable reason code.
- No task text, personal data, credentials, artifact content, or per-dispatch identifier appears in
  gateway metric labels.
- Nested-dispatch depth and model cost can be reported per root task.

## Rollout

### Phase 0: Contract and task graph

- Accept this PRD and the technical specification.
- Create linked Baton work for every consumer.
- Confirm named owners and repository boundaries.

### Phase 1: Instrumentation

- Add envelope types and requested/resolved audit fields.
- Run in observe mode.
- Establish missing-policy and invalid-policy dashboards.

### Phase 2: First-party migration

- Migrate Retort and Cognitive Mesh dispatchers.
- Add Sluice's safe metadata projection.
- Add Baton and mcp-org correlation.
- Update Mystira and MCP guidance.

### Phase 3: Warning

- Warn on missing/legacy policy and uncorrelated model requests.
- Continue to reject authority expansion, artifact-access failure, provider/residency denial,
  sensitive-metadata leakage, and existing authorization failures in every rollout mode.
- Validate that warnings represent caller defects rather than incomplete observability.

### Phase 4: Enforcement

- Reject new non-compliant agent dispatches.
- Enable enforcement independently at each boundary after its callers are ready.
- Keep ordinary inference and non-dispatch MCP requests outside the enforcement path.

## Risks and mitigations

| Risk                                         | Mitigation                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Too little context causes repeated work      | Artifact-first briefs, explicit recent mode, structured missing-artifact rejection |
| Adapters interpret modes differently         | Conformance fixtures and requested/resolved audit fields                           |
| Metadata cardinality harms telemetry         | Enumerated policy fields and opaque IDs only                                       |
| Existing callers break abruptly              | Observe and warn stages before enforcement                                         |
| Dispatch schema becomes a second task system | Keep task state in Baton/Retort; envelope carries execution policy and references  |
| Child agents evade bounds through MCP tools  | Require propagation at every dispatch-capable MCP boundary                         |
| Provider receives sensitive metadata         | Sluice accepts only the safe projection; content fields are prohibited             |

## Product acceptance criteria

- The technical specification defines the envelope, validation order, safe gateway projection,
  adapter mappings, audit model, errors, and conformance tests.
- Each named consumer has a linked Baton task with repository-specific acceptance criteria.
- A reference dispatch can be traced from Baton through Cognitive Mesh and Sluice to mcp-org
  without placing task content in telemetry.
- Conformance tests cover isolated, recent, continuation, depth overflow, authority expansion,
  unsupported version, redaction, and ordinary non-dispatch inference.
- Enforcement can be enabled per component without a coordinated all-at-once deployment.
