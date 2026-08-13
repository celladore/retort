# Technical Specification: Bounded Agent Dispatch Contract

**Status:** Proposed  
**Contract:** `org.dispatch.v1`  
**Target:** R13  
**PRD:** [PRD-008 Organization-Wide Bounded Agent Dispatch](../../product/PRD-008-bounded-agent-dispatch.md)  
**Canonical owner:** Retort

## 1. Purpose

This specification defines the portable contract used when one agent, orchestrator, or service
launches, schedules, or forwards work to another agent. It separates product intent from runtime
mechanics and specifies how Retort, Baton, Cognitive Mesh, Sluice, mcp-org, Mystira, and other MCP
services participate.

Normative keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are used as defined by RFC 2119.

## 2. Boundary classification

Implementations classify each tool or endpoint before applying this contract:

| Boundary class   | Examples                                                                   | Requirement                                                           |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Dispatcher       | Native subagent launcher, Cognitive Mesh orchestration, queued project run | Construct and validate the full envelope                              |
| Forwarder        | MCP tool that schedules or delegates work elsewhere                        | Validate, narrow, and propagate the envelope                          |
| Model gateway    | Sluice `/v1/responses` for an agent workflow                               | Accept only the safe metadata projection                              |
| Task/audit store | Baton, mcp-org                                                             | Persist intent, resolution, and correlation without sensitive content |
| Passive tool     | Search, read-only data lookup, ordinary inference                          | No dispatch envelope required                                         |

An endpoint's classification is based on behavior, not service name. A single MCP server may expose
both passive and dispatch-capable tools.

## 3. Logical envelope

The JSON representation uses camelCase. YAML authoring uses the same field names.

```json
{
  "version": "org.dispatch.v1",
  "dispatchId": "018f2f4a-9f89-7ee0-a9e1-4d91ab7fd123",
  "rootDispatchId": "018f2f4a-9f89-7ee0-a9e1-4d91ab7fd123",
  "parentDispatchId": null,
  "parentPolicyRef": null,
  "operationKind": "agent_dispatch",
  "objective": "Review the authentication handler for authorization regressions.",
  "constraints": ["Do not edit files or trigger external effects."],
  "scope": {
    "mode": "read_only",
    "ownedResources": [
      {
        "kind": "repo_path",
        "value": "apps/api/src/auth/**",
        "baseRevision": "0123456789abcdef0123456789abcdef01234567"
      }
    ],
    "allowedActions": ["read", "test"],
    "deniedActions": ["write", "deploy", "external_message"]
  },
  "context": {
    "mode": "isolated",
    "recentTurnLimit": 0,
    "checkpointRef": null,
    "artifactRefs": [
      {
        "uri": "repo://docs/security/auth-model.md",
        "purpose": "authorization invariants",
        "classification": "internal",
        "digest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    ]
  },
  "execution": {
    "currentDepth": 0,
    "maxDelegationDepth": 2,
    "isolation": "worktree",
    "externalEffects": "deny"
  },
  "routing": {
    "capability": "security-review",
    "routingProfile": "first-party-agent-standard",
    "dataClassification": "internal",
    "dataResidency": "organization-policy",
    "maxInputTokens": null
  },
  "completion": {
    "expectedOutputs": ["findings", "evidence", "residualRisks"],
    "closeoutRequirement": "handoff"
  },
  "correlation": {
    "taskId": "optional-baton-task-id",
    "runId": "optional-runtime-run-id",
    "traceId": "opaque-trace-id"
  },
  "requestedBy": {
    "claimedAgentId": "orchestrator",
    "runtime": "codex"
  }
}
```

## 4. Field definitions

### 4.1 Identity and lineage

| Field              | Required   | Rules                                                              |
| ------------------ | ---------- | ------------------------------------------------------------------ |
| `version`          | Yes        | Exact supported major version; initial value `org.dispatch.v1`     |
| `dispatchId`       | Yes        | Opaque UUID or ULID; globally unique                               |
| `rootDispatchId`   | Yes        | Root uses its own `dispatchId`; every descendant preserves it      |
| `parentDispatchId` | Child only | Required when `currentDepth > 0` or context mode is `continuation` |
| `parentPolicyRef`  | Child only | Authenticated authoritative record plus immutable policy digest    |
| `operationKind`    | Yes        | `agent_dispatch`, `agent_continuation`, or `agent_handoff`         |

