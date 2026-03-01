# Integration Plan — Addressing Platform Gaps

This document provides a phased integration plan to address the gaps identified
in each platform's documentation. Each phase is prioritized by impact and effort.

---

## Phase 1: High-Impact, Low-Effort (Quick Wins)

**Timeline:** 1–2 sprints

These items improve existing platform support with minimal code changes.

### 1.1 Generate AGENTS.override.md Template

**Platforms affected:** OpenAI Codex, Warp, all AGENTS.md consumers
**Gap:** `AGENTS.override.md` is not generated for local/env-specific overrides
**Change:** Add a template `AGENTS.override.md` with placeholder sections for
environment-specific instructions (staging vs production, team preferences).
**Files to modify:**
- `templates/root/AGENTS.override.md` (new template)
- Sync engine to include in output

### 1.2 Add Numeric Prefixes to Cline Rules

**Platforms affected:** Cline
**Gap:** Generated `.clinerules/` files lack numeric ordering prefixes
**Change:** Rename generated files: `01-typescript.md`, `02-security.md`, etc.
**Files to modify:**
- `rules.yaml` or sync engine Cline renderer

### 1.3 Generate .aiderignore and .geminiignore

**Platforms affected:** Aider, Gemini CLI
**Gap:** Ignore patterns not generated
**Change:** Generate from common patterns (node_modules, dist, .env, etc.)
aligned with `.gitignore`.
**Files to modify:**
- `templates/aider/.aiderignore` (new)
- `templates/gemini/.geminiignore` (new)
- Sync engine to include in output

### 1.4 Expand Cursor Subfolder Rules for Monorepos

**Platforms affected:** Cursor IDE
**Gap:** No subfolder rules for monorepo/microservice layouts
**Change:** When `project.yaml` defines multiple packages, generate
per-package `.cursor/rules/` in each package directory.
**Files to modify:**
- Sync engine Cursor renderer (monorepo detection)

---

## Phase 2: Medium-Impact, Medium-Effort (Core Enhancements)

**Timeline:** 2–3 sprints

These items add new render targets and generate platform-specific configuration.

### 2.1 Add `aider` Render Target

**Platforms affected:** Aider
**Gap:** No `.aider.conventions.md` or `.aider.conf.yml` generation
**Change:** Add `aider` to renderTargets. Generate:
- `.aider.conventions.md` from `project.yaml` conventions
- `.aider.conf.yml` with test/lint commands
- `.aiderignore` from project patterns
**Files to modify:**
- `settings.yaml` schema (add `aider` target)
- `templates/aider/` (new directory with templates)
- Sync engine (new Aider renderer)

### 2.2 Generate Gemini settings.json

**Platforms affected:** Google Gemini CLI
**Gap:** Project-level `settings.json` not generated
**Change:** Generate `.gemini/settings.json` with sensible defaults
(respecting gitignore, checkpointing enabled, etc.).
**Files to modify:**
- `templates/gemini/settings.json` (new template)
- Sync engine Gemini renderer

### 2.3 Generate Roo Code Mode-Specific Rules

**Platforms affected:** Roo Code
**Gap:** Mode-specific rules not generated (architect, code, debug)
**Change:** Map team roles to Roo modes. Generate `.roo/rules-{mode}/`
directories with appropriate content.
**Files to modify:**
- `templates/roo/rules-{mode}/` (new directories)
- Sync engine Roo renderer (mode mapping logic)
- `teams.yaml` → Roo mode mapping configuration

### 2.4 Generate Continue Native Rules

**Platforms affected:** Continue
**Gap:** Rules not generated in `.continue/rules/` format
**Change:** Generate rules in `.continue/rules/` with YAML frontmatter
(title, objective, severity, applies) in addition to portable files.
**Files to modify:**
- `templates/continue/rules/` (new directory)
- Sync engine (new Continue native renderer)

### 2.5 Generate Cline Memory and Context Templates

**Platforms affected:** Cline
**Gap:** Memory files, directory structure file, and phased workflows not generated
**Change:** Generate `.clinerules/memory`, `.clinerules/directory-structure`
from project.yaml, and phased workflow templates.
**Files to modify:**
- `templates/cline/memory` (new)
- `templates/cline/directory-structure` (new)
- Sync engine Cline renderer

---

## Phase 3: New Platform Targets (Expansion)

**Timeline:** 3–4 sprints

