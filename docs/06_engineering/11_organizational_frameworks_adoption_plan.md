# Organizational & Management Frameworks Adoption Plan

**Created**: 2026-03-05
**Status**: Planning
**Companion to**: `10_scrum_team_practices_adoption_plan.md` (Scrum-specific practices)
**Author**: Human + AI collaborative session

---

## Purpose

Scrum is one framework among many. Real organizations draw from Kanban, Lean, XP, Shape Up, Team Topologies, DORA, the Spotify Model, Toyota Production System, military C2 doctrine, incident management, and more. This document surveys all major frameworks, extracts principles relevant to AI agent teams, and proposes concrete adoption plans.

---

## Part 1: Framework Survey

### Frameworks Assessed

| # | Framework | Origin | Core Idea |
|---|-----------|--------|-----------|
| 1 | **Kanban** | Toyota / David Anderson | Visualize flow, limit WIP, manage bottlenecks |
| 2 | **Extreme Programming (XP)** | Kent Beck | Technical excellence through disciplined engineering practices |
| 3 | **Lean Software Development** | Poppendieck / Toyota Production System | Eliminate waste, deliver fast, amplify learning |
| 4 | **Shape Up** | Basecamp / Ryan Singer | Fixed time, variable scope, appetite-driven bets |
| 5 | **Team Topologies** | Skelton & Pais | Optimize team structures for fast flow of change |
| 6 | **DORA / Accelerate** | Google / Forsgren, Humble, Kim | Measure and optimize software delivery performance |
| 7 | **Spotify Model** | Spotify (Henrik Kniberg) | Squads, tribes, chapters, guilds — autonomous alignment |
| 8 | **Toyota Production System (TPS)** | Taiichi Ohno | Just-in-time, jidoka (stop-the-line), kaizen |
| 9 | **Theory of Constraints (TOC)** | Eliyahu Goldratt | Find and exploit the bottleneck — everything else is secondary |
| 10 | **Incident Command System (ICS)** | Emergency management | Structured escalation, clear roles, unified command |
| 11 | **Mission Command (Auftragstaktik)** | Military doctrine | Intent-based delegation — tell "what" and "why", not "how" |
| 12 | **OKRs** | Intel / Google | Objectives & Key Results — alignment without micromanagement |
| 13 | **Six Sigma / DMAIC** | Motorola / GE | Data-driven quality improvement through statistical control |
| 14 | **Cynefin Framework** | Dave Snowden | Match decision-making approach to problem complexity domain |
| 15 | **Wardley Mapping** | Simon Wardley | Situational awareness through value chain evolution mapping |

---

## Part 2: Principles Extracted & Relevance Assessment

### From Kanban

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| K1 | **Visualize the workflow** | Make all work visible in its current state | Yes | Agents need a shared board — not just a backlog list but a flow visualization showing where each item is in the pipeline |
| K2 | **Limit Work in Progress** | Constrain concurrent work to force completion | Yes | Already planned in Scrum doc — Kanban reinforces this as foundational |
| K3 | **Manage flow, not people** | Focus on moving work items smoothly through the system | Yes | Agents aren't "managed" — their work items are. Measure cycle time, not utilization |
| K4 | **Make policies explicit** | Write down how decisions are made | Yes | Decision policies are currently implicit in agent roles — make them explicit |
| K5 | **Implement feedback loops** | Regular cadences for review and adjustment | Yes | Maps to sync/retro but adds the idea of multiple feedback loops at different frequencies |
| K6 | **Improve collaboratively, evolve experimentally** | Small changes, measured outcomes | Yes | Process changes should be experiments with success criteria, not permanent mandates |
| K7 | **Service Level Expectations (SLEs)** | Probabilistic delivery commitments | Yes | "85% of P1 items complete within 2 sessions" is more honest than "all P1s done in sprint" |
| K8 | **Classes of Service** | Different handling for different work types | Yes | Expedite lane for P0, standard for P1-P2, intangible for tech debt |
| K9 | **Cumulative Flow Diagram** | Visual of items in each state over time | Partial | Useful for detecting bottlenecks — can be a text-based approximation |

