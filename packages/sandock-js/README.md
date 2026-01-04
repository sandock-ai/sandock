# Sandock SDK

> Lightweight TypeScript SDK for [Sandock](https://sandock.ai) - Sandbox in Docker for AI Agents

[![npm version](https://badge.fury.io/js/sandock.svg)](https://www.npmjs.com/package/sandock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install sandock
# or
pnpm add sandock
# or
yarn add sandock
```

## Quick Start

```typescript
import { createSandockClient } from 'sandock'

const client = createSandockClient({
  baseUrl: 'https://sandock.ai',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
})

// Create a sandbox
const sandbox = await client.sandbox.create({ image: 'node:20-alpine' })
console.log('Sandbox ID:', sandbox.data.id)

// Run code
const result = await client.sandbox.runCode(sandbox.data.id, {
  language: 'javascript',
  code: 'console.log("Hello from sandbox!")'
})
console.log('Output:', result.data.stdout)

// Stop sandbox
await client.sandbox.stop(sandbox.data.id)
```

## API Reference

### Client Creation

```typescript
import { createSandockClient } from 'sandock'

const client = createSandockClient({
  baseUrl: 'https://sandock.ai',      // API base URL
  headers: { 'Authorization': '...' }, // Optional headers
  fetch: customFetch                   // Optional custom fetch
})
```

### Sandbox Operations

#### `client.sandbox.create(options)`

Create a new sandbox container.

```typescript
const sandbox = await client.sandbox.create({
  image: 'node:20-alpine',     // Required: Docker image
  command: ['node', '-e', ''], // Optional: Custom command
  env: { NODE_ENV: 'prod' },   // Optional: Environment variables
  cpu: 1,                      // Optional: CPU limit
  memory: 512,                 // Optional: Memory limit (MB)
  spaceId: 'space_xxx'         // Optional: Space ID
})
// Returns: { success: true, data: { id: 'sdbXXX' } }
```

#### `client.sandbox.start(sandboxId)`

Start an existing sandbox.

```typescript
await client.sandbox.start('sdbXXX')
// Returns: { success: true, data: { id: 'sdbXXX', started: true } }
```

#### `client.sandbox.stop(sandboxId)`

Stop and clean up a sandbox.

```typescript
await client.sandbox.stop('sdbXXX')
// Returns: { success: true, data: { id: 'sdbXXX', stopped: true } }
```

#### `client.sandbox.get(sandboxId)`

Get sandbox information.

```typescript
const info = await client.sandbox.get('sdbXXX')
// Returns: { success: true, data: { id: 'sdbXXX', status: 'running' } }
```

#### `client.sandbox.runCode(sandboxId, options, callbacks?)`

Execute code in a sandbox. Supports JavaScript, TypeScript, and Python.

**Batch Mode** (wait for completion):

```typescript
const result = await client.sandbox.runCode('sdbXXX', {
  language: 'javascript',  // 'javascript' | 'typescript' | 'python'
  code: 'console.log("hello")',
  timeoutMs: 30000         // Optional timeout
})
// Returns: { success: true, data: { stdout, stderr, exitCode, timedOut, durationMs } }
```

**Streaming Mode** (real-time output via SSE):

```typescript
await client.sandbox.runCode('sdbXXX', 
  { language: 'python', code: 'print("streaming!")' },
  {
    onStdout: (chunk) => console.log('[stdout]', chunk),
    onStderr: (chunk) => console.log('[stderr]', chunk),
    onError: (err) => console.error('[error]', err)
  }
)
```

#### `client.sandbox.shell(sandboxId, command, callbacks?)`

Execute a shell command in a sandbox.

**Batch Mode**:

```typescript
const result = await client.sandbox.shell('sdbXXX', 'ls -la')
// Returns: { success: true, data: { stdout, stderr, exitCode, timedOut, durationMs } }
```

**Streaming Mode**:

```typescript
await client.sandbox.shell('sdbXXX', 'echo "start"; sleep 2; echo "done"', {
  onStdout: (chunk) => process.stdout.write(chunk)
})
```

### File System Operations

#### `client.fs.write(sandboxId, path, content)`

Write a file to the sandbox.

```typescript
await client.fs.write('sdbXXX', '/sandbox/app.js', 'console.log("hi")')
// Returns: { success: true, data: true }
```

#### `client.fs.read(sandboxId, path)`

Read a file from the sandbox.

```typescript
const file = await client.fs.read('sdbXXX', '/sandbox/app.js')
// Returns: { success: true, data: { path: '...', content: '...' } }
```

#### `client.fs.list(sandboxId, path)`

List files in a directory.

```typescript
const files = await client.fs.list('sdbXXX', '/sandbox')
// Returns: { success: true, data: { path: '...', entries: [...] } }
```

#### `client.fs.delete(sandboxId, path)`

Delete a file or directory.

```typescript
await client.fs.delete('sdbXXX', '/sandbox/temp.txt')
// Returns: { success: true, data: true }
```

### Meta Information

#### `client.getMeta()`

Get API version and metadata.

```typescript
const meta = await client.getMeta()
// Returns: { success: true, data: { version: '2.1.0' } }
```

### Raw API Access

The client also exposes the underlying `openapi-fetch` methods for direct API access:

```typescript
// Direct GET request
const { data, error } = await client.GET('/api/v1/sandbox')

// Direct POST request
const { data, error } = await client.POST('/api/v1/sandbox/{id}/code', {
  params: { path: { id: 'sdbXXX' } },
  body: { language: 'javascript', code: '...' }
})
```

## Streaming Support

The SDK supports real-time output streaming via Server-Sent Events (SSE). When you provide callback functions to `runCode` or `shell`, the SDK automatically uses SSE endpoints for real-time output delivery.

```typescript
// Streaming is automatically enabled when callbacks are provided
await client.sandbox.runCode(sandboxId, 
  { language: 'javascript', code: 'for(let i=0;i<5;i++) console.log(i)' },
  {
    onStdout: (chunk) => console.log('[stdout]', chunk),  // Real-time!
    onStderr: (chunk) => console.log('[stderr]', chunk),
  }
)

// Without callbacks = batch mode (waits for completion)
const result = await client.sandbox.runCode(sandboxId, { language: 'javascript', code: '...' })
```

## TypeScript Support

The SDK is fully typed with TypeScript. All API responses and options have proper type definitions.

```typescript
import type { 
  SandockClient,
  SandboxCreateOptions,
  RunCodeOptions,
  ExecutionResult,
  StreamCallbacks 
} from 'sandock'
```

## License

MIT
