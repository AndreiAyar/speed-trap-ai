// This file defines shared API contract types for predictable payloads.

// Status values describe one job lifecycle state.
export type JobStatus = "queued" | "running" | "done" | "failed";

// Request payload for creating a processing job.
export interface CreateJobRequest {
  // Source type allows future expansion to live mode.
  sourceType: "file" | "live";
  // Path or URL depending on source type.
  sourcePath: string;
  // Camera config id maps to engine config file.
  cameraConfigId?: string;
}

// Job artifact paths produced by Python engine.
export interface JobArtifacts {
  // Overlay video with lines, labels, and disclaimer.
  overlayVideo?: string;
  // Track summary CSV for quick import and analysis.
  summaryCsv?: string;
  // Event timeline JSONL for detailed inspection.
  eventsJsonl?: string;
  // Metadata JSON emitted by engine.
  metadataJson?: string;
}

// Core job structure used by API responses.
export interface JobRecord {
  // Unique job id used as lookup key.
  id: string;
  // Current job status value.
  status: JobStatus;
  // Original source path provided by user.
  sourcePath: string;
  // Optional error details when status is failed.
  errorMessage?: string;
  // Progress percentage for UI progress display.
  progress: number;
  // Artifact paths after completion.
  artifacts: JobArtifacts;
  // Timestamp when job was created.
  createdAt: string;
  // Timestamp when job finished or failed.
  finishedAt?: string;
}

// Vehicle row structure sent to leaderboard UI.
export interface VehicleTrack {
  // Track id from tracker.
  trackId: number;
  // Class id from detector.
  classId: number;
  // Highest observed estimated speed.
  maxSpeedKmh: number | null;
  // Average estimated speed.
  avgSpeedKmh: number | null;
  // First time this track was seen.
  firstSeenMs: number;
  // Last time this track was seen.
  lastSeenMs: number;
  // Timestamp when line A crossing was detected.
  crossedAms: number | null;
  // Timestamp when line B crossing was detected.
  crossedBms: number | null;
  // Number of speed samples collected.
  numSamples: number;
}