### From Extreme Programming (XP)

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| X1 | **Continuous Integration** | Integrate frequently, at least daily | Yes | Already present via CI — extend to "every agent task integrates before next begins" |
| X2 | **Test-First Development** | Write test before implementation | Yes | Agents should write the test that proves the story, then implement to pass it |
| X3 | **Incremental Design** | Design emerges from refactoring, not upfront | Yes | Agents over-architect. Principle: implement the simplest thing, refactor when the pattern emerges |
| X4 | **10-Minute Build** | Build + test must run in under 10 minutes | Yes | If CI takes too long, agents can't get fast feedback. Set a build time budget |
| X5 | **Collective Code Ownership** | Anyone can change any code | Yes | Already planned in Scrum doc — XP validates this as critical |
| X6 | **Coding Standards** | Team-wide style agreements | Yes | Already present — `02_coding_standards.md` and linter config |
| X7 | **Sustainable Pace** | Don't burn out the team | Reframed | For agents: don't exhaust context windows or token budgets. "Sustainable pace" = session scope that fits within budget |
| X8 | **Customer on Team** | Customer available for questions at all times | Yes | The human (you) should be reachable for clarification — model as "Product Owner availability SLA" |
| X9 | **Spike solutions** | Time-boxed investigation before committing to a plan | Yes | Agents should do spikes — short, throwaway investigations — before estimating complex work |

### From Lean Software Development

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| L1 | **Eliminate waste** | Anything that doesn't deliver value to the user is waste | Yes | Agents generate verbose docs, over-scaffold, create unused abstractions. Identify and eliminate waste categories |
| L2 | **Amplify learning** | Build knowledge through rapid feedback | Yes | Short cycles: implement → test → review → learn. Not: plan → plan → plan → implement |
| L3 | **Decide as late as possible** | Defer decisions until the last responsible moment | Yes | Don't choose database schema before API contract is finalized. Sequence decisions to maximize information |
| L4 | **Deliver as fast as possible** | Speed of delivery is a competitive advantage | Yes | Smaller deliverables, more frequent integration. Every session should ship something |
| L5 | **Empower the team** | Give agents autonomy within their scope | Yes | Agents shouldn't need orchestrator approval for every micro-decision within their domain |
| L6 | **Build integrity in** | Quality is built in, not inspected in | Yes | DoD is inspection. Better: agents inherently include tests, handle errors, consider edge cases |
| L7 | **See the whole** | Optimize the whole system, not local components | Yes | Backend speed doesn't matter if it blocks frontend. Optimize end-to-end flow |
| L8 | **Value Stream Mapping** | Map the entire flow from request to delivery | Yes | Map: idea → backlog → refined → sprint → implement → review → merge → deploy. Find waste in each step |

### From Shape Up

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| S1 | **Appetite, not estimates** | Set a time budget, scope to fit | Yes | Instead of "how long will this take?" ask "how much are we willing to spend on this?" Then scope accordingly |
| S2 | **Betting table** | Leadership bets on pitches — explicit resource allocation | Yes | Product Owner explicitly bets sprint capacity on proposals. Not everything makes the cut |
| S3 | **Six-week cycles** | Longer cycles than Scrum sprints, with cooldown | Partial | The cycle concept is good. Cooldown (1 week of unstructured work) could reduce tech debt |
| S4 | **Hill charts** | Track work as "figuring it out" (uphill) vs "making it happen" (downhill) | Yes | Brilliant for agents. Much work stalls on the uphill — agent doesn't know how to solve it yet. Separate discovery from execution |
| S5 | **Fat marker sketches** | Low-fidelity scope definitions, intentionally loose | Yes | Over-specified tasks constrain agents. Define the "shape" of the solution, leave room for agent judgment |
| S6 | **Circuit breaker** | If work isn't done by deadline, it doesn't get an extension — it gets re-evaluated | Yes | Prevents runaway tasks. If a task can't complete in its appetite, it's re-scoped or killed, not extended indefinitely |
| S7 | **Cooldown period** | Buffer between cycles for cleanup, exploration, tech debt | Yes | Dedicated time for agents to refactor, update deps, clean up. Not "waste" — investment |

