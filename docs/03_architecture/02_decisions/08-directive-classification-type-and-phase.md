# ADR-08: Directive Classification — Type and Phase Scoping

## Status

**Proposed**

## Date

2026-03-05

## Context

AgentKit Forge's `rules.yaml` defines ~90 conventions across 14 domains. All
conventions carry a `severity` field (critical / error / warning / info), but
severity alone conflates two concerns:

1. **How important** is this rule? (severity)
2. **Can tooling enforce it automatically?** (enforcement vs. guidance)

For example, `sec-least-privilege` (severity: error) is architectural guidance
that no linter can check, while `ts-lint` (severity: error) is enforced by
ESLint in CI. Agents receiving both rules as equivalent "errors" cannot
distinguish between a hard gate they must pass and a design principle they
should follow.

Additionally, conventions lack lifecycle context. A rule like
`dn-clean-layering` matters during planning and implementation but is
irrelevant during the validation phase (where linters and tests run). Without
phase scoping, agents are presented with the full rule corpus regardless of
what they are currently doing.

### Options Considered

| Option | Description | Trade-offs |
|--------|-------------|------------|
| **A — Separate files** | Split rules into `directives.yaml` (enforcement) and `guidelines.yaml` (advisory) | Clean separation, but doubles the number of files and splits domain cohesion |
| **B — Status quo** | Keep using severity alone | Simple, but agents cannot distinguish enforceable gates from design principles |
| **C — Extend conventions** | Add `type` and `phase` fields to existing conventions in `rules.yaml` | Backwards-compatible, preserves domain grouping, minimal schema change |

## Decision

We adopt **Option C**: extend each convention in `rules.yaml` with two optional
fields:

### `type` (optional, default: `advisory`)

| Value | Meaning | Agent behaviour |
|-------|---------|-----------------|
| `enforcement` | Hard constraint backed by tooling, CI gates, or hooks | Agent MUST pass this check; violations block merge |
| `advisory` | Design guidance, best practice, or architectural principle | Agent SHOULD follow; violations are flagged but do not block CI |

### `phase` (optional, default: all phases)

Scopes a convention to one or more phases of the 5-phase orchestrator
lifecycle:

| Phase | When |
|-------|------|
| `discovery` | Understanding requirements, scanning codebase |
| `planning` | Designing solution, writing ADRs |
| `implementation` | Writing code, adding tests |
| `validation` | Running linters, tests, quality gates |
| `ship` | Creating PR, deploying, documenting |

When `phase` is omitted, the convention applies across all phases (e.g.,
`sec-no-secrets` is always relevant). When provided, agents can filter their
active rule set to only the conventions relevant to the current orchestrator
phase.

### Classification Principles

- **enforcement** is reserved for rules that have a concrete automated check:
  a CLI tool, a CI gate, a hook, or a testable assertion. If no tool can
  verify compliance, the rule is `advisory`.
- **phase** reflects when an agent should actively consider the rule. A rule
  may span multiple phases (e.g., `rs-unsafe` is relevant during both
  `implementation` and `validation`).
- Rules with `severity: critical` and no `type` should be reviewed for
  explicit classification during adoption.

### Schema Changes

```yaml
conventions:
  - id: ts-lint
    rule: 'All code must pass ESLint'
    severity: error
    type: enforcement          # NEW — was implicit
    phase: validation          # NEW — when this rule matters
    autofix: true
    tool: 'eslint --fix'

  - id: dn-clean-layering
    rule: 'Follow clean architecture layering...'
    severity: error
    type: advisory             # NEW — no tool can enforce this
    phase:                     # NEW — relevant during design & coding
      - planning
      - implementation
    autofix: false
```

### Engine Changes

- `spec-validator.mjs`: accepts `type` (enum) and `phase` (string or array of
  valid phase names) as optional fields on conventions.
- `synchronize.mjs`: `buildRuleVars()` exposes `ruleEnforcementConventions`,
  `ruleAdvisoryConventions`, `ruleHasEnforcement`, and `ruleHasAdvisory`
  template variables; convention lines include type/phase badges.
- Templates (`language-instructions/TEMPLATE.md`, `cline/clinerules/TEMPLATE.md`,
  `roo/rules/TEMPLATE.md`): render enforcement and advisory sections separately
  when both exist.

## Consequences

### Positive

- Agents can distinguish "must pass CI" rules from "should follow" guidance,
  reducing false-positive noise and improving prioritisation.
- Phase scoping allows agents to focus on relevant rules during each lifecycle
  stage, reducing prompt token waste.
- Fully backwards-compatible: `type` and `phase` default to `advisory` and
  "all phases" respectively when omitted.
- Generated output surfaces the classification visually, making it easier for
  humans to audit which rules are enforced vs. advisory.

### Negative

- Every convention now has two more fields to maintain; contributors must
  decide the correct classification.
- Templates that previously rendered a flat list now have conditional sections,
  slightly increasing template complexity.
- The `advisory` / `enforcement` binary may not capture every nuance (e.g.,
  rules that are enforcement in CI but advisory locally).

### Neutral

- Existing rules without `type` or `phase` continue to work unchanged.
- The orchestrator does not yet filter rules by phase at runtime — this ADR
  lays the schema foundation; runtime filtering is a follow-up.

## Follow-up Work

1. **Orchestrator phase filtering**: update `orchestrator.mjs` to pass the
   current phase to agent context, and filter convention sets accordingly.
2. **CI gate mapping**: for each `enforcement` rule, verify a corresponding
   CI job or hook exists; add missing gates.
3. **Audit remaining untyped rules**: after adoption, sweep any conventions
   still missing `type` and classify them explicitly.
4. **Dashboard / metrics**: surface enforcement pass rates in CI artefacts.

## References

- [rules.yaml](../../../.agentkit/spec/rules.yaml) — canonical rule definitions
- [spec-validator.mjs](../../../.agentkit/engines/node/src/spec-validator.mjs) — schema validation
- [synchronize.mjs](../../../.agentkit/engines/node/src/synchronize.mjs) — template rendering
- [ADR-01: Adopt AgentKit Forge](./01-adopt-agentkit-forge.md)
