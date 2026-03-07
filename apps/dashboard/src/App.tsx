// Main dashboard component orchestrates upload, polling, leaderboard, preview, and history.

// React hooks manage state and side effects.
import { useEffect, useMemo, useState } from "react";

// We import API helpers and typed payloads.
import {
  deleteJob,
  getJob,
  getJobs,
  getVehicle,
  getVehicles,
  toArtifactUrl,
  type JobResponse,
  type VehicleTrack,
} from "./lib/api";

// We import UI components used in page layout.
import { JobUpload } from "./components/JobUpload";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { VehicleDetails } from "./components/VehicleDetails";
import { VideoPreview } from "./components/VideoPreview";
import { RecentJobs } from "./components/RecentJobs";
import { LineCalibrationTool } from "./components/LineCalibrationTool";

// We define localStorage key for restoring selected job after refresh.
const ACTIVE_JOB_STORAGE_KEY = "speedTrap.activeJobId";

// App component is the top-level screen.
export function App() {
  // We store currently active job id from upload action or history click.
  const [jobId, setJobId] = useState<string>("");

  // We store latest job payload from polling endpoint.
  const [job, setJob] = useState<JobResponse | null>(null);

  // We store recent job history from SQLite-backed API.
  const [recentJobs, setRecentJobs] = useState<JobResponse[]>([]);

  // We store fetched leaderboard rows.
  const [tracks, setTracks] = useState<VehicleTrack[]>([]);

  // We store selected row id for detail view.
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

  // We store selected track details.
  const [selectedTrack, setSelectedTrack] = useState<VehicleTrack | null>(null);

  // We store note/disclaimer from track detail endpoint.
  const [trackDisclaimer, setTrackDisclaimer] = useState<string>("Estimare AI pentru divertisment.");

  // We store global page error for API failures.
  const [error, setError] = useState<string | null>(null);

  // This helper loads recent jobs from backend and updates history state.
  const loadRecentJobs = async () => {
    try {
      // We fetch up to 50 latest jobs.
      const list = await getJobs(50);

      // We store recent jobs for UI rendering.
      setRecentJobs(list.jobs);

      // We return fetched list for optional caller decisions.
      return list.jobs;
    } catch (err) {
      // We expose readable error to user when history fetch fails.
      setError(err instanceof Error ? err.message : "Failed to load recent jobs.");
      return [] as JobResponse[];
    }
  };

  // On first mount we restore last selected job or fallback to newest job.
  useEffect(() => {
    // We define bootstrap async flow.
    const bootstrap = async () => {
      // We load job history from API.
      const jobs = await loadRecentJobs();

      // We read previously selected job id from localStorage.
      const storedJobId = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY) ?? "";

      // We restore stored job id when it still exists in history.
      if (storedJobId && jobs.some((entry) => entry.id === storedJobId)) {
        setJobId(storedJobId);
        return;
      }

      // We fallback to latest job when storage is empty/outdated.
      if (jobs.length > 0) {
        setJobId(jobs[0].id);
      }
    };

    // We run bootstrap once.
    void bootstrap();
  }, []);

  // We persist selected job id so refresh keeps the same context.
  useEffect(() => {
    // We store active job id when available.
    if (jobId) {
      window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
    }
  }, [jobId]);

  // We poll active job status and fetch leaderboard when done.
  useEffect(() => {
    // We skip polling if no active job id exists.
    if (!jobId) {
      return;
    }

    // We keep interval id for cleanup.
    let intervalId: number | null = null;

    // We define one poll function reused by interval and initial call.
    const poll = async () => {
      try {
        // We load latest job status from API.
        const latestJob = await getJob(jobId);

        // We store job state for progress and artifact UI.
        setJob(latestJob);

        // We fetch leaderboard once job is complete.
        if (latestJob.status === "done") {
          const vehicles = await getVehicles(jobId, "maxSpeedKmh", "desc");
          // We keep only tracks that produced a final numeric speed.
          const validSpeedTracks = vehicles.tracks.filter((track) => track.maxSpeedKmh !== null);
          setTracks(validSpeedTracks);

          // We clear detail selection when no valid speeds exist for this job.
          if (validSpeedTracks.length === 0) {
            setSelectedTrackId(null);
            setSelectedTrack(null);
          }

          // We auto-select the first valid row when nothing is selected yet.
          if (validSpeedTracks.length > 0 && selectedTrackId === null) {
            setSelectedTrackId(validSpeedTracks[0].trackId);
          }

          // We repair selection when previously selected row no longer exists after filtering.
          if (
            selectedTrackId !== null &&
            !validSpeedTracks.some((track) => track.trackId === selectedTrackId)
          ) {
            setSelectedTrackId(validSpeedTracks[0]?.trackId ?? null);
          }
        }

        // We clear stale leaderboard when job failed.
        if (latestJob.status === "failed") {
          setTracks([]);
          setSelectedTrackId(null);
          setSelectedTrack(null);
        }

        // We refresh sidebar history to reflect updated status/progress.
        const jobs = await getJobs(50);
        setRecentJobs(jobs.jobs);
      } catch (err) {
        // We map errors to readable banner text.
        setError(err instanceof Error ? err.message : "Polling failed.");
      }
    };

    // We start one immediate poll for responsive UI.
    void poll();

    // We continue polling every 1500ms during processing.
    intervalId = window.setInterval(() => {
      void poll();
    }, 1500);

    // Cleanup clears polling interval on dependency change.
    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [jobId, selectedTrackId]);

  // We fetch selected track details whenever selection changes.
  useEffect(() => {
    // We skip detail request when missing required ids.
    if (!jobId || selectedTrackId === null) {
      return;
    }

    // We define async load function.
    const loadTrack = async () => {
      try {
        // We fetch detailed data for selected track.
        const detail = await getVehicle(jobId, selectedTrackId);

        // We store selected track payload.
        setSelectedTrack(detail.track);

        // We store disclaimer note from API.
        setTrackDisclaimer(detail.notes.disclaimer ?? "Estimare AI pentru divertisment.");
      } catch (err) {
        // We map errors to readable message.
        setError(err instanceof Error ? err.message : "Failed to load track.");
      }
    };

    // We run detail fetch.
    void loadTrack();
  }, [jobId, selectedTrackId]);

  // We derive overlay URL once job artifacts are present.
  const overlayUrl = useMemo(() => {
    // We return empty URL when job is not ready.
    if (!job?.artifacts?.overlayVideo) {
      return "";
    }

    // We map absolute path into API artifact URL.
    return toArtifactUrl(job.artifacts.overlayVideo);
  }, [job?.artifacts?.overlayVideo]);

  // We render dashboard page layout.
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Timisoara Traffic Lab</p>
        <h1>Speed Trap AI Dashboard</h1>
        <p className="hero-copy">
          Pipeline offline cu YOLO26n + ByteTrack + poarta A→B pentru estimare viteza.
        </p>
      </header>

      <section className="status-strip">
        <div className="status-pill">
          <span className="status-label">Job:</span>
          <strong>{jobId || "niciun job"}</strong>
        </div>
        <div className="status-pill">
          <span className="status-label">Status:</span>
          <strong>{job?.status ?? "idle"}</strong>
        </div>
        <div className="status-pill">
          <span className="status-label">Progress:</span>
          <strong>{job?.progress ?? 0}%</strong>
        </div>
      </section>

      {error ? <p className="error-banner">Eroare API: {error}</p> : null}

      <div className="layout-grid">
        <JobUpload
          onJobCreated={(newJobId) => {
            // We reset stale state when starting a new job.
            setJobId(newJobId);
            setTracks([]);
            setSelectedTrackId(null);
            setSelectedTrack(null);
            setJob(null);
            setError(null);
            // We refresh history after creating a new job.
            void loadRecentJobs();
          }}
        />

        <RecentJobs
          jobs={recentJobs}
          activeJobId={jobId}
          onSelectJob={(selectedJobId) => {
            // We switch entire context to selected history job.
            setJobId(selectedJobId);
            setTracks([]);
            setSelectedTrackId(null);
            setSelectedTrack(null);
            setError(null);
          }}
          onDeleteJob={(deletedJobId) => {
            // We run async delete flow without blocking UI thread.
            void (async () => {
              try {
                // We call backend deletion endpoint.
                await deleteJob(deletedJobId);

                // We reload history after successful deletion.
                const refreshedJobs = await loadRecentJobs();

                // If deleted job was active, we move context to next available job.
                if (deletedJobId === jobId) {
                  const nextJobId = refreshedJobs.length > 0 ? refreshedJobs[0].id : "";
                  setJobId(nextJobId);

                  // We reset stale UI state tied to removed job.
                  setJob(null);
                  setTracks([]);
                  setSelectedTrackId(null);
                  setSelectedTrack(null);

                  // We clear stored active id when no jobs remain.
                  if (!nextJobId) {
                    window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
                  }
                }
              } catch (err) {
                // We expose readable error when deletion fails.
                setError(err instanceof Error ? err.message : "Failed to delete job.");
              }
            })();
          }}
        />

        <VideoPreview videoUrl={overlayUrl} />

        <LeaderboardTable
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={(trackId) => setSelectedTrackId(trackId)}
        />

        <VehicleDetails track={selectedTrack} disclaimer={trackDisclaimer} />
      </div>

      <LineCalibrationTool suggestedUrl={overlayUrl} />
    </main>
  );
}
