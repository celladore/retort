# Handoff: Phased Telemetry (GH#374)

**Date:** 2026-03-26
**Issue:** [GH#374](https://github.com/phoenixvc/retort/issues/374)
**Prepared for:** Agent designing and implementing the telemetry pipeline
**Branch:** `feat/telemetry-phase1` from `dev`

---

## Why This Matters

Retort has no visibility into how it is actually used. We don't know:
- Which adopter repos are running sync
- Which platforms (claude/cursor/copilot/etc.) are being generated
- Which commands are used most vs never
- Whether generated agent persona files are being read by agents at all
- How many agents a typical adopter spec defines

Without this, product decisions (which features to invest in, which templates are broken in the wild) are guesswork.

---

## Phased Approach

### Phase 1 — Local log files (this session)

No network calls. No consent friction. No privacy exposure.

Emit a structured JSONL log to `.claude/state/telemetry/` on every sync run:

```jsonl
{"event":"sync","ts":"2026-03-26T14:00:00Z","version":"3.1.0","repoHash":"sha256(repoName)","platforms":["claude","cursor"],"agentCount":39,"commandCount":47,"durationMs":4200}
{"event":"command","ts":"...","command":"check","durationMs":1200,"exitCode":0}
```

- `repoHash` — one-way hash of the repo name (never the actual name; preserves privacy, still allows per-repo trend analysis)
- All fields are aggregate counts, never file content or code

This gives local analytics immediately (the `/cost` command already reads similar JSONL logs from `cost-tracker.mjs` — use the same reader pattern).

### Phase 2 — Opt-in endpoint (future session)

Add a `telemetry.endpoint` field to `settings.yaml`. When set, Phase 1 logs are also shipped to that endpoint (HTTPS POST, batched, retry on failure). Default: `null` (off).

Phase 2 is **out of scope for this session**.

---

## What Already Exists

`cost-tracker.mjs` (613 lines) already does local JSONL logging for session cost/usage. Read it first — the telemetry system should reuse its:
- `appendFileSync` log-append pattern
- JSONL rotation logic (it caps log file size and rotates)
- Reader pattern used by the `/cost` command to display summaries

The new `telemetry-tracker.mjs` should either extend `cost-tracker.mjs` or import shared helpers from it (do not duplicate the rotation logic).

---

## New File: `telemetry-tracker.mjs`

```
.agentkit/engines/node/src/telemetry-tracker.mjs
```

Exports:
- `emitSyncEvent(agentkitRoot, payload)` — appends a sync event to the log
- `emitCommandEvent(agentkitRoot, payload)` — appends a command event
- `readTelemetryLog(agentkitRoot, days)` — reads recent events for display
- `summariseTelemetry(events)` — aggregates for the `/cost`-style display

### Integration points

| Where | Change |
|---|---|
| `synchronize.mjs` `runSync()` | Call `emitSyncEvent()` at end of successful sync with platform list, agent count, duration |
| `cli.mjs` command dispatch | Call `emitCommandEvent()` after each command completes (name, duration, exit code) |
| `cost-tracker.mjs` or new `/telemetry` command | Read and display log summary |

---

## Privacy Requirements

- **Never log** repo name, file paths, agent names, rule content, or any user-authored text
- `repoHash` = `sha256(repoName).slice(0, 16)` — unlinkable to the actual repo without the original name
- Log files live in `.claude/state/telemetry/` which is git-ignored (`.claude/` is in `.gitignore`)
- Add a `telemetry.enabled` field to `settings.yaml` (default `true` for Phase 1 local logs, since there's no data leaving the machine)

---

## Settings Schema Addition

```yaml
telemetry:
  enabled: true           # false = no logging at all
  retentionDays: 30       # how long to keep local log files
  endpoint: null          # Phase 2 — URL to POST events to (null = local only)
```

---

## Verification

```bash
# Run sync, then check log exists and is valid JSONL
pnpm -C .agentkit retort:sync
cat .claude/state/telemetry/sync-events.jsonl | head -5

# Verify no plaintext repo name or file paths in log
cat .claude/state/telemetry/sync-events.jsonl | grep -v "sha\|event\|ts\|version\|count\|duration\|platform\|exit"
# Should return nothing (every field should be one of the allowed keys)

# Run test suite
pnpm -C .agentkit test
```

Add a test file: `__tests__/telemetry-tracker.test.mjs` covering:
- Event is appended on sync
- Sensitive fields (repo name) are not present in log output
- Retention policy removes old files
- `summariseTelemetry` aggregates correctly

---

## Constraints

- Phase 1 only — no network calls in this session
- Must not add measurable overhead to sync (log append is O(1), acceptable)
- Log rotation must prevent unbounded disk growth
- PR target: `dev` · Commit: `feat(telemetry): add local JSONL sync event logging (phase 1)`
