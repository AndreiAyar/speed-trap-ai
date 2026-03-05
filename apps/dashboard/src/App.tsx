// Main dashboard component orchestrates upload, polling, leaderboard, and preview.

// React hooks manage state and side effects.
import { useEffect, useMemo, useState } from "react";

// We import API helpers and typed payloads.
import { getJob, getVehicle, getVehicles, toArtifactUrl, type JobResponse, type VehicleTrack } from "./lib/api";

// We import UI components used in page layout.
import { JobUpload } from "./components/JobUpload";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { VehicleDetails } from "./components/VehicleDetails";
import { VideoPreview } from "./components/VideoPreview";

// App component is the top-level screen.
export function App() {
  // We store currently active job id from upload action.
  const [jobId, setJobId] = useState<string>("");

  // We store latest job payload from polling endpoint.
  const [job, setJob] = useState<JobResponse | null>(null);

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

  // We poll job status while active job is running.
  useEffect(() => {
    // We skip polling if no job id exists.
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
          setTracks(vehicles.tracks);

          // We auto-select first row for convenience.
          if (vehicles.tracks.length > 0 && selectedTrackId === null) {
            setSelectedTrackId(vehicles.tracks[0].trackId);
          }
        }
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
    </main>
  );
}
