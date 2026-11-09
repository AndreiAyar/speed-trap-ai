// This file defines all job and vehicle routes for the dashboard.

// We import express router helper.
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// We import contracts for request typing.
import type { CreateJobRequest } from "../types/contracts.js";

// We import service that creates and runs engine jobs.
import { createAndRunJob } from "../services/jobRunner.js";

// We import DB readers for status and leaderboard endpoints.
import { deleteJob, getJob, getVehicleTrack, getVehicleTracks, listJobs } from "../services/sqlite.js";

// We create isolated router instance.
export const jobsRouter = Router();

// We compute current file path for stable workspace root resolution.
const currentFilePath = fileURLToPath(import.meta.url);

// We compute current directory from this module file.
const currentDir = path.dirname(currentFilePath);

// We compute workspace root from source tree location.
const workspaceRoot = path.resolve(currentDir, "../../../../");

// We compute output root used for per-job artifact folders.
const outputRoot = path.join(workspaceRoot, "data", "output");

// This helper loads recent events for one track from events JSONL.
function loadTrackEventSamples(eventsPath: string, trackId: number, maxItems: number = 25): Array<Record<string, unknown>> {
  // We return empty list when events file does not exist.
  if (!eventsPath || !fs.existsSync(eventsPath)) {
    return [];
  }

  // We read all lines from JSONL output file.
  const lines = fs.readFileSync(eventsPath, "utf-8").split(/\r?\n/).filter(Boolean);

  // We parse lines and keep only current track rows.
  const rows: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    try {
      // We parse one JSON line.
      const event = JSON.parse(line) as Record<string, unknown>;

      // We keep rows matching selected track id.
      if (Number(event.trackId) === trackId) {
        rows.push(event);
      }
    } catch {
      // We ignore malformed lines to keep endpoint robust.
    }
  }

  // We return only the latest N samples for smaller payloads.
  return rows.slice(-maxItems);
}

