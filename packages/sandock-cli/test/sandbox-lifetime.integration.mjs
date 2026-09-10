import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Exercise the built CLI and real SDK across an HTTP boundary, with isolated config.
test("CLI sends lifetime options without inventing a space or dropping zero", async () => {
  const configDirectory = await mkdtemp(join(tmpdir(), "sandock-cli-lifetime-"));
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, body: JSON.parse(body) });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ success: true, data: { id: "sb_lifetime_test" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const cliPath = fileURLToPath(new URL("../dist/bin/run.js", import.meta.url));
  const invoke = (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cliPath, ...args], {
        env: {
          ...process.env,
          XDG_CONFIG_HOME: configDirectory,
          SANDOCK_SPACE_ID: "must-not-be-used",
          NO_COLOR: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, output }));
    });
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await invoke(["config", "--set-url", endpoint])).code, 0);
    for (const command of [
      ["sandbox", "create", "--image", "node:24.18.0"],
      ["run", "node:24.18.0"],
    ]) {
      const result = await invoke([
        ...command,
        "--active-deadline-seconds",
        "3600",
        "--auto-delete-interval",
        "0",
      ]);
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, /sb_lifetime_test/);
      assert.deepEqual(requests.at(-1), {
        method: "POST",
        url: "/api/v1/sandbox",
        body: { image: "node:24.18.0", activeDeadlineSeconds: 3600, autoDeleteInterval: 0 },
      });
      const defaults = await invoke(command);
      assert.equal(defaults.code, 0, defaults.output);
      assert.deepEqual(requests.at(-1).body, { image: "node:24.18.0" });
      const disable = await invoke([...command, "--auto-delete-interval=-1"]);
      assert.equal(disable.code, 0, disable.output);
      assert.equal(requests.at(-1).body.autoDeleteInterval, -1);
      for (const invalid of [
        ["--active-deadline-seconds", "0"],
        ["--active-deadline-seconds", "86401"],
        ["--active-deadline-seconds", "1.5"],
        ["--auto-delete-interval=-2"],
      ]) {
        const before = requests.length;
        const rejected = await invoke([...command, ...invalid]);
        assert.notEqual(rejected.code, 0, rejected.output);
        assert.equal(requests.length, before, "invalid flags must not create a sandbox");
      }
    }
    const explicit = await invoke([
      "sandbox",
      "create",
      "--image",
      "node:24.18.0",
      "--space",
      "chosen-space",
      "--active-deadline-seconds",
      "86400",
    ]);
    assert.equal(explicit.code, 0, explicit.output);
    assert.equal(requests.at(-1).body.spaceId, "chosen-space");
    assert.equal(requests.at(-1).body.activeDeadlineSeconds, 86400);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(configDirectory, { recursive: true, force: true });
  }
});