These items add dedicated render targets for platforms currently served
only via AGENTS.md.

### 3.1 Add `amazonq` Render Target

**Platforms affected:** Amazon Q Developer
**Change:** Generate:
- `.amazonq/config.yaml` with project settings
- `.amazonq/prompts/*.md` from commands.yaml
**Files to modify:**
- `settings.yaml` schema (add `amazonq` target)
- `templates/amazonq/` (new directory)
- Sync engine (new Amazon Q renderer)

### 3.2 Add `cody` Render Target

**Platforms affected:** Sourcegraph Cody
**Change:** Generate:
- `.cody/config.json` with project settings
- `.cody/ignore` from project patterns
**Files to modify:**
- `settings.yaml` schema (add `cody` target)
- `templates/cody/` (new directory)
- Sync engine (new Cody renderer)

### 3.3 Subdirectory AGENTS.md for Monorepos

**Platforms affected:** OpenAI Codex, Warp, Google Jules, all AGENTS.md consumers
**Change:** When `project.yaml` defines packages/modules, generate
per-package `AGENTS.md` files with module-specific context.
**Files to modify:**
- Sync engine AGENTS.md renderer (monorepo detection)
- `project.yaml` schema (package/module definitions)

---

## Phase 4: Advanced Integration (Future)

**Timeline:** 4+ sprints

These items add deeper platform integration features.

### 4.1 MCP Configuration Generation

**Platforms affected:** Claude Code, Cursor, Windsurf, Gemini, Cline, Roo, Warp
**Change:** Generate MCP server configurations for platforms that support
Model Context Protocol. Define tool connections, timeouts, permissions.
**Files to modify:**
- `templates/mcp/` (expand existing)
- Per-platform MCP config templates
- Sync engine (MCP config rendering)

### 4.2 Windsurf Workflow Expansion

**Platforms affected:** Windsurf IDE
**Change:** Expand from 2 to 10+ workflow definitions covering common
CI/CD, testing, deployment, and code review scenarios.
**Files to modify:**
- `templates/windsurf/workflows/` (add workflow templates)
- `commands.yaml` → workflow mapping

### 4.3 Claude Code Skill Enrichment

**Platforms affected:** Claude Code
**Change:** Add `scripts/`, `templates/`, and `references/` directories
to generated skills for richer, more autonomous agent behavior.
**Files to modify:**
- Skill templates (add sub-directories)
- Sync engine Claude skill renderer

### 4.4 Codex Config.toml Generation

**Platforms affected:** OpenAI Codex
**Change:** Generate project-level config.toml with model preferences,
approval policy, and sandbox settings.
**Files to modify:**
- `templates/codex/config.toml` (new)
- Sync engine (new Codex config renderer)

### 4.5 Copilot Code Review Integration

**Platforms affected:** GitHub Copilot
**Change:** Generate review-specific prompt files and coding agent
configurations for Copilot's automated review capabilities.
**Files to modify:**
- `templates/copilot/prompts/review-*.prompt.md` (new)
- Copilot renderer (review prompt generation)

---

## Summary: Gap Coverage by Phase

| Phase | Platforms Improved | New Render Targets | Key Deliverables |
|-------|-------------------|-------------------|-----------------|
| 1 | Codex, Cline, Aider, Gemini, Cursor | 0 | Override templates, ignore files, ordering |
| 2 | Aider, Gemini, Roo, Continue, Cline | 1 (aider) | New configs, mode rules, memory templates |
| 3 | Amazon Q, Cody, all AGENTS.md | 2 (amazonq, cody) | New platform targets, monorepo support |
| 4 | Claude, Cursor, Windsurf, Copilot, Codex | 0 | MCP, workflows, skills enrichment |

---

## Files Changed Across All Phases

| Category | New/Modified Files |
|----------|-------------------|
| Templates | ~25 new template files across 6+ directories |
| Sync engine | Renderers for aider, amazonq, cody; monorepo logic; mode mapping |
| Schema | `settings.yaml` (3 new targets), `project.yaml` (package definitions) |
| Documentation | This integration plan + updated platform docs |

---

## See Also

- [Platform Reference README](./README.md) — Overview and comparison matrix
- [TOOLS.md](../TOOLS.md) — Current render targets and output files
- [CUSTOMIZATION.md](../CUSTOMIZATION.md) — How to customize overlays
