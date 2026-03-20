# Language-Aware Hook Generation — Phase 2 Update and Phase 3 Plan

## Decision: Configured language flags vs heuristics

Short answer: **configured language flags should remain the primary source of truth**.

Why this is the right default:

- Deterministic and reproducible across machines/CI.
- Explicitly reflects project intent (not only detected files).
- Avoids false positives from transient files or polyglot folders.

Where heuristics help:

- Bootstrapping (first-run experience, incomplete `project.yaml`).
- Drift detection (warn when observed files diverge from configured stack).
- Confidence scoring (high-confidence suggestions, not silent overrides).

Recommended model: **hybrid precedence**

1. Configured flags (`stack.languages`) win.
2. Heuristics infer _candidate_ flags when config is missing or empty.
3. Generators consume `hasLanguage*Effective` + `languageSource` metadata.
4. CLI surfaces warnings/suggestions when config and heuristics disagree.

## Language Profile Presets (recommended defaults)

Use these presets in `.agentkit/spec/project.yaml` under `automation.languageProfile`.

### `mode: configured`

- Use when `stack.languages` is fully curated and stable.
- Effective flags come only from configured languages.
- Best for strict CI and deterministic enterprise repos.

### `mode: hybrid` (default)

- Use when projects are evolving and may have incomplete language declarations.
- Configured languages win when present; heuristics prepopulate only when missing.
- Best default for most repos.

### `mode: heuristic`

- Use when bootstrapping or importing legacy repos with poor metadata.
- Effective flags come from framework/test signals.
- Treat as transitional and migrate to `hybrid` or `configured` once metadata is complete.

### `diagnostics` levels

- `off`: hide diagnostics sections in generated instructions/prompts.
- `minimal`: show source/confidence and effective flags only.
- `verbose` (default): include configured/inferred/effective matrix plus notices.

### `inferFrom` signal toggles

- `frameworks: true|false` — include frontend/backend framework signals.
- `tests: true|false` — include testing-tool signals.

### Suggested preset combinations

1. **Strict enterprise**: `mode: configured`, `diagnostics: minimal`
2. **Balanced default**: `mode: hybrid`, `diagnostics: verbose`
3. **Bootstrap/migration**: `mode: heuristic`, `diagnostics: verbose`

---

## Phase 2 (Updated): Hybrid Effective Flags + Safe Heuristic Prepopulation

### Goals

- Keep behavior deterministic when config is present.
- Improve bootstrap behavior when config is incomplete.
- Avoid silent behavior changes by surfacing source + confidence.

### Scope

- `flattenProjectYaml` derivations only (no breaking schema changes).
- Add inferred/effective flag variables (generator-only consumption).
- Add diagnostics for config/heuristic mismatch.

### Proposed variables

- `hasLanguageJsLikeInferred`
- `hasLanguageJsLikeEffective`
- `hasLanguagePythonInferred`, `hasLanguagePythonEffective`
- `hasLanguageDotnetInferred`, `hasLanguageDotnetEffective`
- `hasLanguageRustInferred`, `hasLanguageRustEffective`
- `languageInferenceSource` (`configured|heuristic|mixed`)
- `languageInferenceConfidence` (`high|medium|low`)

### Heuristic signals (non-destructive)

- JS/TS: backend/frontend frameworks include `node.js|express|next.js|react` or testing includes `vitest|jest`.
- Python: framework hints or testing includes `pytest`.
- .NET: framework contains `asp.net-core` or unit test stack contains `xunit|nunit`.
- Rust: explicit framework hints or known rust testing/tooling signals.

### Generator behavior in Phase 2

- Hooks use `*Effective` flags, not raw file heuristics.
- SessionStart includes a one-line source marker (e.g., `Stack source: configured` or `mixed`).
- Stop hook keeps strict checks only for effective languages; no runtime file-scanning expansion.

### Acceptance criteria

- Effective/inferred vars available and tested.
- No regression when `stack.languages` is populated.
- Better defaults when `stack.languages` is empty.
- Clear, non-blocking mismatch diagnostics.

---

## Phase 3 (New): Expansion Across Generators, Agents, and Templates

### Objective

Standardize language-awareness beyond Claude hooks and apply the same model to all generated tool surfaces.

### Expansion targets

- Command templates (`check`, `format`, `build`, `test`) for tool guidance and ordering.
- Other tool outputs (Copilot/Cursor/Windsurf instruction variants) where language guidance appears.
- Team/agent templates that emit language-specific rules or examples.

### Phase 3 workstreams

1. **Shared language profile block**
   - Emit a small standardized summary block once per generated surface.
2. **Cross-tool parity matrix**
   - Ensure equivalent language behavior in Claude/Copilot/Cursor/Windsurf outputs.
3. **Drift and observability**
   - Add optional reports showing configured vs inferred language profile.
4. **Progressive strictness**
   - Start informational; optionally enforce in strict CI profile later.

### Phase 3 acceptance criteria

- Same language profile semantics across all major generated surfaces.
- No contradictory guidance across tools.
- CI/docs include parity checks for language-profile rendering.

---

## Continue Phase 2 — Immediate next implementation slice

1. Add inferred/effective vars in the flattening layer.
2. Add unit tests for precedence and confidence/source metadata.
3. Switch hook templates to `*Effective` vars.
4. Add minimal source marker to SessionStart output.
5. Run sync + validate + focused tests.

This sequence preserves current correctness while adding bootstrap resilience without introducing unstable runtime heuristics.

---

## Implementation Tracking (verified 2026-03-04)

### Phase 2 issues (Templates)

- #220 — https://github.com/phoenixvc/retort/issues/220 — `OPEN`
- #221 — https://github.com/phoenixvc/retort/issues/221 — `OPEN`
- #222 — https://github.com/phoenixvc/retort/issues/222 — `OPEN`

### Phase 3 issues (CSS & HTML)

- #223 — https://github.com/phoenixvc/retort/issues/223 — `OPEN`
- #224 — https://github.com/phoenixvc/retort/issues/224 — `OPEN`
- #225 — https://github.com/phoenixvc/retort/issues/225 — `OPEN`

### Current implementation alignment

- Phase 2 language-profile engine and template parity work is implemented in this branch.
- Phase 3 tracking issues are recorded in GitHub and ready for execution sequencing.
