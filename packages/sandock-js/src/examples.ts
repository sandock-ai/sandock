/**
 * Usage examples for sandock-js SDK
 */

import { createSandockClient } from "./index";

// Create client (baseUrl should NOT include /api since paths already include it)
const client = createSandockClient({
  baseUrl: "http://localhost:3030",
  headers: {
    // Example: Authorization header if needed
    // Authorization: "Bearer your-api-key",
  },
});

// Example 1: Get meta information
async function getMeta() {
  const { data, error } = await client.GET("/api/v1/meta", {});

  if (error) {
    console.error("Failed to get meta:", error);
    return;
  }

  console.log("API Version:", data.data.version);
  console.log("Timestamp:", data.data.timestamp);
}

// Example 2: Get user by ID
async function getUser(userId: string) {
  const { data, error } = await client.GET("/api/v1/user/{id}", {
    params: {
      path: { id: userId },
    },
  });

  if (error) {
    console.error("Failed to get user:", error);
    return;
  }

  console.log("User:", data.data);
  console.log("Name:", data.data.name);
  console.log("Age:", data.data.age);
}

// Example 3: Create sandbox
async function createSandbox() {
  const { data, error } = await client.POST("/api/v1/sandbox", {
    body: {
      // spaceId is optional - if not provided, uses user's personal space
      image: "node:20-alpine",
      command: ["node", "--version"],
      env: {
        NODE_ENV: "development",
      },
      cpu: 1,
      memory: 512,
    },
  });

  if (error) {
    console.error("Failed to create sandbox:", error);
    return;
  }

  console.log("Sandbox created:", data.data);
  return data.data;
}

// Example 4: Execute code in sandbox
async function executeCode(sandboxId: string, code: string) {
  const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
    params: {
      path: { id: sandboxId },
    },
    body: {
      code,
      language: "javascript",
    },
  });

  if (error) {
    console.error("Failed to execute code:", error);
    return;
  }

  console.log("Execution result:", data.data);
  console.log("stdout:", data.data.stdout);
  console.log("stderr:", data.data.stderr);
  console.log("exitCode:", data.data.exitCode);
}

// Example 4b: Execute code and replay output as stream callbacks
async function executeCodeStreamed(sandboxId: string, code: string) {
  const { data, error } = await client.POST("/api/v1/sandbox/{id}/code", {
    params: {
      path: { id: sandboxId },
    },
    body: {
      code,
      language: "javascript",
    },
  });

  if (error) {
    console.error("Failed to execute code:", error);
    return;
  }

  if (!data) {
    console.error("No data returned from code execution");
    return;
  }

  console.log("Raw execution result:", JSON.stringify(data.data, null, 2));

  // Use streaming instead with callbacks
  console.log("\n--- Streaming example ---");
  await client.sandbox.runCode(
    sandboxId,
    { language: "javascript", code },
    {
      onStdout: (chunk: string) => console.log("[stdout]", chunk),
      onStderr: (chunk: string) => console.error("[stderr]", chunk),
    },
  );
}

// Example 5: Execute shell command
async function executeShell(sandboxId: string, command: string) {
  const { data, error } = await client.POST("/api/v1/sandbox/{id}/shell", {
    params: {
      path: { id: sandboxId },
    },
    body: {
      cmd: command,
    },
  });

  if (error) {
    console.error("Failed to execute shell command:", error);
    return;
  }

  console.log("Command result:", data.data);
}

// Example 6: Write file
async function writeFile(sandboxId: string, path: string, content: string) {
  const { data, error } = await client.POST("/api/v1/sandbox/{id}/fs/write", {
    params: {
      path: { id: sandboxId },
    },
    body: {
      path,
      content,
    },
  });

  if (error) {
    console.error("Failed to write file:", error);
    return;
  }

  console.log("File written:", data.data);
}

// Example 7: Read file
async function readFile(sandboxId: string, filePath: string) {
  const { data, error } = await client.GET("/api/v1/sandbox/{id}/fs/read", {
    params: {
      path: { id: sandboxId },
      query: { path: filePath },
    },
  });

  if (error) {
    console.error("Failed to read file:", error);
    return;
  }

  console.log("File content:", data.data.content);
}

// Example 8: List files
async function listFiles(sandboxId: string, dirPath: string) {
  const { data, error } = await client.GET("/api/v1/sandbox/{id}/fs/list", {
    params: {
      path: { id: sandboxId },
      query: { path: dirPath },
    },
  });

  if (error) {
    console.error("Failed to list files:", error);
    return;
  }

  console.log("Files:", data.data.entries);
}

// Example 9: Stop sandbox
async function stopSandbox(sandboxId: string) {
  const { data, error } = await client.POST("/api/v1/sandbox/{id}/stop", {
    params: {
      path: { id: sandboxId },
    },
  });

  if (error) {
    console.error("Failed to stop sandbox:", error);
    return;
  }

  console.log("Sandbox stopped:", data.data);
}

// Example 10: Delete sandbox
async function deleteSandbox(sandboxId: string) {
  const { data, error } = await client.DELETE("/api/v1/sandbox/{id}/fs", {
    params: {
      path: { id: sandboxId },
      query: { path: "/" },
    },
  });

  if (error) {
    console.error("Failed to delete file:", error);
    return;
  }

  console.log("File deleted:", data.data);
}

// Example 11: With custom headers (authentication)
async function authenticatedRequest() {
  const authenticatedClient = createSandockClient({
    baseUrl: "http://localhost:3030",
    headers: {
      Authorization: "Bearer your-token-here",
      "X-Custom-Header": "custom-value",
    },
  });

  const { data, error } = await authenticatedClient.GET("/api/v1/meta", {});

  if (error) {
    console.error("Failed:", error);
    return;
  }

  console.log("Authenticated request successful:", data.data);
}

// Example 12: Complete workflow
async function completeWorkflow() {
  console.log("=== Complete Sandbox Workflow ===");

  // 1. Create sandbox
  const sandbox = await createSandbox();
  if (!sandbox || !sandbox.id) return;

  const sandboxId = sandbox.id;
  console.log(`\n✅ Created sandbox: ${sandboxId}`);

  // 2. Write a file
  await writeFile(sandboxId, "/hello.js", 'console.log("Hello from Sandock!")');
  console.log("\n✅ Wrote file");

  // 3. Execute code
  await executeCode(sandboxId, 'console.log("Hello World!")');
  console.log("\n✅ Executed code");

  // 4. List files
  await listFiles(sandboxId, "/");
  console.log("\n✅ Listed files");

  // 5. Read file
  await readFile(sandboxId, "/hello.js");
  console.log("\n✅ Read file");

  // 6. Stop sandbox
  await stopSandbox(sandboxId);
  console.log("\n✅ Stopped sandbox");

  console.log("\n=== Workflow complete ===");
}

// Run examples (uncomment to test)
// getMeta()
// getUser('u_12345')
// completeWorkflow()

export {
  getMeta,
  getUser,
  createSandbox,
  executeCode,
  executeCodeStreamed,
  executeShell,
  writeFile,
  readFile,
  listFiles,
  stopSandbox,
  deleteSandbox,
  authenticatedRequest,
  completeWorkflow,
};
