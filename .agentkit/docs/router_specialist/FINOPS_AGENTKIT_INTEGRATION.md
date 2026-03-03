# FinOps / Cost-Ops and AgentKit Forge: Integration and Template Spec

> Authoritative doc for how `phoenixvc/pvc-costops-analytics` (FinOps implementation) and `agentkit-forge` (guidance and templates) work together. Consumer repos that enable the FinOps overlay get methodology and spec from the forge; concrete implementation lives in the repo.

## 1) Objective

- **Seamless cooperation**: Agents working in a FinOps-enabled repo (e.g. pvc-costops-analytics) follow forge-generated rules and optional Phase 1 spec; they implement or extend only in-repo (ADX KQL, Grafana, scripts, docs). The forge never ships executable KQL/Grafana/Python—only guidance and a reusable “what to build” spec.
- **Single source of truth for methodology**: Phased delivery, ADX cost assessment, reference-table and tag-suggestion patterns, IaC awareness, audit and reversibility are defined once in the forge and synced to any repo that opts in.
- **Clear handoff**: Forge owns “how to approach” and “what Phase 1 includes”; pvc-costops-analytics (or another FinOps repo) owns “the actual code and repo-specific docs.”

## 2) Repository Responsibility Model

| Concern | Primary Repo | Role |
| --- | --- | --- |
| FinOps methodology, rules, and Phase 1 spec (guidance only) | `agentkit-forge` | Spec + templates: rule domain, optional skill/doc; sync generates `.claude/rules`, `.claude/skills`, or docs in consumer. |
| FinOps implementation (KQL, Grafana, Advisor, scripts, Cost Guide) | `phoenixvc/pvc-costops-analytics` | All executable and dashboard artifacts; ADX schema, ingestion, dashboards, `export_az_tag_commands.py`, Cost Management Guide. |
| Session/token cost tracking (AI usage) | `agentkit-forge` | Existing `cost` command/skill; unrelated to cloud FinOps. |
| Downstream telemetry / KPI (orchestration vs runtime cost) | `phoenixvc/pvc-costops-analytics` | Consumer of canonical contracts; see UPSTREAM_MIGRATION_SPEC §6. |

So: **Forge = what to do and how to do it (rules/spec). Repo = where it gets done (code and config).**

## 3) How the Two Work Together

- **Sync**: When a repo (e.g. pvc-costops-analytics) runs `agentkit sync` with a FinOps-enabled overlay, the forge emits:
  - A **rule** (e.g. under a `finops` or `azure-costops` domain) that agents must follow when touching cost visibility, tagging, or optimization.
  - Optionally a **doc** or **skill** that summarizes Phase 1 scope so an agent knows what to implement or extend without re-reading the full plan.
- **Execution**: An agent in that repo, when asked to “add cost-by-product” or “fix untagged resources,” consults the forge-generated rule and optional spec; it then edits only repo files (e.g. `adx/kql/35_cost_analysis.kql`, `grafana/dashboards/azure-cost-overview.json`, `scripts/export_az_tag_commands.py`).
- **No duplication of implementation**: The forge does not contain KQL snippets, Grafana panel JSON, or Python scripts. Those stay in pvc-costops-analytics (or another FinOps repo). The forge only describes patterns and deliverables (e.g. “implement cost_by_product() that joins focus_normalized to resource_group_project and products”).
- **Handback**: If the forge or another agent “implements Phase 1” from scratch in a repo, it does so by following the forge’s Phase 1 spec and writing code in that repo; it defers to the repo’s existing structure (e.g. `adx/kql/` ordering, `scripts/run_adx_schema.py` order) and to the repo’s `phase1-implementation-summary.md` or equivalent if present.

## 4) FinOps Template the Forge Must Create

So that the two work seamlessly, the forge should add the following (all guidance-only; no executable code in the forge).

### 4.1 Rule domain: FinOps / Azure cost-ops

- **Location**: e.g. `.agentkit/spec/rules.yaml` (new domain or subsection) and, if applicable, a template under `.agentkit/templates/claude/rules/` that sync renders for FinOps-enabled overlays.
- **Content (summary)**:
  - Use **phased delivery**; get explicit confirmation before moving to the next phase.
  - Before building cost visibility on ADX, run an **ADX cost assessment** (cost profile vs data volume/query patterns; alternatives; recommendation: proceed / swap / hybrid).
  - Use **reference tables** for product attribution: e.g. `products`, `resource_group_project` (resourceGroup → project, product_id). Cost is attributed via resource group; unmapped resources appear as `<unassigned>`.
  - **Tag suggestions** for untagged resources: derive from the same mapping (e.g. lookup by resource group); expose in a function like `untagged_resources_with_suggestions()` and in Advisor/reporting; do not execute tag apply without **IaC check** (Terraform/Pulumi).
  - Any action that **modifies resource state** must be designed for **audit logging** and **reversibility** from the start.
  - **Implementation lives in the repo**: KQL, Grafana panels, Advisor integration, `az tag` export script (output-only; no execute without IaC check), Cost Management Guide. The forge does not ship these artifacts.

