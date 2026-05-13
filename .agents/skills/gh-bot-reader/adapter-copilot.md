# Adapter — GitHub Copilot for PRs

Companion to `gh-bot-reader/SKILL.md`. Covers parsing GitHub Copilot
review output into `BotFinding[]`.

Copilot is a **review-thread bot** like CodeRabbit — it posts inline
file-and-line review comments via the GraphQL `reviewThreads`
surface. The same canonical query documented in `adapter-coderabbit.md`
works here; only the author filter, severity heuristics, and
status-mapping rules change.

In addition to inline threads, Copilot posts a **review summary**
(`/pulls/{n}/reviews` with `state: COMMENTED`) containing a
"Pull request overview" body, a Changes list, and a file table. The
summary is body-only and not actionable; it maps to `severity: 'info'`
on a separate code path.

## Author identification

Copilot's PR-review bot posts as:

- `copilot-pull-request-reviewer[bot]` — REST `user.login` in
  `/pulls/{n}/comments` and `/pulls/{n}/reviews` payloads.
- `copilot-pull-request-reviewer` — GraphQL `author.login` (the
  `[bot]` suffix is stripped by the GraphQL surface).
- `Copilot` — the bot's display name. The `users/Copilot` REST
  endpoint resolves to id `175728472` and the App URL
  `apps/copilot-pull-request-reviewer`.

All three forms match `bot: 'copilot'`. The adapter should match
both `copilot-pull-request-reviewer[bot]` and the bare
`copilot-pull-request-reviewer` (the GraphQL form is what review-thread
parsing actually sees, since the same GraphQL query in
`adapter-coderabbit.md` is the data source).

> **Note.** `github-copilot[bot]` does **not** exist as a real GitHub
> bot identity — `gh api users/github-copilot` returns 404. An earlier
> draft of `SKILL.md` listed it; do not match on it. The separate
> `copilot[bot]` account (App URL `apps/copilot`) is the Copilot
> coding agent that authors commits, not reviews PRs; out of scope
> for this adapter.

## Where comments live

Copilot produces two surfaces:

1. **Review-thread comments** — inline file-and-line comments.
   Fetched via GraphQL `pullRequest.reviewThreads` (same query as
   CodeRabbit). These are the actionable findings.
2. **Review summary** — a single review per PR, `state: COMMENTED`,
   with a body containing a "Pull request overview" section, a
   `**Changes:**` list, and a `### Reviewed changes` file table.
   Fetched via REST `gh api repos/{owner}/{repo}/pulls/{n}/reviews`,
   filtered to the Copilot author. Not actionable; classified as
   `info`.

There are no conversation comments (`/issues/{n}/comments`) — Copilot
does not post to that surface. The GraphQL query and the
`/pulls/{n}/reviews` REST call together cover all Copilot output.

## Canonical GraphQL query

The same query documented in `adapter-coderabbit.md` is the data source
for review threads here. It returns `headRefOid` and
`headRef.target.committedDate` alongside the thread nodes, which the
status-mapping logic uses.

The author filter is the only change vs the CodeRabbit invocation:

```bash
gh api graphql \
  -F owner="$OWNER" -F name="$REPO" -F number="$PR" \
  -f query="$QUERY" \
  --paginate \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.comments.nodes[0].author.login == "copilot-pull-request-reviewer")'
```

For the review summary, a small REST call:

```bash
gh api "repos/$OWNER/$REPO/pulls/$PR/reviews" \
  --jq '.[] | select(.user.login == "copilot-pull-request-reviewer[bot]" and .state == "COMMENTED")'
```

`/pulls/{n}/reviews` is not paginated for typical PRs (Copilot posts
one review per PR per push), but `--paginate` is safe and recommended
for PRs with many push cycles.

## Severity heuristics

Copilot does **not** use admonition markers (`[!CAUTION]`, `nit:`,
etc.) the way CodeRabbit does. Every inline review-thread comment is
substantive prose without a severity prefix. The adapter classifies
on **surface**, not content:

