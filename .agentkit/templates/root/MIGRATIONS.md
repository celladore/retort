# Migration Guide — {{repoName}}

> How to upgrade between Retort versions and handle breaking changes.

---

## Table of Contents

1. [Upgrade Process](#upgrade-process)
2. [Version History](#version-history)
3. [Breaking Changes](#breaking-changes)

---

## Upgrade Process

### Standard Upgrade

1. Pull the latest Retort changes
2. Review the changelog for breaking changes
3. Run `retort sync` to regenerate all configs
4. Run `retort validate` to verify integrity
5. Review `git diff` for unexpected changes
6. Commit the updated generated files

### Overlay Migration

When upgrading introduces new spec fields:

1. Compare your overlay files against `.agentkit/overlays/__TEMPLATE__/`
2. Add any new required fields to your overlay
3. Run `retort sync` and verify output

---

## Version History

### v0.1.0 (Initial)

- Initial release of Retort
- Spec-driven config generation for 6 AI tools
- 10-team framework with 5-phase lifecycle
- Hook-based security guardrails
- Overlay system for per-repo customization

---

## Breaking Changes

### v0.1.0

No breaking changes — this is the initial release.

---

_This guide is maintained by Retort. Run `pnpm -C .agentkit retort:sync` to regenerate._
