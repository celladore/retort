# feat(platform): Expand IDE and agent-platform support coverage

**Type:** Feature Proposal + Platform Expansion
**Priority:** High
**Labels:** `enhancement`, `platform`, `ide`, `agent`, `dx`
**Blocked by:** None
**Blocks:** #030, #031

---

## Summary

Track support strategy for additional IDEs and agent-oriented platforms the user actively uses.

Requested platforms:

- Qoder
- TRAE
- Antigravity
- Factory
- Nimbalist
- Claude Code
- Zed
- Codex
- OpenCode
- Droid
- Kilo
- Kiro
- Augment

This umbrella exists to answer two questions consistently:

1. Is the platform an IDE, an agent shell, an aggregator, or another execution surface?
2. What level of Retort support should exist for that platform?

---

## Problem

Retort already targets several AI coding environments, but support expansion is currently driven by ad hoc additions. That makes it hard to reason about:

- which platforms are officially supported
- how support levels differ by platform type
- when to add direct generated outputs vs adapters vs documentation only
- how to treat borderline cases like Factory or Claude Code

---

## Proposed Scope

### Phase 1: Platform taxonomy

Define categories such as:

- IDE / editor
- agent coding environment
- MCP-capable runtime surface
- AI workspace / aggregator
- import/export target only

### Phase 2: Requested platform review

Review each requested platform for:

- user value
- existing overlap with current support
- output format needs
- command/workflow compatibility
- maintenance cost

### Phase 3: Support implementation strategy

Decide for each platform whether Retort should add:

- first-class generated outputs
- adapter/export support
- documentation only
- experimental support

---

## Acceptance Criteria

- [ ] The requested platform list is triaged with support recommendations
- [ ] IDE vs platform vs aggregator taxonomy is documented
- [ ] Claude Code support status is explicitly clarified
- [ ] Borderline cases such as Factory are classified with rationale
- [ ] Follow-up tickets exist for direct platform work and aggregator work

---

## Related

- AI aggregator issue: `.github/ISSUES/031-ai-aggregator-support.md`
- TRAE master umbrella: `.github/ISSUES/032-trae-alignment-master-umbrella.md`

---

## Sub-Issues

| #   | File                                          | Title                                              | Priority | Status |
| --- | --------------------------------------------- | -------------------------------------------------- | -------- | ------ |
| 030 | `030-platform-support-matrix.md`              | Add support matrix for requested IDEs/platforms    | P1       | Open   |
| 031 | `031-ai-aggregator-support.md`                | Add support strategy for AI aggregators            | P1       | Open   |
| 038 | `038-platform-support-zed-codex-opencode.md`  | Evaluate support for Zed, Codex, and OpenCode      | P1       | Open   |
| 039 | `039-platform-support-droid-kilo-kiro.md`     | Evaluate support for Droid, Kilo, and Kiro         | P2       | Open   |
| 040 | `040-platform-support-augment-and-similar.md` | Evaluate support for Augment and similar platforms | P1       | Open   |
