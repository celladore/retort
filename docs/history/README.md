# History

Historical documentation for significant PRs and implementations.

## Directory Structure

| Directory                                  | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| [implementations/](./implementations/)     | Major implementations and architecture changes |
| [bug-fixes/](./bug-fixes/)                 | Complex or critical bug resolutions            |
| [features/](./features/)                   | New feature launches                           |
| [migrations/](./migrations/)               | Major migrations and upgrades                  |
| [issues/](./issues/)                       | Issues encountered during development sessions |
| [lessons-learned/](./lessons-learned/)     | Lessons learned from retrospectives            |

## Naming Convention

Files use the format: `XXXX-YYYY-MM-DD-[title]-[type].md`

- `XXXX` — sequential 4-digit number (maintained in [.index.json](./.index.json))
- `YYYY-MM-DD` — completion date
- `[title]` — kebab-case title
- `[type]` — `implementation`, `bugfix`, `feature`, `migration`, `issue`, or `lesson`

## Creating New Documentation

Use the provided script to generate a new document from the correct template:

```bash
# Bash
./scripts/create-doc.sh implementation "Feature Name" <pr-number>
./scripts/create-doc.sh bugfix "Bug Description" <pr-number>
./scripts/create-doc.sh feature "Feature Name" <pr-number>
./scripts/create-doc.sh migration "Migration Name" <pr-number>
./scripts/create-doc.sh issue "Issue Title"
./scripts/create-doc.sh lesson "Lesson Title"
```

```powershell
# PowerShell
./scripts/create-doc.ps1 implementation "Feature Name" <pr-number>
```

Or use the `/document-history` slash command for auto-detection of type and title from session context.

See [docs/06_engineering/06_pr_documentation.md](../06_engineering/06_pr_documentation.md) for the full documentation strategy.