| Source                                                          | Severity     |
| --------------------------------------------------------------- | ------------ |
| Review-thread inline comment                                    | `suggestion` |
| Review summary body (`/reviews` with `state: COMMENTED`)        | `info`       |

That is the entire severity matrix for Copilot. There are two
deliberate non-rules worth stating explicitly:

- **Never emit `blocking`.** Copilot has no explicit blocking signal.
  Per `SKILL.md`, blocking severity requires an explicit signal in
  the bot output — keyword-matching prose like "security",
  "path-traversal", or "memory leak" against `suggestion` content is
  forbidden, even when the underlying concern is genuinely
  security-flavoured. Consumers who want to escalate Copilot prose
  to blocking must do so themselves with explicit rules.
- **Never emit `nit`.** Copilot does not post style preferences;
  every comment is substantive enough to warrant `suggestion`.

If a future Copilot release introduces explicit markers, this
matrix should grow — but until then, content-based classification is
the wrong axis.

## Resolved-state mapping

The `BotFinding.status` field uses the same thread-state derivation
documented for CodeRabbit, with one addition: **PR-state precedence**.

| PR state            | Thread state                                         | `status`         |
| ------------------- | ---------------------------------------------------- | ---------------- |
| `MERGED` / `CLOSED` | any                                                  | `resolved`       |
| `OPEN`              | `isResolved: true`                                   | `resolved`       |
| `OPEN`              | `isOutdated: true` (and not resolved)                | `outdated`       |
| `OPEN`              | neither — comment created after last push            | `new_since_push` |
| `OPEN`              | neither — comment created before last push           | `unresolved`     |

PR-state precedence matters because GitHub does not auto-resolve
review threads on merge — a thread can remain `isResolved: false`
indefinitely on a merged PR. For consumers grouping findings by
"actionable now" vs "historical", PR-state is the more useful axis.

"Last push" is `pullRequest.headRef.target.committedDate` from the
canonical query. **`headRef` is `null` on merged PRs** whose source
branch has been deleted (the common case after squash-merge), so
`head_pushed_at` is unavailable for merged PRs — but that's safe
because the PR-state precedence rule short-circuits the comparison.

## Field mapping

| `BotFinding` field    | Source                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| `bot`                 | `'copilot'`                                                                             |
| `bot_name_raw`        | `comments.nodes[0].author.login` (will read `copilot-pull-request-reviewer`)            |
| `thread_id`           | `reviewThreads.nodes[i].id` (for inline threads) / `review.id` (for the summary)        |
| `pr_number`           | `pullRequest.number`                                                                    |
| `status`              | derived (see status mapping)                                                            |
| `severity`            | derived (see severity heuristics)                                                       |
| `file`                | `reviewThreads.nodes[i].path` (omitted for the summary)                                 |
| `line`                | `reviewThreads.nodes[i].line` (fallback to `startLine`; omit for the summary)           |
| `body`                | comment body, first 500 chars after sanitisation                                        |
| `url`                 | `comments.nodes[0].url` (inline) / `review.html_url` (summary)                          |
| `posted_at`           | `comments.nodes[0].createdAt` (inline) / `review.submitted_at` (summary)                |
| `meta.thread_size`    | `comments.totalCount` (inline only)                                                     |
| `meta.is_outdated`    | `reviewThreads.nodes[i].isOutdated` (inline only)                                       |
| `meta.head_sha`       | `pullRequest.headRefOid`                                                                |
| `meta.comment_kind`   | `'inline-comment'` \| `'review-summary'`                                                |

`meta.comment_kind` is the load-bearing field for consumers that want
to filter the noisy summary out of an otherwise-actionable findings
list. Default `bots` scope consumers should drop `review-summary` by
default and keep inline comments.

## Body sanitisation

Inline review comments are short and prose-only — usually one or two
paragraphs. Before truncating to 500 chars:

