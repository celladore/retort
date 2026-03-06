# Branch Plan: docs/restructure-agentkit-docs

## Objective

Reorganize `.agentkit/docs/` from 24 flat root-level markdown files (~330 KB) into purpose-driven subdirectories matching the existing README.md groupings. This improves discoverability and navigation.

## Target Structure

```
.agentkit/docs/
├── README.md                    (updated: links point to subdirs)
├── getting-started/
│   ├── README.md                (new: stub index)
│   ├── QUICK_START.md
│   ├── CLI_INSTALLATION.md
│   └── ONBOARDING.md
├── guides/
│   ├── README.md                (new: stub index)
│   ├── COMMAND_REFERENCE.md
│   ├── TEAM_GUIDE.md
│   ├── WORKFLOWS.md
│   ├── AGENTS_REFERENCE.md
│   └── AGENTS_VS_TEAMS.md
├── architecture/
│   ├── README.md                (new: stub index)
│   ├── ARCHITECTURE.md
│   ├── STATE_AND_SESSIONS.md
│   ├── SECURITY_MODEL.md
│   └── COST_TRACKING.md
├── configuration/
│   ├── README.md                (new: stub index)
│   ├── PROJECT_YAML_REFERENCE.md
│   ├── CUSTOMIZATION.md
│   ├── TOOLS.md
│   ├── AGENTS_MD_GUIDE.md
│   └── MCP_A2A_GUIDE.md
├── reference/
│   ├── README.md                (new: stub index)
│   ├── MIGRATION_GUIDE.md
│   ├── TROUBLESHOOTING.md
│   ├── ROADMAP.md
│   ├── FOLLOW_UP_ISSUES.md
│   └── DOCUMENTATION_AUDIT.md
├── platform_reference/          (unchanged)
└── router_specialist/           (unchanged)
```

## Steps

### Step 1: Create subdirectories

```bash
mkdir -p .agentkit/docs/{getting-started,guides,architecture,configuration,reference}
```

### Step 2: Move files (git mv)

| Destination        | Files                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `getting-started/` | QUICK_START.md, CLI_INSTALLATION.md, ONBOARDING.md                                              |
| `guides/`          | COMMAND_REFERENCE.md, TEAM_GUIDE.md, WORKFLOWS.md, AGENTS_REFERENCE.md, AGENTS_VS_TEAMS.md      |
| `architecture/`    | ARCHITECTURE.md, STATE_AND_SESSIONS.md, SECURITY_MODEL.md, COST_TRACKING.md                     |
| `configuration/`   | PROJECT_YAML_REFERENCE.md, CUSTOMIZATION.md, TOOLS.md, AGENTS_MD_GUIDE.md, MCP_A2A_GUIDE.md     |
| `reference/`       | MIGRATION_GUIDE.md, TROUBLESHOOTING.md, ROADMAP.md, FOLLOW_UP_ISSUES.md, DOCUMENTATION_AUDIT.md |

### Step 3: Create stub README.md in each subdirectory

Each gets a ~5-line README with purpose + file list + link back to main README.

### Step 4: Update root README.md

Update all 24 links from flat paths to subdirectory paths.

### Step 5: Update cross-document references

Scan all moved files for `](*.md)` patterns and update relative paths.
Key patterns:

- Files in `guides/` referencing `architecture/` files: add `../architecture/` prefix
- Files in `getting-started/` referencing `guides/` files: add `../guides/` prefix

### Step 6: Update external references

Update links in root `README.md` and any other files that point to `.agentkit/docs/` files.

## Verification

- All files accessible from README.md navigation
- Root README.md links all resolve
- Cross-document links within .agentkit/docs/ all resolve
- No broken links
