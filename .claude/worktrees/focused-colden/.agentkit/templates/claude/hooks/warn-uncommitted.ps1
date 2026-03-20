#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# Hook: PostToolUse (matcher: Write|Edit)
# Purpose: Warn when the number of uncommitted changes grows too large.
# Stdin:   JSON with session_id, cwd, hook_event_name, tool_name,
#          tool_input, tool_response
# Stdout:  JSON systemMessage warning when threshold is exceeded
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"

$Threshold = 10

# -- Read JSON payload from stdin ------------------------------------------
try {
    $rawInput = @($input) -join ""
    $data = $rawInput | ConvertFrom-Json
} catch {
    $data = $null
}

$cwd = if ($data -and $data.PSObject.Properties['cwd'] -and -not [string]::IsNullOrWhiteSpace($data.cwd)) {
    $data.cwd
} else {
    $PWD.Path
}

# -- Count uncommitted changes --------------------------------------------
# If git is not available or we are outside a repo, silently exit.
try {
    $isGit = & git -C $cwd rev-parse --is-inside-work-tree 2>$null
} catch {
    exit 0
}

if ($isGit -ne "true") {
    exit 0
}

try {
    $statusOutput = & git -C $cwd status --porcelain 2>$null
} catch {
    exit 0
}

if (-not $statusOutput) {
    exit 0
}

$changeCount = @($statusOutput).Count

# -- Emit warning when threshold exceeded ----------------------------------
if ($changeCount -ge $Threshold) {
    $output = @{
        hookSpecificOutput = @{
            systemMessage = "WARNING: There are $changeCount uncommitted changes (threshold: $Threshold). Consider committing your work to avoid losing changes."
        }
    } | ConvertTo-Json -Depth 5

    Write-Output $output
}

exit 0
