# FW-001: Template Directory Organization & Restructuring

## Metadata

- **ID**: FW-001
- **Priority**: P3
- **Status**: not-started
- **Created**: 2026-03-06

## Problem Statement

`.agentkit/templates/` has platform targets (`claude`, `cursor`, `copilot`, `windsurf`, `cline`, `roo`, `warp`, `codex`, `gemini`) mixed at the same level as non-platform directories (`docs`, `headers`, `language-instructions`, `root`, `github`, `mcp`, `renovate`, `vscode`, `ai`). This flat structure makes it harder to reason about which directories are platform-specific render targets vs. shared/cross-cutting concerns.

## Current Structure

```
.agentkit/templates/
├── ai/                    # platform target
├── claude/                # platform target
├── cline/                 # platform target
├── codex/                 # platform target
├── copilot/               # platform target
├── cursor/                # platform target
├── gemini/                # platform target
├── roo/                   # platform target
├── warp/                  # platform target
├── windsurf/              # platform target
├── docs/                  # shared: doc scaffolding
├── github/                # shared: GitHub config
├── headers/               # shared: file headers
├── language-instructions/ # shared: language rules
├── mcp/                   # shared: MCP config
├── renovate/              # shared: Renovate config
├── root/                  # shared: root-level files
└── vscode/                # shared: VS Code config
```

## Proposed Investigation

1. Evaluate grouping platform targets under a `platforms/` subdirectory
2. Assess impact on sync engine (`syncDirectCopy`, template resolution paths)
3. Determine if `headers/` and `language-instructions/` should be co-located with platforms or remain separate
4. Consider whether `vscode/`, `github/`, `renovate/` are "platforms" or "tooling"
5. Document the taxonomy decision in an ADR

## Constraints

- This requires changes to `.agentkit/engines/` (sync engine template resolution)
- Must maintain backwards compatibility with existing overlay configurations
- All 15+ supported AI tools must continue to generate correctly
- Requires maintainer approval (template-protected directory)

## Acceptance Criteria

- [ ] Investigation complete with recommendation
- [ ] Impact analysis on sync engine documented
- [ ] ADR created for directory taxonomy decision
- [ ] If approved: refactor with full test coverage
- [ ] All AI tool configs regenerate correctly after refactor