### From Team Topologies

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| T1 | **Four team types** | Stream-aligned, enabling, complicated-subsystem, platform | Yes | Our teams are all stream-aligned. We're missing enabling teams (help others adopt new practices) and platform teams (provide shared capabilities) |
| T2 | **Cognitive load management** | Teams should own what they can cognitively handle | Yes | Agents have context window limits — literally a cognitive load ceiling. Scope ownership accordingly |
| T3 | **Team interaction modes** | Collaboration, X-as-a-Service, Facilitating | Yes | Define how teams interact: Backend and Frontend collaborate; Testing provides testing-as-a-service; Quality facilitates |
| T4 | **Team API** | Each team has an explicit interface for how others interact with it | Yes | Each team should publish: what it accepts, what it produces, how to request work, expected turnaround |
| T5 | **Minimize cross-team dependencies** | Restructure to reduce handoffs | Yes | Every handoff is a delay and information loss. Design team boundaries to minimize them |
| T6 | **Thinnest viable platform** | Platform provides just enough to enable stream teams | Yes | Shared tooling (lint, CI, test framework) should be a platform — not each team's responsibility |
| T7 | **Sensing and evolving** | Team structures should change when flow demands it | Yes | If backend and data are always blocking each other, maybe they should merge |

### From DORA / Accelerate

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| D1 | **Deployment Frequency** | How often you deploy to production | Yes | Track: how many completed items ship per sprint. Higher = healthier |
| D2 | **Lead Time for Changes** | Time from commit to production | Yes | For agents: time from "task assigned" to "task merged". Measure and reduce |
| D3 | **Mean Time to Recovery (MTTR)** | How fast you recover from failure | Yes | When an agent introduces a regression, how fast is it detected and fixed? |
| D4 | **Change Failure Rate** | % of changes that cause failures | Yes | Track: what % of merged PRs cause test failures, reverts, or hotfixes |
| D5 | **Trunk-based development** | Short-lived branches, frequent integration | Yes | Agents should merge small, often. Not: work on a branch for 5 sessions then mega-merge |
| D6 | **Loosely coupled architecture** | Teams can deploy independently | Partial | More relevant at scale — but principle of independent team delivery is sound |
| D7 | **Monitoring and observability** | Know what's happening in production | Reframed | For agents: observability of agent work. Can you see what each agent did, decided, and produced? |

### From the Spotify Model

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| SP1 | **Squads** | Autonomous, cross-functional teams with a mission | Partial | Our teams are specialist, not cross-functional. Consider mission-based squads for large features |
| SP2 | **Tribes** | Collections of squads in a related area | Partial | Engineering + Testing + Quality could be a "delivery tribe" |
| SP3 | **Chapters** | People with the same skill across different squads | Yes | All agents that do code review (backend, frontend, quality, security) form a "review chapter" — shared practices |
| SP4 | **Guilds** | Voluntary communities of interest | Yes | Cross-cutting concerns like "performance", "accessibility", "security hardening" could be guilds that any agent joins |
| SP5 | **Alignment over autonomy** | Aligned autonomy: agree on what, free on how | Yes | Core principle for agent delegation. Orchestrator sets the "what" and "why", agents own the "how" |

### From Toyota Production System (TPS)

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| TP1 | **Jidoka (stop the line)** | Stop everything when a defect is found | Yes | If an agent discovers a broken test, security vuln, or data corruption — all agents stop and fix it first |
| TP2 | **Andon cord** | Anyone can signal a problem and halt work | Yes | Any agent should be able to raise an "andon" alert that pauses new work assignment |
| TP3 | **Just-in-time** | Produce only what's needed, when it's needed | Yes | Don't pre-generate boilerplate, scaffolding, or docs for features not yet built |
| TP4 | **Kaizen (continuous improvement)** | Small, constant improvements | Yes | Every retro action item is a kaizen. Track kaizen count per sprint as a health metric |
| TP5 | **Genchi Genbutsu (go and see)** | Decisions based on direct observation, not reports | Yes | Agents should read actual code, run actual tests, check actual state — not rely on stale docs or assumptions |
| TP6 | **Poka-yoke (mistake-proofing)** | Design systems that prevent errors | Yes | Linters, pre-commit hooks, DOR gates, DoD checklists — all poka-yoke. Add more where defects recur |
| TP7 | **Heijunka (level the workload)** | Distribute work evenly to avoid overload/idle cycles | Yes | Orchestrator should balance work across teams, not overload backend while docs is idle |

