# Adapter — Codecov

Companion to `gh-bot-reader/SKILL.md`. Covers parsing Codecov output
into `BotFinding[]`.

Codecov is a **body-posting bot** that lives in conversation comments
(not the PR body, not review threads). It edits a single comment per
PR in place as new pushes change the coverage delta — the comment id
is stable across the PR lifetime. This adapter follows the same
REST-fetch pattern documented in `adapter-renovate.md`, but reads
`pullRequest.comments[]` rather than `pullRequest.body`.

## Author identification

Codecov posts as one of:

- `codecov[bot]` — the Codecov GitHub App (the common install).
- `codecov-commenter` — the legacy / commenter-mode user, used by
  repos that run the codecov-action without installing the App.

Either matches `bot: 'codecov'`.

The Sentry-hosted Codecov rebrand (post-2023) still uses the same
two usernames; no rename has occurred at the bot identity level.

## Where comments live

Codecov produces one artefact:

1. **A single conversation comment** —
   `gh api repos/{owner}/{repo}/issues/{n}/comments`. Codecov posts
   it once and rewrites the body in place on every subsequent push.
   Same `id`, same `created_at`, updated `updated_at`. There is no
   per-push history of comments.

There is no PR body to read (Codecov is not the PR author) and no
review threads. The GraphQL query used by review-comment adapters is
**not** used here.

## Data source — REST

```bash
gh api "repos/$OWNER/$REPO/issues/$PR/comments" --paginate \
  --jq '[.[] | select(.user.login == "codecov[bot]" or .user.login == "codecov-commenter")]'
```

`--paginate` is mandatory for the comments endpoint, even though
Codecov itself only contributes one comment — other bots and humans
share the same pagination boundary.

Because Codecov edits in place, `comment.created_at` is the first
post and `comment.updated_at` is the last refresh. `posted_at` in
the `BotFinding` shape is `comment.updated_at` so consumers see the
state matched to the current head SHA.

## Severity heuristics

Codecov uses two unicode markers as the primary signal:
`:white_check_mark:` for pass, `:x:` for fail. The adapter
classifies on the **specific signal line**, in order; first match
wins.

| Signal                                                                                                                  | Severity     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------ |
| `:x: Your patch check has failed because the patch coverage` (explicit blocking-check failure)                          | `blocking`   |
| `:x: Your project check has failed because the head commit's coverage` (explicit project-threshold failure)             | `blocking`   |
| `:x: Patch coverage is` (regression on the patch — paired with the patch-check-failure line above, fires either way)    | `blocking`   |
| Diff block `- Coverage   X%   Y%   -Z%` (project coverage decrease without a paired `:x:` line — soft regression)       | `suggestion` |
| `:warning:` prefix on any Codecov status line                                                                           | `suggestion` |
| `:white_check_mark: All modified and coverable lines are covered by tests.`                                             | `info`       |
| `:white_check_mark: Project coverage is` / `:white_check_mark: All tests successful`                                    | `info`       |
| Codecov comment with flag table only (no diff block, no status indicators)                                              | `info`       |

The patch-coverage-failure signal is the load-bearing one — Codecov
explicitly says the check has failed and consumers should treat the
PR as blocked. The soft-regression signal (coverage decrease without
`:x:`) is `suggestion` because the configured project threshold may
permit it.

Never emit `blocking` from a heuristic guess — both blocking signals
require the literal `:x:` marker plus the `has failed` phrase.

## Status mapping

Codecov doesn't expose thread-resolution state. Status derives from
PR-level fields and the comment's edit history:

| Condition                                                                                  | `status`         |
| ------------------------------------------------------------------------------------------ | ---------------- |
| PR is open, `comment.updated_at` is newer than the last human push to the head ref         | `new_since_push` |
| PR is open, comment hasn't been refreshed since the last push (codecov-action didn't run)  | `outdated`       |
| PR is open, comment matches the current head SHA                                           | `unresolved`     |
| PR is closed or merged                                                                     | `resolved`       |

Use `pullRequest.headRef.target.committedDate` (from the GraphQL
query, even though the adapter only reads REST comments — the
committer date is needed for the `new_since_push` derivation).

## Field mapping

| `BotFinding` field    | Source                                                       |
| --------------------- | ------------------------------------------------------------ |
| `bot`                 | `'codecov'`                                                  |
| `bot_name_raw`        | `comment.user.login`                                         |
| `thread_id`           | `comment.id` (single issue-comment id per PR)                |
| `pr_number`           | `pull.number`                                                |
| `status`              | derived (see status mapping)                                 |
| `severity`            | derived (see severity heuristics)                            |
| `file`                | omitted — Codecov findings are PR-level, not file-scoped     |
| `line`                | omitted                                                      |
| `body`                | sanitised comment body, first 500 chars                      |
| `url`                 | `comment.html_url`                                           |
| `posted_at`           | `comment.updated_at`                                         |
| `meta.head_sha`       | `pull.head.sha`                                              |
| `meta.comment_kind`   | `'coverage-report'` \| `'patch-check-failure'` \| `'project-check-failure'` \| `'soft-regression'` \| `'other'` |
| `meta.project_coverage` | parsed from `:white_check_mark: Project coverage is X%.` — number, omit if absent |
| `meta.patch_coverage`   | parsed from `:x: Patch coverage is X%` or the per-row Coverage Δ — number, omit if absent |
| `meta.coverage_delta`   | parsed from the diff block (`+0.05%`, `-0.05%`) — signed number, omit if absent |

