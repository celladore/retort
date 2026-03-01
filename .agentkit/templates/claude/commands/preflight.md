---
description: "Run release-readiness checks beyond /check before merge/ship"
allowed-tools: Bash(git *), Bash(npm *), Bash(pnpm *), Bash(npx *), Bash(dotnet *), Bash(cargo *), Bash(python *), Bash(pip *), Bash(pytest *), Bash(go *)
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# /preflight

{{commandDescription}}

## Purpose

Run release-readiness checks beyond `/check` before merge/ship.

## Usage

`/preflight [--stack <stack>] [--range <git-range>] [--base <remote-branch>] [--strict]`

### Flags

- `--stack`: limit checks to stack-relevant paths/tools where possible
  (for example Node-only lint/test/docs checks in mixed repos).
- `--base`: remote default branch reference used when `--range` is omitted
  (for example `origin/main`, `origin/develop`). If omitted, auto-detect from
  `origin/HEAD` (for example via `git symbolic-ref refs/remotes/origin/HEAD`)
  and fall back to `origin/main` only when detection is unavailable.
- `--range`: commit range used for changelog, docs, TODO/FIXME, and commit
  convention checks. If omitted (or null), resolve a base branch (from
  `--base` or auto-detected `origin/HEAD`), then run
  `git merge-base HEAD <resolved-base>` and use `<merge-base>..HEAD`; if
  merge-base detection fails, fall back to `HEAD~50..HEAD` and emit a visible
  warning in the output table that the range is approximate.
- `--strict`: treat warnings as failures and return FAIL if any non-error
  check reports warning-level issues.

### Examples

- `/preflight`
- `/preflight --range main..HEAD`
- `/preflight --base origin/develop`
- `/preflight --stack node --strict`

## Checks

1. Run `/check` and fail on any quality gate error.
2. Verify changelog/release notes updates when user-facing behavior changed.
   Detect user-facing changes using concrete heuristics in the target range:
   - CLI command/flag/help text changes (`commands.yaml`, command docs,
     parser flags)
   - Public API contract changes (route signatures, request/response schema,
     auth requirements)
   - UI labels/copy/form behavior changes in user-visible screens
   - Database migration semantics affecting externally observable behavior
     (required fields, constraints, defaults)
3. Validate commit messages in range follow conventional commit format.
4. Detect TODO/FIXME entries without issue references in changed files.
5. Confirm coverage did not regress versus baseline using explicit comparison:
   - Baseline: resolved base branch HEAD (from `--base` or detected
     `origin/HEAD`) for the same coverage metric
     source used by this repo (coverage summary/tool output)
   - Threshold: fail when total coverage delta < 0.00 percentage points unless
     an active waiver entry is present in `.agentkit/state/coverage-waivers.md`
   - Waiver detection rule: parse `.agentkit/state/coverage-waivers.md` and accept
     waiver entries only when all required fields are present (`author`,
     `rationale`, `linkedIssueOrPr`, `expiresAt`) and `expiresAt` is in the
     future at preflight runtime. The waiver ID is extracted from the heading
     text after the literal prefix "coverage-waiver:" (e.g., heading pattern
     "## coverage-waiver: cw-2026-02-25-auth-refactor").
   - Example valid waiver entry:
     ```markdown
     ## coverage-waiver: cw-2026-02-25-auth-refactor
     - author: @team-quality
     - rationale: Integration migration temporarily lowers branch coverage
     - linkedIssueOrPr: https://github.com/org/repo/pull/1234
     - expiresAt: 2026-03-15T00:00:00Z
     ```
   - Evidence: include baseline %, current %, and delta in the output table
6. Confirm docs updated for API/CLI behavior changes.

## Output

Provide a pass/fail table in markdown:

| Check              | Status    | Evidence                     | Required follow-up                            |
| ------------------ | --------- | ---------------------------- | --------------------------------------------- |
| Range resolution   | PASS/WARN | merge-base branch + range    | set `--range` / `--base` if fallback was used |
| Quality gates      | PASS/FAIL | lint/test/build output       | if FAIL, exact fix list                       |
| Changelog update   | PASS/FAIL | file/entry reference         | add entry if missing                          |
| Commit convention  | PASS/FAIL | offending commits (if any)   | rewrite/fix commits                           |
| TODO/FIXME hygiene | PASS/FAIL | file+line refs               | add issue refs or remove                      |
| Coverage delta     | PASS/FAIL | baseline %, current %, delta | add tests or justify waiver                   |
| Docs update        | PASS/FAIL | docs changed list            | update missing docs                           |