### From Theory of Constraints (TOC)

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| C1 | **Identify the constraint** | Find the single bottleneck limiting throughput | Yes | At any time, one team is the bottleneck. Find it. Everything else is secondary |
| C2 | **Exploit the constraint** | Maximize throughput of the bottleneck | Yes | If backend is the bottleneck, ensure it has zero interruptions, zero waiting, zero waste |
| C3 | **Subordinate everything else** | Non-bottleneck teams serve the bottleneck | Yes | Other teams should produce work that feeds the bottleneck smoothly — not create more work that piles up |
| C4 | **Elevate the constraint** | Invest to increase bottleneck capacity | Yes | Add secondary scope, swarm, or split the team. But only after exploiting first |
| C5 | **Repeat** | When the bottleneck shifts, find the new one | Yes | The constraint moves as the system changes. Continuously reassess |
| C6 | **Drum-Buffer-Rope** | Pace the system to the bottleneck's rhythm | Partial | The bottleneck team's throughput sets the pace. Don't overload upstream or downstream |

### From Incident Command System (ICS)

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| I1 | **Unified command** | Single point of authority during incidents | Yes | During P0 events, one agent (or the orchestrator) takes command. No committee decisions |
| I2 | **Span of control** | No one manages more than 5-7 direct reports | Yes | Orchestrator shouldn't manage 10 teams simultaneously. Group into 3-4 clusters |
| I3 | **Modular organization** | Scale up/down by adding/removing modules | Yes | For large features, spin up temporary "task forces" from existing teams. Dissolve when done |
| I4 | **Incident Action Plan** | Written plan for the operational period | Yes | For P0 incidents: written plan with objectives, assignments, timeline, and success criteria |
| I5 | **After-Action Review (AAR)** | Structured debrief after every incident | Yes | Extends the retrospective concept — specifically for incidents/failures |

### From Mission Command (Auftragstaktik)

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| M1 | **Commander's intent** | State the end state and purpose, not the method | Yes | Orchestrator says "Users can log in with OAuth" not "Create an OAuth controller at path X with methods Y" |
| M2 | **Subsidiarity** | Decisions made at the lowest competent level | Yes | Agents decide implementation details. Orchestrator doesn't specify file names, function signatures, or library choices |
| M3 | **Mutual trust** | Agents trust each other's competence within their domain | Yes | Backend trusts testing to write good tests. Testing trusts backend to write testable code |
| M4 | **Agility and initiative** | Adapt when the situation changes from the plan | Yes | If an agent discovers the planned approach won't work, it should pivot — not blindly follow a stale plan |
| M5 | **Shared situational awareness** | Everyone understands the current state | Yes | Maps to daily sync — but adds "shared understanding of the strategic picture", not just individual status |

### From OKRs

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| O1 | **Objectives** | Qualitative, inspirational goals | Yes | "Make the API robust and well-tested" rather than just a task list |
| O2 | **Key Results** | Measurable outcomes that prove the objective is met | Yes | "API has 90%+ test coverage, p95 latency < 200ms, zero unhandled errors" |
| O3 | **Alignment cascade** | Team OKRs derive from org OKRs | Yes | Sprint goal → team-level key results. Every team's work traces to the sprint objective |
| O4 | **Scoring and review** | Score OKRs at end of period (0.0-1.0) | Yes | At sprint review, score each key result. 0.7 is good. 1.0 means you aimed too low |

### From Cynefin Framework

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| CY1 | **Domain classification** | Clear, Complicated, Complex, Chaotic — different domains need different approaches | Yes | Not all tasks are the same. A "clear" task (add a field) needs no spike. A "complex" task (design auth system) needs experimentation |
| CY2 | **Probe-Sense-Respond** | For complex problems: try something, observe, adapt | Yes | Agents should spike complex tasks, observe results, then commit to an approach |
| CY3 | **Sense-Analyze-Respond** | For complicated problems: analyze first, then act | Yes | Agents with expertise analyze the domain, propose a solution, then implement |
| CY4 | **Act-Sense-Respond** | For chaotic problems: act immediately to stabilize, then figure out what happened | Yes | P0 incidents: fix first, understand later. Don't analyze while production is down |

### From Wardley Mapping

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| W1 | **Value chain awareness** | Know what you build vs buy vs commodity | Partial | Don't build what a library provides. Agents should check for existing solutions before implementing |
| W2 | **Evolution stage awareness** | Genesis → Custom → Product → Commodity | Partial | Our auth system is in "genesis" — treat it differently than logging (commodity). Different quality bars |

### From Six Sigma / DMAIC

| # | Principle | Description | Relevant? | Why |
|---|-----------|-------------|-----------|-----|
| SS1 | **DMAIC cycle** | Define → Measure → Analyze → Improve → Control | Yes | Structured improvement: define the problem, measure current state, analyze root cause, improve, then put controls in place |
| SS2 | **Statistical process control** | Measure variation, reduce it | Partial | Track variation in cycle time, estimation accuracy, defect rates. Reduce variation = predictability |
| SS3 | **Voice of the Customer** | Ground decisions in user needs | Yes | Every feature traces back to a user story or PRD. No agent-driven features without user justification |

