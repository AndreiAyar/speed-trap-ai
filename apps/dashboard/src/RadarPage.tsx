// Radar page provides a minimal local video upload + preview workflow.
import { useEffect, useState } from "react";

// We keep the mandatory entertainment disclaimer in a single constant.
const RADAR_DISCLAIMER = "Doar pentru divertisment. Nu este masurare legala.";

// Radar page is intentionally simple so we can iterate quickly in later steps.
export function RadarPage() {
  // We store selected local file so we can show metadata and allow re-selection.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // We store object URL used by the video element for local preview playback.
  const [videoUrl, setVideoUrl] = useState<string>("");

  // We regenerate and clean up object URLs whenever selected file changes.
  useEffect(() => {
    // We clear preview when no file is selected.
    if (!selectedFile) {
      setVideoUrl("");
      return;
    }

    // We create a local browser URL for the selected file.
    const objectUrl = URL.createObjectURL(selectedFile);
    setVideoUrl(objectUrl);

    // We release URL memory when file changes or component unmounts.
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  // We render the first minimal radar experience requested by user.
  return (
    <main className="radar-shell">
      <section className="radar-card">
        <p className="eyebrow">Speed Trap AI</p>
        <h1 className="radar-title">Radar Upload</h1>
        <p className="panel-subtitle">
          Incarca un video local si il vezi instant in preview.
        </p>

        <form className="upload-form">
          <label htmlFor="radar-video-input" className="field-label">
            Video input
          </label>
          <input
            id="radar-video-input"
            className="field-input"
            type="file"
            accept="video/*"
            onChange={(event) => {
              // We read first selected file and keep only video files.
              const nextFile = event.currentTarget.files?.[0] ?? null;
              if (nextFile && nextFile.type.startsWith("video/")) {
                setSelectedFile(nextFile);
                return;
              }

              // We clear state when selection is empty or invalid.
              setSelectedFile(null);
            }}
          />
        </form>

        {videoUrl ? (
          <div className="radar-preview-wrap">
            <video className="preview-video" src={videoUrl} controls playsInline />
            <p className="radar-file-name">{selectedFile?.name}</p>
          </div>
        ) : (
          <p className="radar-empty">Niciun video incarcat inca.</p>
        )}

        <p className="disclaimer-text">{RADAR_DISCLAIMER}</p>
      </section>
    </main>
  );
}
