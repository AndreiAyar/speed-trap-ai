// This module runs Python engine jobs and syncs outputs into SQLite.

// Node path utilities help compute stable absolute paths.
import path from "node:path";
import { fileURLToPath } from "node:url";

// Node fs utilities read generated artifacts.
import fs from "node:fs";

// Child process spawn runs Python pipeline from API.
import { spawn } from "node:child_process";

// We import id generator for unique job ids.
import { nanoid } from "nanoid";

// We import contract types for strong typing.
import type { CreateJobRequest, JobRecord, VehicleTrack } from "../types/contracts.js";

// We import DB helpers for persistence.
import { getJob, insertJob, replaceVehicleTracks, updateJob } from "./sqlite.js";

// We compute current file path for stable root resolution.
const currentFilePath = fileURLToPath(import.meta.url);

// We compute current directory from this module file.
const currentDir = path.dirname(currentFilePath);

// We compute workspace root path from source tree location.
const workspaceRoot = path.resolve(currentDir, "../../../../");

// We compute engine script path for child process invocation.
const engineScript = path.join(workspaceRoot, "engine", "python", "run_pipeline.py");

// We compute default camera config path.
const defaultCameraConfig = path.join(workspaceRoot, "engine", "python", "configs", "camera.default.yaml");

// We compute output root folder for job artifacts.
const outputRoot = path.join(workspaceRoot, "data", "output");

// We compute project virtualenv Python path for reliable dependency resolution.
const projectVenvPython = path.join(workspaceRoot, "engine", "python", ".venv", "bin", "python");

// This helper parses summary CSV into typed rows.
function parseSummaryCsv(summaryCsvPath: string): VehicleTrack[] {
  // We return empty array when summary file does not exist.
  if (!fs.existsSync(summaryCsvPath)) {
    return [];
  }

  // We read full CSV text into memory.
  const csv = fs.readFileSync(summaryCsvPath, "utf-8").trim();

  // We return empty array when CSV has no data rows.
  if (!csv) {
    return [];
  }

  // We split file into lines.
  const lines = csv.split(/\r?\n/);

  // We remove and parse header line.
  const header = lines.shift();

  // We guard against malformed file with missing header.
  if (!header) {
    return [];
  }

  // We parse headers to map columns.
  const columns = header.split(",");

  // We convert each row into keyed object and typed output.
  return lines
    .map((line) => {
      // We split row by commas for simple numeric CSV structure.
      const values = line.split(",");

      // We build generic key-value map first.
      const row: Record<string, string> = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx] ?? "";
      });

      // We map raw strings into typed numbers with null safety.
      return {
        trackId: Number(row.trackId),
        classId: Number(row.classId),
        maxSpeedKmh: row.maxSpeedKmh ? Number(row.maxSpeedKmh) : null,
        avgSpeedKmh: row.avgSpeedKmh ? Number(row.avgSpeedKmh) : null,
        firstSeenMs: Number(row.firstSeenMs),
        lastSeenMs: Number(row.lastSeenMs),
        crossedAms: row.crossedAms ? Number(row.crossedAms) : null,
        crossedBms: row.crossedBms ? Number(row.crossedBms) : null,
        numSamples: Number(row.numSamples),
      } as VehicleTrack;
    })
    .filter((row) => Number.isFinite(row.trackId));
}

// This helper starts async job execution and returns initial job record.
export function createAndRunJob(request: CreateJobRequest): JobRecord {
  // We normalize source path to absolute path for engine reliability.
  const normalizedSourcePath = path.isAbsolute(request.sourcePath)
    ? request.sourcePath
    : path.join(workspaceRoot, request.sourcePath);

  // We generate new stable id for this job.
  const id = `job_${nanoid(10)}`;

  // We build output folder path for this job.
  const jobOutputDir = path.join(outputRoot, id);

  // We ensure output folder exists.
  fs.mkdirSync(jobOutputDir, { recursive: true });

  // We create initial job object in queued state.
  const job: JobRecord = {
    id,
    status: "queued",
    sourcePath: normalizedSourcePath,
    progress: 0,
    artifacts: {},
    createdAt: new Date().toISOString(),
  };

  // We insert initial row into database.
  insertJob(job);

  // We run async work without blocking API response.
  void runJobInternal(id, { ...request, sourcePath: normalizedSourcePath }, jobOutputDir);

  // We return initial job response.
  return job;
}

