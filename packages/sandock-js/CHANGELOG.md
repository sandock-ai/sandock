---
title: 2026-03-19 Bump version to 2.3.0 - Add activeDeadlineSeconds to create sandbox
---

# Bump version to 2.3.0 - Add activeDeadlineSeconds to create sandbox

Date: 2026-03-19
Author: AI Assistant
AI Agent: GitHub Copilot

## What Changed
- Bumped sandock-js (`sandock`) version from 2.2.5 to 2.3.0
- Bumped sandock-cli version from 2.2.5 to 2.3.0 (keeps in sync)
- `SandboxCreateOptions.activeDeadlineSeconds?: number` parameter added to create sandbox

## Why
Added `activeDeadlineSeconds` optional parameter to `SandboxCreateOptions` for controlling
maximum runtime of sandboxes. Default: 1800s (30 min), Max: 86400s (24 hours). When exceeded,
sandbox status is changed to STOPPED.

## Files Affected
- `projects/sandock/packages/sandock-js/package.json` - Version bump 2.2.5 → 2.3.0
- `projects/sandock/packages/sandock-cli/package.json` - Version bump 2.2.5 → 2.3.0

## Breaking Changes
None - `activeDeadlineSeconds` is an optional parameter

---

---
title: 2026-01-12 Fix Test Suite - Remove Obsolete replayExecutionResult Test
---

# Fix Test Suite - Remove Obsolete replayExecutionResult Test

Date: 2026-01-12
Author: AI Assistant

## What Changed
- Removed obsolete test for `replayExecutionResult` function that no longer exists
- Removed unused `vi` import from vitest
- Test suite now passes successfully (24/24 tests passing)

## Why
The `replayExecutionResult` function was referenced in tests but never existed in the codebase, causing CI test failures:
```
TypeError: (0 , replayExecutionResult) is not a function
```

This function appears to be a leftover from an earlier implementation that was removed when the SDK was refactored to use SSE streaming with callbacks.

## Files Affected
- `projects/sandock/packages/sandock-js/src/index.test.ts` - Removed obsolete test and unused import

## Breaking Changes
None - this only affects internal tests

## Testing
- All 24 remaining tests pass
- CI pipeline should now succeed for sandock-js package