---

## Part 3: Consolidated Adoption Items

Grouping all adoptable principles into concrete implementation items, deduplicated and organized by theme.

### Theme A: Flow & Bottleneck Management

| # | Item | Source Framework(s) | Description |
|---|------|-------------------|-------------|
| A1 | **Kanban board visualization** | Kanban, TPS | Add a visual flow board to `AGENT_BACKLOG.md`: columns for `Ready → In Progress → In Review → Done`. Not just a flat table — a state machine |
| A2 | **Cycle time tracking** | Kanban, DORA, Lean | Measure time from "task starts" to "task merged". Track per team. Identify slow stages |
| A3 | **Bottleneck identification protocol** | TOC | Every sprint, identify which team is the constraint. Orchestrator subordinates other teams to feed the bottleneck |
| A4 | **Classes of service / swim lanes** | Kanban | Four lanes: Expedite (P0, drops everything), Standard (P1-P2), Tech Debt (reserved capacity), Spike (investigation) |
| A5 | **Service Level Expectations** | Kanban | Probabilistic commitments: "85% of P1 items complete within 2 sessions." More honest than deterministic promises |
| A6 | **Cumulative flow tracking** | Kanban | Track items in each state over time. Widening bands = bottleneck forming |
| A7 | **Heijunka / workload leveling** | TPS | Orchestrator distributes work evenly. No team at 100% while another is idle |

### Theme B: Quality & Defect Prevention

| # | Item | Source Framework(s) | Description |
|---|------|-------------------|-------------|
| B1 | **Stop-the-line (Jidoka)** | TPS | If any agent discovers a broken build, security vulnerability, or data corruption: ALL work pauses. Fix the defect first. No new work until green |
| B2 | **Andon alert system** | TPS | Any agent can raise an alert in `AGENT_BACKLOG.md` or `STANDUP.md` that triggers orchestrator attention. Format: `ANDON: [team] — [issue] — [severity]` |
| B3 | **Poka-yoke expansion** | TPS, Six Sigma | Audit where defects recur. For each recurring defect type, add a prevention mechanism (linter rule, pre-commit check, DOR criterion) |
| B4 | **Test-first development** | XP | Agents write the test that proves acceptance criteria, then implement to pass it. Enforced in DoD |
| B5 | **10-minute build budget** | XP | Set a ceiling on CI time. If build + test exceeds 10 minutes, it becomes a P1 tech debt item |
| B6 | **Change failure rate tracking** | DORA | Track % of merged PRs that cause test failures, reverts, or hotfixes. Target: < 15% |
| B7 | **MTTR tracking** | DORA | Measure time from "defect detected" to "fix merged". Target: < 1 session for P0/P1 |

### Theme C: Decision-Making & Delegation

| # | Item | Source Framework(s) | Description |
|---|------|-------------------|-------------|
| C1 | **Commander's intent** | Mission Command | Orchestrator provides intent, not instructions. "Users should be able to reset their password securely" not "Create a POST endpoint at /api/auth/reset with fields email and token..." |
| C2 | **Subsidiarity principle** | Mission Command | Agents make implementation decisions within their domain. Orchestrator approves scope and priority, not file names |
| C3 | **Cynefin domain classification** | Cynefin | Tag each backlog item with complexity domain: Clear / Complicated / Complex / Chaotic. This determines approach |
| C4 | **Spike-before-estimate** | XP, Shape Up, Cynefin | For "Complex" domain items: mandatory time-boxed spike before estimating. Agent investigates for max 1 session, reports findings, then the item is re-scoped and estimated |
| C5 | **Appetite-based scoping** | Shape Up | Instead of "how long will X take?" → "We're willing to spend 2 sessions on X. What scope fits?" Forces ruthless prioritization |
| C6 | **Circuit breaker** | Shape Up | If a task exceeds its appetite (time budget), it stops. Re-evaluate: re-scope, re-estimate, or kill. No indefinite extensions |
| C7 | **Last responsible moment** | Lean | Defer decisions until you have maximum information. Don't pick a database before understanding data patterns |
| C8 | **Betting table** | Shape Up | Product Owner "bets" sprint capacity. Not everything gets funded. Explicit trade-offs, visible to all |

