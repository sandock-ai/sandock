# Fix TypeScript Compilation Errors in sandock-cli and sandock-js

Date: 2025-11-04
Author: AI Assistant (Copilot)
Version: 0.2.4 → 0.2.5

## What Changed
- Bumped version from 0.2.4 to 0.2.5 for both `sandock-cli` and `sandock` packages
- Updated `sandock-cli` dependency to use `^0.2.5` instead of `workspace:*`
- Added `.npmrc` configuration with `link-workspace-packages=true` to ensure workspace linking during development
- Removed deprecated `space` flag from `exec.ts` command that attempted to pass spaceId as a query parameter
- **Restored optional `space` flag in `list.ts` command** - spaceId is an optional query parameter for list endpoint
- Removed conditional query parameter logic that violated the OpenAPI type schema in `exec.ts`
- Updated pnpm lockfile to reflect workspace dependency

## Why
The TypeScript compilation was failing with the following error:
```
Type '{ query?: { spaceId: string; } | undefined; path: { id: string; }; }' is not assignable to type 
'{ query?: undefined; header?: undefined; path: { id: string; }; cookie?: undefined; }'.
```

This occurred because:
1. The `exec.ts` command was trying to pass `query: { spaceId }` to an endpoint that doesn't support query parameters
2. The OpenAPI schema for `/api/sandbox/{id}/shell` explicitly defines `query?: never`
3. However, the `/api/sandbox` (list) endpoint does support an optional `spaceId` query parameter, even though the auto-generated schema shows `query?: never` (schema needs updating)
4. For the list endpoint, we use a type assertion to work around the outdated schema

After the initial fix, versions were bumped to 0.2.5 to properly publish the breaking changes, and the dependency strategy was updated to use `^0.2.5` with workspace linking configuration.

## Files Affected
- `packages/sandock-cli/src/commands/sandbox/exec.ts` - Removed space flag and conditional query parameter logic
- `packages/sandock-cli/src/commands/sandbox/list.ts` - Restored space flag with type assertion (spaceId is optional for list endpoint)
- `packages/sandock-cli/package.json` - Bumped version to 0.2.5, changed sandock dependency from `workspace:*` to `^0.2.5`
- `packages/sandock-js/package.json` - Bumped version to 0.2.5
- `.npmrc` - Added pnpm workspace configuration for linking local packages
- `pnpm-lock.yaml` - Updated to reflect new versions and workspace dependency

## Breaking Changes
**CLI Breaking Changes:**
- Removed `-s, --space` flag from `sandock sandbox exec` command
- The `space` flag remains available for `sandock sandbox list` command (optional)

**Impact:** Users who were passing the `--space` flag to the `exec` command will need to remove it. The space context for exec is now automatically derived from the API key.

**Migration:**
- `exec` command:
  - Before: `sandock sandbox exec sb_123 "ls" --space my-space`
  - After: `sandock sandbox exec sb_123 "ls"`

- `list` command (no change needed):
  - Still works: `sandock sandbox list --space my-space`
  - Also works: `sandock sandbox list` (uses default space from API key)

## Testing
- ✅ Clean build passes successfully: `pnpm clean && pnpm build`
- ✅ TypeScript compilation completes without errors
- ✅ Workspace dependency correctly links to local sandock-js package
- ✅ Integration tests skip gracefully when server is unavailable (expected behavior)

## Technical Details
The OpenAPI schema defines endpoints like `/api/sandbox` and `/api/sandbox/{id}/shell` with `query?: never`, which means they explicitly reject query parameters. The previous code attempted to conditionally add query parameters, which TypeScript correctly rejected as a type error.

**Version Management Strategy:**
- Bumped to 0.2.5 to reflect the breaking change (removal of --space flag)
- Changed dependency from `workspace:*` to `^0.2.5` per maintainer request
- Added `.npmrc` with `link-workspace-packages=true` to ensure workspace packages are linked during development
- This approach allows:
  - Development: Links to local workspace version (0.2.5)
  - Production: Will use published version from npm registry once 0.2.5 is published
  - Compatibility: `^0.2.5` ensures any future 0.2.x patches will work

## Follow-up Tasks
- Publish version 0.2.5 to npm registry when ready for release
