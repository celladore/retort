# CI/CD Workflow Patterns

Copy-paste templates for common CI/CD scenarios. All patterns follow these conventions:
- Concurrency group cancels in-progress runs on new push
- `fetch-depth: 1` unless full history is needed
- Dependency cache keyed on lockfile hash
- Matrix workflows have a summary job for branch protection rules

---

## Basic CI (Any Stack)

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [dev, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Setup
        # stack-specific setup here

      - name: Lint
        run: # stack lint command

      - name: Test
        run: # stack test command
```

---

## .NET Multi-Project with Coverage

```yaml
name: CI (.NET)

on:
  pull_request:
  push:
    branches: [dev, main]

concurrency:
  group: dotnet-ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'

      - name: Restore
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore --configuration Release

      - name: Test with coverage
        run: |
          dotnet test --no-build --configuration Release \
            --collect:"XPlat Code Coverage" \
            --results-directory ./coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          directory: ./coverage
```

---

## TypeScript / pnpm with Turborepo

```yaml
name: CI (TypeScript)

on:
  pull_request:
  push:
    branches: [dev, main]

concurrency:
  group: ts-ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm turbo typecheck

      - name: Lint
        run: pnpm turbo lint

      - name: Test
        run: pnpm turbo test -- --coverage
```

---

## Terraform Plan-Only (PR Safety Check)

```yaml
name: Terraform Plan

on:
  pull_request:
    paths:
      - 'infra/**'
      - '.github/workflows/infra-plan.yml'

concurrency:
  group: tf-plan-${{ github.ref }}
  cancel-in-progress: true

jobs:
  plan:
    runs-on: ubuntu-latest
    environment: dev
    permissions:
      id-token: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Terraform Init
        run: terraform init
        working-directory: infra/

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color -out=tfplan
        working-directory: infra/

      - name: Comment plan on PR
        uses: actions/github-script@v7
        with:
          script: |
            const output = `#### Terraform Plan 📖
            \`\`\`
            ${{ steps.plan.outputs.stdout }}
            \`\`\``;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            })
```

---

## Full Deploy with Environment Protection

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4
      # build + deploy steps

  deploy-staging:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment: staging   # requires reviewer approval in GitHub settings
    steps:
      - uses: actions/checkout@v4
      # deploy steps

  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # requires reviewer approval + wait timer
    steps:
      - uses: actions/checkout@v4
      # deploy steps
```

---

## Change Detection with paths-filter

```yaml
# Avoid running expensive jobs when unrelated files change
- uses: dorny/paths-filter@v3
  id: changes
  with:
    filters: |
      api:
        - 'apps/api/**'
        - 'packages/domain/**'
      frontend:
        - 'apps/web/**'
        - 'packages/shared-ts/**'
      infra:
        - 'infra/**'

# Then conditionally run jobs:
- name: Build API
  if: steps.changes.outputs.api == 'true'
  run: dotnet build apps/api
```

---

## Rust CI

```yaml
name: CI (Rust)

on:
  pull_request:
  push:
    branches: [dev, main]

concurrency:
  group: rust-ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions-rust-lang/setup-rust-toolchain@v1
        with:
          components: clippy, rustfmt

      - name: Cache cargo
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - run: cargo fmt -- --check
      - run: cargo clippy -- -D warnings
      - run: cargo test
```
