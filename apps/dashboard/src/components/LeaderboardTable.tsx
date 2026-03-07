// Leaderboard table component shows detected vehicles sorted by speed.

// React hook memoizes derived sorted rows for UI responsiveness.
import { useMemo } from "react";

// Vehicle type comes from API client contracts.
import type { VehicleTrack } from "../lib/api";

// Component props define rows and selection callback.
interface LeaderboardTableProps {
  // Source rows fetched from backend.
  tracks: VehicleTrack[];
  // Currently selected track id.
  selectedTrackId: number | null;
  // Handler for row click interactions.
  onSelectTrack: (trackId: number) => void;
}

// Table component used by main app layout.
export function LeaderboardTable({ tracks, selectedTrackId, onSelectTrack }: LeaderboardTableProps) {
  // We memoize rows copy to avoid unnecessary allocations every render.
  const rows = useMemo(() => tracks.slice(), [tracks]);

  // We render empty placeholder when no tracks are available.
  if (rows.length === 0) {
    return (
      <section className="panel">
        <h2 className="panel-title">Top viteze detectate</h2>
        <p className="panel-subtitle">Nu exista viteze valide inca. Finalizeaza un job sau ajusteaza liniile/ROI pentru a vedea clasamentul.</p>
      </section>
    );
  }

  // We render leaderboard table with clickable rows.
  return (
    <section className="panel">
      <h2 className="panel-title">Top viteze detectate</h2>
      <p className="panel-subtitle">Se afiseaza doar track-urile cu viteza valida, sortate descrescator dupa viteza maxima estimata.</p>

      <div className="table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Max km/h</th>
              <th>Avg km/h</th>
              <th>Clasa</th>
              <th>A (ms)</th>
              <th>B (ms)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((track) => {
              const isSelected = selectedTrackId === track.trackId;
              return (
                <tr
                  key={track.trackId}
                  className={isSelected ? "row-selected" : ""}
                  onClick={() => onSelectTrack(track.trackId)}
                >
                  <td>{track.trackId}</td>
                  <td>{track.maxSpeedKmh ?? "-"}</td>
                  <td>{track.avgSpeedKmh ?? "-"}</td>
                  <td>{track.classId}</td>
                  <td>{track.crossedAms ?? "-"}</td>
                  <td>{track.crossedBms ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
