import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Leaderboard table component shows detected vehicles sorted by speed.
// React hook memoizes derived sorted rows for UI responsiveness.
import { useMemo } from "react";
// Table component used by main app layout.
export function LeaderboardTable({ tracks, selectedTrackId, onSelectTrack }) {
    // We memoize rows copy to avoid unnecessary allocations every render.
    const rows = useMemo(() => tracks.slice(), [tracks]);
    // We render empty placeholder when no tracks are available.
    if (rows.length === 0) {
        return (_jsxs("section", { className: "panel", children: [_jsx("h2", { className: "panel-title", children: "Top viteze detectate" }), _jsx("p", { className: "panel-subtitle", children: "Nu exista date inca. Finalizeaza un job pentru a vedea clasamentul." })] }));
    }
    // We render leaderboard table with clickable rows.
    return (_jsxs("section", { className: "panel", children: [_jsx("h2", { className: "panel-title", children: "Top viteze detectate" }), _jsx("p", { className: "panel-subtitle", children: "Sortat descrescator dupa viteza maxima estimata." }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "leaderboard-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "ID" }), _jsx("th", { children: "Max km/h" }), _jsx("th", { children: "Avg km/h" }), _jsx("th", { children: "Clasa" }), _jsx("th", { children: "A (ms)" }), _jsx("th", { children: "B (ms)" })] }) }), _jsx("tbody", { children: rows.map((track) => {
                                const isSelected = selectedTrackId === track.trackId;
                                return (_jsxs("tr", { className: isSelected ? "row-selected" : "", onClick: () => onSelectTrack(track.trackId), children: [_jsx("td", { children: track.trackId }), _jsx("td", { children: track.maxSpeedKmh ?? "-" }), _jsx("td", { children: track.avgSpeedKmh ?? "-" }), _jsx("td", { children: track.classId }), _jsx("td", { children: track.crossedAms ?? "-" }), _jsx("td", { children: track.crossedBms ?? "-" })] }, track.trackId));
                            }) })] }) })] }));
}
