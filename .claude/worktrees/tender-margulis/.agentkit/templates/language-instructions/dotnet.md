<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Language-specific AI assistant instructions. -->

# Instructions — .NET / C#

Apply these rules when editing `.cs` files, `.csproj`, or `.sln` files.

## Architecture

- Follow clean architecture layering: Domain → Application → Infrastructure →
  Presentation. No layer may bypass the layer directly above it.
- Use ports and adapters (hexagonal) for external integrations.
- Define port interfaces in the Application layer; implement adapters in
  Infrastructure.

## Dependency Injection

- All services must use constructor-based dependency injection.
- Register services in dedicated extension methods
  (e.g. `AddMyFeatureServices()`).
- Never use the service locator anti-pattern (`IServiceProvider.GetService`).

## Code Style

- PascalCase for public members; `_camelCase` for private fields.
- Enable nullable reference types (`<Nullable>enable</Nullable>`).
- Use `async`/`await` with `ConfigureAwait(false)` in library code.
- All code must pass `dotnet format`.

## Testing

{{#if testingUnit}}- Unit test framework: **{{testingUnit}}**.{{/if}}

- Use xUnit or NUnit for unit tests; name test classes `<Class>Tests`.
- xUnit: `[Fact]` for single-case, `[Theory]` + `[InlineData]` for parameterised tests.
- NUnit: `[Test]` for single-case, `[TestCase(...)]` for parameterised tests.
- Follow Arrange-Act-Assert with blank lines separating each phase.
- Use `Moq` or `NSubstitute` for mocking; mock interfaces, not concrete types.
{{#if testingCoverage}}- Minimum coverage: **{{testingCoverage}}%** line and branch.{{/if}}

## API Compatibility

- Public API surfaces must maintain backwards compatibility.
- Breaking changes require a version bump + deprecation notice + migration docs.
- Use API versioning for HTTP endpoints.

## Documentation

- XML documentation comments for all public APIs.
- Include `<summary>`, `<param>`, `<returns>`, and `<exception>` tags.
- Enable XML doc generation: set `<GenerateDocumentationFile>true</GenerateDocumentationFile>`
  in the project file and verify with `dotnet build`. Use DocFX for publishing
  API reference documentation.

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