### Theme D: Team Structure & Interaction

| # | Item | Source Framework(s) | Description |
|---|------|-------------------|-------------|
| D1 | **Team interaction modes** | Team Topologies | Define for each team pair: Collaboration (work together), X-as-a-Service (request/response), or Facilitating (coaching/enabling) |
| D2 | **Team API** | Team Topologies | Each team publishes an explicit contract: what it accepts, what it produces, how to request work, SLE for response |
| D3 | **Cognitive load budgeting** | Team Topologies | Agents have context windows. Don't assign a team work that exceeds what it can hold in context. Measure and respect the ceiling |
| D4 | **Chapters for shared practices** | Spotify | Cross-team groups for shared skills: "Review Chapter" (all agents that review code), "Testing Chapter" (all agents that write tests) — shared standards |
| D5 | **Guilds for cross-cutting concerns** | Spotify | Voluntary interest groups: "Performance Guild", "Security Guild", "DX Guild". Any team member can participate. Guilds propose standards and tools |
| D6 | **Span of control limits** | ICS | Orchestrator manages max 4-5 team clusters, not 10 individual teams. Group teams into clusters for oversight |
| D7 | **Temporary task forces** | ICS | For large cross-cutting features, assemble a temporary squad from multiple teams. Dissolves when feature ships |
| D8 | **Enabling team role** | Team Topologies | One team (quality or a new "enablement" role) helps other teams adopt new practices, tools, and standards. Not doing the work for them — teaching them |

### Theme E: Planning & Strategy

| # | Item | Source Framework(s) | Description |
|---|------|-------------------|-------------|
| E1 | **OKRs per sprint** | OKRs | Sprint Goal becomes an Objective. Add 2-3 measurable Key Results. Score at sprint review |
| E2 | **Hill charts** | Shape Up | Track each task on a hill: left side (uphill) = figuring it out, right side (downhill) = making it happen. Stuck on the left = needs a spike or swarm |
| E3 | **Value stream mapping** | Lean | Map the full flow: idea → backlog → refined → sprint → implement → review → merge → deploy. Identify and eliminate waste at each step |
| E4 | **Cooldown periods** | Shape Up | Between major sprints, 1 session of unstructured time: tech debt, exploration, tooling improvements, dependency updates |
| E5 | **Fat marker sketches** | Shape Up | Task descriptions should be intentionally loose. Define the shape of the solution, not the exact implementation. Leave room for agent judgment and initiative |
| E6 | **DMAIC for process problems** | Six Sigma | When a process problem is identified (e.g., "reviews take too long"): Define it precisely, Measure current state, Analyze root cause, Improve with a specific change, Control with a new policy |

### Theme F: Learning & Improvement

| # | Item | Source Framework(s) | Description |
|---|------|-------------------|-------------|
| F1 | **After-Action Review (AAR)** | ICS, Military | For every P0 incident: structured debrief within 1 session. What was planned, what happened, why, what we'll do differently |
| F2 | **Kaizen counter** | TPS | Track number of small improvements per sprint. Health metric: increasing kaizen count = healthy culture |
| F3 | **Genchi Genbutsu rule** | TPS | Agents must verify state directly before acting. Read the actual file, run the actual test, check the actual error. Never act on assumptions or stale information |
| F4 | **Experiment-driven improvement** | Kanban, Lean | Every process change is an experiment: hypothesis, duration, success criteria. Keep if it works, revert if it doesn't |
| F5 | **5 Whys for systemic issues** | TPS, Lean | Already proposed in Scrum plan — reinforced here as a Lean practice |
| F6 | **Voice of the Customer trace** | Six Sigma | Every feature traces to a user need. If an agent proposes work that can't trace to a user story or PRD, it's challenged |
| F7 | **Build-Measure-Learn loop** | Lean Startup | Ship small, measure impact, learn, iterate. Not: build everything, then hope it works |

### Theme G: Sustainability & Pace

| # | Item | Source Framework(s) | Description |
|---|------|-------------------|-------------|
| G1 | **Sustainable pace / token budgeting** | XP (reframed) | Each session has a token/cost budget. Scope work to fit within budget. Don't overload sessions — leave margin for unexpected work |
| G2 | **Slack / buffer time** | Kanban, TOC | Not all capacity should be scheduled. Reserve 15-20% for unplanned work, discoveries, and emergent blockers |
| G3 | **Just-in-time work preparation** | TPS, Lean | Don't pre-generate scaffolding, docs, or boilerplate for features not yet in sprint. Produce just what's needed, when it's needed |

