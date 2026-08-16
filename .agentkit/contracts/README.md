# Agent Harnessing contracts

Retort vendors immutable schema snapshots so clean machines and CI can validate contracts without network access. org-meta remains the canonical doctrine, schema, and compatibility owner.

`agent-harnessing-v1.lock.json` pins the source repository, immutable merge revision, canonical identifier, normalized SHA-256 digest, lifecycle state, and authority boundary for `agent-harnessing-v1.schema.json`.

## Validate

```sh
pnpm --dir .agentkit retort:harness doctor --json
pnpm --dir .agentkit retort:harness validate --document path/to/harness.json --json
```

## Update

Schema updates must come from a reviewed org-meta merge. Replace the vendored schema, update every lock field from immutable merge evidence, run the harness tests and full Retort validation, and publish the change through a separate reviewed PR. Do not fetch mutable schema content during validation or infer runtime, external-effect, or merge authority from a passing contract.
