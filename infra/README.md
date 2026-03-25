<<<<<<< HEAD

# Infrastructure — retort

# This directory holds infrastructure and staging guidance for the Retort framework repository.

# Infrastructure — agentkit-forge

This directory holds infrastructure and staging guidance for the AgentKit Forge framework repository.

> > > > > > > origin/main

## Staging and local validation

This repo is **framework-only**: it does not deploy a runnable application. There is no traditional staging server.

- **Local:** Run `pnpm install` and `pnpm -C .agentkit agentkit:sync` (and optionally `pnpm -C .agentkit agentkit:validate`) from the repo root.
- **Staging-like:** Use the root `docker-compose.yml` to run sync in a container: `docker compose --profile sync run --rm agentkit-sync`.
  <<<<<<< HEAD
- # **Adopters:** Projects that use Retort should define their own staging (e.g. in their `infra/`, Terraform, or Docker Compose) and deploy their application there.
- **Adopters:** Projects that use AgentKit Forge should define their own staging (e.g. in their `infra/`, Terraform, or Docker Compose) and deploy their application there.
  > > > > > > > origin/main

## Naming and IaC

When adding Terraform/Bicep/Pulumi in adopters’ repos, follow the conventions in the root CLAUDE.md (e.g. naming `{org}-{env}-{project}-{resourcetype}-{region}`, mandatory tags).
