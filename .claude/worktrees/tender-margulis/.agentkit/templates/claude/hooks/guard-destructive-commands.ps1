#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# Hook: PreToolUse (matcher: Bash)
# Purpose: Block destructive shell commands before they execute.
# Stdin:   JSON with session_id, cwd, hook_event_name, tool_name, tool_input
# Stdout:  JSON deny response on match, empty otherwise
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"

# -- Read JSON payload from stdin ------------------------------------------
try {
    $rawInput = @($input) -join ""
    $data = $rawInput | ConvertFrom-Json
} catch {
    # If we cannot parse stdin, allow by default.
    exit 0
}

$command = ""
if ($data -and $data.PSObject.Properties['tool_input']) {
    $ti = $data.tool_input
    if ($ti.PSObject.Properties['command']) {
        $command = $ti.command
    }
}

# If there is no command we cannot evaluate -- allow by default.
if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
}

# -- Destructive command patterns ------------------------------------------
# Literal substring checks.
$denyFixed = @(
    "rm -rf /",
    "rm -rf ~",
    "git push --force",
    "git push -f ",
    "git reset --hard",
    "terraform destroy",
    "az group delete",
    "gh repo delete"
)

# Case-insensitive regex checks.
$denyRegex = @(
    "DROP\s+TABLE",
    "DROP\s+DATABASE"
)

# Check literal patterns.
foreach ($pattern in $denyFixed) {
    if ($command.Contains($pattern)) {
        $reason = "Blocked: command contains destructive pattern '$pattern'."

        $output = @{
            hookSpecificOutput = @{
                hookEventName           = "PreToolUse"
                permissionDecision       = "deny"
                permissionDecisionReason = $reason
            }
        } | ConvertTo-Json -Depth 5

        Write-Output $output
        exit 0
    }
}

# Check regex patterns.
foreach ($pattern in $denyRegex) {
    if ($command -imatch $pattern) {
        $reason = "Blocked: command contains destructive pattern '$pattern'."

        $output = @{
            hookSpecificOutput = @{
                hookEventName           = "PreToolUse"
                permissionDecision       = "deny"
                permissionDecisionReason = $reason
            }
        } | ConvertTo-Json -Depth 5

        Write-Output $output
        exit 0
    }
}

# No match -- allow the operation (empty stdout, exit 0).
exit 0
