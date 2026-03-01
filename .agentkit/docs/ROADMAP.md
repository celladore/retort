# AgentKit Forge — Roadmap

Future initiatives under consideration. Items here are not committed — they represent
directions we may explore based on community feedback and usage patterns.

---

## Near Term (v0.2.x)

### Plugin System for Sync Targets
Dynamically discover `syncXxx()` functions instead of hard-coding them in `synchronize.mjs`.
Enables third-party sync targets without forking the engine.

### ESLint + Prettier for Engine Source
Add linting and formatting to the AgentKit Forge engine source code itself.
Currently only target repos are linted — the sync engine has no linter.

### Coverage Reporting
Integrate `vitest --coverage` into CI and track coverage over time.
Set baseline thresholds to prevent regressions.

### Cursor/Windsurf Template Expansion
Expand Cursor and Windsurf templates to achieve closer parity with Claude Code's
15 commands, 6 rule files, and lifecycle hooks.

---

## Medium Term (v0.3.x)

### Remote State Backend
Move orchestrator state beyond filesystem-only storage. Support team-shared state
via SQLite, Redis, or cloud storage for multi-machine coordination.

### Token-Level Cost Tracking
Intercept AI API calls to track actual token usage and costs. Requires either
a proxy layer or API key wrapper. Would enable per-command and per-file cost
attribution.

### Visual Dashboard
Web UI for viewing orchestrator state, cost reports, team progress, and session
history. Could be a local dev server or a hosted service.

---

## Long Term (v1.0+)

### GitHub App Integration
Auto-create PRs from handoff documents, post review findings as PR comments,
and sync backlog items with GitHub Issues. Deep integration with the GitHub
ecosystem.

### Multi-Repository Orchestration
Coordinate agent work across multiple repositories in a monorepo or polyrepo
setup. Shared state, cross-repo references, and unified backlog.

### AI Model Abstraction Layer
Support multiple AI providers (Claude, GPT, Gemini, local models) through a
unified interface. Model selection per team or per command.

---

*This roadmap is maintained by the AgentKit Forge project. Priorities may shift
based on community feedback. Open an issue to suggest new items.*
