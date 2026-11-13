// Portable project commands. Python activation and Unix-only shell tools are
// deliberately avoided so contributors can use the same commands on Windows.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engine = path.join(root, "engine", "python");
const venv = path.join(engine, ".venv");
const venvPython = process.platform === "win32"
  ? path.join(venv, "Scripts", "python.exe")
  : path.join(venv, "bin", "python");

// Pass arguments as an array: paths containing spaces remain single arguments.
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status ?? result.signal}).`);
}

function pythonVersion(candidate) {
  const result = spawnSync(candidate.command, [...candidate.args, "-c",
    "import json,sys; print(json.dumps(list(sys.version_info[:3])))"], { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  try { return JSON.parse(result.stdout.trim()); } catch { return null; }
}

function supportedPython(version) {
  return version?.[0] === 3 && [11, 12].includes(version[1]);
}

function findPython(preferVenv = true) {
  const candidates = [];
  if (process.env.SPEED_TRAP_PYTHON_BIN) {
    const override = { command: process.env.SPEED_TRAP_PYTHON_BIN, args: [] };
    if (!supportedPython(pythonVersion(override))) {
      throw new Error("SPEED_TRAP_PYTHON_BIN must select Python 3.11 or 3.12.");
    }
    return override;
  }
  if (preferVenv && fs.existsSync(venvPython)) candidates.push({ command: venvPython, args: [] });
  if (process.platform === "win32") {
    candidates.push({ command: "py", args: ["-3.12"] }, { command: "py", args: ["-3.11"] });
  }
  for (const command of ["python3.12", "python3.11", "python3", "python"]) {
    candidates.push({ command, args: [] });
  }
  const candidate = candidates.find((item) => supportedPython(pythonVersion(item)));
  if (!candidate) throw new Error("Install Python 3.11 or 3.12 and put it on PATH. See CONTRIBUTING.md.");
  return candidate;
}

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    throw new Error("Node.js 22.13 or newer is required for the API's built-in SQLite support.");
  }
  console.log(`Node.js ${process.versions.node}`);
}

function checkExecutable(command) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`Install ${command} and put it on PATH. See CONTRIBUTING.md.`);
  }
  console.log(result.stdout.split(/\r?\n/)[0]);
}

function doctor(selectedPython) {
  // Report all missing prerequisites together instead of stopping at the first.
  const problems = [];
  for (const check of [checkNode, () => checkExecutable("ffmpeg"), () => checkExecutable("ffprobe")]) {
    try { check(); } catch (error) { problems.push(error.message); }
  }
  try {
    const python = selectedPython ?? findPython();
    console.log(`Python ${pythonVersion(python).join(".")} (${python.command})`);
    const probe = [
      "import importlib,json",
      "missing=[]",
      "for name in ['ultralytics','cv2','numpy','yaml','pandas','lap','torch']:",
      "    try: importlib.import_module(name)",
      "    except Exception as exc: missing.append(name+': '+str(exc))",
      "print(json.dumps(missing))",
    ].join("\n");
    const result = spawnSync(python.command, [...python.args, "-c", probe], { encoding: "utf8" });
    if (result.status !== 0) throw new Error("Python dependency check failed. Run pnpm run setup:engine.");
    const missing = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
    if (missing.length) throw new Error(`Python imports failed: ${missing.join("; ")}. Run pnpm run setup:engine.`);
    console.log("Python engine dependencies import successfully.");
  } catch (error) { problems.push(error.message); }
  if (!fs.existsSync(path.join(root, "apps", "api", "node_modules", "express"))) {
    problems.push("JavaScript dependencies are missing. Run pnpm install --frozen-lockfile.");
  }
  if (problems.length) throw new Error(problems.join("\n"));
  console.log("Environment ready. Calibrate your own recording before estimating speed.");
}

function setup() {
  checkNode();
  checkExecutable("ffmpeg");
  checkExecutable("ffprobe");
  if (!fs.existsSync(venvPython)) {
    const python = findPython(false);
    run(python.command, [...python.args, "-m", "venv", venv]);
  }
  if (!supportedPython(pythonVersion({ command: venvPython, args: [] }))) {
    throw new Error("The existing engine/python/.venv must use Python 3.11 or 3.12.");
  }
  run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
  run(venvPython, ["-m", "pip", "install", "-r", path.join(engine, "requirements.txt")]);
  // Check the environment that setup installed, even if an override selected
  // the Python executable used to create it.
  doctor({ command: venvPython, args: [] });
}

function test() {
  const python = findPython();
  run(python.command, [...python.args, "-m", "unittest", "discover", "-s", "tests", "-v"], engine);
}

function offline(args) {
  const [input, scene] = args.filter((arg) => arg !== "--");
  if (!input) throw new Error("Usage: pnpm run process:video path/to/video.mp4 [path/to/camera.yaml]");
  const source = path.resolve(root, input);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error("Input video does not exist.");
  const config = path.resolve(root, scene ?? process.env.SPEED_TRAP_CAMERA_CONFIG ?? "engine/python/configs/camera.default.yaml");
  if (!fs.existsSync(config)) throw new Error("Camera configuration does not exist.");
  const output = path.join(root, "data", "output", `manual_${Date.now()}`);
  const python = findPython();
  run(python.command, [...python.args, path.join(engine, "run_pipeline.py"), "--input", source,
    "--config", config, "--out", output], engine);
  console.log(`Artifacts: ${output}`);
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === "doctor") doctor();
  else if (command === "setup") setup();
  else if (command === "test") test();
  else if (command === "process") offline(args);
  else throw new Error("Use pnpm run doctor, pnpm run setup:engine, pnpm test:engine, or pnpm run process:video.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
