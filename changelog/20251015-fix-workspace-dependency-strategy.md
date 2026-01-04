---
title: 2025-10-15 Fix Workspace Dependency Strategy for npm Publishing
---

# Fix Workspace Dependency Strategy for npm Publishing

Date: 2025-10-15
Author: AI Assistant

## What Changed
- Changed `sandock-cli` dependency from `workspace:*` to `^0.2.0` (real npm version)
- Modified CI workflow to wait for SDK availability on npm before installing CLI dependencies
- **Added automatic dependency version update**: CLI's `package.json` now auto-updates to match published SDK version
- Removed local SDK build step from CLI publish job
- Added retry logic with timeout for npm registry propagation

## Why
The `workspace:*` dependency doesn't work when published to npm:
- Users running `npx sandock-cli` would get "Cannot find module 'sandock'" error
- Even with tsup bundling, `npm install` would still try to resolve `workspace:*`
- The workspace protocol is only for local monorepo development, not for npm distribution

**The Problem:**
```json
// ❌ This fails when published to npm
"dependencies": {
  "sandock": "workspace:*"
}
```

**The Solution:**
```json
// ✅ Use real npm version range
"dependencies": {
  "sandock": "^0.2.0"
}
```

## Files Affected
- `packages/sandock-cli/package.json` - Changed sandock dependency from `workspace:*` to `^0.2.0`
- `.github/workflows/publish-sandock-js-sdk-cli.yml` - Updated CLI publish flow:
  - Added "Wait for SDK to be available on npm" step with retry logic
  - **Added "Update CLI dependency to latest SDK version" step** - automatically syncs version
  - Changed install command to `pnpm install --no-frozen-lockfile` to fetch from npm
  - Removed local SDK build step (no longer needed)

## Breaking Changes
None for end users. This is an internal build process improvement.

**Development workflow:**
- Local development still works (pnpm workspace resolution)
- CI/CD now properly uses npm registry for dependencies
- Users of published packages get correct dependency resolution

## CI/CD Flow

**Before (broken):**
```yaml
1. Publish SDK to npm
2. Checkout code (has workspace:* in CLI)
3. pnpm install (tries workspace, might use stale local version)
4. Build SDK locally
5. Build CLI (references local SDK)
6. Publish CLI (with workspace:* ❌)
```

**After (correct):**
```yaml
1. Publish SDK to npm (e.g., 0.2.1 → 0.2.2) ✅
2. Checkout code
3. Wait for SDK on npm (retry loop, max 5 min)
4. Update CLI package.json: "sandock": "^0.2.2" ✅
5. pnpm install --no-frozen-lockfile (gets SDK@0.2.2 from npm)
6. Build CLI (references npm SDK@0.2.2)
7. Publish CLI (with ^0.2.2 ✅)
```

## Testing

**Manual verification:**
1. ✅ Check package.json has real version: `"sandock": "^0.2.0"`
2. ✅ Workflow waits for SDK availability before proceeding
3. ✅ Install fetches from npm registry, not workspace

**After deployment:**
1. Trigger workflow to publish both packages
2. Verify SDK publishes successfully
3. Check that CLI job waits for SDK on npm (logs should show retry attempts)
4. Verify CLI installs SDK from npm (check pnpm output)
5. Test published CLI: `npx sandock-cli@latest --version`
6. Verify `node_modules/sandock` exists after install

**End-user test:**
```bash
# Should work without errors
npx sandock-cli config --show
npx sandock sandbox list
```

## Implementation Details

**Version sync logic:**
```bash
# Get SDK version from packages/sandock-js/package.json
SDK_VERSION=$(node -p "require('./packages/sandock-js/package.json').version")

# Update CLI's dependency
npm pkg set dependencies.sandock="^$SDK_VERSION"
```

This ensures CLI always depends on the **exact version** that was just published, not a stale version.

**Wait logic:**
- Tries up to 30 times (5 minutes total)
- 10 second delay between attempts
- Uses `npm view sandock@$VERSION` to check availability
- Fails loudly if timeout exceeded

**Why the wait?**
- npm registry can take 30-60 seconds to propagate after publish
- Without waiting, CLI install would fail with "package not found"
- Retry loop ensures eventual consistency

## Alternatives Considered

❌ **tsup bundling**: Would work but oclif needs dynamic command loading
❌ **Version replacement script**: Too complex, error-prone
✅ **Real npm versions + wait logic**: Simple, reliable, standard practice

## Follow-up Tasks
None - this is the correct long-term solution for npm package dependencies.

## Notes
This is how most npm CLIs handle dependencies (e.g., `@vercel/cli` depends on specific versions of other `@vercel/*` packages). The key insight: **workspace protocol is for development only, published packages must use real version ranges**.