// Internal async runner does state transitions and artifact indexing.
async function runJobInternal(jobId: string, request: CreateJobRequest, jobOutputDir: string): Promise<void> {
  // We fetch latest job row before mutation.
  const current = getJob(jobId);

  // We stop if job row unexpectedly does not exist.
  if (!current) {
    return;
  }

  // We transition job to running state.
  const runningJob: JobRecord = {
    ...current,
    status: "running",
    progress: 15,
  };

  // We persist running transition.
  updateJob(runningJob);

  // We choose config file; currently we map all ids to default config.
  const configPath = defaultCameraConfig;

  // We construct Python CLI arguments.
  const args = [
    engineScript,
    "--input",
    request.sourcePath,
    "--config",
    configPath,
    "--out",
    jobOutputDir,
    "--hide-outside-roi-overlays",
    request.hideOutsideRoiOverlays === false ? "false" : "true",
  ];

  // We select python executable with environment override priority.
  let pythonBin = process.env.SPEED_TRAP_PYTHON_BIN ?? "";

  // We fallback to project virtualenv Python when available.
  if (!pythonBin && fs.existsSync(projectVenvPython)) {
    pythonBin = projectVenvPython;
  }

  // We fallback to system python when no override and no venv are found.
  if (!pythonBin) {
    pythonBin = "python3";
  }

  // We spawn Python pipeline process.
  const child = spawn(pythonBin, args, {
    cwd: path.join(workspaceRoot, "engine", "python"),
    stdio: ["ignore", "pipe", "pipe"],
  });

  // We collect stdout for metadata JSON printed by engine.
  let stdoutData = "";

  // We collect stderr for failure diagnostics.
  let stderrData = "";

  // We append stdout chunks as they arrive.
  child.stdout.on("data", (chunk) => {
    stdoutData += chunk.toString("utf-8");
  });

  // We append stderr chunks as they arrive.
  child.stderr.on("data", (chunk) => {
    stderrData += chunk.toString("utf-8");
  });

  // We wait for process exit and then finalize job state.
  child.on("close", (code) => {
    // We read latest job row for safe update merge.
    const latest = getJob(jobId);

    // We stop if job row is missing.
    if (!latest) {
      return;
    }

    // We handle success path when exit code is zero.
    if (code === 0) {
      // We compute artifact file paths.
      const overlayVideo = path.join(jobOutputDir, "overlay.mp4");
      const summaryCsv = path.join(jobOutputDir, "summary.csv");
      const eventsJsonl = path.join(jobOutputDir, "events.jsonl");
      const metadataJson = path.join(jobOutputDir, "metadata.json");

      // We parse summary CSV and sync vehicle rows into DB.
      const tracks = parseSummaryCsv(summaryCsv);
      replaceVehicleTracks(jobId, tracks);

      // We mark job as done and attach artifact paths.
      const doneJob: JobRecord = {
        ...latest,
        status: "done",
        progress: 100,
        finishedAt: new Date().toISOString(),
        artifacts: {
          overlayVideo,
          summaryCsv,
          eventsJsonl,
          metadataJson,
        },
      };

      // We persist success state.
      updateJob(doneJob);
      return;
    }

    // We mark job as failed with stderr diagnostics.
    const failedJob: JobRecord = {
      ...latest,
      status: "failed",
      progress: 100,
      finishedAt: new Date().toISOString(),
      errorMessage: stderrData.trim() || stdoutData.trim() || "Engine failed with unknown error.",
    };

    // We persist failure state.
    updateJob(failedJob);
  });

  // We also handle process spawn failures (for example invalid python path).
  child.on("error", (error) => {
    // We read latest job row for safe failure update.
    const latest = getJob(jobId);

    // We stop if job row is missing.
    if (!latest) {
      return;
    }

    // We persist explicit spawn failure message.
    updateJob({
      ...latest,
      status: "failed",
      progress: 100,
      finishedAt: new Date().toISOString(),
      errorMessage: `Failed to start Python engine: ${error.message}`,
    });
  });
}