1. Collapse runs of two or more blank lines to one.
2. Trim leading and trailing whitespace.

That's it. Copilot does not append `<details>` blocks, suggestion
patches, or trailing prompts, so there is nothing structured to
strip. Curly quotes (`"`, `"`, `'`) and other Unicode characters
appear verbatim from the bot's output — preserve them.

The review summary body is structured and longer. For
`severity: 'info'` consumers, the truncated head is fine — the first
500 chars typically capture the "Pull request overview" paragraph
and the start of the Changes list. No structural stripping needed.

## Known gotchas

- **No admonition markers, ever.** Every Copilot inline comment is
  `suggestion`. Resist the urge to keyword-match for security or
  correctness concerns and escalate — the SKILL.md rule "Never emit
  `blocking` from a heuristic guess" applies in full. Consumers who
  want different policy must layer it on top.
- **GraphQL strips the `[bot]` suffix.** REST returns
  `copilot-pull-request-reviewer[bot]`; GraphQL returns
  `copilot-pull-request-reviewer`. The adapter matches against the
  GraphQL form for inline threads and against the REST form for the
  summary endpoint. Both must be in the username table in
  `SKILL.md`.
- **`headRef` is `null` on merged PRs with deleted branches.** This
  is normal after squash-merge with branch auto-deletion. The
  PR-state precedence rule in status mapping handles this — merged
  PRs go straight to `resolved` without consulting
  `head_pushed_at`.
- **`line` can be `null` even when `path` is set.** When a thread
  becomes outdated because the file was edited past the flagged
  region, GitHub clears `line`/`startLine` but keeps `path` and
  `isOutdated: true`. Consumers should treat `line` as optional and
  group by `path` alone when it's absent.
- **No nits, no info.** Copilot does not post style preferences or
  status updates as review threads. If a future release adds them,
  the severity matrix above will need extending — but as of
  2026-05, the bot is uniformly `suggestion` for inline + `info`
  for the summary.
- **The review summary is one per push.** Each push that triggers a
  re-review creates a new review row with a fresh `submitted_at`.
  Consumers wanting a single canonical summary should take the most
  recent review row, not all of them.
- **`copilot[bot]` ≠ `copilot-pull-request-reviewer[bot]`.** The
  former is the Copilot coding agent (PR author / commit author);
  the latter is the PR reviewer. This adapter is for the reviewer
  only. If the agent and reviewer ever start posting to overlapping
  surfaces, the username table will need disambiguation, but as of
  2026-05 the surfaces are disjoint.
- **PR state must be fetched explicitly.** The canonical GraphQL
  query in `adapter-coderabbit.md` does not include
  `pullRequest.state`. Either extend the query to include it, or
  fetch it separately — but it's required for status derivation
  here, because PR-state precedence is part of the table.

## Reference sample

Captured payloads ship alongside this adapter at
`org-meta/skills/gh-bot-reader/copilot.sample.json`. All three
scenarios come from `phoenixvc/retort`:

1. **`security-concern-suggestion`** — `retort#551`. Open PR;
   Copilot flags a path-traversal-flavoured issue with no marker.
   Severity stays `suggestion`; status is `new_since_push` (comment
   created 4 minutes after the head commit).
2. **`test-quality-suggestion`** — `retort#533`. Merged PR;
   substantive critique of test determinism with no marker.
   Severity `suggestion`; status `resolved` via PR-state precedence
   (thread is still `isResolved: false` at the GraphQL level).
3. **`outdated-thread-merged-pr`** — `retort#531`. Merged PR; thread
   has `isOutdated: true` because the file was edited after Copilot
   flagged it (and `line` is `null` as a result). `headRef` is
   `null` because the source branch was deleted on merge. Severity
   `suggestion`; status `resolved` via PR-state precedence.

When extending the adapter, run new heuristics against each
scenario and verify the `expected` block reproduces. The fixture is
the ground-truth shape; the field mapping in this document derives
from it.
