# IDE Settings Sync Reference

> Last updated: 2026-03-19 | Status: documentation

## Overview

Cross-IDE settings sync strategy for the phoenixvc workspace. Baseline editor: **Zed**.

## Supported Editors

| Editor      | Config Location                         | Status        | Notes                  |
| ----------- | --------------------------------------- | ------------- | ---------------------- |
| Zed         | `%APPDATA%/Zed/settings.json`           | **baseline**  | Most refined settings  |
| VS Code     | `%APPDATA%/Code/User/settings.json`     | parity needed |                        |
| Cursor      | `%APPDATA%/Cursor/User/settings.json`   | parity needed | Fork of VS Code        |
| Windsurf    | `%APPDATA%/Windsurf/User/settings.json` | parity needed | Fork of VS Code        |
| Antigravity | —                                       | pending setup |                        |
| Trae        | —                                       | pending setup |                        |
| Qoder       | —                                       | pending setup |                        |
| Nimbalyst   | —                                       | pending setup |                        |
| Rider       | —                                       | pending setup | JetBrains .NET IDE     |
| PyCharm     | —                                       | pending setup | Partner's IDE (Python) |

## Zed Baseline Settings

Located: `C:\Users\smitj\AppData\Roaming\Zed\settings.json`

### Key Conventions

| Setting                 | Zed Value         | Target Parity |
| ----------------------- | ----------------- | ------------- |
| Terminal shell          | Git bash          | All editors   |
| Whitespace rendering    | `"boundary"`      | All editors   |
| Tab size (C#)           | 4                 | All editors   |
| Tab size (Python)       | 4                 | All editors   |
| Tab size (Rust)         | 4                 | All editors   |
| Tab size (TS/JSON/YAML) | 2                 | All editors   |
| Theme                   | Ayu Light/Dark    | Align others  |
| Format on save          | `on`              | All editors   |
| Auto save               | `on_focus_change` | Align         |

### Language-Specific Overrides

```json
{
  "languages": {
    "CSharp": { "tab_size": 4, "hard_tabs": false },
    "Python": { "tab_size": 4, "format_on_save": "on" },
    "Rust": { "tab_size": 4, "hard_tabs": false },
    "TypeScript": { "tab_size": 2 },
    "TSX": { "tab_size": 2 },
    "JSON": { "tab_size": 2 },
    "YAML": { "tab_size": 2 }
  }
}
```

## Current Gaps

### VS Code

- Terminal defaults to PowerShell (not Git bash)
- Whitespace rendering: `"none"` (vs `"boundary"`)
- No language-specific tab size overrides

### Cursor

- Similar gaps to VS Code
- Has unique: `cursor.windowSwitcher.sidebarHoverCollapsed`

### Windsurf

- Similar gaps to VS Code
- Has unique: `editor.tabCompletion: "on"`

## Task

Mark org-meta roadmap item `org-meta-foundation` > `Cross-IDE settings sync` as done when:

- [x] Document baseline (Zed)
- [x] Align VS Code settings
- [x] Align Cursor settings
- [x] Align Windsurf settings
- [ ] Document Antigravity, Trae, Qoder, Nimbalyst configs (once installed)
- [ ] Document Rider, PyCharm configs (once partner sets up)

## Changes Applied (2026-03-19)

### VS Code

- `files.autoSave`: `afterDelay` → `onFocusChange`
- `editor.renderWhitespace`: `none` → `boundary`
- `terminal.integrated.defaultProfile.windows`: `PowerShell` → `Git Bash`
- Added language overrides: C# (4), Python (4), Rust (4), TS/JSON/YAML (2)

### Cursor

- `files.autoSave`: `afterDelay` → `onFocusChange`
- `editor.renderWhitespace`: `none` → `boundary`
- Added language overrides: C# (4), Python (4), Rust (4), TS/JSON/YAML (2)

### Windsurf

- `files.autoSave`: `afterDelay` → `onFocusChange`
- `editor.renderWhitespace`: `none` → `boundary`
- Added language overrides: C# (4), Python (4), Rust (4), TS/JSON/YAML (2)

## Related

- User profile: `mystira-workspace/.agents/users/smitj.yaml`
- Original task: org-meta `.roadmap.yaml` > `org-meta-foundation`
