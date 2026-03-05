<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Language-specific AI assistant instructions. -->

# Instructions — Blockchain / Smart Contracts

Apply these rules when editing `.sol` files or code in `contracts/`,
`programs/`, or `blockchain/` directories.

## Solana Programs (Anchor)

- Use the Anchor framework for all Solana programs.
- Validate all account constraints using Anchor macros (`#[account(...)]`).
- Use PDAs (Program Derived Addresses) for deterministic account addressing.
- All instructions must have explicit error codes (custom `#[error_code]` enum).
- Emit events for every state-changing instruction.

## EVM / EtherLink Contracts (Solidity)

- Target Solidity `^0.8.20` or later; enable overflow checks.
- Use OpenZeppelin audited contracts for standard patterns (ERC-20, ERC-721,
  access control).
- Implement replay protection (`nonce` or `EIP-712` typed signatures).
- Emit events for all state transitions.
- Mark functions `view`/`pure` wherever state is not mutated.

## x402 Payment Protocol

- Follow the HTTP 402 payment-required flow strictly.
- Verify payment proof before granting resource access.
- Implement idempotent payment processing (duplicate payment detection).
- Include receipt generation and verification.
- Handle payment timeout and retry scenarios explicitly.

## Gas Optimisation

- Minimise storage operations (prefer `memory` over `storage` in loops).
- Use `calldata` over `memory` for read-only function parameters.
- Batch transactions where possible.
- Document gas cost estimates in NatSpec for public functions.

## Testing

{{#if testingUnit}}- Test framework: **{{testingUnit}}**.{{/if}}

- Write unit tests for every public instruction/function using Anchor test
  framework (TypeScript) or Hardhat/Foundry for EVM contracts.
- Test both happy-path and all failure conditions (invalid accounts, overflow,
  replay attacks).
- Use local validator / Hardhat network for integration tests; never test on
  mainnet.
  {{#if testingCoverage}}- Minimum coverage: **{{testingCoverage}}%** on public contract surfaces.{{/if}}

## Security

- Never store private keys in code or environment files.
- Audit all arithmetic operations for overflow/underflow.
- Check for reentrancy vulnerabilities on all external calls.
- Require `msg.sender` checks for all privileged operations.
- Run Slither or equivalent static analyser before deploying.

{{#if ruleConventions}}

## Project Conventions

The following conventions are enforced in **{{projectName}}** and derived from
`.agentkit/spec/rules.yaml`:

{{#if ruleHasEnforcement}}

### Enforcement Rules

{{ruleEnforcementConventions}}

{{/if}}
{{#if ruleHasAdvisory}}

### Advisory Rules

{{ruleAdvisoryConventions}}

{{/if}}
{{/if}}
