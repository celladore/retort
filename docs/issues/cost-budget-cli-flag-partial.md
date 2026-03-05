# fix(cost): Expose --budget flag in /cost command template and CLI

> **Labels**: `bug`, `cost-management`, `finops`
> **Priority**: P2

## Summary

The `/cost --budget` flag is defined in the command spec (`commands.yaml` line 469) but is only **partially implemented**:

| Layer                   | Status      | Detail                                                                     |
| ----------------------- | ----------- | -------------------------------------------------------------------------- |
| `commands.yaml` spec    | Defined     | `--budget` flag with description                                           |
| Budget guard module     | Implemented | `runBudgetStatus()` in `budget-guard.mjs`                                  |
| CLI entry point         | Implemented | `cli.mjs cost --budget` calls `runBudgetStatus()`                          |
| Command template        | **MISSING** | `.agentkit/templates/claude/commands/cost.md` does not document `--budget` |
| Generated command files | **MISSING** | All platform command outputs lack `--budget` documentation                 |

Users invoking `/cost --budget` get no agent guidance because the flag isn't documented in the command template that agents read.

## Root Cause

The `--budget` flag was added to `commands.yaml` and implemented in the engine during Wave 2, but the corresponding command template (`.agentkit/templates/claude/commands/cost.md`) was not updated. Since templates are protected files, this requires a maintainer update.

## What Needs to Change

### 1. Template: `.agentkit/templates/claude/commands/cost.md`

Add `--budget` to the Arguments/flags section:

```markdown
- `--budget` — Show budget enforcement status: session + daily limits vs current usage, enforcement mode, and utilization percentages.
```

Add to Available Commands table:

```markdown
| `/cost --budget` | Budget enforcement status and utilization |
```

Add a Budget Enforcement section explaining output:

```markdown
## Budget Enforcement

Shows the budget-guard circuit breaker status:

- **Enforcement mode**: `warn`, `enforce`, or `off`
- **Session limits**: duration, commands, files modified — current vs max with % utilization
- **Daily limits**: sessions, total duration, total commands — current vs max
- **Warning threshold**: configurable via `warnAtPercent` (default 80%)

When enforcement is `enforce` and a limit is exceeded, the PreToolUse hook blocks tool calls.
In `warn` mode, a warning is injected into context.

> `/cost --budget` shows local session/daily circuit breaker status.
> For cloud infrastructure budget governance, use `/cost-centres` instead.
```

### 2. Verify CLI integration

Confirm that `node .agentkit/engines/node/src/cli.mjs cost --budget` works correctly and outputs structured budget status.

### 3. Re-sync

```bash
pnpm -C .agentkit agentkit:sync
```

Verify all platform command outputs include the `--budget` documentation.

## Acceptance Criteria

- [ ] `/cost --budget` is documented in the command template's flags section
- [ ] Budget command appears in the Available Commands table
- [ ] Budget Enforcement section explains what the output shows
- [ ] Distinction between `/cost --budget` (session) and `/cost-centres` (cloud) is documented
- [ ] `cli.mjs cost --budget` works end-to-end
- [ ] All platform command outputs regenerated with `--budget` documentation
- [ ] No drift between spec and generated output

## Related

- See also: `docs/issues/cost-budget-flag-template-update.md` (earlier issue with more template detail)
- Budget guard module: `.agentkit/engines/node/src/budget-guard.mjs`
- Budget guard tests: `.agentkit/engines/node/src/__tests__/budget-guard.test.mjs`
- Settings: `.agentkit/spec/settings.yaml` (`budgetPolicy` section)
