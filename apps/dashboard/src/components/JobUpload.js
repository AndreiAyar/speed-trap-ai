import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Upload/start panel component for creating processing jobs.
// React hooks manage form state and submission flow.
import { useState } from "react";
// API helpers create jobs.
import { createJob } from "../lib/api";
// We export upload component used on main page.
export function JobUpload({ onJobCreated }) {
    // We keep source path input as local state.
    const [sourcePath, setSourcePath] = useState("data/input/sample.mp4");
    // We track loading state for submit button.
    const [isSubmitting, setIsSubmitting] = useState(false);
    // We track optional error message for user feedback.
    const [error, setError] = useState(null);
    // Submit handler creates a job and emits job id to parent.
    const handleSubmit = async (event) => {
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
        }
        catch (err) {
            // We map unknown errors into readable string.
            setError(err instanceof Error ? err.message : "Failed to create job.");
        }
        finally {
            // We disable loading state after request settles.
            setIsSubmitting(false);
        }
    };
    // We render job creation panel.
    return (_jsxs("section", { className: "panel panel-upload", children: [_jsx("h2", { className: "panel-title", children: "Lanseaza analiza video" }), _jsx("p", { className: "panel-subtitle", children: "Introdu calea fisierului MP4 si porneste analiza cu metoda pe doua linii (A\u2192B)." }), _jsxs("form", { className: "upload-form", onSubmit: handleSubmit, children: [_jsx("label", { className: "field-label", htmlFor: "sourcePath", children: "Cale fisier video" }), _jsx("input", { id: "sourcePath", className: "field-input", value: sourcePath, onChange: (e) => setSourcePath(e.target.value), placeholder: "/absolute/path/to/video.mp4", required: true }), _jsx("button", { className: "btn-primary", type: "submit", disabled: isSubmitting, children: isSubmitting ? "Pornire job..." : "Porneste procesare" })] }), error ? _jsxs("p", { className: "error-text", children: ["Eroare: ", error] }) : null, _jsx("p", { className: "disclaimer-text", children: "Estimare AI pentru divertisment. Nu este masurare legala." })] }));
}
