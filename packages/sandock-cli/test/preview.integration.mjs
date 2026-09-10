import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("CLI generates and revokes a signed Preview through the configured API", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sandock-cli-preview-"));
  const token = "t0123456789abcde";
  const signedUrl = `https://3000-${token}.preview.example`;
  const requests = [];
  let fail = false;
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.writeHead(fail ? 403 : 200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        success: !fail,
        data: request.method === "GET" ? { url: signedUrl } : { revoked: true },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const invoke = (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL("../dist/bin/run.js", import.meta.url)), ...args],
        {
          env: { ...process.env, XDG_CONFIG_HOME: directory, NO_COLOR: "1" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
  try {
    assert.equal(
      (await invoke(["config", "--set-url", `http://127.0.0.1:${server.address().port}`])).code,
      0,
    );
    for (const expiry of [undefined, "60", "86400"]) {
      const generated = await invoke([
        "sandbox",
        "preview",
        "sb_example",
        "--port",
        "3000",
        ...(expiry ? ["--expires-in", expiry] : []),
      ]);
      assert.equal(generated.code, 0, generated.stderr);
      assert.equal(generated.stdout.trim(), signedUrl);
      assert.deepEqual(requests.at(-1), {
        method: "GET",
        url: `/api/v1/sandbox/sb_example/signed-preview-url?port=3000&expiresIn=${expiry ?? "3600"}`,
      });
    }
    const revoked = await invoke(["sandbox", "revoke-preview", "sb_example", token]);
    assert.equal(revoked.code, 0, revoked.stderr);
    assert.deepEqual(requests.at(-1), {
      method: "DELETE",
      url: `/api/v1/sandbox/sb_example/preview-token/${token}`,
    });
    assert.doesNotMatch(revoked.stdout + revoked.stderr, new RegExp(token));
    for (const args of [
      ["preview", "sb_example", "--port", "0"],
      ["preview", "sb_example", "--port", "65536"],
      ["preview", "sb_example", "--port", "3000", "--expires-in", "59"],
      ["preview", "sb_example", "--port", "3000", "--expires-in", "86401"],
      ["revoke-preview", "sb_example", "https://3000-sb_example.preview.example"],
      ["revoke-preview", "sb_example", "file:///tmp/a"],
      ["revoke-preview", "../other", token],
      ["preview", "../other", "--port", "3000"],
    ]) {
      const count = requests.length;
      const result = await invoke(["sandbox", ...args]);
      assert.notEqual(result.code, 0);
      assert.equal(requests.length, count, "invalid input must not reach the API");
    }
    fail = true;
    for (const args of [
      ["preview", "sb_example", "--port", "3000"],
      ["revoke-preview", "sb_example", token],
    ]) {
      const result = await invoke(["sandbox", ...args]);
      assert.notEqual(result.code, 0);
      assert.doesNotMatch(result.stdout + result.stderr, new RegExp(token));
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
