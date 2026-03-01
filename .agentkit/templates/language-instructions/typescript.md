<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Language-specific AI assistant instructions. -->
# Instructions — TypeScript / JavaScript

Apply these rules when editing `.ts`, `.tsx`, `.js`, `.mjs`, or `.jsx` files.

## Linting & Formatting

- All code must pass ESLint with the project configuration.
- All code must be formatted with Prettier — run `prettier --write` before
  committing.
- Do not disable ESLint rules inline without an explanatory comment.

## Type Safety

- Enable `strict: true` in `tsconfig.json`.
- All exported functions, classes, and module boundaries must have explicit
  type annotations.
- Avoid `any` — use `unknown` with type guards when the type is truly dynamic.
- Enable strict null checks; handle `null`/`undefined` explicitly.
- Use `satisfies` for type-checked literals without widening.

## Code Style

- Prefer `const` and `let` over `var`.
- Use `async`/`await` over raw Promise chains.
- Prefer named exports over default exports for better refactor tooling.
- No `console.log` in production code — use the project's structured logger.
- Prefer early returns to reduce nesting.

## Testing

{{#if testingUnit}}- Unit test framework: **{{testingUnit}}**.{{/if}}
- Co-locate test files with source: `foo.ts` → `foo.test.ts`.
- Use descriptive test names that explain the expected behaviour.
- Mock external dependencies at system boundaries, not internal modules.
{{#if testingCoverage}}- Minimum coverage: **{{testingCoverage}}%** line, branch, and function.{{/if}}

```typescript
describe('myFunction', () => {
  it('should return the processed value when input is valid', () => {
    // Arrange → Act → Assert
  });
});
```

## Accessibility (UI Components)

- All UI components must meet WCAG 2.1 AA standards.
- Use semantic HTML elements.
- Include ARIA attributes where native semantics are insufficient.
- Ensure full keyboard navigation support.
- Maintain sufficient colour contrast (4.5:1 normal text, 3:1 large text).

## Dependencies

- Justify new dependencies in the PR description.
- Pin versions in `package.json`; use lock files.
- Run `npm audit` / `pnpm audit` before merging.
- Prefer packages with TypeScript declarations included.

{{#if ruleConventions}}
## Project Conventions

The following conventions are enforced in **{{projectName}}** and derived from
`.agentkit/spec/rules.yaml`:

{{ruleConventions}}
{{/if}}
