const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");

test("compiler endpoint structure is available", async () => {
  const port = 3187;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: require("node:path").join(__dirname, ".."),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore"
  });

  await new Promise((resolve, reject) => {
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        clearInterval(check);
        res.resume();
        res.statusCode === 200 ? resolve() : reject(new Error("health check failed"));
      }).on("error", () => {
        if (attempts >= 30) {
          clearInterval(check);
          reject(new Error("server did not start"));
        }
      });
    }, 100);
  });

  try {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((res) => res.json());
    assert.equal(health.status, "ok");
    assert.equal(health.compiler, "gcc");

    const compile = await fetch(`http://127.0.0.1:${port}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "#include <stdio.h>\nint main(void){puts(\"Hello\");return 0;}",
        input: ""
      })
    }).then((res) => res.json());
    assert.equal(compile.output, "Hello\n");
    assert.equal(compile.exitCode, 0);
  } finally {
    child.kill("SIGTERM");
  }
});
