// This module wraps SQLite setup and simple data access helpers.

// We import path utilities to create stable absolute DB paths.
import path from "node:path";
import { fileURLToPath } from "node:url";

// We import fs so we can ensure target folders exist.
import fs from "node:fs";

// We import Node's built-in SQLite support to avoid native addon setup pain.
import { DatabaseSync } from "node:sqlite";

// We import shared types for return payload safety.
import type { JobRecord, JobStatus, VehicleTrack } from "../types/contracts.js";

// We compute current file path for reliable root resolution.
const currentFilePath = fileURLToPath(import.meta.url);

// We compute current directory from file path.
const currentDir = path.dirname(currentFilePath);

// We compute workspace root from source file location.
const workspaceRoot = path.resolve(currentDir, "../../../../");

// We compute path for local SQLite DB file.
const dbPath = path.join(workspaceRoot, "data", "speed-trap.sqlite");

// We ensure data folder exists before opening database.
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// We open SQLite database in default mode.
const db = new DatabaseSync(dbPath);

// We initialize schema once at module load.
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    source_path TEXT NOT NULL,
    progress INTEGER NOT NULL,
    artifacts_json TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS vehicle_tracks (
    job_id TEXT NOT NULL,
    track_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    max_speed_kmh REAL,
    avg_speed_kmh REAL,
    first_seen_ms REAL NOT NULL,
    last_seen_ms REAL NOT NULL,
    crossed_a_ms REAL,
    crossed_b_ms REAL,
    num_samples INTEGER NOT NULL,
    PRIMARY KEY (job_id, track_id)
  );
`);

// This helper inserts a new job row.
export function insertJob(job: JobRecord): void {
  // We create prepared statement for insertion.
  const stmt = db.prepare(`
    INSERT INTO jobs (id, status, source_path, progress, artifacts_json, error_message, created_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // We execute insert with serialized artifacts object.
  stmt.run(
    job.id,
    job.status,
    job.sourcePath,
    job.progress,
    JSON.stringify(job.artifacts),
    job.errorMessage ?? null,
    job.createdAt,
    job.finishedAt ?? null
  );
}

// This helper updates job state and artifacts as processing changes.
export function updateJob(job: JobRecord): void {
  // We create prepared statement for updates.
  const stmt = db.prepare(`
    UPDATE jobs
    SET status = ?,
        progress = ?,
        artifacts_json = ?,
        error_message = ?,
        finished_at = ?
    WHERE id = ?
  `);

  // We run update query with safe null handling.
  stmt.run(
    job.status,
    job.progress,
    JSON.stringify(job.artifacts),
    job.errorMessage ?? null,
    job.finishedAt ?? null,
    job.id
  );
}

// This helper fetches one job by id.
export function getJob(id: string): JobRecord | null {
  // We query single row from jobs table.
  const row = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;

  // We return null when job id is not found.
  if (!row) {
    return null;
  }

  // We map DB row into typed API shape.
  return {
    id: row.id,
    status: row.status as JobStatus,
    sourcePath: row.source_path,
    progress: row.progress,
    artifacts: JSON.parse(row.artifacts_json),
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? undefined,
  };
}

// This helper stores leaderboard rows for one job.
export function replaceVehicleTracks(jobId: string, tracks: VehicleTrack[]): void {
  // We remove old rows first to avoid stale data.
  db.prepare(`DELETE FROM vehicle_tracks WHERE job_id = ?`).run(jobId);

  // We prepare insert statement once for performance and clarity.
  const insert = db.prepare(`
    INSERT INTO vehicle_tracks (
      job_id, track_id, class_id, max_speed_kmh, avg_speed_kmh,
      first_seen_ms, last_seen_ms, crossed_a_ms, crossed_b_ms, num_samples
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // We insert each track row.
  for (const track of tracks) {
    insert.run(
      jobId,
      track.trackId,
      track.classId,
      track.maxSpeedKmh,
      track.avgSpeedKmh,
      track.firstSeenMs,
      track.lastSeenMs,
      track.crossedAms,
      track.crossedBms,
      track.numSamples
    );
  }
}

// This helper returns sorted vehicle tracks for one job.
export function getVehicleTracks(jobId: string, sort: string = "maxSpeedKmh", order: "asc" | "desc" = "desc"): VehicleTrack[] {
  // We whitelist sortable columns to prevent SQL injection.
  const columnMap: Record<string, string> = {
    trackId: "track_id",
    classId: "class_id",
    maxSpeedKmh: "max_speed_kmh",
    avgSpeedKmh: "avg_speed_kmh",
    firstSeenMs: "first_seen_ms",
    lastSeenMs: "last_seen_ms",
  };

  // We choose default safe sort column when unknown key is requested.
  const sortColumn = columnMap[sort] ?? "max_speed_kmh";

  // We normalize order to ASC/DESC.
  const sortOrder = order === "asc" ? "ASC" : "DESC";

  // We run sorted query and map to API field names.
  const rows = db
    .prepare(
      `SELECT * FROM vehicle_tracks WHERE job_id = ? ORDER BY ${sortColumn} ${sortOrder}, track_id ASC`
    )
    .all(jobId) as any[];

  // We map raw DB rows into typed objects.
  return rows.map((row) => ({
    trackId: row.track_id,
    classId: row.class_id,
    maxSpeedKmh: row.max_speed_kmh,
    avgSpeedKmh: row.avg_speed_kmh,
    firstSeenMs: row.first_seen_ms,
    lastSeenMs: row.last_seen_ms,
    crossedAms: row.crossed_a_ms,
    crossedBms: row.crossed_b_ms,
    numSamples: row.num_samples,
  }));
}

// This helper returns one track for detail view.
export function getVehicleTrack(jobId: string, trackId: number): VehicleTrack | null {
  // We query one row by job and track id.
  const row = db
    .prepare(`SELECT * FROM vehicle_tracks WHERE job_id = ? AND track_id = ?`)
    .get(jobId, trackId) as any;

  // We return null when track does not exist.
  if (!row) {
    return null;
  }

  // We map DB row to API shape.
  return {
    trackId: row.track_id,
    classId: row.class_id,
    maxSpeedKmh: row.max_speed_kmh,
    avgSpeedKmh: row.avg_speed_kmh,
    firstSeenMs: row.first_seen_ms,
    lastSeenMs: row.last_seen_ms,
    crossedAms: row.crossed_a_ms,
    crossedBms: row.crossed_b_ms,
    numSamples: row.num_samples,
  };
}
