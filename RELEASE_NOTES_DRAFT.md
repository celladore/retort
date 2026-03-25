# Release Notes — retort (agentkit-forge) — 2026-03-25 (DRAFT)

> Covers changes since repository creation — 17 PRs over the last 30 days  
> Review and edit before publishing.

## Features
- Rebrand CLI from `agentkit` to `retort` with deprecated alias for one release cycle (#436)
- Kit-based domain selection, init wizard, and stop hook performance improvements (#432)
- Add `syncDateMode` config (run/version/none) and file-path context to placeholder warnings (#459)
- Add `integrationBranch` setting and PR base branch guard (#438)
- Add `/start` command — new user entry point with state detection and contextual status dashboard (#387)
- Add configurable prefix to kit commands (#388)
- Complete revisit of agents with `start` command and `AskUserQuestion` tooling (#400)
- Claude heuristics integration (#398)

## Bug Fixes
- Fix `jq --arg` E2BIG error on Windows Git Bash by piping via stdin (#460)
- Add safety wrapper and dry-run preview for retort sync (#457)
- Reduce generated file churn from EOL, formatting, and scaffold noise (#458)
- CI remediation — configurable package manager, test stability fixes (#390)

## Docs
- Update ecosystem table with current repo names (cockpit→deck, ai-cadence→phoenix-flow, ai-flume→sluice) (#441)
- Add tool-neutral agent hub findings, ADR-10, and adoption roadmap (#428)
- Add Linear PhoenixVC workspace setup implementation record (#431)

## Infra / DevOps
- Remove `package-lock.json` in favour of `pnpm-lock.yaml` (#462)
- Update follow-up issues after kit-based domain filtering (#435)
