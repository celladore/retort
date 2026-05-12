# Adapter — Renovate

Companion to `gh-bot-reader/SKILL.md`. Covers parsing Renovate output
into `BotFinding[]`.

Renovate is the canonical reference for **body-posting bots** —
findings live on the PR body and on issue comments, not in review
threads. Future adapters for body-only bots (Codecov delta comments,
dashboard summaries) should follow the same REST-fetch pattern
described here.

## Author identification

Renovate posts as one of:

- `renovate[bot]` — Mend Renovate App (most installs)
- `renovate-bot` — self-hosted Renovate or legacy user-mode installs

Either matches `bot: 'renovate'`.

The Mend `Mend.io` / `mend-renovate[bot]` brand also exists for the
hosted product; treat it as an alias for `renovate[bot]` and route
through this adapter.

## Where comments live

Renovate produces three kinds of artefact on a PR. Only the first two
are in scope for this adapter:

1. **PR body** — Renovate is the PR author, so `pullRequest.body` is
   the update announcement. Contains the package table, release notes,
   configuration block, and a rebase checkbox. Edited in-place as the
   PR progresses; never a separate comment.
2. **Conversation comments** — `gh api repos/{owner}/{repo}/issues/{n}/comments`.
   Renovate posts here when something requires user attention:
   automerge failure, rebase failure, edited-and-blocked, status-check
   failures, manual-action-required notices.
3. **Dependency Dashboard issue** _(out of scope)_ — opt-in feature
   that posts as a repo-level issue, not a PR comment. Not surfaced by
   this adapter; a separate skill may consume it later.

There are no review threads to fetch; the GraphQL query from the
CodeRabbit companion is **not** used for this adapter.

## Data source — REST

Use these two endpoints per PR:

```bash
# PR body (Renovate is the author)
gh api "repos/$OWNER/$REPO/pulls/$PR" \
  --jq '{number, body, user: .user.login, head_sha: .head.sha, updated_at, html_url}'

# Conversation comments — filter to Renovate-authored after fetch
gh api "repos/$OWNER/$REPO/issues/$PR/comments" --paginate \
  --jq '[.[] | select(.user.login | test("^(renovate(-bot)?|renovate\\[bot\\]|mend-renovate\\[bot\\])$"))]'
```

`--paginate` is mandatory for the comments endpoint — repos that run
Renovate continuously can accumulate dozens of automerge-failure
comments on a single long-lived PR.

Body-only adapters do not need `headRefOid` / `committedDate` for the
`status` derivation the way review-comment adapters do; the bot
republishes the body in-place rather than posting a new comment, so
the "comment posted before or after last push" heuristic does not
apply. See _Status mapping_ below.

## Severity heuristics

Renovate does not use admonition markers. The adapter classifies on
**structural signals** in the body and conversation comments. Apply in
order; first match wins.

| Signal                                                                                                              | Severity     |
| ------------------------------------------------------------------------------------------------------------------- | ------------ |
| Rebase-loop signature (≥ 4 Renovate force-pushes within 24h, or `<!--renovate-debug:BASE64-->` decodes to a payload with `retryCount` ≥ 3) | `blocking`   |
| Body or comment contains `⚠ Artifact update problem` / `Lock file maintenance failed`                               | `blocking`   |
| Comment titled `Branch automerge failure` / body line `Automerge failed`                                            | `blocking`   |
| Comment titled `Edited/Blocked` (rebase paused because PR was hand-edited)                                          | `blocking`   |
| Body section `## ⚠ Warning` / `## ❗ Closure` / `## ⚠ Rebase failed`                                                 | `blocking`   |
| Comment `Status check failure` listing required checks                                                              | `suggestion` |
| PR title contains `(major)` suffix, or any package `Change` cell shows a major transition (e.g. `^20.4.3` → `^21.0.0`) | `suggestion` |
| Vulnerability fix indicated by `vulnerabilityAlerts` flag in body, or `[SECURITY]` prefix in PR title               | `suggestion` |
| Comment titled `### Renovate Ignore Notification` (PR closed without merging — informational)                       | `info`       |
| Plain dependency update with no warning sections — body is the status table only                                    | `info`       |
| Renovate-authored comment with no recognised pattern                                                                | `info`       |

Never emit `blocking` from a heuristic guess — the signals above are
all explicit Renovate markers. Default to `info` when uncertain.

### Rebase-loop signature

The simplest reliable detector:

1. List Renovate-authored force-pushes to the PR head ref:
   `gh api "repos/$OWNER/$REPO/pulls/$PR/commits"` then filter
   `author.login` to the Renovate usernames.
