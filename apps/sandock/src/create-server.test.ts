// Hermetic test env (SANDBOX_PROVIDER=LOCAL, PG_DATABASE_URL=pglite://memory://) is injected by
// vitest.config.ts `test.env`, which applies BEFORE this module graph is evaluated. sandock-core
// captures SANDBOX_PROVIDER in a module-level const at import time and reads PG_DATABASE_URL lazily
// on first db use, so setting it inline here (after the ESM-hoisted imports) would be too late.
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSandboxOpenServer } from "./create-server";

interface Envelope<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
}

let server: Server;
let base: string;

async function readEnvelope<T>(res: Response): Promise<Envelope<T>> {
  return (await res.json()) as Envelope<T>;
}

/** POST helper with JSON body. */
function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Fetch a single sandbox's status from the `list` endpoint (base contract has no `get`). */
async function statusOf(id: string): Promise<string | undefined> {
  const res = await fetch(`${base}/api/v1/sandbox`);
  const body = await readEnvelope<{ items: Array<{ id: string; status: string }> }>(res);
  return body.data.items.find((s) => s.id === id)?.status;
}

/** Poll `list` until the sandbox reaches `status`; throw (never hang) on timeout. */
async function waitForStatus(
  id: string,
  status: string,
  timeoutMs = 15_000,
  intervalMs = 300,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: string | undefined;
  while (Date.now() < deadline) {
    last = await statusOf(id);
    if (last === status) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Sandbox ${id} did not reach ${status} within ${timeoutMs}ms (last status: ${last ?? "<absent>"})`,
  );
}

/** Poll list until the sandbox reaches RUNNING (LOCAL may transition after start). */
const waitForRunning = (id: string, timeoutMs = 15_000, intervalMs = 300): Promise<void> =>
  waitForStatus(id, "RUNNING", timeoutMs, intervalMs);

/** Create a sandbox and return its id (minimal valid body). */
async function createSandbox(title: string): Promise<string> {
  const res = await postJson("/api/v1/sandbox", { title });
  expect(res.status).toBe(200);
  const body = await readEnvelope<{ id: string }>(res);
  expect(body.success).toBe(true);
  return body.data.id;
}

/** Delete a sandbox (self-cleanup); tolerant of already-gone sandboxes. */
async function deleteSandbox(id: string): Promise<void> {
  await fetch(`${base}/api/v1/sandbox/${id}`, { method: "DELETE" }).catch(() => {});
}

beforeAll(async () => {
  server = createSandboxOpenServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("sandock server (real HTTP)", () => {
  it("drives the full sandbox lifecycle over HTTP transport", async () => {
    // ── a. create ──────────────────────────────────────────────────────────────────────────
    // CreateSandboxInputSchema is fully optional (`.partial()`); a `title` is a minimal valid body.
    const createRes = await postJson("/api/v1/sandbox", { title: "e2e-sandock-open" });
    expect(createRes.status).toBe(200);
    const created = await readEnvelope<{ id: string }>(createRes);
    expect(created.success).toBe(true);
    expect(typeof created.data.id).toBe("string");
    const id = created.data.id;

    // ── b. start → RUNNING ───────────────────────────────────────────────────────────────────
    const startRes = await postJson(`/api/v1/sandbox/${id}/start`);
    expect(startRes.status).toBe(200);
    const started = await readEnvelope<{ id: string; started: boolean }>(startRes);
    expect(started.success).toBe(true);
    expect(started.data.started).toBe(true);
    // The base contract has no `get`, so poll `list` for status (fails loudly on timeout).
    await waitForRunning(id);

    // ── c. runCode ───────────────────────────────────────────────────────────────────────────
    const codeRes = await postJson(`/api/v1/sandbox/${id}/code`, {
      language: "javascript",
      code: "console.log(40+2)",
    });
    expect(codeRes.status).toBe(200);
    const codeBody = await readEnvelope<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timedOut: boolean;
      durationMs: number;
    }>(codeRes);
    expect(codeBody.success).toBe(true);
    expect(codeBody.data.stdout).toContain("42");
    expect(codeBody.data.exitCode).toBe(0);

    // ── d. writeFile ─────────────────────────────────────────────────────────────────────────
    const writeRes = await postJson(`/api/v1/sandbox/${id}/fs/write`, {
      path: "demo/hello.txt",
      content: "hello-sandock-open",
    });
    expect(writeRes.status).toBe(200);
    const writeBody = await readEnvelope<boolean>(writeRes);
    expect(writeBody.success).toBe(true);
    expect(writeBody.data).toBe(true);

    // ── e. readFile (round-trips the written content) ────────────────────────────────────────
    const readRes = await fetch(
      `${base}/api/v1/sandbox/${id}/fs/read?path=${encodeURIComponent("demo/hello.txt")}`,
    );
    expect(readRes.status).toBe(200);
    const readBody = await readEnvelope<{ path: string; content: string }>(readRes);
    expect(readBody.success).toBe(true);
    expect(readBody.data.content).toBe("hello-sandock-open");

    // ── f. listFiles ─────────────────────────────────────────────────────────────────────────
    const listRes = await fetch(
      `${base}/api/v1/sandbox/${id}/fs/list?path=${encodeURIComponent("demo")}`,
    );
    expect(listRes.status).toBe(200);
    const listBody = await readEnvelope<{ path: string; entries: string[] }>(listRes);
    expect(listBody.success).toBe(true);
    expect(listBody.data.entries).toContain("hello.txt");

    // ── g. removeFile — #5324 REGRESSION GUARD ───────────────────────────────────────────────
    // `path` is a QUERY param (the contract marks removeFile `inputStructure: "detailed"`). The
    // #5324 regression was oRPC's default "compact" mode putting a DELETE's fields in the request
    // BODY instead of the query string. Driving this over REAL HTTP (query string, no body) is the
    // only way to catch that transport-level bug — calling the handler directly would not.
    const removeRes = await fetch(
      `${base}/api/v1/sandbox/${id}/fs?path=${encodeURIComponent("demo/hello.txt")}`,
      { method: "DELETE" },
    );
    expect(removeRes.status).toBe(200);
    const removeBody = await readEnvelope<boolean>(removeRes);
    expect(removeBody.success).toBe(true);
    expect(removeBody.data).toBe(true);

    // The file is really gone: reading it now errors (non-2xx; not the success envelope).
    const readGoneRes = await fetch(
      `${base}/api/v1/sandbox/${id}/fs/read?path=${encodeURIComponent("demo/hello.txt")}`,
    );
    expect(readGoneRes.ok).toBe(false);
    expect(readGoneRes.status).toBeGreaterThanOrEqual(400);

    // ── h. delete (self-cleanup) ─────────────────────────────────────────────────────────────
    const deleteRes = await fetch(`${base}/api/v1/sandbox/${id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);
    const deleteBody = await readEnvelope<{ id: string; deleted: boolean }>(deleteRes);
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.data.deleted).toBe(true);

    // The deleted sandbox no longer appears in list.
    const afterRes = await fetch(`${base}/api/v1/sandbox`);
    const afterBody = await readEnvelope<{ items: Array<{ id: string; status: string }> }>(
      afterRes,
    );
    expect(afterBody.data.items.some((s) => s.id === id)).toBe(false);
  });

  it("drives stop → pause → resume → stop and reflects each status in `list`", async () => {
    // Fresh sandbox: pause requires a clean RUNNING starting state (manager throws otherwise).
    const id = await createSandbox("e2e-lifecycle");
    try {
      // start → RUNNING
      const startRes = await postJson(`/api/v1/sandbox/${id}/start`);
      expect(startRes.status).toBe(200);
      await waitForStatus(id, "RUNNING");

      // pause → PAUSED (opPause returns { id, status:"PAUSED", paused:true }).
      const pauseRes = await postJson(`/api/v1/sandbox/${id}/pause`);
      expect(pauseRes.status).toBe(200);
      const paused = await readEnvelope<{ id: string; status: string; paused: boolean }>(pauseRes);
      expect(paused.success).toBe(true);
      expect(paused.data.paused).toBe(true);
      expect(paused.data.status).toBe("PAUSED");
      await waitForStatus(id, "PAUSED");

      // resume → RUNNING (opResume returns { id, status:"RUNNING", resumed:true }).
      const resumeRes = await postJson(`/api/v1/sandbox/${id}/resume`);
      expect(resumeRes.status).toBe(200);
      const resumed = await readEnvelope<{ id: string; status: string; resumed: boolean }>(
        resumeRes,
      );
      expect(resumed.success).toBe(true);
      expect(resumed.data.resumed).toBe(true);
      expect(resumed.data.status).toBe("RUNNING");
      await waitForStatus(id, "RUNNING");

      // stop → STOPPED (opStop returns { id, stopped:true }; status confirmed via list).
      const stopRes = await postJson(`/api/v1/sandbox/${id}/stop`);
      expect(stopRes.status).toBe(200);
      const stopped = await readEnvelope<{ id: string; stopped: boolean }>(stopRes);
      expect(stopped.success).toBe(true);
      expect(stopped.data.stopped).toBe(true);
      await waitForStatus(id, "STOPPED");
    } finally {
      await deleteSandbox(id);
    }
  });

  it("runs a shell command and returns a success execution envelope", async () => {
    const id = await createSandbox("e2e-shell");
    try {
      await postJson(`/api/v1/sandbox/${id}/start`);
      await waitForRunning(id);

      // ShellInputSchema: `cmd` is a string | string[]; a trivial echo is enough.
      const res = await postJson(`/api/v1/sandbox/${id}/shell`, { cmd: "echo hello-shell" });
      expect(res.status).toBe(200);
      const body = await readEnvelope<{
        stdout: string;
        stderr: string;
        exitCode: number | null;
        timedOut: boolean;
        durationMs: number;
      }>(res);
      expect(body.success).toBe(true);
      expect(body.data.stdout).toContain("hello-shell");
      expect(body.data.exitCode).toBe(0);
      expect(body.data.timedOut).toBe(false);
    } finally {
      await deleteSandbox(id);
    }
  });

  it("runs Python code and returns stdout + exit code 0", async () => {
    const id = await createSandbox("e2e-python");
    try {
      await postJson(`/api/v1/sandbox/${id}/start`);
      await waitForRunning(id);

      const res = await postJson(`/api/v1/sandbox/${id}/code`, {
        language: "python",
        code: "print(6*7)",
      });
      expect(res.status).toBe(200);
      const body = await readEnvelope<{ stdout: string; exitCode: number | null }>(res);
      expect(body.success).toBe(true);
      expect(body.data.stdout).toContain("42");
      expect(body.data.exitCode).toBe(0);
    } finally {
      await deleteSandbox(id);
    }
  });

  it("rejects a lifecycle op on a non-existent sandbox (500 oRPC error, not the success envelope)", async () => {
    // The op reaches `manager.get(id)`, which throws a plain Error("Sandbox not found"); oRPC maps a
    // non-ORPCError to a 500 INTERNAL_SERVER_ERROR with its own error shape (NOT `{success,...}`).
    const res = await postJson("/api/v1/sandbox/does-not-exist/start");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      defined?: boolean;
      code?: string;
      status?: number;
      success?: boolean;
    };
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.status).toBe(500);
    // It is the oRPC error shape, not a success envelope.
    expect(body.success).toBeUndefined();

    // A filesystem read on a non-existent sandbox behaves the same way.
    const readRes = await fetch(
      `${base}/api/v1/sandbox/does-not-exist/fs/read?path=${encodeURIComponent("a.txt")}`,
    );
    expect(readRes.status).toBe(500);
    const readBody = (await readRes.json()) as { code?: string };
    expect(readBody.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("rejects invalid request bodies with a 400 validation error", async () => {
    // (a) create with a wrong-typed field (`title` must be a string).
    const createRes = await postJson("/api/v1/sandbox", { title: 123 });
    expect(createRes.status).toBe(400);
    const createBody = (await createRes.json()) as {
      code?: string;
      status?: number;
      message?: string;
    };
    expect(createBody.code).toBe("BAD_REQUEST");
    expect(createBody.status).toBe(400);

    // (b) runCode with an invalid `language` enum value on a real sandbox.
    const id = await createSandbox("e2e-invalid-body");
    try {
      const res = await postJson(`/api/v1/sandbox/${id}/code`, { language: "klingon", code: "x" });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code?: string; status?: number };
      expect(body.code).toBe("BAD_REQUEST");
      expect(body.status).toBe(400);
    } finally {
      await deleteSandbox(id);
    }
  });

  it("serves an OpenAPI spec that documents removeFile's `path` as a query param (#5324)", async () => {
    const res = await fetch(`${base}/api/v1/openapi.json`);
    expect(res.status).toBe(200);
    const spec = (await res.json()) as {
      openapi?: string;
      paths?: Record<
        string,
        Record<string, { parameters?: Array<{ name: string; in: string }>; requestBody?: unknown }>
      >;
    };

    expect(spec.openapi).toBeTruthy();
    expect(spec.paths).toBeDefined();
    const paths = spec.paths ?? {};
    // Base paths exist.
    expect(paths["/api/v1/sandbox"]).toBeDefined();
    expect(paths["/api/v1/sandbox/{id}/fs"]).toBeDefined();

    // The openapi-doc side of the #5324 guard: removeFile's DELETE documents `path` as a QUERY
    // parameter (not a requestBody).
    const removeOp = paths["/api/v1/sandbox/{id}/fs"].delete;
    expect(removeOp).toBeDefined();
    const pathParam = removeOp.parameters?.find((p) => p.name === "path");
    expect(pathParam).toBeDefined();
    expect(pathParam?.in).toBe("query");
    expect(removeOp.requestBody).toBeUndefined();
  });

  it("returns the 404 envelope for an unknown path", async () => {
    const res = await fetch(`${base}/api/v1/nope`);
    expect(res.status).toBe(404);
    const body = await readEnvelope<Record<string, never>>(res);
    expect(body.success).toBe(false);
    expect(body.code).toBe(404);
  });
});
