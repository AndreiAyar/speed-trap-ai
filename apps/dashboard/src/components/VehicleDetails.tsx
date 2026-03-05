// Track detail card explains selected vehicle metrics in plain language.

// Vehicle shape imported from API type contract.
import type { VehicleTrack } from "../lib/api";

// Props include optional selected track and notes.
interface VehicleDetailsProps {
  // Selected track data loaded from API.
  track: VehicleTrack | null;
  // Optional note text from backend.
  disclaimer?: string;
}

// Details component provides a readable single-track summary.
export function VehicleDetails({ track, disclaimer }: VehicleDetailsProps) {
  // We render helper text when nothing is selected.
  if (!track) {
    return (
      <section className="panel">
        <h2 className="panel-title">Detalii vehicul</h2>
        <p className="panel-subtitle">Selecteaza un rand din tabel pentru a vedea detalii.</p>
      </section>
    );
  }

  // We render selected track metrics.
  return (
    <section className="panel">
      <h2 className="panel-title">Detalii vehicul ID {track.trackId}</h2>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">Viteza maxima</span>
          <span className="stat-value">{track.maxSpeedKmh ?? "-"} km/h</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Viteza medie</span>
          <span className="stat-value">{track.avgSpeedKmh ?? "-"} km/h</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Primul frame (ms)</span>
          <span className="stat-value">{track.firstSeenMs}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Ultimul frame (ms)</span>
          <span className="stat-value">{track.lastSeenMs}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Trecere Linia A</span>
          <span className="stat-value">{track.crossedAms ?? "-"}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Trecere Linia B</span>
          <span className="stat-value">{track.crossedBms ?? "-"}</span>
        </div>
      </div>

      <p className="disclaimer-text">{disclaimer ?? "Estimare AI pentru divertisment."}</p>
    </section>
  );
}
