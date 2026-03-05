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

// Route: create new processing job.
jobsRouter.post("/jobs", (req, res) => {
  // We parse request body into typed object.
  const body = req.body as CreateJobRequest;

  // We enforce file source type for MVP.
  if (body.sourceType !== "file") {
    return res.status(400).json({ error: "MVP supports only sourceType='file'." });
  }

  // We ensure source path is present.
  if (!body.sourcePath) {
    return res.status(400).json({ error: "sourcePath is required." });
  }

  // We create and queue async job.
  const job = createAndRunJob(body);

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

  // We return typed job payload.
  return res.json(job);
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
