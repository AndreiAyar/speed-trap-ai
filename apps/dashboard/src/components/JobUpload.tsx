// Upload/start panel component for creating processing jobs.

// React hooks manage form state and submission flow.
import { useState } from "react";

// API helpers create jobs.
import { createJob } from "../lib/api";

// Component props define callback after job creation.
interface JobUploadProps {
  // Callback receives newly created job id.
  onJobCreated: (jobId: string) => void;
}

// We export upload component used on main page.
export function JobUpload({ onJobCreated }: JobUploadProps) {
  // We keep source path input as local state.
  const [sourcePath, setSourcePath] = useState("/Users/ayar/Personal Dev/speed-trap-ai/data/input/sample.mp4");

  // We track loading state for submit button.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // We track optional error message for user feedback.
  const [error, setError] = useState<string | null>(null);

  // Submit handler creates a job and emits job id to parent.
  const handleSubmit = async (event: React.FormEvent) => {
    // We prevent browser default form submission behavior.
    event.preventDefault();

    // We clear previous error before new request.
    setError(null);

    // We enable loading state while request is in flight.
    setIsSubmitting(true);

    try {
      // We send create job request to API.
      const res = await createJob({
        sourceType: "file",
        sourcePath,
        cameraConfigId: "camera.default",
      });

      // We notify parent so polling can begin.
      onJobCreated(res.jobId);
    } catch (err) {
      // We map unknown errors into readable string.
      setError(err instanceof Error ? err.message : "Failed to create job.");
    } finally {
      // We disable loading state after request settles.
      setIsSubmitting(false);
    }
  };

  // We render job creation panel.
  return (
    <section className="panel panel-upload">
      <h2 className="panel-title">Lanseaza analiza video</h2>
      <p className="panel-subtitle">
        Introdu calea fisierului MP4 si porneste analiza cu metoda pe doua linii (A→B).
      </p>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="sourcePath">
          Cale fisier video
        </label>
        <input
          id="sourcePath"
          className="field-input"
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          placeholder="/absolute/path/to/video.mp4"
          required
        />

        <button className="btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Pornire job..." : "Porneste procesare"}
        </button>
      </form>

      {error ? <p className="error-text">Eroare: {error}</p> : null}

      <p className="disclaimer-text">
        Estimare AI pentru divertisment. Nu este masurare legala.
      </p>
    </section>
  );
}
