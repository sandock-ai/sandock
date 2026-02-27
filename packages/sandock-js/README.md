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
const sandbox = await client.sandbox.create({ 
  image: 'node:20-alpine' 
})
console.log('Sandbox ID:', sandbox.data.id)

// Start the sandbox (if needed)
await client.sandbox.start(sandbox.data.id)

// Run code
const result = await client.sandbox.runCode(sandbox.data.id, {
  language: 'javascript',
  code: 'console.log("Hello from sandbox!")'
})
console.log('Output:', result.data.stdout)
console.log('Exit Code:', result.data.exitCode)

// Stop sandbox
await client.sandbox.stop(sandbox.data.id)

// Delete sandbox (optional - frees resources)
await client.sandbox.delete(sandbox.data.id)
```

## API Response Format

All API responses follow a consistent structure:

```typescript
{
  success: boolean    // Request success flag
  code: number        // HTTP status code (e.g., 200)
  message: string     // Response message (e.g., 'SUCCESS')
  data: T             // Response data (type varies by endpoint)
}
```

**Example:**
```typescript
const result = await client.sandbox.create({ image: 'node:20-alpine' })
// result = {
//   success: true,
//   code: 200,
//   message: 'SUCCESS',
//   data: { id: 'sdbXXX' }
// }
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

#### `client.sandbox.list()`

List all managed sandboxes.

```typescript
const sandboxes = await client.sandbox.list()
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { items: [{ id: 'sdbXXX' }, ...] } }
```

#### `client.sandbox.create(options)`

Create a new sandbox container.

```typescript
const sandbox = await client.sandbox.create({
  image: 'sandockai/sandock-code:latest',  // Optional: Docker image (default: sandockai/sandock-code:latest)
  spaceId: 'space_xxx',                    // Optional: Target workspace ID
  memoryLimitMb: 512,                      // Optional: Memory limit in MB
  cpuShares: 1024,                         // Optional: CPU shares allocation
  workdir: '/workspace',                   // Optional: Working directory
  keep: false,                             // Optional: Keep container after exit
  activeDeadlineSeconds: 1800,             // Optional: Max runtime in seconds (Kubernetes only, default: 1800, max: 86400)
  command: ['node', 'server.js'],          // Optional: Override default container command (Kubernetes only)
  env: { NODE_ENV: 'production' },         // Optional: Environment variables
  volumes: [                               // Optional: Volume mounts
    {
      volumeId: 'vol_xxx',
      mountPath: '/data',
      subpath: 'project1'                  // Optional: Subdirectory within volume
    }
  ]
})
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { id: 'sdbXXX' } }
```

#### `client.sandbox.start(sandboxId)`

Start an existing sandbox.

```typescript
await client.sandbox.start('sdbXXX')
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { id: 'sdbXXX', started: true } }
```

#### `client.sandbox.stop(sandboxId)`

Stop and clean up a sandbox.

```typescript
await client.sandbox.stop('sdbXXX')
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { id: 'sdbXXX', stopped: true } }
```

#### `client.sandbox.delete(sandboxId)`

Delete a sandbox and free resources.

```typescript
await client.sandbox.delete('sdbXXX')
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { id: 'sdbXXX', deleted: true } }
```

#### `client.sandbox.runCode(sandboxId, options, callbacks?)`

Execute code in a sandbox. Supports JavaScript, TypeScript, and Python.

**Supported Languages:**
- `javascript` - Run JavaScript code with Node.js
- `typescript` - Run TypeScript code (auto-compiled and executed)
- `python` - Run Python code

**Batch Mode** (wait for completion):

```typescript
const result = await client.sandbox.runCode('sdbXXX', {
  language: 'javascript',  // 'javascript' | 'typescript' | 'python'
  code: 'console.log("hello")',
  timeoutMs: 30000,        // Optional: timeout in milliseconds
  input: 'user input',     // Optional: stdin input
  env: { KEY: 'value' }    // Optional: environment variables
})
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { stdout, stderr, exitCode, timedOut, durationMs } }
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

#### `client.sandbox.shell(sandboxId, options, callbacks?)`

Execute a shell command in a sandbox.

**Batch Mode**:

```typescript
const result = await client.sandbox.shell('sdbXXX', { cmd: 'ls -la' })
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { stdout, stderr, exitCode, timedOut, durationMs } }
```

**With Options**:

```typescript
const result = await client.sandbox.shell('sdbXXX', {
  cmd: 'npm install',            // String or string[] for multiple commands
  timeoutMs: 60000,              // Optional: timeout in milliseconds (default: 30000)
  workdir: '/app',               // Optional: working directory
  env: { NODE_ENV: 'prod' },     // Optional: environment variables
  input: 'user input'            // Optional: stdin input
})
```

**Streaming Mode**:

```typescript
await client.sandbox.shell('sdbXXX', { cmd: 'echo "start"; sleep 2; echo "done"' }, {
  onStdout: (chunk) => process.stdout.write(chunk)
})
```

### File System Operations

#### `client.fs.write(sandboxId, path, content, options?)`

Write a file to the sandbox.

```typescript
await client.fs.write('sdbXXX', '/sandbox/app.js', 'console.log("hi")', { executable: false })
// Returns: { success: true, code: 200, message: 'SUCCESS', data: true }
```

#### `client.fs.read(sandboxId, path)`

Read a file from the sandbox.

```typescript
const file = await client.fs.read('sdbXXX', '/sandbox/app.js')
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { path: '/sandbox/app.js', content: 'console.log("hi")' } }
```

#### `client.fs.list(sandboxId, path)`

List files in a directory.

```typescript
const files = await client.fs.list('sdbXXX', '/sandbox')
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { path: '/sandbox', entries: ['app.js', 'package.json'] } }
```

#### `client.fs.delete(sandboxId, path)`

Delete a file or directory.

```typescript
await client.fs.delete('sdbXXX', '/sandbox/temp.txt')
// Returns: { success: true, code: 200, message: 'SUCCESS', data: true }
```

### Volume Operations

Volumes provide persistent storage that can be mounted to sandboxes.

#### `client.volume.list()`

List all volumes in the current space.

```typescript
const volumes = await client.volume.list()
// Returns: { success: true, data: { volumes: [{ id, name, status, ... }] } }
```

#### `client.volume.create(name, metadata?, spaceId?)`

Create a new volume.

```typescript
const volume = await client.volume.create('my-data')
// Returns: { success: true, data: { id: 'vol_xxx', name: 'my-data', status: 'ready', ... } }

