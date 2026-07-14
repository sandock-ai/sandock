# Sandock

Headless, single-tenant sandbox execution service — OpenAPI only, no auth, no UI.

Sandock runs code and shell commands inside isolated sandboxes and exposes lifecycle,
exec, and filesystem operations over a plain REST/OpenAPI surface. This app is the
open-core server: a thin oRPC glue layer over [`sandock-core`](../../packages/sandock-core)
(the provider-agnostic sandbox execution engine), backed by its own PGLite database and a
fixed local actor — no multi-tenant auth, billing, or UI. It's meant to be self-hosted.

## Requirements

- Node.js >= 24.18
- pnpm >= 9 (this app lives in the [kapps](../../) pnpm workspace)

## Running locally

From the repository root:

```bash
pnpm --filter sandock-server dev
```

This starts the server on `http://localhost:3070` (override with `PORT`). By default it
uses the `LOCAL` sandbox provider (no Docker/Kubernetes required) and a PGLite database
file under `.data/`.

Copy `.env.example` to `.env` to customize the database location:

```bash
cp .env.example .env
```

Other scripts (run from `apps/sandock/`):

```bash
pnpm start         # run the built server (same entrypoint as dev, no watch)
pnpm test          # run the vitest suite (real HTTP against an in-memory PGLite db)
pnpm typecheck      # tsc --noEmit
pnpm db:generate    # generate a new Drizzle migration from src/db/schema.ts
pnpm db:migrate     # apply migrations to PG_DATABASE_URL
```

## API

Once running, the server exposes:

- `GET /api/v1/openapi.json` — OpenAPI 3.0 spec
- `GET /api/v1/doc` — Swagger UI

Sandbox lifecycle, code/shell execution, and filesystem endpoints (all under `/api/v1`):

| Method | Path                       | Purpose                  |
| ------ | -------------------------- | ------------------------- |
| POST   | `/sandbox`                 | Create a sandbox          |
| GET    | `/sandbox`                 | List sandboxes            |
| POST   | `/sandbox/{id}/start`      | Start a sandbox           |
| POST   | `/sandbox/{id}/stop`       | Stop a sandbox            |
| POST   | `/sandbox/{id}/pause`      | Pause a sandbox           |
| POST   | `/sandbox/{id}/resume`     | Resume a sandbox          |
| DELETE | `/sandbox/{id}`            | Delete a sandbox          |
| POST   | `/sandbox/{id}/code`       | Run code                  |
| POST   | `/sandbox/{id}/shell`      | Run a shell command       |
| POST   | `/sandbox/{id}/fs/write`   | Write a file              |
| GET    | `/sandbox/{id}/fs/read`    | Read a file               |
| GET    | `/sandbox/{id}/fs/list`    | List a directory          |
| DELETE | `/sandbox/{id}/fs`         | Delete a file (`?path=`)  |

The full contract lives in [`packages/sandock-contract`](../../packages/sandock-contract).

## Running with Docker

Build and run from the repository root (the Dockerfile needs the monorepo's
lockfile and `packages/sandock-core` + `packages/sandock-contract` as build context):

```bash
docker build -f apps/sandock/Dockerfile -t sandock .
docker run -d -p 3070:3070 -v sandock-data:/data --name sandock sandock
```

This uses the zero-setup default: a PGLite database persisted under the `/data`
volume. Point at a real Postgres instead:

```bash
docker run -d -p 3070:3070 -e PG_DATABASE_URL=postgresql://user:pass@host:5432/db --name sandock sandock
```

`python3` is included in the image for the `python` language in `POST /sandbox/{id}/code`
(`javascript`/`typescript` run via the image's own Node.js). The container publishes a
`HEALTHCHECK` against `GET /api/v1/openapi.json`.

## Configuration

| Env var           | Default                    | Purpose                                             |
| ------------------ | --------------------------- | ---------------------------------------------------- |
| `PORT`              | `3070`                      | HTTP listen port                                     |
| `PG_DATABASE_URL`   | `pglite://.data/sandock`    | Database connection (PGLite by default; Postgres via `postgresql://...`) |
| `SANDBOX_PROVIDER`  | `LOCAL`                     | Sandbox execution backend (`LOCAL`/`DOCKER`/`KUBERNETES`, see `sandock-core`) |

## License

MIT — see [LICENSE](./LICENSE).
