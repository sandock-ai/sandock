---
title: 2025-11-04 Add Delete Sandbox Command
---

# Add Delete Sandbox Command

Date: 2025-11-04
Author: AI Assistant (Copilot)
Version: 0.2.5

## What Changed
- Added new `delete` command to `sandock-cli` for deleting sandboxes
- Command supports confirmation prompt for safety
- Added `--force` flag to skip confirmation when needed
- Uses the DELETE `/api/sandbox/{id}` endpoint

## Why
Per maintainer request to add sandbox deletion functionality to the CLI. This allows users to programmatically delete sandboxes through the command line interface.

## Files Affected
- `packages/sandock-cli/src/commands/sandbox/delete.ts` - New delete command implementation

## Usage Examples
```bash
# Delete with confirmation prompt
sandock sandbox delete sb_12345

# Delete without confirmation (force)
sandock sandbox delete sb_12345 --force
sandock sandbox delete sb_12345 -f
```

## Features
- **Confirmation prompt**: By default, asks user to confirm deletion
- **Force flag**: Use `--force` or `-f` to skip confirmation
- **Clear feedback**: Uses spinner and colored output for better UX
- **Error handling**: Proper error messages and status reporting

## Testing
- ✅ TypeScript compilation passes
- ✅ Command is available in CLI
- ✅ Follows same pattern as other sandbox commands (create, list, exec, info)

## Breaking Changes
None - this is a new feature addition.

## Follow-up Tasks
None - feature is complete.
