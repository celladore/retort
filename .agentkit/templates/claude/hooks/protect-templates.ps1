# ---------------------------------------------------------------------------
# Hook: PreToolUse (matcher: Write|Edit)
# Purpose: Block AI writes to Retort source files (templates, spec,
#          engines, overlays) in DOWNSTREAM repos. In the agentkit-forge source
#          repo itself, agents ARE the maintainers and need full access.
# Stdin:   JSON with session_id, cwd, hook_event_name, tool_name, tool_input
# Stdout:  JSON deny response on match, empty otherwise
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$rawInput = $input | Out-String
$payload  = $rawInput | ConvertFrom-Json

# Null-safe property access for strict PowerShell modes
$filePath = if ($payload.PSObject.Properties['tool_input'] -and $payload.tool_input.PSObject.Properties['file_path']) {
    $payload.tool_input.file_path
} else {
    $null
}

if (-not $filePath) {
    exit 0
}

# -- Source repo detection -----------------------------------------------------
# If we are in the agentkit-forge source repo, agents are maintaining the
# templates and engine — protection is not needed.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$agentkitPkg = Join-Path $scriptDir '..\..\.agentkit\package.json'
if (Test-Path $agentkitPkg) {
    try {
        $pkg = Get-Content $agentkitPkg -Raw | ConvertFrom-Json
        if ($pkg.name -eq 'agentkit-forge-runtime') {
            # This IS the agentkit-forge source repo — agents maintain these files.
            exit 0
        }
    } catch {
        # Ignore parse errors, proceed with protection
    }
}

# -- Protected directory patterns ---------------------------------------------
# In downstream repos, these are the upstream source-of-truth paths.
$protectedPatterns = @(
    '\.agentkit[\\/]templates[\\/]'
    '\.agentkit[\\/]spec[\\/]'
    '\.agentkit[\\/]engines[\\/]'
    '\.agentkit[\\/]overlays[\\/]'
    '\.agentkit[\\/]bin[\\/]'
)

foreach ($pattern in $protectedPatterns) {
    if ($filePath -match $pattern) {
        $reason = "Blocked: '$filePath' is an Retort source file. These files are the upstream source-of-truth and must not be modified directly by AI agents. To propose changes, create a PR to the agentkit-forge repository targeting the relevant spec or template. If you need to change project configuration, edit the YAML specs in .agentkit/spec/ and run 'pnpm -C .agentkit retort:sync'."
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
