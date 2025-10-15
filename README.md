
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
});

// Create a sandbox
const { data } = await client.POST("/api/sandbox", {
  body: {
    spaceId: "default",
    name: "my-sandbox",
    image: "node:20",
  },
});

// Execute code
const result = await client.POST("/api/sandbox/{id}/shell", {
  params: { path: { id: data.id } },
  body: {
    cmd: "node -e 'console.log(\"Hello from Sandock!\")'",
  },
});

console.log(result.data);
```

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