`meta.comment_kind` is derived from the strongest severity signal in
the body. A comment with both `:x: Patch coverage is 0%` and
`:x: Your patch check has failed` is `patch-check-failure`. A comment
with only a coverage-decrease line in the diff block (no `:x:`) is
`soft-regression`. A clean coverage report is `coverage-report`.

## Body sanitisation

Codecov comments are long (flag tables, diff blocks, "rocket"
details). Before truncating to 500 chars:

1. **Strip the diff block** — the fenced code block beginning with
   `@@`/`Coverage Diff` and ending with the matching closing fence.
   Keep the leading `:white_check_mark:` / `:x:` status lines that
   appear before the block.
2. **Strip the flag table** — the `| Flag | Coverage Δ | |` header
   and the rows that follow through the next blank line.
3. **Strip the `<details>` blocks** — "Additional details and
   impacted files", "New features to boost your workflow",
   "Continue to review full report in Codecov by Sentry" (if
   wrapped in `<details>`).
4. **Strip the "Flags with carried forward coverage" note** —
   one-line link, never load-bearing.
5. **Strip the `[see N files with indirect coverage changes]`
   link** — appears only on flag-only comments.
6. **Strip the footer** — the
   `[:umbrella: View full report in Codecov by Sentry]` line and
   the `:loudspeaker: Have feedback on the report?` line.
7. **Collapse runs of two or more blank lines** to one.
8. **Trim leading and trailing whitespace.**

The goal is a 1–3 line summary: the `## [Codecov](URL) Report`
header plus the key status indicator(s). Flag-table-only comments
collapse to just the header and the success/failure line.

## Known gotchas

- **Single comment, edited in place.** Don't expect multiple Codecov
  comments per PR — the bot rewrites the same `id` on every push.
  This is the opposite of CodeRabbit (one thread per finding) and
  similar to Renovate body posting.
- **`codecov[bot]` vs `codecov-commenter`.** The two usernames are
  semantically equivalent. Always match both. A repo can switch
  between them by installing/uninstalling the App, but the comment
  shape is identical.
- **Patch-check vs project-check.** Codecov exposes two independent
  status checks: the "patch" check (coverage on the lines changed
  in the PR) and the "project" check (overall repository coverage).
  Either can fail independently. The `:x:` line names which one
  failed; the adapter must read the phrase to set
  `meta.comment_kind` correctly.
- **Soft regression vs hard failure.** A project coverage decrease
  (`- Coverage   X%   Y%   -Z%`) without a paired `:x: Your project
  check has failed` line is a soft signal — Codecov shows the
  decrease but the configured project threshold may permit it. Map
  to `suggestion`, not `blocking`. Consumers may override.
- **Carried-forward flags.** When a flag has no measurements on the
  head commit, Codecov omits it from the flag table with a note.
  Don't attempt to back-fill that flag's coverage — the note is the
  ground truth.
- **Sentry rebrand artefacts.** The footer says "View full report in
  Codecov by Sentry" since the 2023 rebrand; older PRs may say
  "View full report at Codecov" without the Sentry suffix. Both are
  stripped by step 6.
- **No `file` / `line` fields.** Codecov findings are PR-level, not
  file-scoped (despite Codecov knowing which files lost coverage —
  that data is in the linked Codecov UI, not the comment body).
  Consumers grouping by file must fall back to `pr_number`-only
  grouping.
- **Codecov-action not run.** If a PR doesn't trigger the
  codecov-action (e.g. docs-only PR, CI skipped), Codecov does not
  post a comment at all. The adapter returns an empty array for
  that PR — absence is not a finding.

## Reference sample

Captured payloads ship alongside this adapter at
`org-meta/skills/gh-bot-reader/codecov.sample.json`. Codecov is not
installed in `phoenixvc/*`, so the fixture is captured from public
OSS repos. Three scenarios:

1. **`success-full-coverage`** —
   `chrisvogt/gatsby-theme-chronogrove#620`. Patch coverage 100%,
   project coverage held. Diff block + flag table + success
   markers. (info / coverage-report)
2. **`patch-coverage-failure`** — `frappe/frappe#39193`. Patch
   coverage 0% on a one-line change; `:x: Your patch check has
   failed` because the threshold is 85%. (blocking /
   patch-check-failure)
3. **`flags-only-success`** — `spegel-org/spegel#1341`. Minimal
   comment with the success marker, flag table, and an
   `[see N files with indirect coverage changes]` link in place of
   the full diff block. (info / coverage-report)

When extending the adapter, run new heuristics against each scenario
and verify the `expected` block reproduces. The fixture is the
ground-truth shape; the field mapping in this document derives from
it.
