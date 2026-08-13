# Startup context budget

What a session pays for before it has done any work — and where each kind of instruction
should live so that cost stays proportionate.

This matters more for Retort than for any single project. Retort is the scaffolding other
repos inherit: a convention that wastes 10k tokens per session costs that once here, and once
again in every project Retort onboards.

Ported from a startup-context reduction in `phoenixvc/mystira-workspace` (2026-08-13), which
cut its always-loaded footprint from 86,073 to 31,184 bytes (63%) without dropping a single
rule or agent.

---

## The multiplier

Startup context is not paid once. A subagent gets a fresh context window — it does **not**
inherit the parent conversation — but it _does_ re-pay the global overhead:

| Component                      | Re-paid per subagent dispatch?                |
| ------------------------------ | --------------------------------------------- |
| `CLAUDE.md`, `AGENTS.md`       | **Yes**                                       |
| `.claude/rules/`               | **Yes**                                       |
| Directory-scoped `CLAUDE.md`   | Only when files in that directory are touched |
| Agent frontmatter (the roster) | No — but paid every session at startup        |
| Agent **body**                 | Only on dispatch                              |
| MCP tool names                 | Gated by that agent's `tools:` allowlist      |

A session that dispatches six specialists pays for root memory **seven times**. That single
fact should decide where every piece of instruction goes.

## Where things belong

| If it is…                              | Put it in…            | Cost                        |
| -------------------------------------- | --------------------- | --------------------------- |
| True everywhere, needed often          | Root `CLAUDE.md`      | Every session × every agent |
| An enforceable rule, needed everywhere | `.claude/rules/`      | Every session × every agent |
| True only under one directory          | `<dir>/CLAUDE.md`     | Only sessions touching it   |
| Reference, looked up occasionally      | `docs/`               | Only when read              |
| How one agent does its job             | That agent's **body** | Only on dispatch            |
| Why a rule exists, a post-mortem       | Traces / history      | Only when read              |

The recurring mistake is putting the last three categories in the first two.

---

## Conventions

### Agent frontmatter is an index, not documentation

Only frontmatter loads at startup; the body loads on dispatch. A `description:` should be one
routing entry — domain, trigger, and sibling disambiguation where that is load-bearing. Worked
examples belong in the body under a `## When to invoke` heading.

**Retort already follows this** — 27 agents, ~712 bytes of frontmatter each, zero `<example>`
blocks. It is written down here so onboarded projects inherit the convention rather than
rediscovering it. For contrast, mystira-workspace had grown three to five worked example
dialogues per description: 47,894 bytes of routing index paid every session, while 876 KB of
actual agent knowledge sat correctly deferred in the bodies. Compacting to routing entries cut
it to ~14 KB with no loss of capability.

### Rules carry rules; rationale goes elsewhere

A post-mortem explaining _why_ a rule exists is read once and paid on every dispatch. Keep the
obligation in `.claude/rules/`, and link the trace for the reasoning.

### Every agent declares an explicit `tools:` allowlist

The key is **`tools:`**. A file using `allowed-tools:` is silently ignored, and that agent is
then granted the _entire_ tool registry — including every deferred MCP name. This was live in
mystira-workspace on its most frequently dispatched exploration agent, which made it the single
largest source of per-dispatch overhead. It failed silently in both directions: nothing warned
that the key was wrong, and nothing warned that the agent was over-privileged.

### An agent must never be instructed to call a tool outside its allowlist

Six agents in mystira-workspace had bodies invoking MCP tools their own frontmatter blocked.
The most costly was its project-management agent: coordination through the shared task graph
was its entire reason for existing, and every call it made was refused. Two others pointed at a
server listed in `deniedMcpServers`.

Note that a purely textual check is not enough. Scanning bodies for literal `mcp__` strings
misses agents that describe a server in prose — that false negative hid a real bug until an
automated reviewer caught it. Scan for **the tool names each server provides**, not the prefix.

