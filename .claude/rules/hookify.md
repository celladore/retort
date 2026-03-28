# Hookify Rule Syntax

Rules for writing correct hookify guard files in `.claude/hookify.*.local.md`.

## The `event: file` Pattern Bug

The simple `pattern:` shorthand behaves differently depending on event type:

| Event  | `pattern:` matches                                    |
| ------ | ----------------------------------------------------- |
| `bash` | The shell command string — correct and intuitive      |
| `file` | The **file content** (`new_text`) — NOT the file path |

This means path-based file guards written with the shorthand silently misbehave:

- The rule fires on any file whose **content** contains the pattern
- The rule does NOT fire based on the destination file path

### Broken (path guard with shorthand)

```yaml
---
event: file
action: block
pattern: \.github/workflows/
---
```

This blocks any file edit whose **content** mentions `.github/workflows/`, not edits
to workflow files themselves. It will cause false positives on docs, rules files, and
any file that references the path.

### Correct (explicit conditions)

```yaml
---
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: "\.github/workflows/"
---
```

## Rules

- **Always** use `conditions: [{field: file_path, ...}]` for path-based `event: file` guards
- The simple `pattern:` shorthand is acceptable for `event: bash` rules only
- For content-based file guards, use `conditions: [{field: new_text, ...}]` explicitly
- Never mix intent (path vs content) into a single ambiguous `pattern:` field on file events

## Correct Hookify Rule Examples

### Block writes to protected directories (path-based)

```yaml
---
name: block-workflow-edits
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: "\.github/workflows/"
---
Review workflow changes carefully — they affect CI/CD for all branches.
```

### Warn on secrets in file content (content-based)

```yaml
---
name: warn-secrets-in-content
enabled: true
event: file
action: block
conditions:
  - field: new_text
    operator: regex_match
    pattern: "(ApiKey|Secret|Password|Bearer)\\s*[=:]\\s*[\"'][^\"']{8,}"
---
Potential hardcoded secret detected. Use environment variables or a secret manager instead.
```

### Bash guard (shorthand is fine)

```yaml
---
name: block-force-push
enabled: true
event: bash
action: block
pattern: "git\\s+push\\s+.*--force"
---
Force push is blocked. Use --force-with-lease if absolutely necessary.
```
