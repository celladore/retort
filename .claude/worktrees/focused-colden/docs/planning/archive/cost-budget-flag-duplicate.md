# chore(cost): Add `--budget` flag documentation to `/cost` command template

> **Target repo**: `retort`
> **Labels**: `chore`, `finops`, `cost-management`
> **Priority**: P2

## Summary

The `/cost` command spec in `commands.yaml` defines a `--budget` flag (line 469) that shows budget enforcement status (session + daily limits vs current usage). However, the corresponding slash command template at `.agentkit/templates/claude/commands/cost.md` does not document this flag, so users invoking `/cost --budget` won't get properly guided behavior.

## Context

This gap was identified during the Wave 1-2 implementation of the cost management infrastructure plan (`plan.cost-management.md`). The budget-guard circuit breaker module (`.agentkit/engines/node/src/budget-guard.mjs`) exposes `runBudgetStatus()` which provides:

- Current session metrics vs configured limits (duration, commands, files modified)
- Daily aggregate metrics vs daily caps
- Budget policy enforcement mode (warn/enforce/off)
- Percentage utilization for each metric

The `--budget` flag was added to the command spec but the template is a protected file (`.agentkit/templates/`) that cannot be modified by AI agents — it requires a human maintainer update.

## What Needs to Change

### File: `.agentkit/templates/claude/commands/cost.md`

**1. Add `--budget` to the Arguments section** (after `--last`):

```markdown
- `--budget` to show budget enforcement status (session + daily limits vs current usage).
```

**2. Add budget command to the Available Commands table**:

```markdown
| `cost --budget` | Budget enforcement status and utilization |
```

**3. Add a Budget Enforcement section** explaining what it shows:

````markdown
## Budget Enforcement

When `--budget` is passed, the agent runs the budget-guard status check:

```bash
node .agentkit/engines/node/src/cli.mjs cost --budget
```
````

This shows:

- **Enforcement mode**: `warn`, `enforce`, or `off` (from `settings.yaml` → `budgetPolicy.enforcement`)
- **Session limits**: duration, commands, files modified — current vs max, with % utilization
- **Daily limits**: sessions, total duration, total commands — current vs max
- **Warning thresholds**: configurable via `warnAtPercent` (default 80%)

If budget is exceeded and enforcement is `enforce`, the PreToolUse hook (`budget-guard-check.sh`) will block tool calls. In `warn` mode, it injects a warning into context.

````

**4. Add a note** distinguishing `/cost --budget` from `/cost-centres`:

```markdown
> **Note**: `/cost --budget` shows the local session/daily circuit breaker status.
> For cloud infrastructure budget governance (Azure consumption budgets, cost centres),
> use `/cost-centres` instead.
````

### After editing the template

```bash
pnpm -C .agentkit agentkit:sync
```

Commit both the template change and regenerated output.

## Acceptance Criteria

- [ ] `/cost --budget` flag is documented in the template's Arguments section
- [ ] Budget command appears in the Available Commands table
- [ ] Budget Enforcement section explains what the output shows
- [ ] Distinction between `/cost --budget` and `/cost-centres` is clear
- [ ] `agentkit:sync` regenerates all platform outputs with the updated template
- [ ] No drift between spec and generated output

## References

- Spec: `.agentkit/spec/commands.yaml` line 469 (`--budget` flag definition)
- Budget guard module: `.agentkit/engines/node/src/budget-guard.mjs` (`runBudgetStatus()`)
- Budget guard tests: `.agentkit/engines/node/src/__tests__/budget-guard.test.mjs`
- Settings: `.agentkit/spec/settings.yaml` (`budgetPolicy` section, lines 121-132)
- Plan: `plan.cost-management.md` §4.1-E
