# Sandock Code Runtime

A slim Docker image for running Sandock code with pre-installed development tools.

## Included Tools

- **Python 3** - Python runtime
- **Node.js 22** - JavaScript runtime
- **pnpm** - Fast, disk space efficient package manager
- **tsx** - TypeScript execute with Node.js
- **Deno** - Modern JavaScript/TypeScript runtime
- **code-server** - VS Code in the browser (optional, can be started with environment variable)

## Build & Publish

### Build locally
```bash
docker build -t sandock-code:latest .
```

### Build and publish to Docker Hub
```bash
# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 \
  -t <your-dockerhub-username>/sandock-code:latest \
  --push .
```

## Usage

### Basic Usage

#### 1. Run interactively (basic mode)
```bash
docker run -it --rm sandock-code:latest
```

#### 2. Run with volume mount
Mount your local directory to `/workspace` in the container:
```bash
docker run -it --rm -v $(pwd):/workspace sandock-code:latest
```

#### 3. Execute specific commands
Test installed tools:
```bash
# Check tool versions
docker run --rm sandock-code:latest node --version
docker run --rm sandock-code:latest python --version
docker run --rm sandock-code:latest pnpm --version
docker run --rm sandock-code:latest deno --version
```

### code-server Usage (VS Code in Browser)

#### 4. Run with code-server enabled (foreground)
```bash
docker run -it --rm -p 8080:8080 -e START_CODE_SERVER=true sandock-code:latest
```
Then access VS Code at: **http://localhost:8080**

#### 5. Run with code-server + volume mount
```bash
docker run -it --rm -p 8080:8080 -v $(pwd):/workspace -e START_CODE_SERVER=true sandock-code:latest
```

#### 6. Run code-server in background (recommended)
```bash
# Start container in background
docker run -d -p 8080:8080 -v $(pwd):/workspace -e START_CODE_SERVER=true --name sandock-code sandock-code:latest

# View logs
docker logs sandock-code

# Stop container
docker stop sandock-code

# Remove container
docker rm sandock-code
```

### Key Parameters

- **`-p 8080:8080`**: Map code-server port
- **`-e START_CODE_SERVER=true`**: Enable code-server
- **`-v $(pwd):/workspace`**: Mount current directory to container's /workspace
- **`-d`**: Run in background (detached mode)
- **`--name sandock-code`**: Name the container for easy management
- **`--rm`**: Automatically remove container when it exits

### code-server Access

When `START_CODE_SERVER=true` is set:
- code-server will start automatically on port 8080
- Access VS Code interface at `http://localhost:8080`
- No authentication required (for development use)
- Working directory is set to `/workspace`

**Security Note**: code-server runs without authentication and binds to all interfaces (0.0.0.0) for development convenience. For production use, consider:
- Using a reverse proxy with authentication
- Setting up token-based authentication
- Restricting network access to the container

### Test the Image

After building, verify all tools are correctly installed:
```bash
make test
```

This will check: node, pnpm, tsx, python, deno, and code-server.

## Image Size

Based on `node:22-bookworm-slim` for minimal image size while maintaining full functionality.

**Note**: The image includes code-server which adds approximately 150MB to the image size.
