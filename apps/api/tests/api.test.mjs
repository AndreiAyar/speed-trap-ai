// Exercise the compiled HTTP server, a temporary SQLite database, and files
// whose paths contain spaces. These checks run without a model download.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
let child, temporary, inputs, video, outside, base;
let logs = "";
const createdJobs = [];

before(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), "speed-trap-api-"));
  await fs.mkdir(path.join(root, "data", "input"), { recursive: true });
  inputs = await fs.mkdtemp(path.join(root, "data", "input", "api test "));
  video = path.join(inputs, "sample video.mp4");
  outside = path.join(temporary, "outside.mp4");
  // The preview endpoint only streams bytes; decoding is tested by the engine.
  await fs.writeFile(video, Buffer.alloc(256, 7));
  await fs.writeFile(outside, Buffer.alloc(256, 8));

  const reservation = net.createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(root, "apps", "api", "dist", "server.js")], {
    cwd: root,
    env: {
      ...process.env, PORT: String(port), HOST: "127.0.0.1",
      SPEED_TRAP_DB_PATH: path.join(temporary, "jobs.sqlite"),
      SPEED_TRAP_PYTHON_BIN: path.join(temporary, "missing-python"),
      SPEED_TRAP_ALLOWED_ORIGINS: "https://dashboard.example.test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error(`API exited before startup: ${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`API did not start: ${logs}`);
});

after(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  for (const id of createdJobs) await fs.rm(path.join(root, "data", "output", id), { recursive: true, force: true });
  if (inputs) await fs.rm(inputs, { recursive: true, force: true });
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
});

test("health and empty history work from a fresh database", async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).disclaimer, "Doar pentru divertisment. Nu este masurare legala.");
  assert.equal((await (await fetch(`${base}/api/jobs`)).json()).count, 0);
});

test("unknown browser origins cannot create jobs", async () => {
  const response = await fetch(`${base}/api/jobs`, {
    method: "POST", headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType: "file", sourcePath: video }),
  });
  assert.equal(response.status, 403);
  assert.equal((await (await fetch(`${base}/api/jobs`)).json()).count, 0);
  assert.equal((await fetch(`${base}/health`, { headers: { Origin: "http://localhost.evil.test" } })).status, 403);
});

test("local and explicitly configured dashboard origins are allowed", async () => {
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:4173", "https://dashboard.example.test"]) {
    const response = await fetch(`${base}/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  }
});

test("preview streams a range from a repository-relative path containing spaces", async () => {
  const relative = path.relative(root, video);
  const response = await fetch(`${base}/api/local-video?path=${encodeURIComponent(relative)}`, { headers: { Range: "bytes=0-31" } });
  assert.equal(response.status, 206);
  assert.equal((await response.arrayBuffer()).byteLength, 32);
});

test("files outside the repository are rejected for preview and processing", async () => {
  assert.equal((await fetch(`${base}/api/local-video?path=${encodeURIComponent(outside)}`)).status, 400);
  const response = await fetch(`${base}/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType: "file", sourcePath: outside }),
  });
  assert.equal(response.status, 400);
});

test("a symlink cannot expose an outside video", async (context) => {
  const link = path.join(inputs, "outside-link.mp4");
  try { await fs.symlink(outside, link); }
  catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return context.skip("This runner cannot create symlinks.");
    throw error;
  }
  assert.equal((await fetch(`${base}/api/local-video?path=${encodeURIComponent(link)}`)).status, 400);
});

test("invalid JSON fields return a client error instead of creating a job", async () => {
  for (const body of [{}, { sourceType: "file", sourcePath: {} }, { sourceType: "file", sourcePath: "data/input/missing.mp4" }]) {
    const response = await fetch(`${base}/api/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
});

test("a missing Python executable retains an actionable error", async () => {
  const response = await fetch(`${base}/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType: "file", sourcePath: video }),
  });
  assert.equal(response.status, 202);
  const { jobId } = await response.json();
  createdJobs.push(jobId);
  let job;
  for (let attempt = 0; attempt < 50; attempt++) {
    job = await (await fetch(`${base}/api/jobs/${jobId}`)).json();
    if (job.status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(job.status, "failed");
  // Wait for the close event too: it must not overwrite the spawn error.
  await new Promise((resolve) => setTimeout(resolve, 100));
  job = await (await fetch(`${base}/api/jobs/${jobId}`)).json();
  assert.match(job.errorMessage, /Failed to start Python engine/);
});
