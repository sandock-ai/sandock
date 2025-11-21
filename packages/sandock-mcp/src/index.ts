#!/usr/bin/env node

/**
 * Sandock MCP Server
 *
 * Model Context Protocol server for Sandock - provides AI agents with tools
 * to work with isolated Docker sandbox environments.
 *
 * This MCP provides tools for:
 * 1. Creating and managing sandboxes
 * 2. Executing Python code and shell commands
 * 3. File operations (write, download)
 * 4. Lifecycle management
 *
 * RECOMMENDED USAGE:
 * - For most code execution: Use sandock_run_code (automatic lifecycle management)
 * - For multi-step workflows: Use sandock_create_sandbox + sandock_shell_exec + sandock_delete_sandbox
 *
 * SANDBOX ENVIRONMENT (seey/sandock-python:latest):
 * - Base: Python 3.11 on Debian Bookworm (standard Linux environment)
 * - Published at: https://hub.docker.com/r/seey/sandock-python
 *
 * Pre-installed Python Packages (can use directly without pip install):
 * - Data: numpy, pandas
 * - HTTP: requests, httpx, beautifulsoup4, lxml
 * - Files: openpyxl (Excel), python-docx (Word), PyPDF2/pypdf (PDF), pillow (Image)
 * - Async: aiohttp, aiofiles
 * - Config: pyyaml, python-dotenv, jsonschema
 * - Utils: chardet, python-dateutil, pytz, ipython
 *
 * Additional packages can be installed with pip or apt-get as needed.
 */

import { FastMCP } from "fastmcp";
import {
  createSandbox,
  createSandboxSchema,
  deleteSandbox,
  deleteSandboxSchema,
  downloadFile,
  downloadFileSchema,
  runCode,
  runCodeSchema,
  shellExec,
  shellExecSchema,
  writeFile,
  writeFileSchema,
} from "./tools/index.js";
import { initializeClient } from "./utils/client.js";

// Initialize Sandock client and context
const context = initializeClient();

// Create FastMCP server
const server = new FastMCP({
  name: "sandock-mcp",
  version: "0.3.1",
});

/**
 * Tool: Run Code (Recommended)
 *
 * Execute Python code in a fresh, temporary sandbox. Each call creates a new sandbox,
 * runs the code, and automatically cleans up. No context is preserved between calls.
 *
 * Use this for simple, self-contained code execution.
 * For multi-step workflows that need to preserve files/state, use sandock_create_sandbox instead.
 *
 * Environment: Python 3.11 on Debian Linux
 * Pre-installed Python packages (no pip install needed):
 * numpy, pandas, requests, httpx, beautifulsoup4, lxml, openpyxl, python-docx,
 * PyPDF2, pypdf, pillow, aiohttp, aiofiles, pyyaml, python-dotenv, chardet, etc.
 */
server.addTool({
  name: "sandock_run_code",
  description:
    "Execute Python code in a fresh, temporary sandbox. Each call creates a NEW sandbox - no context preserved between calls. Best for simple, self-contained tasks. Use print() for output. Auto-cleanup after execution. Environment: Python 3.11 on Debian Linux. Pre-installed packages (no pip install needed): numpy, pandas, requests, httpx, beautifulsoup4, lxml, openpyxl, python-docx, PyPDF2, pypdf, pillow, aiohttp, aiofiles, pyyaml, python-dotenv, chardet, jsonschema, pytz, python-dateutil.",
  parameters: runCodeSchema,
  execute: async (args) => runCode(args, context),
});

/**
 * Tool: Create Sandbox
 *
 * Create a persistent sandbox that preserves context across multiple operations.
 * Use this when you need to download files, install packages, then process them in subsequent steps.
 *
 * Returns a sandboxId for use with sandock_shell_exec, sandock_write_file, sandock_download_file.
 * Must call sandock_delete_sandbox when finished.
 *
 * Environment: Python 3.11 on Debian Linux
 * Pre-installed Python packages (no pip install needed):
 * numpy, pandas, requests, httpx, beautifulsoup4, lxml, openpyxl, python-docx,
 * PyPDF2, pypdf, pillow, aiohttp, aiofiles, pyyaml, python-dotenv, chardet, etc.
 */