// With optional metadata
const volume = await client.volume.create('my-data', { project: 'demo' })

// With optional spaceId (creates volume in specified space)
const volume = await client.volume.create('my-data', undefined, 'space_xxx')

// With both metadata and spaceId
const volume = await client.volume.create('my-data', { project: 'demo' }, 'space_xxx')
```

#### `client.volume.get(volumeId)`

Get volume by ID.

```typescript
const volume = await client.volume.get('vol_xxx')
// Returns: { success: true, data: { id, name, status, sizeBytes, ... } }
```

#### `client.volume.getByName(name, create?, spaceId?)`

Get volume by name, optionally creating if it doesn't exist.

```typescript
// Get existing volume
const volume = await client.volume.getByName('my-data')

// Get or create volume
const volume = await client.volume.getByName('my-data', true)

// Get or create volume in specific space
const volume = await client.volume.getByName('my-data', true, 'space_xxx')

// Get volume from specific space (without create)
const volume = await client.volume.getByName('my-data', false, 'space_xxx')
```

#### `client.volume.delete(volumeId)`

Delete a volume. Note: Cannot delete volumes that are mounted to active sandboxes.

```typescript
await client.volume.delete('vol_xxx')
// Returns: { success: true, data: { id: 'vol_xxx', deleted: true } }
```

### Creating Sandbox with Volume Mounts

Mount volumes to sandboxes for persistent storage:

```typescript
// First, create or get a volume
const volume = await client.volume.getByName('my-data', true)

// Create sandbox with volume mount
const sandbox = await client.sandbox.create({
  image: 'node:20-alpine',
  volumes: [
    {
      volumeId: volume.data.id,
      mountPath: '/data',           // Mount path inside container
      subpath: 'project1'           // Optional: subdirectory within volume
    }
  ]
})

// Data written to /data will persist across sandbox restarts
await client.sandbox.shell(sandbox.data.id, { cmd: 'echo "hello" > /data/test.txt' })
```

### User Operations

#### `client.user.get(userId)`

Get user basic profile information.

```typescript
const user = await client.user.get('user_xxx')
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { id: 'user_xxx', name: 'Ultra-man', age: 20 } }
```

### Meta Information

#### `client.getMeta()`

Get API version and metadata.

```typescript
const meta = await client.getMeta()
// Returns: { success: true, code: 200, message: 'SUCCESS', data: { version: 'dev', timestamp: 1760724524102 } }
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
  { 
    language: 'javascript', 
    code: 'for(let i=0;i<5;i++) { console.log(i); console.error("err" + i); }' 
  },
  {
    onStdout: (chunk) => console.log('[stdout]', chunk),  // Real-time stdout
    onStderr: (chunk) => console.error('[stderr]', chunk), // Real-time stderr
    onError: (err) => console.error('[error]', err)       // Error handling
  }
)

// Without callbacks = batch mode (waits for full completion)
const result = await client.sandbox.runCode(sandboxId, { 
  language: 'javascript', 
  code: 'console.log("batch mode")' 
})
console.log(result.data.stdout, result.data.stderr, result.data.exitCode)
```

## TypeScript Support

The SDK is fully typed with TypeScript. All API responses and options have proper type definitions based on the OpenAPI schema.

```typescript
import type { 
  SandockClient,
  CreateSandboxRequest,
  RunCodeRequest,
  ShellRequest,
  WriteFileRequest,
  SandboxExecutionResult,
  SandboxListResponse,
  MetaResponse,
  User,
  StreamCallbacks,
  VolumeInfo,
  VolumeMountInput
} from 'sandock'

// All types are auto-generated from OpenAPI schema
import type { paths, components } from 'sandock/schema'
```

## License

MIT
