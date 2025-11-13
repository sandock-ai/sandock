# Sandock MCP

Model Context Protocol (MCP) server for Sandock - provides AI agents with a powerful tool to execute code in isolated Docker sandbox environments.

## Features

- ⚡ **Execute Code** - Run JavaScript, TypeScript, or Python code in isolated sandboxes
- 🎯 **Multi-Language Support** - Native support for JavaScript, TypeScript, and Python
- 📦 **Ephemeral Sandboxes** - Automatic sandbox creation and cleanup for each execution
- ⏱️ **Timeout Protection** - Configurable execution timeout (default: 30s, max: 300s)
- 🛠️ **Structured Output** - Comprehensive results including stdout, stderr, exit code, and execution time
- 🛡️ **Error Handling** - Detailed error messages with troubleshooting suggestions and solutions

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

### sandock_run_code

Execute code in an isolated sandbox environment.

This tool handles the complete lifecycle:
1. Creates a new ephemeral sandbox
2. Executes the provided code using the `/code` endpoint
3. Returns comprehensive results (stdout, stderr, exit code, execution time)
4. Automatically cleans up the sandbox after execution

**Parameters:**
- `language` (string, required) - Programming language: `"javascript"`, `"typescript"`, or `"python"`
- `code` (string, required) - Code to execute
- `timeout` (number, optional) - Execution timeout in seconds (default: `30`, max: `300`)

**Returns:**
- `success` (boolean) - Whether execution succeeded (exit code was 0)
- `language` (string) - Programming language used
- `exitCode` (number) - Process exit code
- `stdout` (string) - Standard output
- `stderr` (string) - Standard error
- `timedOut` (boolean) - Whether execution timed out
- `durationMs` (number) - Execution duration in milliseconds
- `sandboxId` (string) - ID of the sandbox used (for debugging)
- `executionFailed` (boolean, optional) - Present if exit code is non-zero
- `timeout` (boolean, optional) - Present if execution timed out
- `troubleshooting` (array, optional) - Suggested troubleshooting steps on failure

**Error Response** (on API/network issues):
- `success` (false)
- `errorType` (string) - Type of error: `CONFIGURATION_ERROR`, `AUTHENTICATION_ERROR`, `RATE_LIMIT_ERROR`, `SERVICE_UNAVAILABLE`, `INVALID_REQUEST`, `CODE_EXECUTION_FAILED`, `SANDBOX_NOT_FOUND`, `EXECUTION_TIMEOUT`, `REQUEST_TOO_LARGE`, `INVALID_CODE`, `PERMISSION_DENIED`, or `INTERNAL_ERROR`
- `error` (string) - Brief error description
- `message` (string) - Detailed error message
- `details` (object) - Error context (status code, API URL, error message preview, etc.)
- `solutions` (array) - Suggested solutions to resolve the issue
- `documentation` (string, optional) - Link to relevant documentation

**Examples:**

JavaScript:
```typescript
{
  "language": "javascript",
  "code": "console.log('Hello from JavaScript!');\nconst result = 2 + 2;\nconsole.log(`2 + 2 = ${result}`);",
  "timeout": 30
}
```

Python:
```typescript
{
  "language": "python",
  "code": "print('Hello from Python!')\nimport sys\nprint(f'Python {sys.version}')\nresult = sum([1, 2, 3, 4, 5])\nprint(f'Sum: {result}')",
  "timeout": 30
}
```

TypeScript:
```typescript
{
  "language": "typescript",
  "code": "interface Person {\n  name: string;\n  age: number;\n}\n\nconst person: Person = { name: 'Alice', age: 30 };\nconsole.log(`${person.name} is ${person.age} years old`);",
  "timeout": 30
}
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