server.addTool({
  name: "sandock_create_sandbox",
  description:
    "Create a persistent sandbox that preserves context across multiple commands. Use when you need to: download files and process them, install packages and use them, or run multi-step workflows. Returns sandboxId. Must call sandock_delete_sandbox when done. Environment: Python 3.11 on Debian Linux. Pre-installed packages (no pip install needed): numpy, pandas, requests, httpx, beautifulsoup4, lxml, openpyxl, python-docx, PyPDF2, pypdf, pillow, aiohttp, aiofiles, pyyaml, python-dotenv, chardet, jsonschema, pytz, python-dateutil.",
  parameters: createSandboxSchema,
  execute: async (args) => createSandbox(args, context),
});

/**
 * Tool: Shell Exec
 *
 * Execute shell commands in a persistent sandbox. The sandbox context is preserved -
 * files created, packages installed, and environment changes persist across calls.
 *
 * Requires a sandboxId from sandock_create_sandbox.
 *
 * Environment: Python 3.11 on Debian Linux (standard Linux commands available)
 * Pre-installed Python packages (no pip install needed):
 * numpy, pandas, requests, httpx, beautifulsoup4, lxml, openpyxl, python-docx,
 * PyPDF2, pypdf, pillow, aiohttp, aiofiles, pyyaml, python-dotenv, chardet, etc.
 */
server.addTool({
  name: "sandock_shell_exec",
  description:
    "Execute shell commands in a persistent sandbox. Context is preserved - files, installed packages, and changes persist. Requires sandboxId from sandock_create_sandbox. Environment: Python 3.11 on Debian Linux (standard Linux commands available). Pre-installed Python packages (no pip install needed): numpy, pandas, requests, httpx, beautifulsoup4, lxml, openpyxl, python-docx, PyPDF2, pypdf, pillow, aiohttp, aiofiles, pyyaml, python-dotenv, chardet, jsonschema, pytz, python-dateutil.",
  parameters: shellExecSchema,
  execute: async (args) => shellExec(args, context),
});

/**
 * Tool: Write File
 *
 * Write text content to a file in a persistent sandbox.
 * The file persists and can be used in subsequent operations.
 *
 * Requires a sandboxId from sandock_create_sandbox.
 */
server.addTool({
  name: "sandock_write_file",
  description:
    "Write text content to a file in a persistent sandbox. File persists for later use. Requires sandboxId from sandock_create_sandbox. Use for scripts, config files, text data. For binary files, use sandock_download_file.",
  parameters: writeFileSchema,
  execute: async (args) => writeFile(args, context),
});

/**
 * Tool: Download File
 *
 * Download a file from URL into a persistent sandbox for later processing.
 * File content doesn't pass through the agent, saving tokens. Efficient for large files.
 *
 * Requires a sandboxId from sandock_create_sandbox.
 */
server.addTool({
  name: "sandock_download_file",
  description:
    "Download a file from URL into a persistent sandbox for later processing. File persists and can be processed in subsequent commands. Requires sandboxId from sandock_create_sandbox. Efficient for large files (content doesn't pass through agent).",
  parameters: downloadFileSchema,
  execute: async (args) => downloadFile(args, context),
});

/**
 * Tool: Delete Sandbox
 *
 * Delete a persistent sandbox and free resources.
 * Always call this when finished with a sandbox to prevent resource leaks.
 *
 * Only for sandboxes created with sandock_create_sandbox (sandock_run_code auto-cleans).
 */
server.addTool({
  name: "sandock_delete_sandbox",
  description:
    "Delete a persistent sandbox and free resources. Call when finished with sandboxes created via sandock_create_sandbox. (sandock_run_code auto-cleans, no need to call this).",
  parameters: deleteSandboxSchema,
  execute: async (args) => deleteSandbox(args, context),
});

// Start the MCP server
server.start({
  transportType: "stdio",
});