// This helper validates local video path before we stream it to the browser.
function resolveSafeVideoPath(inputPath: string): string | null {
  // We trim whitespace to avoid accidental copy/paste issues.
  const trimmedPath = inputPath.trim();

  // We reject empty values immediately.
  if (!trimmedPath) {
    return null;
  }

  // We resolve relative paths from workspace root and keep absolute paths unchanged.
  const candidatePath = path.resolve(workspaceRoot, trimmedPath);

  // Resolve symlinks too, so a link inside the project cannot expose outside files.
  let resolvedPath: string;
  try {
    resolvedPath = fs.realpathSync(candidatePath);
    if (!fs.statSync(resolvedPath).isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  // We only allow files inside workspace root for safety.
  const relativeToRoot = path.relative(workspaceRoot, resolvedPath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  // We require the file to exist on disk.
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  // We require a video-like extension to avoid arbitrary file serving.
  const extension = path.extname(resolvedPath).toLowerCase();
  const allowedExtensions = new Set([".mp4", ".mov", ".m4v", ".webm"]);
  if (!allowedExtensions.has(extension)) {
    return null;
  }

  // We return validated absolute path.
  return resolvedPath;
}

// This helper reads engine metadata JSON when the job already produced it.
function loadJobMetadata(metadataPath: string | undefined): Record<string, unknown> | undefined {
  // We skip when metadata artifact is missing or path is blank.
  if (!metadataPath || !fs.existsSync(metadataPath)) {
    return undefined;
  }

  try {
    // We parse the metadata file into a plain object for API consumers.
    return JSON.parse(fs.readFileSync(metadataPath, "utf-8")) as Record<string, unknown>;
  } catch {
    // We ignore malformed metadata so status endpoint remains robust.
    return undefined;
  }
}

// Route: create new processing job.
jobsRouter.post("/jobs", (req, res) => {
  // We parse request body into typed object.
  const body = (req.body ?? {}) as Partial<CreateJobRequest>;

  // We enforce file source type for MVP.
  if (body.sourceType !== "file") {
    return res.status(400).json({ error: "MVP supports only sourceType='file'." });
  }

  // We ensure source path is present.
  if (typeof body.sourcePath !== "string") {
    return res.status(400).json({ error: "sourcePath must be a video path inside this repository." });
  }

  // Use the same file validation for preview and processing, before creating a job.
  const sourcePath = resolveSafeVideoPath(body.sourcePath);
  if (!sourcePath) {
    return res.status(400).json({ error: "Video not found. Copy it into data/input/ and use its repository-relative path." });
  }

  // We create and queue async job.
  const job = createAndRunJob({ ...body, sourceType: "file", sourcePath });

  // We return accepted response immediately.
  return res.status(202).json({ jobId: job.id, status: job.status });
});

// Route: list recent jobs for refresh-safe dashboard history.
jobsRouter.get("/jobs", (req, res) => {
  // We parse optional query limit and clamp to a safe range.
  const rawLimit = Number(req.query.limit ?? 30);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 30;

  // We fetch recent jobs from SQLite.
  const jobs = listJobs(limit);

  // We return job history payload.
  return res.json({ jobs, count: jobs.length });
});

// Route: stream local workspace video files for calibration preview.
jobsRouter.get("/local-video", (req, res) => {
  // We parse string query parameter from request URL.
  const rawPath = String(req.query.path ?? "");

  // We validate and resolve requested local file path.
  const resolvedPath = resolveSafeVideoPath(rawPath);

  // We reject invalid or unsafe paths.
  if (!resolvedPath) {
    return res.status(400).json({ error: "Invalid local video path." });
  }

  // We set a browser-friendly content type based on file extension.
  const extension = path.extname(resolvedPath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".webm": "video/webm",
  };
  res.type(contentTypeMap[extension] ?? "video/mp4");

  // We stream the file through Express sendFile with range support.
  return res.sendFile(resolvedPath);
});

// Route: delete one job and remove its local artifact files.
jobsRouter.delete("/jobs/:jobId", (req, res) => {
  // We read target job id from URL parameters.
  const { jobId } = req.params;

  // We delete SQLite rows and fetch deleted payload when found.
  const deleted = deleteJob(jobId);

  // We return 404 when job was not found in DB.
  if (!deleted) {
    return res.status(404).json({ error: "Job not found." });
  }

  // We resolve canonical job output folder from job id.
  const jobOutputDir = path.join(outputRoot, jobId);

  // We remove full job artifact folder when present.
  let removedOutputDir = false;
  if (fs.existsSync(jobOutputDir)) {
    fs.rmSync(jobOutputDir, { recursive: true, force: true });
    removedOutputDir = true;
  }

  // We return a compact deletion summary to frontend.
  return res.json({
    deletedJobId: jobId,
    removedOutputDir,
    note: "SQLite rows deleted and local job artifacts removed.",
  });
});

// Route: fetch one job status and artifact paths.
jobsRouter.get("/jobs/:jobId", (req, res) => {
  // We read job id from URL params.
  const { jobId } = req.params;

  // We load job row from DB.
  const job = getJob(jobId);

  // We return 404 if job is unknown.
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  // We enrich the response with engine metadata when it already exists on disk.
  const metadata = loadJobMetadata(job.artifacts.metadataJson);

  // We return typed job payload.
  return res.json({
    ...job,
    metadata: metadata
      ? {
          fps: typeof metadata.fps === "number" ? metadata.fps : undefined,
        }
      : undefined,
  });
});

// Route: list vehicle tracks for leaderboard.
jobsRouter.get("/jobs/:jobId/vehicles", (req, res) => {
  // We read path and query parameters.
  const { jobId } = req.params;
  const sort = String(req.query.sort ?? "maxSpeedKmh");
  const order = req.query.order === "asc" ? "asc" : "desc";

  // We verify job exists before listing tracks.
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  // We fetch sorted tracks from DB.
  const tracks = getVehicleTracks(jobId, sort, order);

  // We return leaderboard data.
  return res.json({ jobId, tracks, sort, order });
});

// Route: fetch one vehicle track detail.
jobsRouter.get("/jobs/:jobId/vehicles/:trackId", (req, res) => {
  // We read IDs from URL params.
  const { jobId, trackId } = req.params;

  // We convert track id to number.
  const numericTrackId = Number(trackId);

  // We validate number parsing result.
  if (!Number.isFinite(numericTrackId)) {
    return res.status(400).json({ error: "trackId must be numeric." });
  }

  // We load one track row from DB.
  const track = getVehicleTrack(jobId, numericTrackId);

  // We return 404 when track is absent.
  if (!track) {
    return res.status(404).json({ error: "Track not found." });
  }

  // We fetch job to locate events artifact file.
  const job = getJob(jobId);

  // We load recent event samples for selected track when available.
  const recentEvents = loadTrackEventSamples(job?.artifacts.eventsJsonl ?? "", numericTrackId);

  // We include basic interpretation hints for UI.
  return res.json({
    jobId,
    track,
    recentEvents,
    snapshots: {
      // MVP does not export image snapshots yet, but field exists for extension.
      available: false,
      reason: "Snapshot export is not implemented in MVP.",
    },
    notes: {
      disclaimer: "Estimare AI pentru divertisment. Nu este masurare legala.",
      speedMethod: "Two-line gate (A->B)",
    },
  });
});
