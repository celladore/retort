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

### What's Missing: Document → Backlog Pipeline

**Critical gap: There is no documented mechanism to tell any agent "read PRD-005 and generate backlog items from it" — or any other specification document for that matter.**

Current flow:
```
/orchestrate → /discover → /healthcheck → /sync-backlog → /plan → delegate
                                                ↑
                                     Reads AGENT_BACKLOG.md
                                     (manually populated — by whom?)
```

The Product Manager agent's responsibilities include "Prioritize backlog items" and "Write PRDs", but there's no command or workflow that says "take this document, extract deliverables, and write them into AGENT_BACKLOG.md with team assignments."

### Additional Bug: PRD Detector Doesn't Find PRDs

In `.agentkit/engines/node/src/discover.mjs` line 215:
```javascript
{ name: 'prd', label: 'PRDs', dirs: ['docs/prd', 'docs/PRD'], files: ['PRD.md', 'docs/PRD.md'] }
```

But actual PRDs live in `docs/01_product/`. The detector will **never find them**.

---

## Part 4: Intake Agent — Multi-Document-Type Specification Intake

### Design Principle

By the time this branch merges, a dedicated **Intake Agent** will exist. Rather than building a narrow `/prd-intake` command, all document-to-backlog intake — PRDs, functional specs, UI design specs, user stories, tech specs, process flows — should flow through this single agent. This keeps the intake pipeline unified, auditable, and extensible.

### Supported Document Types

| Document Type | Short ID | Typical Location | What Gets Extracted |
|--------------|----------|-------------------|---------------------|
| **Product Requirements Document (PRD)** | `prd` | `docs/01_product/PRD-*.md` | Phases, milestones, deliverables, acceptance criteria, personas, success metrics |
| **Functional Specification** | `func-spec` | `docs/02_specs/FUNC-*.md` | Feature descriptions, business rules, input/output contracts, edge cases, validation rules |
| **UI/UX Design Specification** | `ui-spec` | `docs/05_design/UI-*.md` | Screens/flows, component hierarchy, interaction patterns, responsive breakpoints, accessibility requirements |
| **User Stories** | `stories` | `docs/01_product/stories/` or inline in PRDs | As-a/I-want/So-that, acceptance criteria, story points, dependencies |
| **Technical Specification** | `tech-spec` | `docs/02_specs/TECH-*.md` | Architecture decisions, API contracts, data models, sequence diagrams, performance budgets |
| **Process Flow** | `process` | `docs/06_processes/FLOW-*.md` | Swimlane steps, decision points, error paths, SLAs, integration touchpoints |

### `/intake` Command Design

```
Usage: /intake <doc-type> <ID-or-path> [flags]

Examples:
  /intake prd PRD-005
  /intake func-spec FUNC-012
  /intake tech-spec docs/02_specs/TECH-003-json-rpc-api.md
  /intake ui-spec UI-001 --phase 2
  /intake stories docs/01_product/stories/sprint-14.md
  /intake process FLOW-007 --team backend

Behavior:
1. Resolve document from type + ID or path
   - prd PRD-005 → docs/01_product/PRD-005-*.md (glob match)
   - func-spec FUNC-012 → docs/02_specs/FUNC-012-*.md
   - Fallback: treat argument as literal file path
2. Detect document structure (headings, tables, lists)
3. Extract deliverables using type-specific extractors:
   - PRD: phases → deliverables → acceptance criteria
   - Func spec: features → business rules → validation rules
   - UI spec: screens → components → interaction flows
   - User stories: epics → stories → acceptance criteria
   - Tech spec: modules → API contracts → data models
   - Process flow: steps → decision points → integration touchpoints
4. Map extracted items to teams using teams.yaml scope patterns
5. Generate AGENT_BACKLOG.md entries:
   - Priority: derived from document structure (phases, priority fields, story points)
   - Team: from scope pattern matching against deliverable content
   - Source reference: doc type + ID (e.g., "PRD-005 Phase 1", "FUNC-012 §3.2")
   - Cross-team dependencies populated from dependency sections
   - Acceptance criteria carried forward verbatim
6. Output summary of proposed/written backlog items

Flags:
  --dry-run        Show proposed items without writing
  --phase N        Only intake from a specific phase/section
  --team <id>      Only intake items relevant to a specific team
  --append         Add to existing backlog (default)
  --replace        Replace existing items sourced from this document
  --priority-map   Override default priority mapping (e.g., "phase1=P0,phase2=P1")
```

### Intake Agent Definition for `agents.yaml`