### 4.2 Optional: Phase 1 spec doc (template)

- **Location**: e.g. `.agentkit/docs/FINOPS_PHASE1_SPEC.md` or a template under `.agentkit/templates/docs/` that can be synced into a repo’s docs when FinOps overlay is enabled.
- **Content (summary)**:
  - **Reference tables**: `products` (product_id, name, description), `resource_group_project` (resourceGroup, project, product_id); DDL in repo.
  - **KQL functions**: `inventory_untagged_resources(_since)`, `untagged_resources_with_suggestions(_since)`, `cost_by_product(_since)`, `cost_trend_by_product(_since)`; behavior and dependency on reference tables.
  - **Grafana**: One row/section “FinOps Product & Tagging”; panels: untagged resources with tag suggestions (table), cost by product (pie/bar), cost trend by product (time series).
  - **Advisor**: Query `untagged_resources_with_suggestions`; system prompt instructs model to recommend applying suggested tags and to mention the repo’s `az tag` export script.
  - **Script**: Export script that queries ADX for suggestions and prints `az tag add` commands; no execution; document IaC check before running.
  - **Cost Management Guide**: Stub section (architecture, what Phase 1 enables, Phase 2 connective notes).
  - **Schema order**: Include reference tables in ADX deployment order (e.g. after base tables, before cost-analysis functions).

This doc is the “contract” the forge offers so that any agent (or human) implementing Phase 1 in a repo knows exactly what to add, without the forge holding repo-specific code.

### 4.3 Optional: FinOps skill or command

- **Option A**: Extend or reference the existing `cost` command/skill with a clear note that “cost” in the forge is for **session/token** tracking; for **cloud FinOps** work, follow the FinOps rule and Phase 1 spec.
- **Option B**: Add a separate skill (e.g. `finops` or `azure-cost-ops`) that is invoked when the user asks for cost visibility, tagging, or optimization; the skill body points to the rule and Phase 1 spec and says “implement in repo per spec.”

Either way, the forge must not duplicate the repo’s KQL or scripts—only point to the methodology and the spec.

## 5) What the Forge Should Assume About pvc-costops-analytics

- **Existing stack**: ADX (Kusto), FOCUS cost export, `focus_normalized()`, existing cost functions (e.g. `cost_untagged_resources`), Grafana Azure Data Explorer datasource, Python Advisor, Terraform infra.
- **Conventions**: KQL in `adx/kql/` with numbered ordering (e.g. `10_tables.kql`, `15_reference_tables.kql`, `35_cost_analysis.kql`); dashboards in `grafana/dashboards/`; scripts in `scripts/`; docs in `docs/` (e.g. `cost-analysis-guide.md`, `adx-cost-assessment.md`, `phase1-gaps-and-ambiguities.md`).
- **Downstream role**: pvc-costops-analytics is both the **implementation home** for FinOps and a **downstream consumer** for telemetry/KPI (see UPSTREAM_ISSUE_BODY, UPSTREAM_MIGRATION_SPEC). Event families and ingestion contracts stay aligned via the same checklist/gates.

## 6) Integration Checklist (for Forge Maintainers)

- [ ] Add FinOps rule domain (and optional template) to spec + templates; ensure overlay can enable “finops” or “azure-cost-ops” without shipping code.
- [ ] Add optional Phase 1 spec doc (or template) describing reference tables, four KQL functions, Grafana panels, Advisor change, export script, Cost Guide stub, schema order.
- [ ] Document in COMMAND_REFERENCE or QUICK_START that “cost” is session/token; cloud FinOps is governed by the FinOps rule and optional skill/spec.
- [ ] Ensure generated artifacts in consumer repos are reference-only for this doc; authoritative text lives in agentkit-forge (same policy as router_specialist).

## 7) References

- Router-specialist ownership and downstream analytics: [UPSTREAM_MIGRATION_SPEC.md](UPSTREAM_MIGRATION_SPEC.md), [UPSTREAM_ISSUE_BODY.md](UPSTREAM_ISSUE_BODY.md).
- pvc-costops-analytics (implementation): `phoenixvc/pvc-costops-analytics` — `adx/kql/`, `grafana/dashboards/`, `advisor/app/`, `scripts/`, `docs/`.
- Forge architecture and sync: `.agentkit/docs/ARCHITECTURE.md`, `.agentkit/docs/CUSTOMIZATION.md`.
