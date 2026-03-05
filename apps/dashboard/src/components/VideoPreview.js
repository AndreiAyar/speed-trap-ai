import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Preview component renders helpful placeholder when URL is missing.
export function VideoPreview({ videoUrl }) {
    // We show instructions before job completion.
    if (!videoUrl) {
        return (_jsxs("section", { className: "panel", children: [_jsx("h2", { className: "panel-title", children: "Preview overlay" }), _jsx("p", { className: "panel-subtitle", children: "Dupa finalizarea job-ului, aici apare video-ul procesat." })] }));
    }
    // We render HTML video player for generated output.
    return (_jsxs("section", { className: "panel", children: [_jsx("h2", { className: "panel-title", children: "Preview overlay" }), _jsx("video", { className: "preview-video", controls: true, src: videoUrl })] }));
}
