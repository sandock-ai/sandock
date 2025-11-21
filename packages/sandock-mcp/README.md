# Sandock MCP

Model Context Protocol (MCP) server for Sandock - provides AI agents with tools to work with isolated Docker sandbox environments for continuous task processing.

## Features

- 🚀 **Sandbox Management** - Create, manage, and delete isolated sandbox environments
- 💻 **Shell Execution** - Execute shell commands for file operations and system tasks
- 📝 **File Operations** - Write text files and download binary files from URLs
- ⚡ **Code Execution** - Run JavaScript, TypeScript, or Python code
- 🎯 **Stateful Sessions** - Agent manages sandbox lifecycle for multi-step workflows
- 🔄 **Continuous Processing** - Handle complex tasks like file upload, extraction, processing, and result retrieval
- ⏱️ **Timeout Protection** - Configurable timeouts for all operations
- 🛡️ **Error Handling** - Detailed error messages with troubleshooting suggestions

## Installation

```bash
npm install sandock-mcp
```

## Configuration

### Environment Variables

Set the following environment variables to configure the Sandock MCP server:

- `SANDOCK_API_URL` - Sandock API base URL (default: `https://sandock.ai`)
- `SANDOCK_API_KEY` - Your Sandock API key (required for API access)

### MCP Client Configuration

Add to your MCP client configuration file:

#### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS)

