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

For contrast, mystira-workspace had grown three to five worked example dialogues per
description: 47,894 bytes of routing index paid every session, while 876 KB of actual agent
knowledge sat correctly deferred in the bodies. Compacting to routing entries cut it to ~14 KB
with no loss of capability.

**Retort partially follows this.** All 27 `agents/*.md` carry an `Examples:` list inside the
frontmatter — trigger phrasings rather than full dialogues, which is why the roster is
comparatively light at ~712 bytes per agent. But they are still worked examples living in the
index, and the convention above says they belong in the body. Moving them is the same change
mystira-workspace made, at a smaller scale.

Note this is _not_ currently a startup cost — see "The roster is not registered" below — but it
becomes one the moment that is fixed.

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

### Memory files total ~95 KB

| File                    | Bytes      |
| ----------------------- | ---------- |
| `CLAUDE.md`             | 12,289     |
| `AGENTS.md`             | 2,853      |
| `.claude/rules/**/*.md` | 80,075     |
| **Total**               | **95,217** |

Roughly 24k tokens before any work begins, re-paid on every subagent dispatch.

This counts memory files only. The agent roster is the other startup contributor, and it is
covered separately below because in this repository it currently costs nothing — for a reason
worth fixing.

### The roster is not registered

None of the 39 `.claude/agents/*.md` files carry YAML frontmatter — they begin with an HTML
comment banner and a `#` heading. Claude Code registers a subagent from its frontmatter `name`
and `description`, so as written **none of them register**, and ~200 KB of agent personas is
inert rather than dispatchable.

The properly-formed definitions live in `agents/*.md` at the repo root — 27 files with
`description`, `model` and `tools` — which is not a directory Claude Code reads. Both are
generated: `platform-syncer.mjs` writes `.claude/agents/<id>.md` from the agents spec.

So the roster costs 0 bytes at startup today, and that is the symptom, not the win. Confirm
against a live session (`/agents`, or check whether the personas are dispatchable at all)
before acting — if they are in fact reachable by some path not visible in the repo, this
finding is void and the 27 frontmatter blocks become a real ~19 KB startup cost instead.

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
testing rule and two of the security rule, and nothing indicates which governs.

**Neither copy is stale — both are generated, from two different sources.** `synchronize.mjs`
runs two tasks per target under the `coding-rules` feature flag:

| Generator call             | Source                                   | Output                     |
| -------------------------- | ---------------------------------------- | -------------------------- |
| `syncDirectCopy`           | `.agentkit/templates/claude/rules/` (13) | `.claude/rules/*.md`       |
| `syncLanguageInstructions` | `.agentkit/spec/rules.yaml`              | `.claude/rules/languages/` |

The two sets were never meant to overlap, but ten domain names now appear in both. The split is:

- **Both** (10): agent-conduct, ci-cd, dependency-management, documentation, git-workflow, iac,
  security, template-protection, testing, typescript
- **Template only** (5): agent-delegation, hookify, pr-base-branch, quality, worktree-isolation
- **Spec only** (3): ai-cost-ops, finops, plus the generated `README.md`

The two versions are also structurally different, not near-duplicates. `.claude/rules/testing.md`
is prose (`## Test Pyramid`, `## Coverage`, `## Mocking & Isolation`); the spec-generated one is
schema-shaped (`## Applies To`, `## Enforcement Rules`, `## Advisory Rules`). They are different
documents about the same subject.

**The fix does not belong in the generated files** — every one is marked `DO NOT EDIT` and would
be restored by the next `pnpm --dir .agentkit retort:sync`. It belongs in `.agentkit`, and it is
a design decision for the maintainers:

1. **Spec wins** — drop the 10 colliding files from `templates/claude/rules/`, keeping the 5
   template-only ones. Makes `rules.yaml` the single source for any domain it covers.
2. **Templates win** — drop those domains from `rules.yaml`, keeping it for genuine
   language rules. Note the directory is named `languages/` but already carries non-language
   domains (testing, iac, finops), which is what let the collision happen.
3. **Namespace the output** — keep both and stop the name collision, accepting that two
   documents cover each domain.

Also verify whether the loader recurses into `.claude/rules/languages/`, since that decides
whether the duplicate is inert-but-authoritative-looking or genuinely charged twice per session.

### No directory-scoped `CLAUDE.md`

Only the root file and a template. Candidates, if any guidance is subtree-specific: `infra/`,
`src/`, `skills/`. Apply the relocation test above before adding any.

---

## Suggested sequence

1. **Confirm the roster registers at all.** Everything else is secondary if 39 agent files are
   inert. Fix in `platform-syncer.mjs` by emitting `name`/`description` frontmatter.
2. **Resolve the duplicated rules directories** — pick one of the three options above and change
   `.agentkit`, not the generated output. Correctness first, context second.
3. Measure `/context` before and after; record the number.
4. Move rationale and post-mortems out of `.claude/rules/` into docs or history.
5. Move the `Examples:` trigger lists from `agents/*.md` frontmatter into the bodies — after
   step 1, since that is when they start costing anything.
6. Add three mechanical checks to the quality gates so onboarded projects cannot regress:
   - an agent file with no frontmatter, or using `allowed-tools:` instead of `tools:`, or
     declaring no tools at all
   - an agent body referencing a tool outside its own allowlist (match on server tool names,
     not just the `mcp__` prefix)
   - a generated filename colliding across two generator outputs

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
