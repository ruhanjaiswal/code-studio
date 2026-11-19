const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const compilerRoot = "/tmp/code-studio";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, timeout: 10000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", (error) => resolve({ stdout, stderr: error.message, code: 1 }));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

async function compileAndRun(code, input) {
  if (!code.trim()) return { output: "", error: "Enter C source code first." };
  if (code.length > 100000) return { output: "", error: "Source code is limited to 100 KB." };

  await fsp.mkdir(compilerRoot, { recursive: true, mode: 0o700 });
  const temp = await fsp.mkdtemp(path.join(compilerRoot, "run-"));
  const source = path.join(temp, "main.c");
  const binary = path.join(temp, "main");
  try {
    await fsp.writeFile(source, code);
    const compile = await run("gcc", ["-std=c11", "-Wall", "-Wextra", "-O2", source, "-o", binary]);
    if (compile.code !== 0) {
      return { output: compile.stderr.replaceAll(source, "main.c"), error: "Compilation failed" };
    }

    const result = await new Promise((resolve) => {
      const child = spawn(binary, [], { timeout: 5000 });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => { stdout += data; });
      child.stderr.on("data", (data) => { stderr += data; });
      if (input) child.stdin.write(input);
      child.stdin.end();
      child.on("error", (error) => resolve({ stdout, stderr: error.message, code: 1, timedOut: false }));
      child.on("close", (code, signal) => resolve({
        stdout,
        stderr,
        code: code ?? 1,
        timedOut: signal === "SIGTERM"
      }));
    });

    if (result.timedOut) return { output: result.stdout, error: "Process timed out after 5 seconds." };
    return {
      output: result.stdout + (result.stderr ? (result.stdout ? "\n" : "") + result.stderr : ""),
      exitCode: result.code
    };
  } catch (error) {
    return { output: "", error: error.message };
  } finally {
    await fsp.rm(temp, { recursive: true, force: true });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let file = path.join(root, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const data = await fsp.readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ status: "ok", compiler: "gcc", ready: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/run") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 120000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const { code = "", input = "" } = JSON.parse(body);
        const result = await compileAndRun(code, input);
        res.writeHead(result.error ? 400 : 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON request." }));
      }
    });
    return;
  }
  await serveStatic(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Code Studio running at http://localhost:${port}`);
});
