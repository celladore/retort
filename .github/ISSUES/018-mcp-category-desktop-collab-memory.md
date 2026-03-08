# feat(mcp): Evaluate desktop, collaboration, and memory MCP support

**Priority:** P2 — Medium
**Labels:** `enhancement`, `mcp`, `desktop`, `collaboration`, `memory`
**Blocked by:** #014

---

## Problem

The TRAE marketplace includes desktop/filesystem/shell, collaboration, and memory-oriented MCP servers that can materially change agent workflows. AgentKit Forge needs a clear position on which of these should be integrated, documented, or deferred.

Examples visible in screenshots include:

- File System / Desktop Commander / Windows CLI / Docker
- Slack
- Memory / Persistent Knowledge Graph
- Feedback-oriented MCPs such as Minidoracat/mcp-feedback-enhanced

---

## Scope

Evaluate support posture for:

- desktop/filesystem/shell execution MCPs
- messaging/collaboration MCPs
- memory/knowledge graph MCPs
- feedback-loop MCPs

---

## Acceptance Criteria

- [ ] Desktop/collaboration/memory categories are triaged
- [ ] Dangerous-operation and security implications are documented
- [ ] Memory-related findings feed into the dedicated memory umbrella
- [ ] Feedback-enhanced MCP is evaluated as a first-class candidate

---

## Related

- Umbrella: `.github/ISSUES/013-trae-mcp-alignment-umbrella.md`
- Memory umbrella: `.github/ISSUES/019-trae-memory-support-umbrella.md`
