---
title: 2026-02-04 Fix Multiple Volumes SDK Issue
---

# Fix Multiple Volumes SDK Issue

Date: 2026-02-04
Author: AI Assistant

## What Changed
- Fixed SDK client field name mapping: `cpu` → `cpuShares`, `memory` → `memoryLimitMb`
- Updated generated OpenAPI schema to include missing fields:
  - `spaceId` - Target space/workspace ID
  - `persistenceEnabled` - Enable persistent storage
  - `activeDeadlineSeconds` - Maximum runtime for sandbox (K8s only)
  - `command` - Override default container command
  - `volumes` - Volume mounts for persistent storage
- Improved request body construction in `sandbox.create()` to only include provided fields

## Why
The SDK client was:
1. Sending `cpu` and `memory` field names but the server expects `cpuShares` and `memoryLimitMb`
2. Missing volume mounting fields in the generated OpenAPI schema, which could cause issues with openapi-fetch type checking
3. Including undefined fields in the request body when they weren't provided

## Files Affected
- `projects/sandock/packages/sandock-js/src/client.ts` - Fixed field mapping and request body construction
- `projects/sandock/packages/sandock-js/src/schema.ts` - Added missing fields to CreateSandboxRequest schema

## Breaking Changes
None - API contract unchanged, only internal field mapping fixed

## Testing
- TypeScript compilation passes
- Unit tests pass
- Request body construction verified manually

## Follow-up Tasks
- Consider regenerating schema.ts from server OpenAPI spec to keep it in sync
- Add unit tests for volume mounting in SDK
