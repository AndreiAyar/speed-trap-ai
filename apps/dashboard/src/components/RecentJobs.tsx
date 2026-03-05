// Recent jobs panel helps users reopen previous analyses after refresh.

// We import JobResponse type for typed rows.
import type { JobResponse } from "../lib/api";

// Props define list items, active selection, and click callback.
interface RecentJobsProps {
  // Recent jobs from API.
  jobs: JobResponse[];
  // Active selected job id.
  activeJobId: string;
  // Callback for selecting one job from history.
  onSelectJob: (jobId: string) => void;
  // Callback for deleting one job entry from history.
  onDeleteJob: (jobId: string) => void;
}

// This component renders a compact list of recent jobs.
export function RecentJobs({ jobs, activeJobId, onSelectJob, onDeleteJob }: RecentJobsProps) {
  // We render empty-state helper when no jobs exist.
  if (jobs.length === 0) {
    return (
      <section className="panel">
        <h2 className="panel-title">Joburi recente</h2>
        <p className="panel-subtitle">Inca nu exista joburi salvate.</p>
      </section>
    );
  }

  // We render clickable history rows.
  return (
    <section className="panel">
      <h2 className="panel-title">Joburi recente</h2>
      <p className="panel-subtitle">Datele vin din SQLite, deci raman dupa refresh.</p>

      <div className="jobs-list">
        {jobs.map((job) => {
          // We check if this row is currently selected.
          const isActive = job.id === activeJobId;

          // We create human-friendly timestamp string.
          const createdLabel = new Date(job.createdAt).toLocaleString();

          return (
            <div
              key={job.id}
              className={`job-item ${isActive ? "job-item-active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectJob(job.id)}
              onKeyDown={(event) => {
                // We support keyboard activation for accessibility.
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectJob(job.id);
                }
              }}
            >
              <span className="job-item-id">{job.id}</span>
              <span className="job-item-status">{job.status}</span>
              <span className="job-item-date">{createdLabel}</span>
              <button
                type="button"
                className="job-delete-btn"
                onClick={(event) => {
                  // We prevent row select when clicking delete.
                  event.stopPropagation();

                  // We ask for explicit confirmation before deleting files.
                  const ok = window.confirm(
                    `Delete ${job.id} and remove its output video/files from disk?`
                  );
                  if (ok) {
                    onDeleteJob(job.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
