# Mystira Testing Stacks Reference

Stack-specific test commands, paths, and conventions for `mystira-workspace`.

## .NET / xUnit

**Solution**: `Mystira.sln` (root), `apps/app/src/Mystira.App.sln`, `apps/story-generator/src/Mystira.StoryGenerator.sln`

**Run tests:**
```bash
# All .NET tests
dotnet test Mystira.sln

# Specific solution
dotnet test apps/app/src/Mystira.App.sln

# With coverage
dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage

# Filter by test name
dotnet test --filter "FullyQualifiedName~AuthServiceTests"
```

**Test project naming**: `*.Tests.csproj` (e.g. `Mystira.App.Tests.csproj`)

**xUnit conventions:**
- Test classes: `public class <ClassName>Tests`
- Fact: single test case — `[Fact]`
- Theory: parameterized — `[Theory]` + `[InlineData(...)]`
- Async: `public async Task MethodName_Scenario_Expected()`
- Mocking: Moq (`Mock<IInterface>`) or NSubstitute
- Assertions: FluentAssertions (`result.Should().Be(expected)`)
- AAA pattern: Arrange / Act / Assert, separated by blank lines with comments

**Test project location**: `apps/app/tests/`, `apps/story-generator/tests/`

---

## TypeScript / Vitest

**Packages with tests**: `apps/publisher/`, `apps/admin/ui/`, `packages/shared-ts/`, `packages/core/`

**Run tests:**
```bash
# All TS tests
pnpm test

# Specific package
pnpm --filter @mystira/publisher test

# With coverage
pnpm test -- --coverage

# Watch mode
pnpm vitest

# Run single file
pnpm vitest run src/services/AuthService.test.ts
```

**Config**: `vitest.config.ts` per package (inherits from `configs/vitest.config.ts`)

**Vitest conventions:**
- Test file naming: `*.test.ts` or `*.spec.ts` co-located with source
- Structure: `describe` → `it` / `test`
- Mocking: `vi.fn()`, `vi.mock("module")`, `vi.spyOn(obj, "method")`
- Assertions: `expect(value).toBe(expected)`
- Async: `it("name", async () => { ... })`
- Setup/teardown: `beforeEach`, `afterEach`, `beforeAll`, `afterAll`

---

## Rust / cargo test

**Crate root**: `apps/devhub/`

**Run tests:**
```bash
# All tests in workspace
cargo test

# Specific crate
cargo test -p mystira-devhub-core

# Specific test
cargo test auth::login_returns_token

# With output shown
cargo test -- --nocapture

# Coverage (requires cargo-tarpaulin)
cargo tarpaulin --out Stdout
```

**Rust test conventions:**
- Unit tests: `#[cfg(test)] mod tests { ... }` at bottom of source file
- Integration tests: `tests/` directory at crate root
- Test naming: snake_case, descriptive (`fn login_with_valid_creds_returns_token()`)
- Assertions: `assert!()`, `assert_eq!()`, `assert_ne!()`
- Error testing: `assert!(result.is_err())` or use `#[should_panic]`
- Async: use `#[tokio::test]` for async test functions

---

---

## Blazor WebAssembly / bunit

**Test project**: `apps/app/tests/Mystira.App.PWA.Tests`

Blazor component tests use **bunit**, not plain xUnit — never use xUnit directly for
component rendering assertions.

**Run tests:**
```bash
dotnet test apps/app/tests/Mystira.App.PWA.Tests
```

**bunit conventions:**
```csharp
using Bunit;
using Xunit;

public class BundleCardTests : TestContext
{
    [Fact]
    public void BundleCard_RendersTitle_WhenBundleProvided()
    {
        // Arrange
        var bundle = new Bundle { Title = "Dragon's Hoard" };

        // Act
        var cut = RenderComponent<BundleCard>(parameters => parameters
            .Add(p => p.Bundle, bundle));

        // Assert
        cut.Find("h2").TextContent.Should().Be("Dragon's Hoard");
    }
}
```

**Detection signal**: source file is `*.razor` → test project is `*.PWA.Tests` → use bunit `TestContext`, not plain `[Fact]` class.

**Service testing in Blazor** (non-component services): use plain xUnit + Moq inside the same test project.

---

## Test Pyramid and COPPA Rules

**Target pyramid** (Mystira-specific):

| Tier | Target share | Command |
|---|---|---|
| Unit | 70% | `dotnet test --filter Category=Unit` |
| Integration | 20% | `dotnet test --filter Category=Integration` |
| E2E | 10% | Playwright (apps/e2e/) |

**COPPA-critical paths** require ≥80% coverage regardless of pyramid tier:
- Parental consent flow
- Age gating
- Child data deletion

When coverage-guard finds these paths below 80%, escalate to the user — do not treat
as advisory.

---

## Coverage Thresholds

| Stack | Default threshold | Enforcement |
|---|---|---|
| .NET | 80% | Per solution |
| TypeScript | 80% | Per package |
| Rust | 70% (aspirational) | Per crate |
| COPPA paths (.NET) | 80% | Mandatory escalation |

Override per project in `.claude/retort.local.md`.
