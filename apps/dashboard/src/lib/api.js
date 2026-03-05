// API client helpers centralize HTTP calls for dashboard components.
// We define API base URL with env override for flexibility.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api";
// We define artifact base URL served by API static route.
const ARTIFACT_BASE = (import.meta.env.VITE_ARTIFACT_BASE_URL ?? "http://localhost:8787/artifacts").replace(/\/$/, "");
// This helper checks fetch responses and throws readable errors.
async function parseJsonOrThrow(res) {
    // We parse response body as JSON.
    const data = await res.json();
    // We throw API-provided error when response failed.
    if (!res.ok) {
        throw new Error(data.error ?? "API request failed.");
    }
    // We return typed parsed payload.
    return data;
}
// API call: create processing job.
export async function createJob(payload) {
    const res = await fetch(`${API_BASE}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
}
// API call: fetch one job state.
export async function getJob(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    return parseJsonOrThrow(res);
}
// API call: fetch vehicle leaderboard.
export async function getVehicles(jobId, sort = "maxSpeedKmh", order = "desc") {
    const url = `${API_BASE}/jobs/${jobId}/vehicles?sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}`;
    const res = await fetch(url);
    return parseJsonOrThrow(res);
}
// API call: fetch one vehicle details.
export async function getVehicle(jobId, trackId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/vehicles/${trackId}`);
    return parseJsonOrThrow(res);
}
// Helper converts absolute artifact path to API static URL.
export function toArtifactUrl(absolutePath) {
    // We normalize path separators for browser URLs.
    const normalizedPath = absolutePath.replace(/\\/g, "/");
    // We extract path segment after /data/output/ for static serving.
    const marker = "/data/output/";
    const markerIndex = normalizedPath.indexOf(marker);
    // If marker is missing, we return empty URL to avoid broken links.
    if (markerIndex < 0) {
        return "";
    }
    // We build relative artifact path for server static route.
    const relative = normalizedPath.slice(markerIndex + marker.length);
    // We return final public URL.
    return `${ARTIFACT_BASE}/${relative}`;
}
