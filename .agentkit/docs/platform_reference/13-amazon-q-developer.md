# Amazon Q Developer

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | AI Coding Assistant (IDE extension + CLI) |
| **Categories** | IDE Extension |
| **Access** | VS Code / JetBrains extension, AWS Console, or CLI — requires AWS account (free tier available) |
| **Documentation** | [docs.aws.amazon.com/amazonq](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html) |
| **Performance Rating** | ⭐⭐⭐½ — **70/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions)) |

---

## Platform Overview

Amazon Q Developer is AWS's AI coding assistant available in VS Code, JetBrains,
the AWS Console, and as a CLI tool. It provides code generation, transformation,
debugging, and security scanning with native support for `AGENTS.md`.

Amazon Q Developer supports project-level customization through `.amazonq/`
configuration and reads `AGENTS.md` for universal context.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Project config | `.amazonq/config.yaml` | YAML |
| Custom prompts | `.amazonq/prompts/*.md` | Markdown |
| Transform config | `.amazonq/transform.yaml` | YAML (for code transformation) |

### Key Capabilities

- **AGENTS.md native**: Reads for project context and coding standards.
- **Code transformation**: Automated language/framework migrations (e.g.,
  Java 8 → 17, .NET Framework → .NET 6+).
- **Security scanning**: Built-in vulnerability detection and remediation.
- **AWS integration**: Deep integration with AWS services, CDK, CloudFormation.
- **Multi-IDE support**: VS Code, JetBrains, AWS Console, CLI.
- **Agent capabilities**: `/dev` for autonomous multi-file development tasks.
- **Code review**: Automated PR review with security focus.
- **/transform command**: Automated code modernization.

### Directory Structure Example

```
.amazonq/
  config.yaml
  prompts/
    review.md
    security-check.md
  transform.yaml
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

Amazon Q reads the universal `AGENTS.md`. No platform-specific files are
currently generated.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| .amazonq/config.yaml | ✅ Project configuration | ❌ Not generated | Could generate project config |
| Custom prompts | ✅ `.amazonq/prompts/` | ❌ Not generated | Could generate prompt files |
| Transform config | ✅ Code transformation | ❌ Not generated | Could generate for migration projects |
| Security scanning config | ✅ Built-in | ❌ Not configured | Could generate security scan rules |
| AWS-specific context | ✅ CDK/CloudFormation awareness | ⚠️ In AGENTS.md if AWS stack | Ensure AWS context in AGENTS.md |

**Summary:** Amazon Q is served by `AGENTS.md`. Significant gaps exist in
generating `.amazonq/` configuration for project-specific settings, custom
prompts, and code transformation configs. Adding a `amazonq` render target
would enable richer integration.

---

## Recommendations

- Consider adding an `amazonq` render target for dedicated file generation.
- Generate `.amazonq/config.yaml` with project-specific settings.
- For AWS-heavy projects, ensure AGENTS.md includes CDK/CloudFormation context.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 70/100 ⭐⭐⭐½ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions) |
| Developer Experience | 73/100 ⭐⭐⭐½ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--ide-extensions) |
| Cost & Value | 79/100 ⭐⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--ide-extensions) |
| Customization | 56/100 ⭐⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--ide-extensions) |
| Privacy & Security | 79/100 ⭐⭐⭐⭐ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--ide-extensions) |
| Team & Enterprise | 86/100 ⭐⭐⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--ide-extensions) |
| **Weighted Total** | **74/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **AWS-heavy teams** — deepest AWS service integration (CDK, CloudFormation, Lambda)
- **Security-conscious enterprises** — FedRAMP, SOC 2, ISO 27001, HIPAA compliant
- **Code modernization** — `/transform` automates language/framework migrations
- **Enterprise governance** — IAM policies, CloudTrail audit, AWS Organizations

### Not Ideal For

- **Non-AWS projects** — AWS integration advantages are less relevant
- **Teams wanting model choice** — locked to Amazon's model offerings
- **Deep customization** — fewer instruction file options than Claude Code or Copilot

---

## References

- [Amazon Q Developer documentation](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html)
- [Amazon Q Developer CLI](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line.html)
- [Amazon Q Developer — Code transformation](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/code-transformation.html)
- [Amazon Q Developer customizations](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/customizations.html)