```json
{
  "mcpServers": {
    "sandock": {
      "command": "npx",
      "args": ["-y", "sandock-mcp"],
      "env": {
        "SANDOCK_API_URL": "https://sandock.ai",
        "SANDOCK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Using Node.js path

```json
{
  "mcpServers": {
    "sandock": {
      "command": "node",
      "args": ["/path/to/sandock-mcp/dist/index.js"],
      "env": {
        "SANDOCK_API_URL": "https://sandock.ai",
        "SANDOCK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### 1. sandock_create_sandbox

Create a new isolated sandbox environment.

**Parameters:**
- `name` (string, optional) - Sandbox name (default: auto-generated)
- `image` (string, optional) - Docker image (default: `sandockai/sandock-code:latest`)
- `memoryLimitMb` (number, optional) - Memory limit in MB
- `cpuShares` (number, optional) - CPU shares (relative weight)
- `keep` (boolean, optional) - Keep sandbox alive (default: `false`)

**Returns:**
- `success` (boolean) - Whether creation succeeded
- `sandboxId` (string) - Sandbox ID for subsequent operations
- `name` (string) - Sandbox name
- `message` (string) - Success message

**Example:**
```json
{
  "name": "data-analysis",
  "image": "python:3.11-slim",
  "memoryLimitMb": 1024
}
```

---

### 2. sandock_shell_exec

Execute shell commands in the sandbox. Use for file operations (unzip, tar, grep, cat, ls), system commands, or running installed tools.

**Parameters:**
- `sandboxId` (string, required) - Sandbox ID from `sandock_create_sandbox`
- `command` (string | string[], required) - Shell command: `"ls -la"` or `["bash", "-c", "ls"]`
- `workdir` (string, optional) - Working directory
- `timeout` (number, optional) - Timeout in seconds (default: 30, max: 300)
- `env` (object, optional) - Environment variables

**Returns:**
- `success` (boolean) - Whether command succeeded (exit code 0)
- `exitCode` (number) - Process exit code
- `stdout` (string) - Standard output
- `stderr` (string) - Standard error
- `timedOut` (boolean) - Whether execution timed out
- `durationMs` (number) - Execution duration
- `sandboxId` (string) - Sandbox ID

**Examples:**
```json
// List files
{
  "sandboxId": "sbx_abc123",
  "command": "ls -lh /workspace"
}

// Extract ZIP file
{
  "sandboxId": "sbx_abc123",
  "command": "unzip /workspace/data.zip -d /workspace/data"
}

// Read file content
{
  "sandboxId": "sbx_abc123",
  "command": "cat /workspace/result.json"
}
```

---

### 3. sandock_write_file

Write text content to a file in the sandbox. Use for creating scripts, configuration files, or text data.

**Parameters:**
- `sandboxId` (string, required) - Sandbox ID
- `path` (string, required) - File path in sandbox (e.g., `/workspace/script.py`)
- `content` (string, required) - Text content to write
- `executable` (boolean, optional) - Make file executable

**Returns:**
- `success` (boolean) - Whether write succeeded
- `path` (string) - File path
- `sandboxId` (string) - Sandbox ID
- `message` (string) - Success message

**Example:**
```json
{
  "sandboxId": "sbx_abc123",
  "path": "/workspace/analyze.py",
  "content": "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.describe())"
}
```

---

### 4. sandock_download_file

Download a file from URL into the sandbox. Use for importing user-uploaded files (ZIP, CSV, images). File content never passes through the agent, avoiding token consumption.

**Parameters:**
- `sandboxId` (string, required) - Sandbox ID
- `url` (string, required) - URL of file to download
- `targetPath` (string, required) - Target path in sandbox (e.g., `/workspace/data.zip`)
- `timeout` (number, optional) - Timeout in seconds (default: 60, max: 300)

**Returns:**
- `success` (boolean) - Whether download succeeded
- `path` (string) - File path in sandbox
- `url` (string) - Source URL
- `sizeBytes` (number, optional) - File size
- `sandboxId` (string) - Sandbox ID

**Example:**
```json
{
  "sandboxId": "sbx_abc123",
  "url": "https://cdn.example.com/uploads/data.zip",
  "targetPath": "/workspace/data.zip",
  "timeout": 120
}
```

---

### 5. sandock_delete_sandbox

Delete a sandbox and free resources. Always call this when done to prevent resource leaks.

**Parameters:**
- `sandboxId` (string, required) - Sandbox ID to delete

**Returns:**
- `success` (boolean) - Whether deletion succeeded
- `sandboxId` (string) - Deleted sandbox ID
- `message` (string) - Success message

**Example:**
```json
{
  "sandboxId": "sbx_abc123"
}
```

---

### 6. sandock_run_code (Legacy)

Execute code in an isolated sandbox (legacy tool - creates and destroys sandbox automatically).

**Parameters:**
- `language` (string, required) - `"javascript"`, `"typescript"`, or `"python"`
- `code` (string, required) - Code to execute
- `timeout` (number, optional) - Timeout in seconds (default: 30, max: 300)

**Returns:**
- `success` (boolean) - Whether execution succeeded
- `exitCode` (number) - Process exit code
- `stdout` (string) - Standard output
- `stderr` (string) - Standard error
- `sandboxId` (string) - Sandbox ID (auto-cleaned)

## Workflow Examples

### Data Analysis Workflow

```javascript
// 1. Create sandbox
const { sandboxId } = await sandock_create_sandbox({
  name: "data-analysis",
  image: "python:3.11-slim"
})

// 2. Download user-uploaded file
await sandock_download_file({
  sandboxId,
  url: "https://cdn.platform.com/uploads/sales_data.zip",
  targetPath: "/workspace/data.zip"
})

// 3. Extract ZIP
await sandock_shell_exec({
  sandboxId,
  command: "unzip /workspace/data.zip -d /workspace/data"
})

// 4. List extracted files
const { stdout } = await sandock_shell_exec({
  sandboxId,
  command: "ls /workspace/data"
})

// 5. Write Python analysis script
await sandock_write_file({
  sandboxId,
  path: "/workspace/analyze.py",
  content: `
import pandas as pd
import json

df = pd.read_csv('/workspace/data/sales.csv')
result = {
  'total_sales': float(df['amount'].sum()),
  'avg_sales': float(df['amount'].mean()),
  'count': len(df)
}

with open('/workspace/result.json', 'w') as f:
  json.dump(result, f)

print(json.dumps(result, indent=2))
`
})

// 6. Execute analysis
const { stdout: analysisResult } = await sandock_shell_exec({
  sandboxId,
  command: "python /workspace/analyze.py"
})

// 7. Read result file
const { stdout: resultContent } = await sandock_shell_exec({
  sandboxId,
  command: "cat /workspace/result.json"
})

// 8. Clean up
await sandock_delete_sandbox({ sandboxId })
```

### Simple Code Execution (One-off)

For simple code execution, use the legacy `sandock_run_code` tool:

```javascript
const result = await sandock_run_code({
  language: "python",
  code: "print('Hello World!')",
  timeout: 30
})
```

## Development & Testing

### Quick Test

Run the automated test script to verify everything works:

```bash
# Set your API key
export SANDOCK_API_KEY=your-api-key-here

# Run the test script
./test.sh
```

The test script will:
1. Clean previous builds
2. Build the MCP server
3. Run a comprehensive demo that tests the `sandock_run_code` tool

### Manual Testing

1. **Build the MCP server:**
   ```bash
   pnpm install
   pnpm run build
   ```

2. **Run the demo:**
   ```bash
   export SANDOCK_API_KEY=your-api-key-here
   pnpm run demo
   ```

3. **The demo will test:**
   - Executing Python code
   - Executing JavaScript code
   - Executing TypeScript code
   - Handling errors and timeouts
   - Validating output and error messages

### Development Mode

Run the MCP server directly with tsx (no build needed):

```bash
pnpm run dev
```

## Project Structure

```
sandock-mcp/
├── src/
│   └── index.ts       # Main MCP server implementation
├── demo/
│   └── demo.js        # Comprehensive test demo
├── dist/              # Compiled output
├── test.sh            # Automated test script
├── package.json
├── tsconfig.json
└── README.md
```

## Usage Examples

### With Claude Desktop

1. Install the MCP server:
   ```bash
   npm install -g sandock-mcp
   ```

2. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "sandock": {
      "command": "sandock-mcp",
      "env": {
        "SANDOCK_API_URL": "https://sandock.ai",
        "SANDOCK_API_KEY": "your-api-key"
      }
    }
  }
}
```

3. Restart Claude Desktop

4. In Claude, you can now ask it to execute code:
   - "Write Python code to calculate Fibonacci numbers"
   - "Execute JavaScript code to process this data"
   - "Run TypeScript code to validate this schema"

### With Cline (VS Code)

1. Install the MCP server in your project
2. Configure in Cline settings to use the sandock-mcp command
3. Start using the `sandock_run_code` tool in your AI conversations

### Direct Node.js Usage

If you're building your own MCP client:

```typescript
import { createSandockClient } from "sandock";

const client = createSandockClient({
  baseUrl: "https://sandock.ai",
  headers: {
    Authorization: `Bearer ${process.env.SANDOCK_API_KEY}`,
  },
});

// Create a sandbox
const { data } = await client.POST("/api/sandbox", {
  body: { name: "my-sandbox", keep: false },
});

// Execute code
const { data: result } = await client.POST("/api/sandbox/{id}/code", {
  params: { path: { id: data.id } },
  body: {
    language: "python",
    code: "print('Hello from Sandock!')",
    timeoutMs: 30000,
  },
});

console.log(result.stdout);
```

## License

MIT

## Links

- [Sandock Website](https://sandock.ai)
- [GitHub Repository](https://github.com/sandock-ai/sandock)
- [Documentation](https://sandock.ai/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)

## Support

For issues and questions:
- [GitHub Issues](https://github.com/sandock-ai/sandock/issues)
- [Documentation](https://sandock.ai/docs)
