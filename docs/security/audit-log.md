# Security Audit Log

Chronological record of security audits, dependency vulnerability triages, and findings. Newer entries first.

---

## 2026-05-10 — Dependabot triage (38 open alerts)

**Source:** `gh api repos/phoenixvc/retort/dependabot/alerts` (state=open)
**Auditor:** session handoff #2 follow-up
**Status:** triaged; remediation PRs not yet created

### Counts

| Severity  | Count  |
| --------- | ------ |
| High      | 9      |
| Medium    | 28     |
| Low       | 1      |
| **Total** | **38** |

All 38 are transitive — no direct-dependency listings in any `package.json` are themselves vulnerable. Lockfile updates are sufficient.

### By package and remediation path

| Package             | Alerts | Locations                      | Fix version | Severity profile  |
| ------------------- | ------ | ------------------------------ | ----------- | ----------------- |
| `hono`              | 11     | `.mcp/server/`                 | `4.12.18`   | 10 medium · 1 low |
| `picomatch`         | 7      | `.agentkit/`, `pnpm-lock.yaml` | `4.0.4`     | 1 high · 6 medium |
| `vite`              | 9      | `.agentkit/`, `pnpm-lock.yaml` | `8.0.5`     | 6 high · 3 medium |
| `js-yaml`           | 3      | `.agentkit/`, `pnpm-lock.yaml` | `4.1.1`     | 3 medium          |
| `postcss`           | 3      | `.agentkit/`, `pnpm-lock.yaml` | `8.5.10`    | 3 medium          |
| `fast-uri`          | 2      | `.mcp/server/`                 | `3.1.2`     | **2 high**        |
| `@hono/node-server` | 1      | `.mcp/server/`                 | `1.19.13`   | 1 medium          |
| `ip-address`        | 1      | `.mcp/server/`                 | `10.1.1`    | 1 medium          |
| `markdown-it`       | 1      | `pnpm-lock.yaml`               | `14.1.1`    | 1 medium          |

### Manifest groups

1. **`.mcp/server/package-lock.json` — 16 alerts (all runtime)**
   - All 16 are transitive via `@modelcontextprotocol/sdk@1.27.1`, which pulls in `hono ^4.11.4` and `fast-uri` / `ip-address` / `@hono/node-server`.
   - **Highest priority** because the MCP server processes external requests.
   - Single remediation: bump `@modelcontextprotocol/sdk` (or run `npm update` inside `.mcp/server/`) to a release that depends on `hono >= 4.12.18` and `fast-uri >= 3.1.2`.

2. **`.agentkit/` (lockfile pair: `package-lock.json` + `pnpm-lock.yaml`) — ~10 alerts (all development)**
   - vite, postcss, picomatch, js-yaml under devDependencies.
   - Run `pnpm update` inside `.agentkit/` and commit both lockfiles.

3. **Root `pnpm-lock.yaml` — 12 alerts (mixed)**
   - 3 runtime (js-yaml, markdown-it, picomatch high-severity) — review and update.
   - 9 development (vite, postcss, dev-scope picomatch).
   - Run `pnpm update` at repo root.

### Recommended action plan

| Order | Action                                                                                 | Alerts cleared    | Risk if skipped                                    |
| ----- | -------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------- |
| 1     | `cd .mcp/server && npm update` (or bump `@modelcontextprotocol/sdk` to current latest) | 16 (incl. 2 high) | MCP server attack surface — exposed runtime deps   |
| 2     | `pnpm update` at repo root                                                             | ~12               | Dev tooling attack surface (build chain)           |
| 3     | `cd .agentkit && pnpm update`                                                          | ~10               | Engine dev deps                                    |
| 4     | Verify js-yaml runtime usage parses only trusted YAML                                  | risk validation   | Prototype-pollution exploitable on untrusted input |
| 5     | Verify markdown-it usage is on trusted markdown                                        | risk validation   | ReDoS exploitable on untrusted input               |

Renovate is configured for this repo (per `.claude/rules/dependency-management.md`). Items 1–3 may already be in the Renovate PR queue — check before opening manual updates.

### Risk-adjusted notes (real-world likelihood, not just CVSS)

- **`vite` × 6 high-severity**: all dev-server vulnerabilities (arbitrary file read via WebSocket, `server.fs.deny` bypass). Only exploitable when the dev server is exposed to a network attacker. Retort uses vite via vitest — not a long-running, network-exposed dev server. Real-world risk for retort's use case is **low**, despite the CVSS rating.
- **`picomatch` ReDoS (high, runtime)**: exploitable on user-controlled glob patterns. Retort consumes globs primarily from spec YAML and CLI args under maintainer control. Risk is **low** if no public-facing tooling accepts arbitrary glob patterns from untrusted input.
- **`@modelcontextprotocol/sdk` cluster**: 16 alerts on an MCP server processing external requests is the highest practical risk and the smallest fix (one dependency bump). **Top priority.**
- **`js-yaml` prototype pollution**: exploitable only when parsing untrusted YAML. Retort parses spec YAML files committed to the repo — trusted. Engine code paths that parse `project.yaml`/`teams.yaml` are not attacker-controlled. Risk is **low** in practice.

### Recurrence

Add a recurring `/loop` or scheduled audit at next quarter (2026-08) to re-run this triage and append a new entry to this log.

---

[Back to security index](./README.md)
