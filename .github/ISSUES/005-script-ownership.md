# fix(dx): Assign agent ownership for maintenance scripts

**Priority:** P2 — Medium
**Labels:** `enhancement`, `dx`, `documentation`
**Blocked by:** #002 (maintenance-coordinator agent)

---

## Problem

11 scripts in `scripts/` have no designated agent owner. When scripts break or need updates (e.g., GitHub workflow API changes), nobody is responsible.

---

## Current Scripts

| Script                                         | Purpose                     | Proposed Owner            |
| ---------------------------------------------- | --------------------------- | ------------------------- |
| `resolve-merge.sh` / `.ps1`                    | Merge conflict resolution   | `maintenance-coordinator` |
| `setup-agentkit-branch-governance.sh` / `.ps1` | Branch protection setup     | `maintenance-coordinator` |
| `update-changelog.sh` / `.ps1`                 | CHANGELOG.md updates        | `release-manager`         |
| `create-doc.sh` / `.ps1`                       | Documentation file creation | `content-strategist`      |
| `validate-documentation.sh`                    | Validate docs               | `content-strategist`      |
| `validate-numbering.sh`                        | Validate doc numbering      | `content-strategist`      |
| `check-documentation-requirement.sh`           | Doc requirements check      | `content-strategist`      |

---

## Implementation Plan

### Step 1: Add script paths to agent focus areas (~15 min)

In `.agentkit/spec/agents.yaml`:

**maintenance-coordinator** (from #002):

```yaml
focus:
  - 'scripts/resolve-merge.*'
  - 'scripts/setup-agentkit-branch-governance.*'
```

**release-manager** — add to existing focus:

```yaml
focus:
  # ... existing entries ...
  - 'scripts/update-changelog.*'
```

**content-strategist** — add to existing focus:

```yaml
focus:
  # ... existing entries ...
  - 'scripts/create-doc.*'
  - 'scripts/validate-documentation.*'
  - 'scripts/validate-numbering.*'
  - 'scripts/check-documentation-requirement.*'
```

### Step 2: Add CODEOWNERS entries (~5 min)

```
scripts/resolve-merge.*                    @maintenance-team
scripts/setup-agentkit-branch-governance.* @maintenance-team
scripts/update-changelog.*                 @release-team
scripts/create-doc.*                       @docs-team
scripts/validate-*                         @docs-team
scripts/check-documentation-*              @docs-team
```

### Step 3: Add script health check to doctor.mjs (~30 min)

```javascript
// 6) Script health
const scriptsDir = resolve(projectRoot, 'scripts');
if (existsSync(scriptsDir)) {
  const scripts = readdirSync(scriptsDir).filter((f) => f.endsWith('.sh'));
  for (const script of scripts) {
    const scriptPath = resolve(scriptsDir, script);
    const stat = statSync(scriptPath);
    // Check executable bit
    const isExecutable = (stat.mode & 0o111) !== 0;
    if (!isExecutable) {
      findings.push({
        severity: 'warning',
        message: `scripts/${script} is not executable. Run: chmod +x scripts/${script}`,
      });
    }
    // Check shebang
    const content = readFileSync(scriptPath, 'utf-8');
    if (!content.startsWith('#!/')) {
      findings.push({
        severity: 'warning',
        message: `scripts/${script} is missing shebang line.`,
      });
    }
  }
}
```

---

## Acceptance Criteria

- [ ] Each script has a designated agent owner via focus area
- [ ] CODEOWNERS maps scripts to teams
- [ ] `doctor.mjs` checks script executable permissions and shebang lines
- [ ] `agentkit sync` regenerates agent docs reflecting new focus areas

---

## Related

- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
- Depends-on: #002