Identifiers MUST NOT encode user identity, task text, repository names, or secrets.

`parentDispatchId` is never trusted as a caller assertion by itself. `parentPolicyRef` is an object
with `recordUri` and `policyDigest`; supported URI schemes are registered per deployment and MUST
NOT embed bearer credentials. It identifies an authoritative run record and includes its immutable
canonical-policy digest. The receiving boundary
resolves that record using its own service identity, verifies the caller may continue or delegate
from it, compares the digest, and obtains the effective parent policy from the trusted record. A
caller-supplied parent snapshot is ignored. In-process runtimes may use protected local run state,
but MUST persist the same digest before forwarding across a service boundary. An unresolved,
unauthorized, expired, or mismatched parent fails closed.

`dispatchId` is also the idempotency key. Repeating an ID with the same canonical envelope digest
returns the existing run/result and MUST NOT repeat external effects. Reusing an ID with different
content returns `DISPATCH_ID_CONFLICT`. Authoritative stores define checkpoint expiry and completed
run retention; a continuation after expiry returns `DISPATCH_CHECKPOINT_EXPIRED` rather than
silently starting new work.

### 4.1.1 Canonical digests

All implementations use RFC 8785 JSON Canonicalization Scheme serialized as UTF-8 and hashed with
SHA-256. Digests use `sha256:` followed by 64 lowercase hexadecimal characters.

- `envelopeDigest` hashes the complete received v1 envelope after JSON parsing and before runtime
  resolution. The digest field itself is not part of the envelope. Unknown additive v1 fields remain
  in this digest, so replay detection cannot ignore changed input.
- `policyDigest` hashes a normalized effective-policy projection containing `version`, canonicalized
  `scope`, `context.mode`, artifact/checkpoint identifiers and classifications, `execution`,
  `routing`, `completion.closeoutRequirement`, root/parent identity, and the authenticated requester
  principal. It excludes objective prose, constraint prose, expected-output prose, timestamps, and
  runtime resolution data.

Resource paths and registered policy IDs are normalized and resolved before `policyDigest` is
computed. The authoritative store persists both digests. `parentPolicyRef.policyDigest` always means
this effective-policy digest; idempotent replay comparison always uses `envelopeDigest`. The
canonical JSON schema and fixtures include exact digest vectors shared by Node, .NET, and Python.

### 4.2 Objective and scope

`objective` is required in the full envelope and MUST contain one measurable outcome. It is content
and MUST NOT be copied into gateway metadata or metric labels.

`constraints` is a required non-empty array of task-specific prohibitions or invariants. Constraints
are content: they remain in the full envelope and MUST NOT be copied into gateway metadata or metric
labels. Machine-enforceable constraints also appear in `scope`, `execution`, or `routing`; prose is
not a substitute for those controls.

`scope.mode` is one of:

- `read_only`;
- `write_bounded`;
- `coordination_only`.

`ownedResources` is an array of typed objects. Initial `kind` values are:

- `repo_path`: `{ kind, value, baseRevision }`, where `value` is a slash-normalized
  repository-relative path or glob and `baseRevision` is an immutable commit/object ID;
- `resource_id`: `{ kind, owningSystem, value }`, where the owning system defines authorization and
  subset comparison for the opaque value;
- `responsibility`: `{ kind, owningSystem, value }`, where `value` is a registered responsibility
  name for read-only or coordination work.

For `repo_path`, dispatchers resolve `.` and `..`, repository case rules, symlinks, and junctions
against the canonical repository root before subset comparison. Escapes from the root are rejected.
Every child `repo_path` retains the parent's `baseRevision`; changing revision requires a new root
dispatch because glob membership, symlinks, and path identity may have changed.
For `resource_id`, comparison is delegated to the named owning system. `responsibility` scopes are
not mechanically broadened: an incomparable child requires an explicit owning-system or human
decision. Values MUST NOT contain credentials or bearer URLs. An empty scope is invalid.

`allowedActions` and `deniedActions` use the v1 controlled vocabulary: `read`, `write`, `test`,
`commit`, `push`, `deploy`, `external_message`, `secret_read`, `data_mutation`, and `dispatch`.
Deny wins on conflict. Unknown unqualified values are rejected. Extensions use
`x-<owner>:<action>` and require a registered comparison rule; an unknown extension cannot appear in
`allowedActions` and is treated as denied.