---

## Part 4: Prioritized Adoption Roadmap

### Tier 1 — High Impact, Low Effort (Adopt Now)

| # | Item | Implementation |
|---|------|----------------|
| A4 | Classes of service | Add swim lanes to `AGENT_BACKLOG.md`: Expedite / Standard / Tech Debt / Spike |
| B1 | Stop-the-line | Add `JIDOKA` policy: broken build = all new work pauses. Document in `DOD.md` |
| B2 | Andon alerts | Add `## Alerts` section to `STANDUP.md`. Any agent can post `ANDON: [description]` |
| C1 | Commander's intent | Update orchestrator guidance: provide intent and acceptance criteria, not implementation steps |
| C2 | Subsidiarity | Codify: "Agents own implementation decisions within their scope" in `teams.yaml` process section |
| C3 | Cynefin domain tags | Add `complexity:` field to backlog items: `clear / complicated / complex / chaotic` |
| E5 | Fat marker sketches | Update DOR: task descriptions must define shape, not prescribe implementation |
| F3 | Genchi Genbutsu | Add to agent rules: "Always verify current state directly before acting. Do not assume" |
| G3 | Just-in-time | Add to agent rules: "Do not create scaffolding, boilerplate, or docs for work not yet in sprint" |

### Tier 2 — High Impact, Moderate Effort (Next Sprint)

| # | Item | Implementation |
|---|------|----------------|
| A1 | Kanban board | Restructure `AGENT_BACKLOG.md` with flow columns: Ready → In Progress → In Review → Done |
| A2 | Cycle time tracking | Add `started:` and `completed:` timestamps to backlog items. Calculate cycle time in sprint metrics |
| A3 | Bottleneck identification | Add "Constraint Analysis" section to sprint retrospective template |
| B4 | Test-first development | Add to DoD: "Test written before or concurrently with implementation. Test existed before code was marked complete" |
| C4 | Spike-before-estimate | For items tagged `complexity: complex`, require spike of max 1 session before estimation |
| C5 | Appetite-based scoping | Add `appetite:` field to backlog items (in sessions). If work exceeds appetite, circuit breaker triggers |
| C6 | Circuit breaker | Orchestrator enforces: task exceeding appetite stops, goes to Product Owner for re-scope or kill |
| D1 | Team interaction modes | Add `interaction-mode:` to team pairs in `teams.yaml`: collaboration / x-as-a-service / facilitating |
| D2 | Team API | Each team entry in `teams.yaml` gets `api:` section: accepts, produces, sle |
| E1 | OKRs per sprint | Sprint Goal becomes Objective + 2-3 Key Results. Scored 0.0-1.0 at sprint review |
| F1 | After-Action Review | Add AAR template for P0 incidents in `docs/history/lessons-learned/` |

### Tier 3 — High Impact, Significant Design Work (Future Sprints)

| # | Item | Implementation |
|---|------|----------------|
| A5 | Service Level Expectations | Define SLEs per priority: P0 within same session, P1 within 2 sessions, P2 within sprint |
| A7 | Workload leveling | Orchestrator algorithm: balance assigned points across teams, flag imbalance > 30% |
| B5 | Build time budget | Set CI ceiling: 10 minutes. Track and alert when exceeded. Treat breaches as P1 tech debt |
| B6 | Change failure rate | Track via CI: % of merges followed by a revert or hotfix within 2 sessions |
| B7 | MTTR tracking | Measure from "defect raised" to "fix merged". Add to sprint metrics |
| D3 | Cognitive load budget | Estimate context window usage per task. Don't assign tasks whose combined context exceeds window |
| D4 | Chapters | Create review chapter, testing chapter. Shared standards documents per chapter |
| D5 | Guilds | Create optional guilds: performance, security, DX. Any agent can join. Guilds propose improvements |
| D6 | Span of control | Group 10 teams into 3-4 clusters. Orchestrator manages clusters, cluster leads manage teams |
| D7 | Task forces | Protocol for assembling temporary cross-team squads for large features |
| E2 | Hill charts | Track task progress as uphill (discovery) vs downhill (execution). Flag tasks stuck uphill for > 1 session |
| E3 | Value stream mapping | Map full delivery pipeline. Identify and target the largest waste source each sprint |
| E4 | Cooldown periods | After every 3-4 sprints, 1 session of unstructured time for tech debt, exploration, tooling |
| G1 | Token/cost budgeting | Set per-session budget. Orchestrator scopes work to fit. Track actual vs budget |
| G2 | Buffer capacity | Reserve 15-20% of sprint capacity unallocated for emergent work |

