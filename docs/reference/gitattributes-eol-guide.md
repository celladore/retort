# EOL Normalization for Retort Adopter Repos

> **Issue**: [#420](https://github.com/phoenixvc/retort/issues/420) — Windows: LF/CRLF
> churn on generated files.

After running `retort:sync`, Git on Windows warns that many generated files will be
converted from LF to CRLF in the working copy. This causes noisy diffs, unnecessary
changed-file counts in `git status`, and potential merge conflicts between Windows and
Linux/macOS contributors.

## Root Cause

Retort's sync engine always writes files with LF line endings. Without a `.gitattributes`
in the adopter repo, Git on Windows applies `core.autocrlf` globally — converting LF to
CRLF on checkout. Every sync run then looks like it changed every file.

## Fix: Add a `.gitattributes` to Your Repo

Copy the block below into a `.gitattributes` file at your repo root. If you already have
one, merge the relevant sections.

```gitattributes
# Default: normalize all text to LF in the repository
* text=auto eol=lf

# Generated AI-tool output directories — always LF, never CRLF
# Retort sync writes these with LF; enforcing eol=lf here prevents
# Git on Windows from converting them on checkout.
.claude/**              text eol=lf
.cursor/**              text eol=lf
.clinerules/**          text eol=lf
.roo/**                 text eol=lf
.windsurf/**            text eol=lf
.github/instructions/** text eol=lf
.github/agents/**       text eol=lf
.github/chatmodes/**    text eol=lf
.github/prompts/**      text eol=lf

# Shell scripts — always LF
*.sh text eol=lf

# PowerShell — LF works on all platforms; avoids sync drift between
# Windows (CRLF) and Linux CI (LF)
*.ps1 text eol=lf

# Windows batch scripts require CRLF
*.cmd text eol=crlf
*.bat text eol=crlf

# Binary files — no EOL conversion
*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.woff binary
*.woff2 binary
*.ttf binary
*.eot binary
```

## After Adding `.gitattributes`

Re-normalize existing files so the new rules take effect on all currently tracked files:

```bash
# Stage the new .gitattributes
git add .gitattributes

# Re-normalize all tracked files (runs EOL conversion in-place)
git rm --cached -r .
git reset --hard

# Verify — git status should be clean
git status
```

> **Note**: The `git rm --cached -r . && git reset --hard` pair re-checks out all
> files under the new attributes. It does not delete your working copy.

## Verifying the Fix

After applying the `.gitattributes` and running `retort:sync`, `git status` should
show only the files that actually changed content. No more LF→CRLF warnings.

```bash
pnpm --dir .agentkit retort:sync
git status   # should show only real content changes
```

## When to Use `core.autocrlf` vs `.gitattributes`

| Setting | Scope | Recommended for |
|---------|-------|-----------------|
| `core.autocrlf = true` | Per-developer | Windows-only teams not using `.gitattributes` |
| `core.autocrlf = input` | Per-developer | Prevent CRLF commit on checkout |
| `.gitattributes eol=lf` | Per-repo | **Recommended** — enforces LF for everyone regardless of local config |

`.gitattributes` wins over `core.autocrlf` when both are set. Always prefer
`.gitattributes` in shared repos so behavior is consistent across all platforms and CI.
