---
title: 2026-09-02 Coordinate SDK and CLI Publishing
---

# Coordinate SDK and CLI Publishing

Date: 2026-09-02
Author: AI Assistant
AI Agent: Codex

## Prompts & Instructions

**Original Request:**
> Fix the failed SDK and CLI npm publication and use the successful coordinated package release pattern.

**Refined Instructions:**
- Validate both packages before publishing either one.
- Publish the SDK before the CLI from one idempotent workflow.
- Ensure the published CLI depends on the matching SDK version without a workspace protocol.

## What Changed
- Repaired the workspace lockfile for the current Vitest manifest.
- Coordinated SDK and CLI validation, packing, publication, and GitHub releases in one job.
- Changed the local CLI dependency to `workspace:^` so pnpm publishes `sandock@^2.4.0`.
- Removed the unused composite npm publication action.

## Why

The previous release flow installed and published the packages independently, then waited for the SDK
and rewrote the CLI manifest during CI. A stale lockfile stopped the SDK job before either package could
be released.

## Files Affected
- `.github/workflows/publish-sandock-js-sdk-cli.yml` - Coordinated release workflow.
- `packages/sandock-cli/package.json` - Publish-safe workspace dependency range.
- `pnpm-lock.yaml` - Workspace dependency and Vitest lock state.
- `.github/actions/publish-npm-package/action.yml` - Removed obsolete action.

## Breaking Changes

None.

## Testing
- Frozen-lockfile installation.
- SDK tests and build.
- CLI build and `--help` smoke test.
- Packed CLI manifest inspection.
