<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Language-specific AI assistant instructions. -->
# Instructions — Python

Apply these rules when editing `.py` files or `pyproject.toml`.

## Linting & Formatting

- All code must pass `ruff check` with the project configuration.
- All code must be formatted with `black` — run `black .` before committing.
- Run `ruff check --fix` to auto-fix where safe.
- No `# noqa` suppressions without an explanatory comment.

## Type Safety

- All public functions and methods must have type hints (PEP 484).
- Use `typing.Protocol` for structural subtyping.
- Run `mypy --strict` for new modules; do not allow type errors to accumulate.
- Use `typing.Optional[X]` or `X | None` (3.10+) over bare `None` defaults.

## Code Style

- Follow PEP 8 style guide.
- Use dataclasses or Pydantic models for structured data.
- Isolate IO operations (filesystem, network, database) at module boundaries.
- Core logic must be pure and testable without mocking IO.
- Use `pathlib.Path` over `os.path` for file system operations.

## Testing

{{#if testingUnit}}- Unit test framework: **{{testingUnit}}**.{{/if}}
- Test files must mirror source structure: `tests/test_<module>.py`.
- Use `pytest` fixtures for shared setup; use `@pytest.mark.parametrize` for
  variants.
- Mock at IO boundaries using `pytest-mock` or `unittest.mock`.
{{#if testingCoverage}}- Minimum coverage: **{{testingCoverage}}%** line and branch.{{/if}}

```python
def test_process_invoice_raises_on_invalid_amount():
    # Arrange
    invoice = Invoice(amount=-1)
    # Act + Assert
    with pytest.raises(ValueError, match="amount must be positive"):
        process_invoice(invoice)
```

## Documentation

- Google-style docstrings for all public modules, classes, and functions.
- Include `Args`, `Returns`, and `Raises` sections where applicable.
- Run `pydoc` or `pdoc` to validate documentation builds.

## Dependencies

- Declare dependencies in `pyproject.toml` with version bounds.
- Use virtual environments; never install globally.
- Run `pip-audit` before merging new dependencies.

{{#if ruleConventions}}
## Project Conventions

The following conventions are enforced in **{{projectName}}** and derived from
`.agentkit/spec/rules.yaml`:

{{ruleConventions}}
{{/if}}
