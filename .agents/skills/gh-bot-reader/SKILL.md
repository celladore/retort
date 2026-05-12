---
name: gh-bot-reader
description: Parse bot-authored PR comments and review threads (CodeRabbit, Copilot, Renovate, Codecov, Sonatype, Claude review) into a structured BotFinding list. Use when /cleanup, /preflight, /review, or /document-history need to surface unresolved bot feedback without each command rolling its own parser. Read-only; never replies or resolves threads.
---

# gh-bot-reader

A reusable read-only routine that pulls bot-authored PR review threads and
issue comments from GitHub and normalises them into a structured
`BotFinding[]` shape. Other skills and commands compose this output —
they should not roll their own parsers.

## When to use

Trigger this skill when:

- `/cleanup` needs the `bots` scope (unresolved blocking threads, stuck
  Renovate rebase loops, new-since-last-push comments).
- `/preflight` wants to surface coverage drops or security advisories
  posted by bots on the open PR.
- `/review` is summarising prior bot feedback on a PR before authoring
  a new human review.
- `/document-history` is gathering source material for a bug-fix or
  feature retrospective and wants to enumerate the bot signal that
  shaped it.
- The cross-repo cleanup aggregator (`org-meta/.github/workflows/cleanup-aggregator.yml`)
  runs and needs the same parsing for every project.

Do **not** invoke this skill when:

- The PR comment is from a human reviewer (use `/review` or
  `pr-review-toolkit:comment-analyzer`).
- You need to reply to a bot, resolve a thread, or push changes — this
  skill is read-only by design.

## Output contract — `BotFinding`

Every adapter returns objects matching this shape:

```ts
interface BotFinding {
  bot:
    | 'coderabbit'
    | 'copilot'
    | 'renovate'
    | 'codecov'
    | 'sonatype'
    | 'claude'
    | 'other';
  bot_name_raw: string; // exact GH username, e.g. 'coderabbitai[bot]'
  thread_id: string; // GraphQL node id for review threads; comment id for issue comments
  pr_number: number;
  status: 'unresolved' | 'resolved' | 'outdated' | 'new_since_push';
  severity: 'blocking' | 'suggestion' | 'nit' | 'info';
  file?: string; // path relative to repo root, when applicable
  line?: number; // 1-based line in `file`
  body: string; // sanitised; truncated to first 500 chars
  url: string; // permalink to the comment / thread
  posted_at: string; // ISO 8601
  meta: Record<string, unknown>; // adapter-specific extras
}
```

Treat this shape as a **stable contract**. Consumers (the `/cleanup`
`--json` schema, the cross-repo aggregator, future dashboards) depend
on it. Add fields only by extending `meta` until a follow-up bumps the
contract version.

## API — `scan(opts)`

The skill is invoked with one entry point and a small option set:

```ts
scan(opts: {
  pr_number?: number;        // restrict to one PR; default: all open PRs in repo
  repo?: string;             // 'owner/name'; default: current repo
  since?: string;            // ISO date or relative '7d'; default: no lower bound
  include_resolved?: boolean; // default: false
}): Promise<BotFinding[]>
```

Default behaviour: scan all open PRs in the current repo, exclude
resolved threads, no time floor.

## Severity heuristics

Each adapter is responsible for mapping its bot's conventions onto this
four-level scale:

