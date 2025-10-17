# Sandock Code Runtime Environment
# Slim image with Python, Node.js, pnpm, tsx, Deno and code-server pre-installed

FROM node:22-bookworm-slim

# Set environment variables
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH:/root/.deno/bin:/usr/local/code-server/bin"
ENV DENO_INSTALL="/root/.deno"
ENV DEBIAN_FRONTEND=noninteractive
ENV CODE_SERVER_VERSION=4.19.1

# Install system dependencies and Python in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3 /usr/bin/python

# Install pnpm using npm
RUN npm install -g pnpm@latest

# Install tsx globally via npm
RUN npm install -g tsx

# Install Deno using official installer
RUN curl -fsSL https://deno.land/install.sh | sh

# Install code-server
RUN curl -fsSL https://code-server.dev/install.sh | sh -s -- --method=standalone --prefix=/usr/local/code-server --version ${CODE_SERVER_VERSION}

# Verify all installations
RUN node --version && \
    npm --version && \
    pnpm --version && \
    tsx --version && \
    python --version && \
    deno --version && \
    code-server --version

# Expose code-server port
EXPOSE 8080

# Set working directory
WORKDIR /workspace

# Create startup script
# Note: code-server runs with --auth none and binds to 0.0.0.0 for development convenience.
# This is consistent with other code-server deployments in this repository.
# For production use, consider adding authentication or using a reverse proxy.
RUN echo '#!/bin/bash\n\
if [ "$START_CODE_SERVER" = "true" ]; then\n\
  echo "Starting code-server on port 8080..."\n\
  code-server --auth none --port 8080 --bind-addr 0.0.0.0 /workspace > /tmp/code-server.log 2>&1 &\n\
  echo "code-server started. Access at http://localhost:8080"\n\
fi\n\
exec "$@"' > /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Set entrypoint and default command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/bin/bash"]