---

## Part 5: Framework Integration Map

How these frameworks layer onto each other:

```
                        STRATEGIC LAYER
    ┌──────────────────────────────────────────────┐
    │  OKRs (alignment) + Wardley Maps (awareness) │
    │  Shape Up (appetite/bets) + Cynefin (domain)  │
    └────────────────────┬─────────────────────────┘
                         │
                    PLANNING LAYER
    ┌────────────────────┴─────────────────────────┐
    │  Sprint Planning + Backlog Refinement         │
    │  Appetite scoping + Spike investigations      │
    │  Betting table + DOR gate                     │
    └────────────────────┬─────────────────────────┘
                         │
                   EXECUTION LAYER
    ┌────────────────────┴─────────────────────────┐
    │  Kanban flow + WIP limits + Classes of service│
    │  Commander's intent + Subsidiarity            │
    │  TDD + Pair programming + CI                  │
    │  Stop-the-line + Andon alerts                 │
    └────────────────────┬─────────────────────────┘
                         │
                   FEEDBACK LAYER
    ┌────────────────────┴─────────────────────────┐
    │  Daily sync + Sprint review + Retrospective   │
    │  DORA metrics + Cycle time + Velocity         │
    │  AAR + 5 Whys + DMAIC                         │
    │  Hill charts + Burndown + Cumulative flow     │
    └────────────────────┬─────────────────────────┘
                         │
                 STRUCTURAL LAYER
    ┌────────────────────┴─────────────────────────┐
    │  Team Topologies (team types + interaction)   │
    │  Spotify (chapters + guilds)                  │
    │  ICS (span of control + task forces)          │
    │  Cognitive load management                    │
    └──────────────────────────────────────────────┘
```

---

## Part 6: What NOT to Adopt (and Why)

| Framework/Practice | Why Skip |
|---|---|
| **SAFe (Scaled Agile Framework)** | Designed for 50-150+ person organizations. Our 10-team agent setup is too small. SAFe adds ceremony overhead that only pays off at scale |
| **Spotify Model (full implementation)** | The tribe/squad/chapter/guild model assumes hundreds of engineers. Cherry-pick chapters and guilds only |
| **Six Sigma (full statistical rigor)** | Requires large sample sizes for statistical significance. Our sprint data is too small. Use the DMAIC thinking process, not the statistical machinery |
| **Waterfall / stage-gate** | Incompatible with iterative delivery. We already have phase progression — no need for hard gates between phases |
| **Holacracy / self-management** | Agents need explicit structure. Self-organizing human teams work because humans have intrinsic motivation and social dynamics. Agents need clear delegation |
| **Prince2** | Heavy project management methodology. Overhead far exceeds benefit for our scale |
| **Crystal Clear** | Designed for small co-located human teams. The communication practices assume human relationships |

---

## Part 7: Success Metrics

How we know these adoptions are working:

| Category | Metric | Baseline | Phase 2 Target | Phase 3 Target |
|----------|--------|----------|----------------|----------------|
| Flow | Cycle time (task start → merge) | Not tracked | Measured, trending down | < 2 sessions for P1 |
| Flow | Bottleneck detected proactively | Never | 50% of sprints | 80% of sprints |
| Quality | Stop-the-line events resolved within session | N/A | 90% | 95% |
| Quality | Change failure rate | Not tracked | < 20% | < 10% |
| Decisions | Tasks with Cynefin classification | 0% | 80% | 100% |
| Decisions | Complex tasks with spike before estimate | 0% | 60% | 90% |
| Structure | Team interaction modes defined | 0 pairs | All pairs | All pairs, reviewed quarterly |
| Learning | Kaizen improvements per sprint | Not tracked | 3+ per sprint | 5+ per sprint |
| Learning | AARs completed for P0 incidents | 0% | 100% | 100% |
| Sustainability | Sessions exceeding token budget | Not tracked | < 20% | < 10% |

---

_This is a planning document. No implementation changes have been made. Each phase requires explicit approval before execution._
_See also: `10_scrum_team_practices_adoption_plan.md` for Scrum-specific practices._