```yaml
- id: intake-analyst
  category: product
  name: Intake Analyst
  role: >
    Reads specification documents (PRDs, functional specs, UI design specs,
    user stories, technical specs, process flows) and extracts actionable
    work items. Maps deliverables to teams, generates AGENT_BACKLOG.md
    entries with priorities and dependencies, and maintains traceability
    from source documents to backlog items.
  accepts:
    - intake
    - plan
    - review
  depends-on: []
  notifies:
    - product-manager
    - roadmap-tracker
  focus:
    - 'docs/01_product/**'
    - 'docs/02_specs/**'
    - 'docs/05_design/**'
    - 'docs/06_processes/**'
    - 'docs/prd/**'
    - 'AGENT_BACKLOG.md'
  responsibilities:
    - Parse PRDs and extract phases, deliverables, acceptance criteria
    - Parse functional specs and extract features, business rules, contracts
    - Parse UI/UX specs and extract screens, components, interaction flows
    - Parse user stories and extract epics, stories, acceptance criteria
    - Parse technical specs and extract modules, API contracts, data models
    - Parse process flows and extract steps, decision points, touchpoints
    - Map extracted items to teams using scope pattern matching
    - Generate AGENT_BACKLOG.md entries with priorities and dependencies
    - Maintain source-document-to-backlog traceability
    - Detect conflicts between overlapping specifications
    - Flag gaps where specs reference undefined components or teams
  preferred-tools:
    - Read
    - Write
    - Edit
    - Glob
    - Grep
```

### Intake Agent Gap Analysis Checklist

When the intake agent is built, it should be analyzed for these potential issues:

#### Functional Gaps

| # | Gap | Risk | Mitigation |
|---|-----|------|------------|
| 1 | **No document format validation** — what if a PRD doesn't follow the standard template? | Extraction silently produces incomplete/wrong items | Validate document structure before extraction; warn on missing required sections (e.g., "No Phases/Milestones section found in PRD-005") |
| 2 | **No idempotency** — running intake twice on the same doc creates duplicates | Backlog pollution, duplicate work assignments | Track intake provenance via source tags (e.g., `[PRD-005:Phase1:D3]`) and deduplicate on re-intake |
| 3 | **No cross-document dependency detection** — PRD-005 deliverables may depend on PRD-001 deliverables | Missing dependency edges in backlog | Cross-reference `dependsOn` fields against all previously intaken documents |
| 4 | **No partial re-intake** — if a PRD is updated, can you re-intake just the changed sections? | Full re-intake overwrites manual edits to backlog items | Diff-based re-intake: compare current doc against last-intaken snapshot |
| 5 | **No story point / effort estimation** — items land in backlog without sizing | Teams can't plan capacity | Optional `--estimate` flag that adds T-shirt size estimates based on deliverable complexity |
| 6 | **No validation of team assignments** — scope pattern matching may assign to wrong team | Misrouted work items | Include confidence score per assignment; flag low-confidence mappings for human review |

#### Bugs to Watch For

| # | Bug | Where to Check |
|---|-----|----------------|
| 1 | **PRD detector paths wrong** | `discover.mjs:215` — must include `docs/01_product` |
| 2 | **Glob resolution failures** | `prd PRD-005` must resolve `PRD-005-mesh-native-distribution.md`, not fail on partial match |
| 3 | **Markdown table parsing edge cases** | PRD phase tables with merged cells, empty columns, or multi-line cells |
| 4 | **Priority mapping off-by-one** | Phase 1 → P0, Phase 2 → P1, Phase 3 → P2 — verify boundary when PRD has 5+ phases (P3 is lowest, phases 4+ should all map to P3) |
| 5 | **Acceptance criteria with nested lists** | Nested bullet points in PRD acceptance criteria may be flattened or lost |
| 6 | **Unicode / special characters in doc IDs** | Doc paths with spaces, parens, or non-ASCII chars |

#### Missed Opportunities

| # | Opportunity | Value |
|---|-------------|-------|
| 1 | **Auto-generate dependency graph visualization** | Output a Mermaid diagram showing cross-team, cross-document dependencies |
| 2 | **Conflict detection across doc types** | Flag when a tech spec contradicts a PRD (e.g., PRD says "REST API" but tech spec says "GraphQL") |
| 3 | **Intake history / changelog** | Log every intake run to `events.log` with document hash, items created, teams affected |
| 4 | **Reverse traceability** — from backlog item back to source doc section | Enable "why does this task exist?" queries |
| 5 | **Auto-detect document type** | If user just says `/intake docs/02_specs/TECH-003.md`, infer `tech-spec` from path/content |
| 6 | **Batch intake** | `/intake prd --all` to intake all PRDs at once for initial backlog population |
| 7 | **Staleness detection** | Flag backlog items whose source document has been modified since last intake |
| 8 | **Integration with roadmap-tracker** | After intake, auto-update the roadmap-tracker agent with new milestones |

### How Intake Fits the Existing Flow

