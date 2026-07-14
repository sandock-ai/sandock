// The real `server-only` package throws when imported outside a React Server Component graph.
// sandock-core/db does `import "server-only"`; the integration test drives it in plain Node over
// real HTTP, so alias `server-only` to this no-op (see vitest.config.ts). Matches the pattern in
// packages/busabase-core and apps/productready.
export {};
