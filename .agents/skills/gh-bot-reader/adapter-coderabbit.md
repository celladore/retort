# Adapter — CodeRabbit

Companion to `gh-bot-reader/SKILL.md`. Covers parsing CodeRabbit review
output into `BotFinding[]`.

## Author identification

CodeRabbit posts as one of:

- `coderabbitai[bot]` — most common (App-installed)
- `coderabbitai` — user-mode installs

Either matches `bot: 'coderabbit'`.

## Where comments live

CodeRabbit uses two surfaces:

1. **Review threads** — inline file-and-line review comments. These are
   the ones that show resolved state and an explicit severity prefix.
   Fetch via GraphQL (`pullRequest.reviewThreads`).
2. **Summary issue comments** — the "Walkthrough" / "Summary" comments
   on the PR conversation. These are body-only and rarely actionable;
   classify as `info`.

Only the review-thread comments produce findings worth acting on. Issue
comments may be included with `severity: 'info'` so consumers see them
but do not block.

## Canonical GraphQL query

This is the query the skill uses for review threads. The same query
works for every review-comment adapter — pass it once per PR and route
results by author.

```graphql
query ReviewThreads($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      url
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          comments(first: 100) {
            nodes {
              id
              url
              body
              createdAt
              author { login }
            }
          }
        }
      }
    }
  }
}
```

Invocation pattern with `gh`:

```bash
gh api graphql \
  -F owner="$OWNER" -F name="$REPO" -F number="$PR" \
  -f query="$QUERY" \
  --paginate
```

`--paginate` follows `pageInfo.hasNextPage` automatically when used
with `-F` cursor variables.

## Severity heuristics

CodeRabbit prefixes lines in the comment body with one of several
markers. Inspect the **first non-empty line** of `comments.nodes[0].body`
and map as follows:

| First-line prefix (case-insensitive) | Severity     |
| ------------------------------------ | ------------ |
| `[!CAUTION]`                         | `blocking`   |
| `[!WARNING]`                         | `blocking`   |
| `[!IMPORTANT]`                       | `suggestion` |
| `[!NOTE]`                            | `suggestion` |
| `[!TIP]`                             | `suggestion` |
| `nit:` or `Nit:`                     | `nit`        |
| _Walkthrough_ / _Summary_ body       | `info`       |

If the body contains no marker, default to `suggestion` — CodeRabbit
posts a comment because it has an opinion; treating that as `info`
under-reports.

Markers may appear in either GitHub admonition syntax
(`> [!CAUTION]`) or as plain `[!CAUTION]` at the start of a line.
Both forms match.

## Resolved-state mapping

The `BotFinding.status` field is derived from the thread, not the
comment:

| GraphQL fields                            | `status`         |
| ----------------------------------------- | ---------------- |
| `isResolved: true`                        | `resolved`       |
| `isOutdated: true` (and not resolved)     | `outdated`       |
| neither — comment posted after last push  | `new_since_push` |
| neither — comment posted before last push | `unresolved`     |

"Last push" is `pullRequest.headRefOid`'s committer date — fetch it
once per PR and compare against each thread's earliest comment
`createdAt`.

By default the skill drops `resolved` threads. The
`include_resolved: true` option keeps them.

## Field mapping

| `BotFinding` field | Source                                                            |
| ------------------ | ----------------------------------------------------------------- |
| `bot`              | `'coderabbit'`                                                    |
| `bot_name_raw`     | `comments.nodes[0].author.login`                                  |
| `thread_id`        | `reviewThreads.nodes[i].id`                                       |
| `pr_number`        | `pullRequest.number`                                              |
| `status`           | derived (see table above)                                         |
| `severity`         | derived (see severity heuristics)                                 |
| `file`             | `reviewThreads.nodes[i].path`                                     |
| `line`             | `reviewThreads.nodes[i].line` (fallback to `startLine`)           |
| `body`             | `comments.nodes[0].body`, first 500 chars after stripping markers |
| `url`              | `comments.nodes[0].url`                                           |
| `posted_at`        | `comments.nodes[0].createdAt`                                     |
| `meta.thread_size` | `comments.nodes.length`                                           |
| `meta.is_outdated` | `reviewThreads.nodes[i].isOutdated`                               |

## Body sanitisation

Before truncating to 500 chars:

1. Strip the leading marker (`[!CAUTION]`, `nit:`, etc.).
2. Strip the trailing `<details>` block ("🤖 Prompt for AI Agents",
   committable suggestion blocks). These are useful for the
   `pr-review-toolkit:autofix` flow, not for a summary report.
3. Collapse runs of two or more blank lines to one.
4. Trim leading and trailing whitespace.

## Known gotchas

- **Marker case drift.** CodeRabbit has shipped both `[!CAUTION]` and
  `[!Caution]` in 2026 releases. Match case-insensitively.
- **Multiple comments per thread.** Treat only the first comment as
  the finding; subsequent ones are usually agent replies or
  CodeRabbit's follow-up after a push.
- **Outdated threads on the same file.** When a file is edited after
  CodeRabbit flagged it, the thread becomes `isOutdated`. By default
  the skill keeps these (status: `outdated`) — they still represent
  useful signal — but consumers can filter them out.
- **Pagination.** A single PR with many comments will exceed the
  first-100 page. `--paginate` handles this; do not skip it.
- **Quoted markers.** A human reviewer quoting `> [!CAUTION]` in
  their own comment will not be picked up — author identification by
  `bot` username protects against this.

## Reference sample

A small captured payload will land at
`org-meta/skills/gh-bot-reader/coderabbit.sample.json` (added in a
follow-up PR with the test-fixture harness). Treat that file as the
canonical shape; new adapters should provide their own equivalent.
