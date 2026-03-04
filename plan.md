# Plan: CLI & Packaging Engineer + PRD Integration Gaps

---

## Part 1: Naming Options for the New Agent/Team

The current system has 10 teams defined in `.agentkit/spec/teams.yaml`. The new team would be T11.

| Option | Agent Name | Team ID | Command | Pros | Cons |
|--------|-----------|---------|---------|------|------|
| A | CLI Engineer | `cli` | `/team-cli` | Direct, obvious scope | Undersells packaging/publish |
| B | Package Engineer | `packaging` | `/team-packaging` | Emphasizes npm/registry/distribution | Undersells CLI UX |
| C | Distribution Engineer | `distribution` | `/team-distribution` | Matches PRD-005 naming | Vague — confused with CDN/infra |
| **D (Recommended)** | **CLI & Packaging** | **`cli`** | **`/team-cli`** | Covers both halves; short command ID | Slightly longer name |

**Recommendation: Option D.** The team name captures both concerns. The short ID `cli` follows the existing convention (single lowercase word: `backend`, `frontend`, `devops`, `infra`, `product`). Command `/team-cli` is ergonomic.

---

## Part 2: CLI & Packaging Team Definition

### Addition to `teams.yaml`

```yaml
- id: cli
  name: CLI & PACKAGING
  focus: 'CLI entry points, npm packaging, distribution pipelines'
  scope:
    - 'bin/**'
    - 'src/cli*'
    - 'engines/**'
    - 'package.json'
    - '.npmrc'
    - 'action.yml'
    - 'scripts/publish*'
    - 'scripts/release*'
    - 'scripts/pack*'
  accepts: [implement, review, plan, package, publish, release]
  handoff-chain: [testing, infra, docs]
```

### Agent Definition for `agents.yaml`

```yaml
- id: cli-engineer
  category: engineering
  name: CLI & Packaging Engineer
  role: >
    Specialist responsible for CLI entry points, argument parsing, command
    routing, npm package structure, publish pipelines, GitHub Action
    definitions, and engine module boundary management.
  accepts:
    - implement
    - review
    - plan
  depends-on: []
  notifies:
    - testing
    - infra
    - docs
  focus:
    - 'bin/**'
    - 'src/cli*'
    - 'engines/**'
    - 'package.json'
    - '.npmrc'
    - 'action.yml'
    - 'scripts/publish*'
    - 'scripts/release*'
  responsibilities:
    - CLI entry point and argument parsing (bin/, src/cli*)
    - npm package manifest management (package.json files, exports, bin)
    - Template and spec resolution from install paths (import.meta.resolve)
    - GitHub Action composite step definition (action.yml)
    - Registry publish pipeline (npm, GitHub Packages, Artifactory)
    - Engine module boundaries (what ships vs. what doesn't)
    - Semver versioning and changelog integration
    - Package size optimization and tree-shaking verification
  preferred-tools:
    - Read
    - Write
    - Edit
    - Bash
    - Glob
    - Grep
```

### Scope Overlap Resolution

| Overlapping Path | Primary Owner | Secondary | Resolution |
|-----------------|---------------|-----------|------------|
| `engines/**` (runtime) | `cli` | `platform` | `cli` owns module boundaries & exports; `platform` owns shared internals |
| `package.json` (deps) | `cli` | `devops` | `cli` owns `files`, `exports`, `bin`, publish scripts; `devops` owns lint/format scripts, devDeps |
| `.github/workflows/publish*` | `cli` | `devops` | `cli` owns publish workflow logic; `devops` owns runner config & secrets |
| `scripts/publish*` | `cli` | `devops` | `cli` primary; `devops` owns CI integration of those scripts |

### Handoff Chain Rationale

```
cli -> testing    (test the packaged output, install-from-tarball tests)
cli -> infra      (publish pipeline CI, registry credentials)
cli -> docs       (CLI usage docs, --help text, README install instructions)
```

---

## Part 3: Product Manager — Current State & PRD Targeting Gaps

### What Already Exists

The Product Manager agent and Product team **already exist** in the spec:

| Asset | Location | Status |
|-------|----------|--------|
| Team definition | `.agentkit/spec/teams.yaml` lines 64-69 | Exists: `product` team |
| Agent definition | `.agentkit/spec/agents.yaml` lines 533-565 | Exists: `product-manager` agent |
| Agent markdown | `.github/agents/product-manager.agent.md` | Exists: generated |
| Chat mode | `.github/chatmodes/team-product.chatmode.md` | Exists: generated |
| Command definition | `.agentkit/spec/commands.yaml` lines 738-756 | Exists: `team-product` |
| Slash command file | `.agentkit/templates/claude/commands/team-product.md` | **Missing** — not generated from template |

### Product Manager Capabilities

- **Accepts**: `plan`, `review` (cannot implement code)
- **Scope**: `docs/01_product/**`, `docs/prd/**`
- **Handoff**: `backend`, `frontend`
- **Notifies**: `backend`, `frontend`
- **Responsibilities**: Write PRDs, define acceptance criteria, prioritize backlog, coordinate planning, maintain roadmap

### What's Missing: PRD → Backlog Pipeline

**Critical gap: There is no documented mechanism to tell the Product Manager "read PRD-005 and generate backlog items from it."**

Current flow:
```
/orchestrate → /discover → /healthcheck → /sync-backlog → /plan → delegate
                                                ↑
                                     Reads AGENT_BACKLOG.md
                                     (manually populated — by whom?)
```

The Product Manager agent's responsibilities include "Prioritize backlog items" and "Write PRDs", but there's no command or workflow that says "take PRD-005, extract deliverables, and write them into AGENT_BACKLOG.md with team assignments."

### Additional Bug: PRD Detector Doesn't Find PRDs

In `.agentkit/engines/node/src/discover.mjs` line 215:
```javascript
{ name: 'prd', label: 'PRDs', dirs: ['docs/prd', 'docs/PRD'], files: ['PRD.md', 'docs/PRD.md'] }
```

But actual PRDs live in `docs/01_product/`. The detector will **never find them**.

---

## Part 4: Recommended New Documents & Artifacts

### Documents That Should Exist

| # | Document | Proposed Location | Purpose | Priority |
|---|----------|------------------|---------|----------|
| 1 | **`/prd-intake` command** | `.agentkit/templates/claude/commands/prd-intake.md` | New slash command: reads a PRD, extracts deliverables, maps to teams, writes `AGENT_BACKLOG.md` entries | **P0** — this is the missing link |
| 2 | **PRD Index** | `docs/01_product/INDEX.md` | Lists all PRDs with status (Draft/Approved/In Progress/Shipped), affected teams, and links | **P1** — useful for both humans and agents |
| 3 | **PRD-to-Team Matrix** | Section added to `UNIFIED_AGENT_TEAMS.md` or standalone `docs/01_product/PRD_TEAM_MATRIX.md` | Which teams are affected by which PRDs and their role (implementor, reviewer, dependency) | **P1** |
| 4 | **Roadmap Tracker agent enhancement** | `.agentkit/spec/agents.yaml` (roadmap-tracker section) | The `roadmap-tracker` agent already exists but may need PRD-phase tracking capabilities | **P2** — evaluate existing agent |

### `/prd-intake` Command Design

```
Usage: /prd-intake <PRD-ID or path>

Example: /prd-intake PRD-005
         /prd-intake docs/01_product/PRD-005-mesh-native-distribution.md

Behavior:
1. Resolve PRD file from ID or path
   - PRD-005 → docs/01_product/PRD-005-*.md (glob match)
2. Read the PRD and extract:
   - Phases and milestones
   - Deliverables per phase
   - Dependencies between deliverables
   - Acceptance criteria
3. Map deliverables to teams using teams.yaml scope patterns
4. Generate AGENT_BACKLOG.md entries:
   - Priority derived from phase order (Phase 1 → P0, Phase 2 → P1, etc.)
   - Team assignment from scope mapping
   - Cross-team dependencies populated
   - Notes include PRD reference and acceptance criteria
5. Output summary of proposed/written backlog items

Flags:
  --dry-run     Show proposed items without writing
  --phase N     Only intake from a specific PRD phase
  --team <id>   Only intake items for a specific team
  --append      Add to existing backlog (default)
  --replace     Replace existing items sourced from this PRD
```

### How It Fits the Existing Flow

```
NEW FLOW:
  /prd-intake PRD-005          ← new: PRD → backlog items (Product Manager scope)
       ↓
  AGENT_BACKLOG.md             ← now populated with PRD-sourced items
       ↓
  /orchestrate                 ← existing: orchestrate from backlog
       ↓
  Phase 1-5 lifecycle          ← unchanged
```

