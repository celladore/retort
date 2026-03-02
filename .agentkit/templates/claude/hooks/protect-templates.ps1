# ---------------------------------------------------------------------------
# Hook: PreToolUse (matcher: Write|Edit)
# Purpose: Block AI writes to AgentKit Forge source files (templates, spec,
#          engines, overlays). Changes to these files must go through a PR
#          to the agentkit-forge repository, not be made directly by agents.
# Stdin:   JSON with session_id, cwd, hook_event_name, tool_name, tool_input
# Stdout:  JSON deny response on match, empty otherwise
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$rawInput = $input | Out-String
$payload  = $rawInput | ConvertFrom-Json

$filePath = $payload.tool_input.file_path

if (-not $filePath) {
    exit 0
}

# -- Protected directory patterns ---------------------------------------------
$protectedPatterns = @(
    '\.agentkit[\\/]templates[\\/]'
    '\.agentkit[\\/]spec[\\/]'
    '\.agentkit[\\/]engines[\\/]'
    '\.agentkit[\\/]overlays[\\/]'
    '\.agentkit[\\/]bin[\\/]'
)

foreach ($pattern in $protectedPatterns) {
    if ($filePath -match $pattern) {
        $reason = "Blocked: '$filePath' is an AgentKit Forge source file. These files are the upstream source-of-truth and must not be modified directly by AI agents. To propose changes, create a PR to the agentkit-forge repository targeting the relevant spec or template."
        @{
            hookSpecificOutput = @{
                hookEventName           = 'PreToolUse'
                permissionDecision      = 'deny'
                permissionDecisionReason = $reason
            }
        } | ConvertTo-Json -Depth 3
        exit 0
    }
}

exit 0