### 4.3 Context

`context.mode` is `isolated`, `recent`, or `continuation`.

| Mode           | `recentTurnLimit` | Additional requirement                                |
| -------------- | ----------------- | ----------------------------------------------------- |
| `isolated`     | `0`               | Self-contained brief and artifact references          |
| `recent`       | `1..3` by default | Runtime can prove which preceding turns were selected |
| `continuation` | `0`               | Parent dispatch, authoritative policy, and checkpoint |

The organization-wide contract has no `full` mode. Adapters MUST NOT translate a specialist change
or parallel dispatch into full-history inheritance.

`checkpointRef` is required only for `continuation`. It has the same reference and classification
shape as an artifact plus a checkpoint format/version. The receiver resolves it through an
authenticated authoritative store, verifies its digest, confirms that it belongs to the declared
parent/root lineage and agent identity, and rejects expired or inaccessible checkpoints.

`artifactRefs` entries contain:

- `uri`: stable URI or repository-relative reference;
- `purpose`: short reason the child needs it;
- `classification`: `public`, `internal`, `confidential`, or `restricted`;
- `digest`: optional immutable content digest;
- `mediaType`: optional MIME type.

A reference does not confer access. The dispatcher or child MUST authorize artifact access using the
owning system's policy.

The portable classification lattice is `public < internal < confidential < restricted`. Local
classes require a versioned mapping to this lattice before dispatch; unknown or unmapped classes are
rejected. Before provider routing, the dispatcher/classification service classifies every projected
content source: objective, constraints, task brief, selected recent turns, checkpoint, artifacts,
tool results, and newly generated context. The effective request classification is the maximum of
the declared routing class and all projected or loaded content. Personal data and secrets also
trigger their owning privacy/secret policy regardless of the ordinal class. Routing is revalidated
whenever projected context changes or a newly loaded/generated item raises classification. Content
whose class cannot be established is treated as `restricted` or rejected according to the owning
data policy; it is never routed under a weaker caller declaration.

### 4.4 Execution

`currentDepth` is zero for a root dispatch and increments exactly once per child edge.
`maxDelegationDepth` is inherited and MAY be narrowed. It MUST NOT increase in a child.

`isolation` is `none`, `process`, `workspace`, `worktree`, or `runtime_default`. Code-writing work
SHOULD resolve to `worktree` when supported.

`externalEffects` is `deny`, `approval_required`, or `allow_declared`. A child cannot receive a more
permissive value than its parent. This field does not replace service-specific authorization.

### 4.5 Routing

`capability` is a provider-neutral need such as `security-review`, `cheap-reasoning`, or
`documentation`. It is not a provider deployment name.

`routingProfile` is a bounded identifier registered by the gateway or owning organization. It
resolves allowed capability aliases, providers, regions, and maximum context. It MUST NOT contain a
free-form provider instruction. `dataResidency` is likewise a registered policy ID when routing
crosses a service boundary.

`dataClassification` and `dataResidency` constrain routing. `maxInputTokens` is optional in local
dispatches and exists only when an owner has selected a quantitative ceiling. Before a model-gateway
call, the adapter resolves a numeric ceiling from the request and registered routing profile, using
the lower value when both exist. Absence MUST NOT be interpreted as an unlimited financial budget.

### 4.6 Completion and correlation

`expectedOutputs` is a non-empty list drawn from the task contract. `closeoutRequirement` may reuse a
Batonesque value such as `tests`, `pr_merged`, `deployment_verified`, `handoff`, or `none`.

`taskId`, `runId`, and `traceId` are opaque correlation identifiers. `traceId` is required for every
dispatch and is generated at the root before validation when the caller has not supplied one.

`requestedBy.claimedAgentId` and `requestedBy.runtime` are routing/audit claims, not authentication.
At every service boundary the receiver binds them to an independently authenticated principal from
the transport and stores both claimed and authenticated identities. Authorization and
`policyDigest` use the authenticated principal. A mismatch is auditable and MAY be rejected by local
policy; the claimed identity alone never grants access or lineage rights.

## 5. Validation order

Validators run in this order so callers receive deterministic errors:

1. Parse and structural validation.
2. Contract major-version support.
3. Required identity, objective, constraints, scope, expected output, and trace correlation.
4. Context-mode invariants.
5. Authenticated parent resolution, lineage, idempotency, and depth.
6. Authority monotonicity against the parent.
7. Artifact/checkpoint syntax, access, digest, expiry, and effective classification.
8. Runtime capability and isolation resolution.
9. Provider, data-residency, and model policy.
10. Audit record creation.
11. Launch or forward.

No external work starts before steps 1-10 succeed.

## 6. Authority comparison

The dispatcher computes an effective parent policy and verifies:

```text
child.resources       subset-of parent.resources
child.allowedActions  subset-of parent.allowedActions
child.deniedActions   superset-of parent.deniedActions
child.rootDispatchId  equal-to parent.rootDispatchId
child.currentDepth    equal-to parent.currentDepth + 1
child.currentDepth    <= parent.maxDelegationDepth
child.currentDepth    <= child.maxDelegationDepth
child.maxDepth        <= parent.maxDelegationDepth
child.dataClass       no-more-sensitive-than parent/provider allowance
child.dataResidency   subset-of parent/provider allowed regions
child.routingProfile  subset-of parent/provider capability, model, and provider grants
child.maxInputTokens  <= effective parent/profile ceiling
child.externalEffects no-more-permissive-than parent.externalEffects
```

Where scopes cannot be compared mechanically, the dispatcher requires an explicit human or owning
service decision and records the reason. It MUST NOT silently assume the child is narrower.

## 7. Runtime adapter mappings

### 7.1 Codex

| Contract intent          | Adapter behavior                                                               |
| ------------------------ | ------------------------------------------------------------------------------ |
| `isolated`               | `fork_turns: none`; self-contained task prompt                                 |
| `recent`                 | Positive bounded `fork_turns`, never greater than `recentTurnLimit`            |
| `continuation`           | Reuse the existing agent/run when possible; otherwise dispatch from checkpoint |
| Specialist type override | MUST NOT use full-history fork                                                 |

The adapter records requested mode, resolved history mechanism (`none`, `selected_turns`,
`checkpoint`, or `runtime_full_history`), resolved turn count, agent type, and model without storing
conversation content in audit metadata. `runtime_full_history` is valid only for an explicitly
authorized same-agent continuation and remains distinguishable in audit.

### 7.2 Claude

Retort emits agent frontmatter for model, tools, worktree isolation, and dispatch capability. The
caller constructs a self-contained prompt or task file from the envelope. Agent frontmatter does
not carry invocation-specific transcript history.

| Contract intent | Adapter behavior                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `isolated`      | New subagent receives the task file/brief and artifact references only                                 |
| `recent`        | Caller explicitly copies at most `recentTurnLimit` selected turns into the brief and records the count |
| `continuation`  | Re-dispatch/reuse the same agent from the verified checkpoint and authoritative parent task            |

Claude's native `isolation: worktree` and `disallowedTools` are structural defaults, but the adapter
must also intersect them with `allowedActions`/`deniedActions`. A runtime that cannot enforce an
allowed write/external-effect boundary with tools, hooks, sandbox, or approval policy rejects that
dispatch instead of relying on prompt prose. The audit records the same resolved history mechanism
and turn count defined for Codex.

### 7.3 Cognitive Mesh

`AgentTask` gains a typed dispatch policy. Before creating a child task, Cognitive Mesh:

1. validates authority and depth;
2. projects permitted context instead of reusing the parent context dictionary;
3. resolves agent/model routing under classification and residency constraints;
4. records requested and resolved policy;
5. invokes the runtime adapter with the projected child task.

### 7.4 MCP dispatchers and forwarders

Dispatch-capable tool input schemas accept a `dispatch` object or a `dispatchRef` resolvable from the
authoritative task/run store. The server validates the effective envelope before queuing or
forwarding. Passive tools do not require the field.

`dispatchRef` is an opaque record reference, not a bearer capability. The MCP server resolves it
with server credentials, authorizes the calling principal against the referenced task/run, verifies
the canonical envelope digest, and loads the stored policy. Callers cannot select a different parent
or policy snapshot merely by supplying an identifier. Forwarders persist their resolved child
record before invoking the next boundary.

## 8. Sluice safe metadata projection

Sluice MUST NOT receive the full envelope as request metadata. Agent workflow requests use only:

