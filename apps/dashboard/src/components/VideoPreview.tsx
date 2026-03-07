// React hooks let us control the player when the user selects a vehicle.
import { useEffect, useRef } from "react";

// Video preview component shows overlay output after job completion.

// Props include optional public URL.
interface VideoPreviewProps {
  // Public URL for overlay video served by API.
  videoUrl: string;
  // Optional timestamp where the player should jump for the selected vehicle.
  seekTargetMs?: number | null;
  // This key changes on every row click, even when the same row is clicked again.
  seekRequestKey?: number;
}

// Preview component renders helpful placeholder when URL is missing.
export function VideoPreview({ videoUrl, seekTargetMs = null, seekRequestKey = 0 }: VideoPreviewProps) {
  // We keep direct access to the native video element for seeking.
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // We remember a pending seek when metadata is not ready yet.
  const pendingSeekSecondsRef = useRef<number | null>(null);

  // This helper seeks safely once duration and metadata are available.
  const applySeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // We clamp target to the known video duration when available.
    const duration = Number.isFinite(video.duration) ? video.duration : seconds;
    const safeSeconds = Math.max(0, Math.min(seconds, duration || seconds));

    // We jump player to requested position and keep playback paused for inspection.
    video.currentTime = safeSeconds;
    video.pause();
  };

  // We jump to the requested timestamp whenever user selects a leaderboard row.
  useEffect(() => {
    if (!videoUrl || seekTargetMs === null || seekTargetMs < 0) {
      return;
    }

    const targetSeconds = seekTargetMs / 1000;
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // If metadata is already available, we can seek immediately.
    if (video.readyState >= 1) {
      applySeek(targetSeconds);
      pendingSeekSecondsRef.current = null;
      return;
    }

    // Otherwise we store the target until metadata finishes loading.
    pendingSeekSecondsRef.current = targetSeconds;
  }, [seekRequestKey, seekTargetMs, videoUrl]);

  // We show instructions before job completion.
  if (!videoUrl) {
    return (
      <section className="panel">
        <h2 className="panel-title">Preview overlay</h2>
        <p className="panel-subtitle">Dupa finalizarea job-ului, aici apare video-ul procesat.</p>
      </section>
    );
  }

  // We render HTML video player for generated output.
  return (
    <section className="panel">
      <h2 className="panel-title">Preview overlay</h2>
      <video
        ref={videoRef}
        className="preview-video"
        controls
        src={videoUrl}
        onLoadedMetadata={() => {
          // We apply deferred seek once the browser knows video timing data.
          if (pendingSeekSecondsRef.current !== null) {
            applySeek(pendingSeekSecondsRef.current);
            pendingSeekSecondsRef.current = null;
          }
        }}
      />
    </section>
  );
}
