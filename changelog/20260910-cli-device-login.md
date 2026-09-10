---
title: 2026-09-10 CLI Device Login
---

# CLI Device Login

Date: 2026-09-10
Author: AI Assistant
AI Agent: Codex

## Prompts & Instructions

**Original Request:**
> Add one-time-code login to the Sandock CLI so a user can authorize creation of an API key.

**Refined Instructions:**
- Use the RFC 8628 device authorization endpoints exposed by Sandock Cloud.
- Require confirmation before replacing an existing local API key.
- Save the new key only after finalization succeeds and never print credentials.
- Cover pending, slowdown, denial, expiry, and network-failure behavior with tests.

## What Changed

- Added `sandock login` with optional `--no-browser` behavior.
- Added an isolated, testable device authorization and API key finalization flow.
- Added CLI tests to the package and public release workflow.
- Coordinated the Sandock SDK and CLI versions at 2.5.0.

## Why

Users can now authenticate the CLI without manually copying a long-lived API key from account
settings, including from SSH or other environments where a browser cannot be launched locally.

## Files Affected

- `packages/sandock-cli/src/commands/login.ts` - Adds the Oclif login command.
- `packages/sandock-cli/src/lib/device-login.ts` - Implements the device authorization flow.
- `packages/sandock-cli/test/device-login.test.ts` - Covers login outcomes and credential safety.
- `packages/sandock-cli/package.json` - Adds tests and releases version 2.5.0.
- `packages/sandock-cli/README.md` - Documents browser and headless login.
- `packages/sandock-js/package.json` - Coordinates SDK version 2.5.0.
- `pnpm-lock.yaml` - Refreshes the standalone workspace dependency graph.
- `.github/workflows/publish-sandock-js-sdk-cli.yml` - Runs CLI tests before publishing.

## Breaking Changes

None.

## Testing

- Run `pnpm --filter sandock-cli test`.
- Run `pnpm --filter sandock-cli typecheck`.
- Run `pnpm --filter sandock-cli build`.
- Run `pnpm --filter sandock build`.
