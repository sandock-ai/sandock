# Sandock (open-source) Dockerfile — headless, single-tenant sandbox execution
# service. No Next.js build step: runs `pnpm start` (tsx) directly, same as local
# dev. `docker run` this without a monorepo checkout to self-host it standalone.

FROM node:24.18.0-bookworm-slim AS base
ENV PNPM_HOME=/root/.local/share/pnpm \
    PATH=/root/.local/share/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ---- deps (lockfile fetch -> offline install) ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
RUN pnpm fetch

COPY apps/sandock/package.json apps/sandock/
COPY packages/sandock-core/package.json packages/sandock-core/
COPY packages/sandock-contract/package.json packages/sandock-contract/
COPY packages/openlib/package.json packages/openlib/
RUN pnpm install --offline --frozen-lockfile --ignore-scripts

COPY apps/sandock apps/sandock
COPY packages/sandock-core packages/sandock-core
COPY packages/sandock-contract packages/sandock-contract
COPY packages/openlib packages/openlib

# ---- runtime ----
FROM node:24.18.0-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3070 \
    NODE_OPTIONS=--conditions=react-server \
    # Zero-setup default: PGLite under the mounted /data volume. Point at a real
    # Postgres instead with -e PG_DATABASE_URL=postgresql://... at run time.
    PG_DATABASE_URL=pglite:///data/sandock \
    # The non-root `sandock` user below has no writable $HOME, but corepack's
    # `pnpm` shim needs a cache dir to verify/fetch the pinned package manager
    # version at container start — point it at a path already under /app,
    # which is chown'd to sandock by the COPY below.
    COREPACK_HOME=/app/.corepack-cache
WORKDIR /app
RUN corepack enable \
    # python3: the LOCAL provider's `runCode` shells out to `python3 <file>` for
    # python snippets (see packages/sandock-core/src/sandbox-provider/local.ts);
    # javascript/typescript already work via this image's own node/tsx.
    && apt-get update && apt-get install -y --no-install-recommends curl ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -u 1001 sandock && mkdir -p /data && chown sandock:sandock /data

COPY --chown=sandock:sandock --from=deps /app ./
# COPY --chown only chowns what it copies in, not the pre-existing /app mount
# point itself (created by WORKDIR while still root) — corepack needs to mkdir
# COREPACK_HOME directly under it, so fix that one directory (non-recursive;
# a `-R` over the whole node_modules tree here is a multi-minute no-op cost).
RUN chown sandock:sandock /app
USER sandock

# Persist the database across restarts.
VOLUME /data

WORKDIR /app/apps/sandock
EXPOSE 3070
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3070/api/v1/openapi.json || exit 1

CMD ["pnpm", "start"]
