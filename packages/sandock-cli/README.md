# Sandock CLI

> Command-line interface for [Sandock](https://sandock.ai) - Sandbox in Docker for AI Agents

[![npm version](https://badge.fury.io/js/sandock-cli.svg)](https://www.npmjs.com/package/sandock-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

Run directly with npx (no installation needed):

```bash
npx sandock-cli --help
```

Or install globally:

```bash
npm install -g sandock-cli
# or
pnpm add -g sandock-cli

# Then use directly
sandock --help
```

## Quick Start

```bash
# Sign in once through your browser and create an API key
sandock login

# Create and enter a Node.js sandbox
sandock run node:24.18.0-alpine --shell

# Create and enter Python REPL
sandock run python:3.12 --shell --cmd python

# Create sandbox without entering shell
sandock run ubuntu:24.04
```

## Usage

### Configuration

Sign in interactively to create and save an API key:

```bash
# Open the authorization page in your default browser
sandock login

# Print the URL and one-time code without opening a browser
sandock login --no-browser
```

The CLI prints the authorization URL and one-time code, waits for approval, and saves the newly
created API key only after authorization succeeds. If a key is already configured, replacing it
requires confirmation and defaults to cancel. The API key itself is never printed.

You can also configure your Sandock API URL and credentials manually:

```bash
# Show current configuration
sandock config --show

# Set API URL
sandock config --set-url https://sandock.ai

# Set API key (if required)
sandock config --set-key your-api-key

# Reset to defaults
sandock config --reset
```

### Quick Run (Create + Shell)

The `run` command creates a sandbox and optionally enters an interactive shell:

```bash
# Create and enter shell
sandock run node:24.18.0-alpine --shell

# Create with custom shell command
sandock run python:3.12 --shell --cmd python

# Create with resource limits
sandock run node:24.18.0-alpine --shell --cpu 2 --memory 512

# Create with custom name
sandock run ubuntu:24.04 --shell --title "my-dev-env"

# Create only (no shell)
sandock run node:24.18.0-alpine
```

### Sandbox Management

#### Create a sandbox

```bash
# Create in your personal space
sandock sandbox create --image node:24.18.0

# Create with custom image
sandock sandbox create --image node:24.18.0-alpine
sandock sandbox create -i python:3.11
```

#### List sandboxes

```bash
sandock sandbox list
sandock sandbox list --limit 50
```

#### Get sandbox info

```bash
sandock sandbox info sb_12345
```

#### Delete a sandbox

```bash
sandock sandbox delete sb_12345
```

#### Interactive shell

```bash
# Enter default shell (/bin/sh)
sandock sandbox shell sb_12345

# Enter bash
sandock sandbox shell sb_12345 --cmd /bin/bash

# Enter Python REPL
sandock sandbox shell sb_12345 --cmd python
```

#### Execute commands

```bash
# Basic execution
sandock sandbox exec sb_12345 "node -v"
sandock sandbox exec sb_12345 "python script.py" --timeout 60

# Stream output in real-time
sandock sandbox exec sb_12345 "echo hello; sleep 1; echo world" --stream
```

#### Run code

```bash
# Run JavaScript code
sandock sandbox run-code sb_12345 -l javascript -c "console.log('hello')"

# Run Python code from file with streaming
sandock sandbox run-code sb_12345 -l python -f script.py --stream

# Run TypeScript inline
sandock sandbox run-code sb_12345 -l typescript -c "const x: number = 1; console.log(x)" -s
```

## Available Commands

### `sandock login`

Sign in through a browser using a one-time code and create an API key.

**Flags:**
- `--no-browser`: Print the authorization URL without opening a browser

**Examples:**
```bash
sandock login
sandock login --no-browser
```

### `sandock run <image>`

Create a sandbox from image and optionally enter interactive shell

**Args:**
- `image` (required): Docker image (e.g., node:24.18.0-alpine, python:3.12, ubuntu:24.04)

**Flags:**
- `--shell`: Enter interactive shell after creation
- `--cmd <command>`: Shell command (default: /bin/sh)
- `--cpu, -c <shares>`: CPU shares
- `--memory, -m <mb>`: Memory limit in MB
- `--title <name>`: Sandbox name

**Examples:**
```bash
sandock run node:24.18.0-alpine --shell
sandock run python:3.12 --shell --cmd python
sandock run ubuntu:24.04 --cpu 2 --memory 512
```

### `sandock config`

Manage CLI configuration (API URL, API key)

**Flags:**
- `--show, -s`: Show current configuration
- `--set-url <url>`: Set API URL
- `--set-key <key>`: Set API key
- `--reset`: Reset configuration to defaults

### `sandock sandbox create`

Create a new sandbox

**Flags:**
- `--image, -i <image>` (required): Docker image to use
- `--space, -s <id>`: Optional; omit to use your personal space

### `sandock sandbox list`

List all sandboxes

**Flags:**
- `--limit, -l <number>`: Maximum number of sandboxes to list (default: 20)

### `sandock sandbox info <id>`

Get detailed information about a sandbox

**Args:**
- `id` (required): Sandbox ID

### `sandock sandbox shell <id>`

Open interactive shell in a sandbox (PTY)

**Args:**
- `id` (required): Sandbox ID

**Flags:**
- `--cmd <command>`: Shell command to execute (default: /bin/sh)

**Examples:**
```bash
sandock sandbox shell sb_12345
sandock sandbox shell sb_12345 --cmd /bin/bash
sandock sandbox shell sb_12345 --cmd python
```

### `sandock sandbox exec <id> <command>`

Execute a shell command in a sandbox

**Args:**
- `id` (required): Sandbox ID
- `command` (required): Shell command to execute

**Flags:**
- `--timeout, -t <seconds>`: Execution timeout in seconds (default: 30)
- `--stream, -s`: Stream output in real-time

### `sandock sandbox run-code <id>`

Execute code in a sandbox

**Args:**
- `id` (required): Sandbox ID

**Flags:**
- `--language, -l <lang>` (required): Programming language (javascript, typescript, python)
- `--code, -c <code>`: Inline code to execute
- `--file, -f <path>`: Path to code file to execute
- `--timeout, -t <seconds>`: Execution timeout in seconds (default: 30)
- `--stream, -s`: Stream output in real-time

### `sandock sandbox delete <id>`

Delete a sandbox

**Args:**
- `id` (required): Sandbox ID

### `sandock sandbox preview-url <id>`

Get a preview URL for a sandbox port.

**Args:**
- `id` (required): Sandbox ID

**Flags:**
- `--port, -p <number>` (required): Port number to preview
- `--signed, -s`: Generate a signed (shareable) URL
- `--expires <seconds>`: Signed URL expiry in seconds (default: 3600)

**Examples:**
```bash
# Get standard preview URL
sandock sandbox preview-url sb_12345 --port 3000

# Get signed (shareable) preview URL
sandock sandbox preview-url sb_12345 --port 3000 --signed

# Signed URL with custom expiry
sandock sandbox preview-url sb_12345 --port 3000 --signed --expires 7200
```

## Examples

```bash
# Quick start: create and enter shell
sandock run node:24.18.0-alpine --shell

# Create Python sandbox and enter REPL
sandock run python:3.12 --shell --cmd python

# Create sandbox with resource limits
sandock run ubuntu:24.04 --shell --cpu 2 --memory 1024 --title "my-env"

# Create a Node.js sandbox (traditional way)
sandock sandbox create --image node:24.18.0

# List all sandboxes
sandock sandbox list

# Enter interactive shell
sandock sandbox shell sb_abc123

# Execute shell command in a sandbox
sandock sandbox exec sb_abc123 "npm install && npm start"

# Execute with streaming output
sandock sandbox exec sb_abc123 "echo start; sleep 2; echo done" --stream

# Run JavaScript code
sandock sandbox run-code sb_abc123 -l javascript -c "console.log('Hello')"

# Run Python code with streaming
sandock sandbox run-code sb_abc123 -l python -c "print('Hello from Python')" --stream

# Run code from file
sandock sandbox run-code sb_abc123 -l python -f ./script.py --stream

# Check sandbox info
sandock sandbox info sb_abc123

# Delete sandbox
sandock sandbox delete sb_abc123

# Get preview URL for port 3000
sandock sandbox preview-url sb_abc123 --port 3000

# Get signed preview URL (shareable)
sandock sandbox preview-url sb_abc123 --port 3000 --signed
```

## Development

This CLI uses [oclif](https://oclif.io/) framework and the [sandock](https://www.npmjs.com/package/sandock) SDK.

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run locally
pnpm dev run node:24.18.0-alpine --shell
pnpm dev config --show
```

## Links

- **Website**: [https://sandock.ai](https://sandock.ai)
- **Documentation**: [https://sandock.ai/docs](https://sandock.ai/docs)
- **Sandock SDK**: [https://www.npmjs.com/package/sandock](https://www.npmjs.com/package/sandock)
- **GitHub**: [https://github.com/sandock-ai/sandock](https://github.com/sandock-ai/sandock)

## License

MIT License - see [LICENSE](./LICENSE) for details

### Sandbox lifetime (2.5.1)

Both `sandbox create` and `run` accept:

- `--active-deadline-seconds <seconds>`: Maximum runtime, integer 1–86400.
- `--auto-delete-interval <minutes>`: Delay after stopping; -1 disables deletion, 0 requests immediate deletion, positive values wait that many minutes. Deletion is processed by the service scheduler.

Omit either option to keep its service default. The runtime limit is independent of signed URL expiry.

```bash
sandock sandbox create --image node:24.18.0 --active-deadline-seconds 3600 --auto-delete-interval 0
sandock run node:24.18.0 --active-deadline-seconds 3600 --auto-delete-interval 0
```

### Signed Preview URLs (2.5.1)

```bash
# Print a signed URL using the SDK (port required, expiry 60–86400 seconds)
sandock sandbox preview sb_example --port 3000 --expires-in 3600

# Revoke the token from that URL using the SDK
sandock sandbox revoke-preview sb_example t0123456789abcde
```

The default expiry is 3600 seconds. For a returned URL such as
`https://3000-t0123456789abcde.sandock.ai`, the token is `t0123456789abcde`.
Treat the URL and token as credentials. Revoking a token affects every URL carrying it;
it does not stop or delete the sandbox. Proxy caches and existing connections may outlast
the revocation response. Generating again may refresh a still-valid token for the same
sandbox and port; it is not a way to revoke the old URL.

These commands directly use `sandock` SDK's `getSignedPreviewUrl` and
`revokePreviewToken`; the CLI does not implement its own signing or revocation.