### Keep the default MCP config lean

Tool deferral keeps _schemas_ out of context, but names still cost. A server earns a place in
the always-loaded config only if it offers reach the built-ins do not. A filesystem MCP server
alongside Read/Write/Edit costs names _and_ a decision on every file operation.

Put situational servers behind a profile loaded per session with `--mcp-config`, and register
each server exactly once — split by secret, with token-reading servers in settings and
secret-free stdio servers in the committed config.

### Aggregation is not context reduction

A gateway re-exporting N servers still surfaces N × tools. Only a task-shaped _facade_ reduces
the count, and it trades away the tool descriptions the model uses to choose correctly. Reach
for denial, lean defaults, and per-agent allowlists first.

### Scope only as a relocation

Add a directory-scoped `CLAUDE.md` when you are moving instruction _out of_ something
always-loaded. Creating one for content that was not previously in root **adds** cost for every
session in that directory.

---

## Audit of this repository

Measured against `dev` at `871b6b7` on 2026-08-13 (identical on `main`). Re-measure before acting.

### Always-loaded memory is ~95 KB

| File                    | Bytes      |
| ----------------------- | ---------- |
| `CLAUDE.md`             | 12,289     |
| `AGENTS.md`             | 2,853      |
| `.claude/rules/**/*.md` | 80,075     |
| **Total**               | **95,217** |

Roughly 24k tokens before any work begins, re-paid on every subagent dispatch.

### Ten rules files are duplicated across two directories, with divergent content

`.claude/rules/` and `.claude/rules/languages/` both contain files of the same name, and **none
of the pairs are identical**:

| File                       | `.claude/rules/` | `.claude/rules/languages/` |
| -------------------------- | ---------------- | -------------------------- |
| `agent-conduct.md`         | 2,020            | 3,201                      |
| `ci-cd.md`                 | 1,352            | 2,513                      |
| `dependency-management.md` | 1,454            | 2,794                      |
| `documentation.md`         | 1,650            | 2,975                      |
| `git-workflow.md`          | 2,248            | 4,378                      |
| `iac.md`                   | 2,973            | 6,484                      |
| `security.md`              | 1,655            | 2,633                      |
| `template-protection.md`   | 2,870            | 2,228                      |
| `testing.md`               | 3,250            | 5,141                      |
| `typescript.md`            | 1,529            | 4,147                      |

This is a **correctness problem before it is a context problem**: there are two versions of the
testing rule and two of the security rule, and nothing indicates which governs. Worth resolving
regardless of the token cost.

**Verify first** whether the loader recurses into `.claude/rules/languages/` — check `/context`
in a live session. If it does not, the subdirectory reads as authoritative while being inert;
if it does, every session pays for both copies.

### No directory-scoped `CLAUDE.md`

Only the root file and a template. Candidates, if any guidance is subtree-specific: `infra/`,
`src/`, `skills/`. Apply the relocation test above before adding any.

---

## Suggested sequence

1. Resolve the duplicated rules directories — correctness first, context second.
2. Measure `/context` before and after; record the number.
3. Move rationale and post-mortems out of `.claude/rules/` into docs or history.
4. Add two mechanical checks to the quality gates so onboarded projects cannot regress:
   - an agent file using `allowed-tools:` instead of `tools:`, or declaring no tools at all
   - an agent body referencing a tool outside its own allowlist (match on server tool names,
     not just the `mcp__` prefix)
5. Keep the lean-description convention documented, since Retort already gets it right.

## Checking the budget

```bash
wc -c CLAUDE.md AGENTS.md
find .claude/rules -name '*.md' -exec cat {} \; | wc -c

# agent index — per file, because awk's `exit` would stop at the first one
for f in agents/*.md; do
  awk '/^---$/{n++; if(n==2) exit; next} n==1{print}' "$f"
done | wc -c
```

Roughly 3.5–4 characters per token for prose; markdown tables run denser.