```json
{
  "dispatch_policy": "org.dispatch.v1",
  "dispatch_id": "opaque-id",
  "root_dispatch_id": "opaque-id",
  "parent_dispatch_id": "opaque-id-or-absent",
  "operation_kind": "agent_dispatch",
  "capability": "security-review",
  "context_mode": "isolated",
  "delegation_depth": 1,
  "max_delegation_depth": 2,
  "trace_id": "opaque-id",
  "data_classification": "internal",
  "data_residency": "za-approved",
  "routing_profile": "first-party-agent-standard",
  "max_input_tokens": 32000
}
```

Rules:

- Values are enumerated or opaque identifiers with bounded length.
- `routing_profile` and `data_residency` are server-registered bounded policy IDs, not free-form
  descriptions. Sluice resolves them against the authenticated virtual key and requested capability
  alias. The intersection of those policies is authoritative; a request cannot broaden it.
- `capability` is the enumerated provider-neutral alias from the full envelope. Sluice validates it
  against the authenticated virtual key and `routing_profile`; it is never derived from prompt text.
- `max_input_tokens` and `max_delegation_depth` are numeric ceilings. Sluice may narrow them but
  MUST NOT route or forward a request that exceeds them.
- Objective, paths, constraints, artifact URIs/content, prompt text, responses, credentials,
  personal data, and free-form user input are prohibited.
- Existing `app`, `agent`, `workflow`, `stage`, and request correlation fields remain in force.
- Any `operation_kind` in `agent_dispatch`, `agent_continuation`, or `agent_handoff` activates
  dispatch-policy validation. Ordinary inference remains unaffected.
- Sluice records resolved model/provider and usage against `dispatch_id` and `trace_id`.
- Gateway policy may narrow routing but cannot widen a caller's model, provider, residency, or
  classification allowance.

## 9. Persistence and audit

### Baton

Baton stores requested dispatch intent on a task and resolved policy on each execution run. The task
schema remains the source for objective, ownership, lifecycle, and closeout. The dispatch record
references the task rather than duplicating its complete description.

Minimum run fields:

- `dispatch_policy_version`;
- `dispatch_id`, `parent_dispatch_id`, and root dispatch ID;
- `envelope_digest` and `policy_digest`;
- claimed requester identity and authenticated principal;
- requested/resolved context mode;
- resolved history mechanism and turn count;
- current/max depth;
- requested/resolved agent and model hints;
- trace ID;
- validation outcome and reason code;
- timestamps.

### mcp-org

mcp-org extends agent-message audit records with optional dispatch, task, run, trace, context-mode,
depth, and policy-version fields. Its dispatch audit payload is structured: event type, tool name,
portable outcome/reason code, redaction/classification flags, counters, and opaque identifiers.
Free-form `inputSummary`/`outputSummary` fields remain legacy content fields: dispatch integrations
omit them by default; if an existing caller supplies them, mcp-org applies input classification,
authorization, redaction, bounded length, and existing retention before storage. They never become
metric labels or authoritative policy evidence. Org health can report adoption rates,
missing-policy counts, rejections, and uncorrelated usage.

### Retention

Each owning system applies its existing retention policy. The contract does not justify retaining
raw prompts or task content longer than currently authorized.

## 10. Error contract

Dispatch validation failures return a structured object:

```json
{
  "error": {
    "code": "DISPATCH_DEPTH_EXCEEDED",
    "message": "Child depth exceeds the effective maximum delegation depth.",
    "dispatchId": "opaque-id",
    "retryable": false,
    "field": "execution.currentDepth"
  }
}
```

Messages MUST be safe for logs and MUST NOT echo prompts, secrets, personal data, or artifact
content. Provider throttling and transient transport errors remain distinct from policy rejection.

The stable v1 policy codes are those in PRD-008 plus `DISPATCH_PARENT_UNTRUSTED`,
`DISPATCH_ID_CONFLICT`, `DISPATCH_CHECKPOINT_EXPIRED`, and
`DISPATCH_CLASSIFICATION_UNMAPPED`. Implementations MAY add namespaced diagnostic codes, but callers
must be able to branch on the portable code.

## 11. Compatibility and versioning

