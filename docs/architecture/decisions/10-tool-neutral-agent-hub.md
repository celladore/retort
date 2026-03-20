# ADR-10: Adopt Tool-Neutral `.agents/` Hub Pattern

**Status:** Proposed
**Date:** 2026-03-17
**Deciders:** JustAGhosT
**Related:** [Findings Report](../specs/tool-neutral-agent-hub-findings.md), [Multi-IDE Plugin Plan](../../../.claude/projects/C--Users-smitj-repos-agentkit-forge/memory/project_multi_ide_plugin_plan.md)

## Context

AgentKit Forge currently generates tool-specific configuration into isolated directories (`.claude/`, `.cursor/`, `.github/instructions/`, `.gemini/`, etc.). Each tool gets its own copy of agents, rules, commands, and skills. This creates two problems:

1. **No shared discovery layer.** An agent running in Cursor cannot read Claude's agent personas. An agent in Gemini cannot consume Claude's skills. Cross-tool collaboration requires reading another tool's proprietary directory format.

2. **Governance is platform-coupled.** Enforcement hooks (`.claude/hooks/`) are shell scripts that only work for tools executing through a shell. Browser agents, API agents, and sandboxed environments bypass all governance.

The Mystira.workspace project independently developed a `.agents/` directory pattern that addresses both problems through a tool-neutral hub with reflective guards.

## Decision

Adopt the `.agents/` directory as a **first-class sync output target** in AgentKit Forge, alongside existing tool-specific directories.

### Directory Structure

```
.agents/                          # Tool-neutral hub (NEW)
  guards/                         # Governance rules (portable)
  skills/                         # Shared skills (tool-agnostic)
  traces/                         # Cross-session reasoning context
  roadmaps/                       # Strategic multi-session goals
  .readme.yaml                    # Directory metadata

.claude/                          # Claude-specific (existing, slimmed)
  hooks/                          # Platform hooks (generated from guards)
  settings.json                   # Claude permissions
  state/                          # Runtime state (unchanged)

.cursor/, .gemini/, etc.          # Other tools (existing, slimmed)
  rules/                          # Platform-specific rule format only
```

### Principles

1. **`.agents/` is the canonical shared layer.** Any content readable by multiple agent tools lives here.
2. **Tool-specific dirs become thin wrappers.** They contain only platform hooks, permissions, and format-specific adaptations.
3. **Guards are the canonical governance source.** Shell hooks are generated from guard definitions for tools that support automated enforcement.
4. **The sync engine owns `.agents/`.** It is generated from `.agentkit/spec/` — not hand-authored — preserving the spec-driven architecture.

## Consequences

### Positive

- Any agent from any tool can discover shared agents, skills, guards, and roadmaps by reading `.agents/`
- Governance becomes portable — guards work for shell-based, browser-based, and API-based agents
- Cross-session continuity improves via traces and roadmaps
- Token cost decreases — agents read one shared location instead of parsing tool-specific dirs
- Path toward an industry convention for multi-agent repository configuration

### Negative

- Sync engine must generate an additional output target (development effort)
- Existing tool-specific content must be migrated or deduplicated (one-time cost)
- Projects already using `.agents/` for other purposes (rare) would conflict
- Guard "reflective enforcement" is weaker than hook-based enforcement — trust gap for non-cooperative agents

### Neutral

- `.agentkit/spec/` remains the single source of truth — no change to the authoring workflow
- Existing CI drift checks extend naturally to `.agents/` output
- Hook generation from guards is an optimisation, not a requirement — can ship incrementally
