#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# Hook: PreToolUse (matcher: Write|Edit)
# Purpose: Block writes to sensitive files such as .env, secrets, keys, etc.
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

$filePath = ""
if ($data -and $data.PSObject.Properties['tool_input']) {
    $ti = $data.tool_input
    if ($ti.PSObject.Properties['file_path']) {
        $filePath = $ti.file_path
    }
}

# If there is no file path we cannot evaluate -- allow by default.
if ([string]::IsNullOrWhiteSpace($filePath)) {
    exit 0
}

# -- Sensitive file patterns -----------------------------------------------
$denyPatterns = @(
    '\.env$',
    '\.env\.',
    '\.tfvars$',
    'secrets',
    'credential',
    'private_key',
    'id_rsa',
    '\.pem$'
)

foreach ($pattern in $denyPatterns) {
    if ($filePath -match $pattern) {
        $reason = "Blocked: file path '$filePath' matches sensitive pattern '$pattern'."

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