- Additive optional fields remain within `org.dispatch.v1`.
- Removing or changing field meaning requires `org.dispatch.v2`.
- Unknown optional fields are preserved where practical and ignored by v1 consumers.
- Unknown major versions are recorded in observe mode and rejected in enforce mode.
- A forwarder MUST NOT downgrade a major version silently.
- Runtime-specific resolution data lives under the run/audit record, not in the portable request.

## 12. Rollout modes

| Mode      | Missing/legacy-policy behavior                                                    |
| --------- | --------------------------------------------------------------------------------- |
| `off`     | Legacy caller has no envelope instrumentation; existing authorization still runs  |
| `observe` | Record missing/unsupported envelope fields without fabricating compliant values   |
| `warn`    | Warn on missing/unsupported envelope fields while legacy authorization still runs |
| `enforce` | Reject missing, unsupported, or structurally invalid envelopes before launch      |

Rollout is per boundary. A model gateway may enforce safe metadata after its callers migrate while a
separate MCP dispatcher remains in observe mode.

Rollout mode governs compatibility with missing or legacy dispatch policy only. Artifact access
denial, checkpoint integrity failure, authority expansion, sensitive-metadata leakage, provider or
residency denial, credential handling, and the owning system's pre-existing authorization rules fail
closed in every mode. `observe` and `warn` are not authorization bypasses. When a legacy request has
too little information to prove a new monotonicity invariant, the system records it as unassessed and
applies all existing controls; it MUST NOT report the request as compliant.

## 13. Conformance tests

Every dispatcher or forwarder implements shared fixtures for:

1. Valid isolated read-only dispatch.
2. Valid recent dispatch with one and three turns.
3. Rejection above the organization maximum of three turns, plus rejection above any configured
   lower runtime ceiling.
4. Valid continuation using a parent dispatch and durable checkpoint.
5. Rejection of continuation without parent/checkpoint.
6. Rejection of missing objective, constraints, scope, expected output, or trace ID generation
   failure.
7. Rejection of child write scope outside the parent scope.
8. Rejection of external-effect escalation.
9. Rejection of skipped/falsified depth, depth overflow, and child max-depth increase.
10. Unsupported major version in observe and enforce modes.
11. Artifact reference access denial.
12. Safe Sluice projection excludes content fields.
13. Ordinary non-dispatch inference remains valid without dispatch metadata.
14. Requested and resolved policies correlate across task, run, gateway usage, and audit records.
15. Logs and metrics contain no objective, prompt, credential, personal data, path, or artifact
    content.
16. Parent lookup rejects unauthorized, missing, expired, or digest-mismatched records.
17. Duplicate dispatch IDs are idempotent for the same digest and conflict for different content.
18. Effective classification rises when a more sensitive artifact is loaded and routing is
    revalidated.
    The same fixtures cover under-classified objective/constraints, recent turns, checkpoint
    content, tool results, and unknown content treated as restricted or rejected.
19. Broader routing profile, capability/model/provider grant, residency, or input-token ceiling is
    rejected.
20. Gateway validation activates for dispatch, continuation, and handoff operation kinds.
21. RFC 8785/SHA-256 digest vectors match in Node, .NET, and Python implementations.

The canonical fixtures SHOULD be serialized as implementation-neutral JSON and reused by Node,
.NET, and Python consumers.

## 14. Implementation sequence

1. Retort publishes the schema, fixtures, validators, and adapter guidance.
2. Baton adds task/run persistence and correlation fields.
3. Cognitive Mesh adds typed policy and child-context projection.
4. Sluice adds the safe metadata projection in observe mode.
5. mcp-org adds audit correlation and adoption-health reporting.
6. Mystira updates dispatch guidance and validates specialist flows.
7. Other MCP services inventory tools, classify boundaries, and adopt the envelope where required.
8. Each boundary advances observe to warn to enforce using live first-party telemetry.

## 15. Definition of done

- The canonical JSON schema and fixture set are versioned in Retort.
- All named components can parse `org.dispatch.v1` and report requested/resolved policy.
- Cognitive Mesh no longer passes unprojected parent context wholesale to child agents.
- Sluice correlates agent workflow usage without receiving content in metadata.
- Baton and mcp-org expose a complete dispatch lineage and validation outcome.
- The cross-system conformance suite passes every positive and negative fixture, and at least one
  successful end-to-end reference flow can be traced across systems.
- Enforcement is enabled only after first-party callers show no unexplained missing-policy events.