2. Compare timestamps. If 4 or more land within a 24-hour window with
   no human commits between them, mark the PR `blocking` with
   `meta.rebase_loop = true`.
3. As a secondary signal, look for a `<!--renovate-debug:BASE64-->`
   HTML comment in the body (single-line, no surrounding spaces). The
   payload is base64-encoded JSON with fields like `createdInVer`,
   `updatedInVer`, `targetBranch`, `labels`. Some Renovate versions
   also include a `retryCount` field — decode the base64 and check
   for `"retryCount"` ≥ 3. Most installs (including current Mend
   Renovate) omit this field, so the primary detection remains the
   force-push count.

The 4-pushes-in-24h threshold is conservative. Adjust per-repo in the
consumer (`/cleanup` may want a looser threshold on monorepos with
many concurrent updates).

## Status mapping

Renovate threads don't have `isResolved` / `isOutdated` flags. Status
is derived from PR-level fields:

| Condition                                                                            | `status`         |
| ------------------------------------------------------------------------------------ | ---------------- |
| PR is open, `mergeable_state: "dirty"` (merge conflict pending Renovate rebase)      | `unresolved`     |
| PR is open, Renovate has edited the body since the last human push to a base branch  | `new_since_push` |
| PR is open, no warnings, awaiting review                                             | `unresolved`     |
| PR is closed or merged                                                               | `resolved`       |
| Comment is from a previous PR head SHA that has since been force-pushed by Renovate  | `outdated`       |

For a body-only finding, "the comment" is the PR body itself —
`posted_at` is `pullRequest.updated_at` (the last body edit) and
`status` is always one of `unresolved`, `new_since_push`, or
`resolved` (never `outdated` for the body — old body content is
overwritten, not preserved).

For conversation comments, use the comment's `created_at` and
`updated_at`. A Renovate comment older than the current head SHA is
`outdated`.

## Field mapping

Body-posted finding:

| `BotFinding` field    | Source                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| `bot`                 | `'renovate'`                                                            |
| `bot_name_raw`        | `pull.user.login`                                                       |
| `thread_id`           | `'pr-body-' + pull.number` (synthetic — no thread node exists)          |
| `pr_number`           | `pull.number`                                                           |
| `status`              | derived (see status mapping)                                            |
| `severity`            | derived (see severity heuristics)                                       |
| `file`                | omitted — body findings are PR-level, not file-scoped                   |
| `line`                | omitted — body findings have no line                                    |
| `body`                | sanitised body (see below), first 500 chars                             |
| `url`                 | `pull.html_url`                                                         |
| `posted_at`           | `pull.updated_at`                                                       |
| `meta.head_sha`       | `pull.head.sha`                                                         |
| `meta.update_type`    | parsed from package table — `'patch'` \| `'minor'` \| `'major'` \| `'pin'` \| `'mixed'` |
| `meta.rebase_loop`    | `true` when the rebase-loop signature fires; otherwise omitted          |

Conversation-comment finding:

| `BotFinding` field    | Source                                                       |
| --------------------- | ------------------------------------------------------------ |
| `bot`                 | `'renovate'`                                                 |
| `bot_name_raw`        | `comment.user.login`                                         |
| `thread_id`           | `comment.id` (issue comment id)                              |
| `pr_number`           | `pull.number`                                                |
| `status`              | derived (see status mapping)                                 |
| `severity`            | derived (see severity heuristics)                            |
| `file`                | omitted                                                      |
| `line`                | omitted                                                      |
| `body`                | sanitised comment body, first 500 chars                      |
| `url`                 | `comment.html_url`                                           |
| `posted_at`           | `comment.created_at`                                         |
| `meta.comment_kind`   | `'automerge-failure'` \| `'edited-blocked'` \| `'status-check-failure'` \| `'rebase-failed'` \| `'ignore-notification'` \| `'other'` |

`meta.comment_kind` is derived from the first non-empty line of the
comment body — Renovate uses stable headings (`Branch automerge
failure`, `Edited/Blocked`, `### Renovate Ignore Notification`, etc.)
that survive minor wording drift since 2023. The `ignore-notification`
kind is emitted when a PR is closed without merging; Renovate posts a
notice that future updates in the same version range will be skipped.

## Body sanitisation

Renovate bodies are long (release notes, configuration blocks, etc.).
Before truncating to 500 chars:

1. **Strip the package table** if it is followed by other content —
   the consumer wants the warning, not the diff matrix. Detect by a
   `| Package |` header line; the column names that follow vary by
   config. Current Mend Renovate emits
   `| Package | Change | Age | Confidence |` with merge-confidence
   enabled (the default); installs without merge-confidence emit
   `| Package | Change |`. Some older repos may still emit the
   legacy `| Package | Type | Update |`. Match any of these
   variants, then remove through the next `---` separator. Keep
   the table if there is nothing else in the body (a plain update).
