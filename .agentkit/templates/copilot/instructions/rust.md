<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# Copilot Instructions — Rust

Apply these rules when editing `.rs` files or `Cargo.toml`.

## Error Handling

- Use `thiserror` for library error types and `anyhow` for application code.
- Prefer `Result<T, E>` over `panic!`, `unwrap()`, or `expect()` in library
  code. Reserve `unwrap` for cases where the invariant is proven by construction
  and documented with a comment.
- Implement `std::fmt::Display` for all public error types.
- Use the `?` operator for error propagation; avoid manual `match` on `Result`
  when `?` suffices.

## Code Style

- Run `cargo fmt` before committing. Do not deviate from the project's
  `rustfmt.toml` configuration.
- Run `cargo clippy -- -D warnings` and fix all warnings. Do not suppress
  Clippy lints without a documented justification.
- Prefer `&str` over `String` in function parameters when ownership is not
  required.
- Use `#[must_use]` on functions whose return value should not be discarded.
- Minimize `unsafe` blocks. Every `unsafe` block must have a `// SAFETY:`
  comment explaining why the invariants are upheld.

## Testing

- Place unit tests in a `#[cfg(test)] mod tests` block at the bottom of
  each module.
- Use `#[test]` for synchronous tests and `#[tokio::test]` for async tests.
- Name test functions descriptively: `test_<function>_<scenario>_<expected>`.
- Use `assert_eq!` and `assert_ne!` over plain `assert!` for clearer failure
  messages.
- Write integration tests in the `tests/` directory for cross-module behavior.
- Aim for high coverage on public API surfaces; internal helpers can have
  lighter coverage if they are exercised through public API tests.

## Dependencies

- Justify new dependencies in the PR description. Prefer crates with:
  - Active maintenance and recent releases
  - No `unsafe` code (or well-audited `unsafe`)
  - Minimal transitive dependency count
- Pin exact versions in `Cargo.toml` for binaries; use semver ranges for
  libraries.

## Performance

- Avoid unnecessary allocations in hot paths; prefer iterators over collecting
  into `Vec`.
- Use `#[bench]` or Criterion for performance-sensitive code and include
  benchmarks in the PR.
- Profile before optimizing; do not sacrifice readability for speculative gains.

## Documentation

- Add `///` doc comments to all public items.
- Include usage examples in doc comments for public functions and types.
- Run `cargo doc --no-deps` to verify documentation builds without warnings.
