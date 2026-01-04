# Sandock CLI

> Command-line interface for [Sandock](https://sandock.ai) - Sandbox in Docker for AI Agents

[![npm version](https://badge.fury.io/js/sandock-cli.svg)](https://www.npmjs.com/package/sandock-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

Run directly with npx (no installation needed):

```bash
npx sandock --help
# or
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

## Usage

### Configuration

Configure your Sandock API URL and credentials:

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

### Sandbox Management

#### Create a sandbox

```bash
# Uses server default image (sandockai/sandock-code:latest)
sandock sandbox create --name my-sandbox

# Or specify a custom image
sandock sandbox create --name my-sandbox --image node:20-alpine
sandock sandbox create -n python-env -i python:3.11
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
- `--name, -n <name>` (required): Sandbox name
- `--image, -i <image>`: Docker image to use (default on server: sandockai/sandock-code:latest)
- `--space, -s <id>`: Space ID (default: default)

### `sandock sandbox list`

List all sandboxes

**Flags:**
- `--limit, -l <number>`: Maximum number of sandboxes to list (default: 20)

### `sandock sandbox info <id>`

Get detailed information about a sandbox

**Args:**
- `id` (required): Sandbox ID

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

## Examples

```bash
# Create a Node.js sandbox with default image
sandock sandbox create --name my-app

# Create with custom image
sandock sandbox create --name my-app --image node:20

# List all sandboxes
sandock sandbox list

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
```

## Development

This CLI uses [oclif](https://oclif.io/) framework and the [sandock](https://www.npmjs.com/package/sandock) SDK.

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run locally
pnpm dev config --show
```

## Links

- **Website**: [https://sandock.ai](https://sandock.ai)
- **Documentation**: [https://sandock.ai/docs](https://sandock.ai/docs)
- **Sandock SDK**: [https://www.npmjs.com/package/sandock](https://www.npmjs.com/package/sandock)
- **GitHub**: [https://github.com/sandock-ai/sandock](https://github.com/sandock-ai/sandock)

## License

MIT License - see [LICENSE](./LICENSE) for details
