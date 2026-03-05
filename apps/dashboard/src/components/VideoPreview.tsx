// Video preview component shows overlay output after job completion.

// Props include optional public URL.
interface VideoPreviewProps {
  // Public URL for overlay video served by API.
  videoUrl: string;
}

// Preview component renders helpful placeholder when URL is missing.
export function VideoPreview({ videoUrl }: VideoPreviewProps) {
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
      <video className="preview-video" controls src={videoUrl} />
    </section>
  );
}
