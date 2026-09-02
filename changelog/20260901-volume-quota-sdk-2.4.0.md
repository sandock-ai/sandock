---
title: 2026-09-01 Volume Quota SDK 2.4.0
---

# Volume Quota SDK 2.4.0

Date: 2026-09-01
Author: AI Assistant
AI Agent: Codex

## Prompts & Instructions

**Original Request:**
> Increase the Enterprise volume limit to 50 GiB, expose the new volume quota APIs in `projects/sandock/packages`, and bump the package version to 2.4.0.

**Refined Instructions:**
- Change the Enterprise fallback quota from 10 GiB to 50 GiB.
- Add quota policy, quota update, and create-time quota support to the public TypeScript SDK.
- Keep `sandock` and `sandock-cli` on their shared 2.4.0 release line.
- Preserve the independent `sandock-mcp` 0.x version line.

## What Changed
- Added `quotaBytes` to `VolumeInfo` and volume creation options.
- Added `client.volume.getQuotaPolicy()` and `client.volume.setQuota()`.
- Added request-level tests for explicit quota, default reset, and quota policy lookup.
- Updated SDK documentation and release notes.
- Bumped `sandock` and `sandock-cli` to 2.4.0.

## Why
- Enterprise users need a practical default capacity for large persistent workloads.
- SDK users need typed access to the same quota operations available in the Dashboard and REST API.

## Files Affected
- `apps/sandock-cloud/src/domains/volume/logic/volume-quota-policy.ts`
- `projects/sandock/packages/sandock-js/src/client.ts`
- `projects/sandock/packages/sandock-js/src/volume.test.ts`
- `projects/sandock/packages/sandock-js/package.json`
- `projects/sandock/packages/sandock-cli/package.json`

## Breaking Changes
None. New SDK fields and methods are additive.

## Testing
- Run the Sandock Cloud quota policy tests and scoped typecheck.
- Run the Sandock JS SDK tests and build all public Sandock packages.
- Run repository lint and patch checks.