| Severity     | Meaning                                                                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocking`   | Explicit blocking signal — e.g. CodeRabbit `[!CAUTION]`, Sonatype critical CVE, a failing required check posted by the bot. Consumers should treat this as a merge blocker until acknowledged. |
| `suggestion` | An improvement with rationale — should be considered, may be dismissed.                                                                                                                       |
| `nit`        | Style or preference; safe to ignore but cheap to apply.                                                                                                                                       |
| `info`       | Status updates, table summaries, bot housekeeping. Never blocks.                                                                                                                              |

When an adapter cannot classify confidently, fall back to `info`. Never
emit `blocking` from a heuristic guess — require an explicit signal in
the bot output.

## Bot identification

Adapters are selected by GitHub author username, not by content
sniffing. The mapping:

| `bot` value  | GitHub username pattern                          |
| ------------ | ------------------------------------------------ |
| `coderabbit` | `coderabbitai[bot]`, `coderabbitai`              |
| `copilot`    | `github-copilot[bot]`, `copilot-pull-request-reviewer[bot]`, `copilot-pull-request-reviewer` |
| `renovate`   | `renovate[bot]`, `renovate-bot`, `mend-renovate[bot]` |
| `codecov`    | `codecov[bot]`, `codecov-commenter`              |
| `sonatype`   | `sonatype-lift[bot]`, `sonatype[bot]`            |
| `claude`     | `anthropic[bot]`, `claude[bot]`                  |
| `other`      | Any author with the `[bot]` suffix not listed above |

Authors without the `[bot]` suffix are out of scope — they are human
reviewers and belong to a different code path.

## Data source — prefer GraphQL

Use `gh api graphql` for PR review threads. The GraphQL API exposes
data the REST endpoints do not, and the GraphQL response is the only
practical way to determine whether a thread is resolved or outdated.

A canonical query is shown in the CodeRabbit companion
(`adapter-coderabbit.md`); the same query shape works for all review-comment
adapters. For body-only bots (Renovate status tables on the PR
description; Codecov delta as an issue comment), the REST endpoints
`gh api repos/{owner}/{repo}/pulls/{n}` and
`gh api repos/{owner}/{repo}/issues/{n}/comments` are fine.

## Caching

Cache GitHub responses for 60 seconds in
`~/.claude/cache/gh-bot-reader/` (home-relative, matching the rest of
the `.claude/` tooling conventions) to avoid hammering the API during
a single cleanup run that may scan many PRs. Cache key: SHA-256 of the
GraphQL query string and variables (or REST URL). On secondary rate
limit (HTTP 403 with `x-ratelimit-remaining: 0`), back off using the
`Retry-After` header.

Entries are short-lived: the 60-second TTL means each cleanup run
effectively gets fresh data, and stale entries are ignored. The
directory itself is safe to delete at any time; `/cleanup` should
treat it as ephemeral.

## Per-bot adapters

Each bot has its own companion file detailing parsing rules, sample
output, severity mapping, and known gotchas. The CodeRabbit companion
ships with this skill; the rest land as follow-up PRs:

- `adapter-coderabbit.md` — **included.** CodeRabbit review threads
  with `[!CAUTION]` / `[!WARNING]` / `nit:` blocks.
- `adapter-copilot.md` — **included.** GitHub Copilot for PRs:
  review-thread inline comments (severity: `suggestion`, no
  markers) plus the review summary (`/pulls/{n}/reviews` body,
  severity: `info`). Second review-thread adapter — shares the
  canonical GraphQL query from `adapter-coderabbit.md`.
- `adapter-renovate.md` — pending. Renovate status table + rebase-loop signature.
- `adapter-codecov.md` — pending. Coverage delta comment + project threshold.
- `adapter-sonatype.md` — pending. Vulnerability advisories with CVSS.
- `adapter-claude.md` — pending. Anthropic Claude review output.

When an adapter is missing, the bot still appears in the output with
`bot: 'other'` and `severity: 'info'` — the body is reported verbatim
so the consumer at least sees it. Never throw on an unknown bot.

## Algorithm — high level

1. **List candidate PRs** with
   `gh pr list --state open --limit 1000 --json number,headRefName,updatedAt`
   (or use the supplied `pr_number`). `--limit` is mandatory:
   without it `gh pr list` caps at 30 items and silently skips older
   open PRs in busy repos. `updatedAt` here is only a pre-filter for
   the `since` option; the per-PR "last push" timestamp used for
   `new_since_push` is fetched in the next step.
2. For each PR, **fetch review threads** via the GraphQL query in the
   CodeRabbit companion. The same query also returns `headRefOid` and
   `headRef.target.committedDate` — the committer date of the head
   commit, used as the authoritative "last push" timestamp when
   deriving each thread's `status`. Filter threads by `since` if
   supplied; drop resolved threads unless `include_resolved`.
3. **Group threads by author**. For each author:
   - Match the author against the username table above to pick an adapter.
   - Delegate the thread set to the adapter; receive `BotFinding[]`.
4. **Fetch issue comments** (PR body and conversation comments) via REST
   for each PR — bots like Renovate and Codecov post here, not in
   review threads.
5. **Concatenate, sort by `severity` then `posted_at` descending**, and
   return.

## Out of scope

- Writing back to PRs (resolving threads, replying, hiding comments).
- Cross-bot deduplication (CodeRabbit and Claude both flagging the same
  line) — that is a consumer concern.
- Severity overrides per repo — also a consumer concern, applied after
  this skill returns.
- Human reviewer comments — they belong to `pr-review-toolkit:comment-analyzer`.

## Related

- Consumer: `/cleanup` (baton ticket `fb2e982d-…`) uses this for the
  `bots` scope.
- Consumer: `phoenix-cleanup-aggregator` (baton ticket `b33a9248-…`)
  uses this org-wide.
- Sibling: `pr-review-toolkit:comment-analyzer` covers human reviewer
  comments; this skill explicitly does not.