The orchestrator doesn't need changes — it already reads `AGENT_BACKLOG.md`. The missing piece is the **input stage**.

---

## Part 5: All Teams Cross-Reference (Including New T11)

| Team ID | Name | Focus | Scope (key patterns) | PRDs Affected | Handoff Chain |
|---------|------|-------|---------------------|---------------|---------------|
| `backend` | Backend | API, services, core logic | `apps/api/**`, `services/**`, `src/server/**` | PRD-001, PRD-004 | testing, docs |
| `frontend` | Frontend | UI, components, PWA | `apps/web/**`, `src/client/**`, `components/**` | PRD-006 | testing, docs |
| `data` | Data | Database, models, migrations | `db/**`, `migrations/**`, `models/**`, `prisma/**` | PRD-001 (model config) | backend, testing |
| `infra` | Infra | IaC, cloud, Terraform/Bicep | `infra/**`, `terraform/**`, `bicep/**` | PRD-005 (registry infra) | devops, security |
| `devops` | DevOps | CI/CD, pipelines, automation | `.github/workflows/**`, `scripts/**`, `docker/**` | PRD-005 (publish CI) | testing, security |
| `testing` | Testing | Unit, E2E, integration tests | `**/*.test.*`, `tests/**`, `e2e/**` | All (test coverage) | quality |
| `security` | Security | Auth, compliance, audit | `auth/**`, `security/**` | PRD-006 (API keys) | — |
| `docs` | Documentation | Docs, ADRs, guides | `docs/**`, `*.md` | All (documentation) | — |
| `product` | Product | Features, PRDs, roadmap | `docs/01_product/**`, `docs/prd/**` | All (defines them) | backend, frontend |
| `quality` | Quality | Code review, refactoring | `**/*` | All (quality gates) | — |
| **`cli`** (new) | **CLI & Packaging** | **CLI, npm packaging, distribution** | **`bin/**`, `src/cli*`, `engines/**`, `package.json`** | **PRD-005 Phase 1 (critical path)** | **testing, infra, docs** |

### Agent Inventory (17 → 18 with new CLI Engineer)

| Category | Agents | Count |
|----------|--------|-------|
| Engineering | backend, frontend, data, devops, infra, **cli-engineer** (new) | 5 → **6** |
| Design | brand-guardian, ui-designer | 2 |
| Marketing | content-strategist, growth-analyst | 2 |
| Operations | dependency-watcher, environment-manager, security-auditor | 3 |
| Product | product-manager, roadmap-tracker | 2 |
| Testing | test-lead, coverage-tracker, integration-tester | 3 |

---

## Part 6: Implementation Steps

### Must-do (P0)

1. **Fix PRD detector bug** — add `docs/01_product` to `DOC_ARTIFACT_DETECTORS` dirs in `discover.mjs:215`
2. **Add `cli` team to `teams.yaml`** — new entry after `quality`
3. **Add `cli-engineer` agent to `agents.yaml`** — new entry under `engineering` category
4. **Generate `/team-cli` command** — instantiate `team-TEMPLATE.md` with `cli` team values
5. **Generate `cli-engineer.agent.md`** — in `.github/agents/`
6. **Generate `team-cli.chatmode.md`** — in `.github/chatmodes/`
7. **Update `UNIFIED_AGENT_TEAMS.md`** — add T11 row + full definition
8. **Update `orchestrator.mjs`** — add `team-cli` to team registry
9. **Add T11-CLI items to `AGENT_BACKLOG.md`** — PRD-005 Phase 1 tasks

### Should-do (P1)

10. **Create `/prd-intake` command** — the missing PRD → backlog pipeline
11. **Add `prd-intake` to `commands.yaml`** — command spec entry
12. **Create `docs/01_product/INDEX.md`** — PRD index with statuses
13. **Generate `/team-product` command file** — currently missing despite spec existing

### Nice-to-have (P2)

14. **Create PRD-to-Team matrix** — either in UNIFIED_AGENT_TEAMS.md or standalone
15. **Evaluate `roadmap-tracker` agent** — may need PRD phase tracking
16. **Add scope overlap resolution rules** — document T11 overlaps with T8/T4/T9