```
UPDATED FLOW:
  /intake prd PRD-005           ← intake agent: any doc type → backlog items
  /intake tech-spec TECH-003    ← same agent, different extractor
  /intake ui-spec UI-001        ← same agent, different extractor
       ↓
  AGENT_BACKLOG.md              ← now populated with spec-sourced items
       ↓
  /orchestrate                  ← existing: orchestrate from backlog (unchanged)
       ↓
  Phase 1-5 lifecycle           ← unchanged
```

The orchestrator remains untouched. The intake agent is a **pre-orchestration input stage** that converts any specification document into structured backlog items.

### Relationship to Existing Agents

| Agent | Relationship to Intake Agent |
|-------|------------------------------|
| **Product Manager** | Writes PRDs and specs that the intake agent consumes. Reviews intake output for accuracy. Does NOT perform intake itself — separation of concerns between authoring and processing. |
| **Roadmap Tracker** | Receives milestone updates after intake. Tracks phase-level progress across intaken documents. |
| **Orchestrator** | Reads `AGENT_BACKLOG.md` that intake populates. No direct interaction — decoupled via the backlog file. |
| **All team agents** | Receive tasks that originate from intaken documents. Source traceability tags let them trace back to the originating spec section. |

### Documents That Should Exist

| # | Document | Proposed Location | Purpose | Priority |
|---|----------|------------------|---------|----------|
| 1 | **`/intake` command** | `.agentkit/templates/claude/commands/intake.md` | Slash command definition for multi-doc-type intake | **P0** — this is the missing input stage |
| 2 | **Intake agent definition** | `.agentkit/spec/agents.yaml` (new `intake-analyst` entry) | Agent spec for the intake analyst | **P0** |
| 3 | **Document type extractors** | `.agentkit/engines/node/src/extractors/` | Per-doc-type parsing logic (prd.mjs, func-spec.mjs, etc.) | **P0** |
| 4 | **PRD Index** | `docs/01_product/INDEX.md` | Lists all PRDs with status, affected teams, last intake date | **P1** |
| 5 | **PRD-to-Team Matrix** | Section in `UNIFIED_AGENT_TEAMS.md` or `docs/01_product/PRD_TEAM_MATRIX.md` | Which teams are affected by which PRDs | **P1** |
| 6 | **Spec directory conventions** | `docs/README.md` or `docs/CONVENTIONS.md` | Documents expected directory layout, naming, and template for each doc type | **P1** |
| 7 | **Roadmap Tracker enhancement** | `.agentkit/spec/agents.yaml` (roadmap-tracker section) | Add intake-triggered milestone updates | **P2** |

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

### Must-do (P0) — CLI & Packaging Agent

1. **Fix PRD detector bug** — add `docs/01_product` to `DOC_ARTIFACT_DETECTORS` dirs in `discover.mjs:215`
2. **Add `cli` team to `teams.yaml`** — new entry after `quality`
3. **Add `cli-engineer` agent to `agents.yaml`** — new entry under `engineering` category
4. **Generate `/team-cli` command** — instantiate `team-TEMPLATE.md` with `cli` team values
5. **Generate `cli-engineer.agent.md`** — in `.github/agents/`
6. **Generate `team-cli.chatmode.md`** — in `.github/chatmodes/`
7. **Update `UNIFIED_AGENT_TEAMS.md`** — add T11 row + full definition
8. **Update `orchestrator.mjs`** — add `team-cli` to team registry
9. **Add T11-CLI items to `AGENT_BACKLOG.md`** — PRD-005 Phase 1 tasks

### Must-do (P0) — Intake Agent

10. **Add `intake-analyst` agent to `agents.yaml`** — new entry under `product` category
11. **Create `/intake` command** — `.agentkit/templates/claude/commands/intake.md`
12. **Add `intake` to `commands.yaml`** — command spec entry with doc-type argument
13. **Create extractor scaffolds** — `.agentkit/engines/node/src/extractors/{prd,func-spec,tech-spec,ui-spec,stories,process}.mjs`
14. **Generate `intake-analyst.agent.md`** — in `.github/agents/`

### Should-do (P1) — Supporting Artifacts

15. **Create `docs/01_product/INDEX.md`** — PRD index with status, affected teams, last intake date
16. **Create `docs/CONVENTIONS.md`** — directory layout and naming conventions for each doc type
17. **Generate `/team-product` command file** — currently missing despite spec existing
18. **Create PRD-to-Team matrix** — either in `UNIFIED_AGENT_TEAMS.md` or standalone
19. **Analyze intake agent for gaps** — run the gap analysis checklist from Part 4 against the built agent

### Nice-to-have (P2) — Enhancements

20. **Enhance `roadmap-tracker` agent** — add intake-triggered milestone updates
21. **Add scope overlap resolution rules** — document T11 overlaps with T8/T4/T9
22. **Implement batch intake** — `/intake prd --all` for initial backlog population
23. **Add staleness detection** — flag backlog items whose source doc changed since last intake
24. **Add dependency graph visualization** — Mermaid diagram output from intake