2. **Strip the `<details>` blocks**: "Release Notes", "Configuration",
   the rebase checkbox `<details>`. They are noise in a one-line
   summary.
3. **Strip HTML comments** — `<!-- rebase-check -->` (unclosed
   inline placeholder; appears immediately before the rebase checkbox
   text on the same line), `<!--renovate-debug:BASE64-->` (single-line,
   no surrounding spaces; payload is opaque base64), and any other
   `<!-- renovate-* -->` markers Renovate may emit (e.g.
   `<!-- renovate-release-notes-... -->` on older installs).
4. **Strip the footer** — the `This PR was generated by [Mend Renovate]`
   line and everything after.
5. **Collapse runs of two or more blank lines** to one.
6. **Trim leading and trailing whitespace.**

For comment bodies, steps 3 + 5 + 6 are usually sufficient; comments
are short.

## Known gotchas

- **Edited bodies have no comment trail.** Renovate rewrites the PR
  body in place as packages update. The body you see today reflects
  the current state, not the original announcement. `posted_at` from
  `updated_at` (not `created_at`) captures this correctly.
- **Conventional Commits in PR titles vary by config.** Renovate may
  produce `chore(deps):`, `fix(deps):`, `Update dependency`, or
  custom `commitMessagePrefix` strings depending on repo
  configuration. Don't rely on title patterns for routing — use the
  author username.
- **Mend.io rebrand.** The product was renamed from "Renovate" to
  "Mend Renovate" in 2023. Older repos may still receive comments
  from `renovate-bot` while newer installs use `renovate[bot]` or
  `mend-renovate[bot]`. The author-identification table covers all
  three.
- **Renovate's `<!-- rebase-check -->` checkbox is interactive.**
  Users click it to trigger a manual rebase. Do not treat the
  checkbox itself as a finding — its mere presence is `info`, not a
  signal. The signal is the post-rebase state.
- **Automerge failure can be transient.** A `Branch automerge failure`
  comment may be followed by a successful merge on the next attempt.
  The adapter still flags it `blocking` for the current scan — the
  consumer can decide to filter by `posted_at` recency.
- **Major version bumps default to `suggestion`, not `blocking`.**
  Some teams treat `major` as opt-in (manual review) and others
  automerge. Don't assume; the heuristic above maps major to
  `suggestion` and lets the consumer apply policy.
- **Vulnerability alerts are a Renovate flag, not a CVE feed.**
  Severity beyond `suggestion` requires a separate Sonatype/GHSA
  feed; this adapter does not promote vulnerability alerts to
  `blocking` even when GitHub marks the advisory as critical.
- **Rebase-loop false positives on monorepos.** A repo with many
  package groups can legitimately see Renovate force-push the same
  PR 4+ times in 24h if multiple upstream packages bump together.
  The signature is still useful as a "look at this" hint but the
  consumer may need a per-repo override.
- **No `file` / `line` fields.** Body-posted findings are PR-level.
  Consumers that group by file (`/cleanup --by-file`) must handle
  the missing field gracefully — fall back to `pr_number`-only
  grouping for Renovate findings.

## Reference sample

Captured payloads ship alongside this adapter at
`org-meta/skills/gh-bot-reader/renovate.sample.json`. The fixture
covers four scenarios from `phoenixvc/mystira-workspace`:

1. **`plain-patch-update`** — single npm patch, body only, no
   warnings (info / patch).
2. **`major-multi-package-bump`** — monorepo major version bump,
   `(major)` suffix in the title, `^20.x` → `^21.0.0` transition in
   the Change column (suggestion / major).
3. **`non-major-group-update`** — multi-package non-major group with
   mixed patch and minor entries (info / mixed).
4. **`ignore-notification-comment`** — `### Renovate Ignore
   Notification` comment posted after a PR was closed without merging
   (info / ignore-notification).

When extending the adapter, run new heuristics against each scenario
and verify the `expected` block reproduces. The fixture is the
ground-truth shape; the field mapping in this document derives from
it.

Notable real-world drift that the fixture exposed (and this document
now reflects):

- Package table header is `| Package | Change | Age | Confidence |`,
  not `| Package | Type | Update |`.
- Major bumps have no `Update: major` row — detect via the title
  pattern or the version-transition in the Change column.
- `<!--renovate-debug:BASE64-->` is a single-line base64 payload, not
  a multi-line JSON block. Current Mend Renovate does not emit
  `retryCount`; force-push count is the primary rebase-loop detector.
- The `### Renovate Ignore Notification` comment kind was not
  previously enumerated; added as an `info` finding.
