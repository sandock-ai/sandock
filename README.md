
# Sandock

> **Sandbox in Docker for AI Agents**

[**Sandock.ai**](https://sandock.ai) is container-based sandbox platform that provides secure, isolated environments for running code and applications.

This repository contains the official SDKs and tools for integrating with Sandock.

## 🌐 Website

- **Production**: [https://sandock.ai](https://sandock.ai)
- **Documentation**: [https://sandock.ai/docs](https://sandock.ai/docs)

## 📦 Packages

### TypeScript SDK (`sandock`)

The official TypeScript/JavaScript SDK for Sandock API integration.

```bash
npm install sandock
# or
pnpm add sandock
```

**Features**:
- ✅ Full TypeScript support with auto-generated types
- ✅ Type-safe API client powered by [openapi-fetch](https://github.com/drwpow/openapi-typescript)
- ✅ Comprehensive sandbox lifecycle management
- ✅ Docker and Kubernetes provider support
- ✅ Built-in timeout handling and error management

**Quick Start**:

```typescript
import { createSandockClient } from "sandock";

const client = createSandockClient({
  baseUrl: "https://sandock.ai",
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});

// Create a sandbox
const { data } = await client.POST("/api/sandbox", {
  body: {
    image: "sandockai/sandock-code:latest",
    memoryLimitMb: 512,
  },
});

const sandboxId = data?.data?.id;

// Execute code
const result = await client.POST("/api/sandbox/{id}/code", {
  params: { path: { id: sandboxId } },
  body: {
    language: "javascript",
    code: 'console.log("Hello from Sandock!")'
  },
});

console.log(result.data?.data?.stdout); // "Hello from Sandock!"

// Delete sandbox when done
await client.DELETE("/api/sandbox/{id}", {
  params: { path: { id: sandboxId } }
});
```

**API Reference**:

**Sandbox Management**
- `POST /api/sandbox` - Create a new sandbox
- `GET /api/sandbox` - List all sandboxes
- `POST /api/sandbox/{id}/start` - Start a sandbox
- `POST /api/sandbox/{id}/stop` - Stop a sandbox
- `DELETE /api/sandbox/{id}` - Delete a sandbox

**Code Execution**
- `POST /api/sandbox/{id}/code` - Run code (JavaScript, TypeScript, Python)
- `POST /api/sandbox/{id}/shell` - Execute shell commands

**File System**
- `POST /api/sandbox/{id}/fs/write` - Write a file
- `GET /api/sandbox/{id}/fs/read` - Read a file
- `GET /api/sandbox/{id}/fs/list` - List directory contents
- `DELETE /api/sandbox/{id}/fs` - Remove file or directory

**Package**: [sandock](./packages/sandock-js)

---

### CLI Tool (`sandock-cli`)

Command-line interface for Sandock operations.

```bash
# Run directly with npx (no installation needed)
npx sandock --help
# or
npx sandock-cli --help

# Or install globally
npm install -g sandock-cli

# Then use directly
sandock --help
```

**Features**:
- ✅ Interactive CLI powered by [oclif](https://oclif.io/)
- ✅ Sandbox lifecycle management (create, list, exec, info)
- ✅ Configuration management (API URL, API keys)
- ✅ Colored output and progress indicators
- ✅ Built on top of the `sandock` SDK

**Quick Start**:

```bash
# Configure API endpoint
npx sandock config --set-url https://sandock.ai

# Create a sandbox (uses server default image: sandockai/sandock-code:latest)
npx sandock sandbox create --name my-app

# Or specify a custom image
npx sandock sandbox create --name my-app --image node:20-alpine

# List sandboxes
npx sandock sandbox list

# Execute commands
npx sandock sandbox exec sb_12345 "npm install && npm start"
```

**Package**: [sandock-cli](./packages/sandock-cli)

---

## 📚 API Documentation

### Complete API Reference

#### Sandbox Management

##### Create Sandbox

```typescript
const { data } = await client.POST('/api/sandbox', {
  body: {
    actorUserId?: string,
    image?: string,              // e.g., 'sandockai/sandock-code:latest'
    pythonImage?: string,        // e.g., 'python:3.12-slim'
    memoryLimitMb?: number,      // Memory limit in MB
    cpuShares?: number,          // CPU shares
    workdir?: string,            // Working directory
    keep?: boolean               // Keep sandbox alive
  }
})
```

Returns: `{ id: string }`

##### List Sandboxes

```typescript
const { data } = await client.GET('/api/sandbox')
```

Returns: `{ items: Array<{ id: string, status: string }> }`

##### Start Sandbox

```typescript
const { data } = await client.POST('/api/sandbox/{id}/start', {
  params: { path: { id: sandboxId } }
})
```

Returns: `{ id: string, started: boolean }`

##### Stop Sandbox

```typescript
const { data } = await client.POST('/api/sandbox/{id}/stop', {
  params: { path: { id: sandboxId } }
})
```

Returns: `{ id: string, stopped: boolean }`

##### Delete Sandbox

```typescript
const { data } = await client.DELETE('/api/sandbox/{id}', {
  params: { path: { id: sandboxId } }
})
```

Returns: `{ id: string, deleted: boolean }`

#### Code Execution

##### Run Code

```typescript
const { data } = await client.POST('/api/sandbox/{id}/code', {
  params: { path: { id: sandboxId } },
  body: {
    language: 'javascript' | 'typescript' | 'python',
    code: string,
    timeoutMs?: number,
    input?: string
  }
})
```

Returns:
```typescript
{
  stdout: string,
  stderr: string,
  exitCode: number | null,
  timedOut: boolean,
  durationMs: number
}
```

##### Execute Shell Command

```typescript
const { data } = await client.POST('/api/sandbox/{id}/shell', {
  params: { path: { id: sandboxId } },
  body: {
    cmd: string | string[],
    timeoutMs?: number,
    workdir?: string,
    env?: Record<string, string>,
    input?: string
  }
})
```

Returns: Same as Run Code

#### File System Operations

##### Write File

```typescript
const { data } = await client.POST('/api/sandbox/{id}/fs/write', {
  params: { path: { id: sandboxId } },
  body: {
    path: string,
    content: string,
    executable?: boolean
  }
})
```

Returns: `boolean`

##### Read File

```typescript
const { data } = await client.GET('/api/sandbox/{id}/fs/read', {
  params: {
    path: { id: sandboxId },
    query: { path: 'path/to/file.txt' }
  }
})
```

Returns: `{ path: string, content: string }`

##### List Files

```typescript
const { data } = await client.GET('/api/sandbox/{id}/fs/list', {
  params: {
    path: { id: sandboxId },
    query: { path: 'path/to/directory' }
  }
})
```

Returns: `{ path: string, entries: string[] }`

##### Remove File/Directory

```typescript
const { data } = await client.DELETE('/api/sandbox/{id}/fs', {
  params: {
    path: { id: sandboxId },
    query: { path: 'path/to/remove' }
  }
})
```

Returns: `boolean`

### Complete Example

```typescript
import { createSandockClient } from 'sandock'

async function main() {
  // Initialize client
  const client = createSandockClient({
    baseUrl: 'https://sandock.ai',
    headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
  })

  try {
    // Create a new sandbox
    const { data: createData } = await client.POST('/api/sandbox', {
      body: {
        image: 'sandockai/sandock-code:latest',
        memoryLimitMb: 512
      }
    })
    
    const sandboxId = createData?.data?.id
    if (!sandboxId) throw new Error('Failed to create sandbox')
    
    console.log('Sandbox created:', sandboxId)

    // Write a file
    await client.POST('/api/sandbox/{id}/fs/write', {
      params: { path: { id: sandboxId } },
      body: {
        path: 'hello.js',
        content: 'console.log("Hello, World!")'
      }
    })

    // Run the file
    const { data: execData } = await client.POST('/api/sandbox/{id}/shell', {
      params: { path: { id: sandboxId } },
      body: {
        cmd: 'node hello.js'
      }
    })

    console.log('Output:', execData?.data?.stdout)

    // List files
    const { data: listData } = await client.GET('/api/sandbox/{id}/fs/list', {
      params: {
        path: { id: sandboxId },
        query: { path: '.' }
      }
    })

    console.log('Files:', listData?.data?.entries)

    // Delete the sandbox
    await client.DELETE('/api/sandbox/{id}', {
      params: { path: { id: sandboxId } }
    })

    console.log('Sandbox deleted')

  } catch (error) {
    console.error('Error:', error)
  }
}

main()
```

---

## 🛠️ Development

This is a pnpm workspace with multiple packages:

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build all packages
pnpm build

# Lint and format
pnpm lint
```

## 🤝 Contributing

We welcome contributions! Please feel free to submit issues and pull requests.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🔗 Links

- **GitHub**: [https://github.com/sandock-ai/sandock](https://github.com/sandock-ai/sandock)
- **npm Package**: [https://www.npmjs.com/package/sandock](https://www.npmjs.com/package/sandock)
- **Website**: [https://sandock.ai](https://sandock.ai)
- **Documentation**: [https://sandock.ai/docs](https://sandock.ai/docs)

---

Made with ❤️ by the Sandock team
