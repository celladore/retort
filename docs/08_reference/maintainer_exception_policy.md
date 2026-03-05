# Maintainer Exception Policy (Emergency, Audited)

## Purpose

Define the exception process for emergency changes that would otherwise be blocked by AgentKit branch-governance guardrails.

## Allowed use

- Production outage mitigation
- Security incident response
- Critical CI/CD unblock where normal policy path is unavailable

## Required controls

1. Open or reference a tracking issue in `JustAGhosT/agentkit-forge`.
2. Include rationale, scope, and rollback plan in the PR description.
3. Require at least one maintainer approval before merge.
4. Add post-incident follow-up task to restore normal policy path.

## Audit requirements

- PR must include:
  - issue link
  - exception reason
  - affected files/paths
  - reviewer approval evidence
- Record follow-up outcome in the linked issue.

## Prohibited under exception

- Silent bypass without issue linkage
- Unreviewed direct pushes to protected branches
- Permanent policy bypasses without ADR/update
