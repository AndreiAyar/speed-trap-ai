import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// This component renders a compact list of recent jobs.
export function RecentJobs({ jobs, activeJobId, onSelectJob }) {
    // We render empty-state helper when no jobs exist.
    if (jobs.length === 0) {
        return (_jsxs("section", { className: "panel", children: [_jsx("h2", { className: "panel-title", children: "Joburi recente" }), _jsx("p", { className: "panel-subtitle", children: "Inca nu exista joburi salvate." })] }));
    }
    // We render clickable history rows.
    return (_jsxs("section", { className: "panel", children: [_jsx("h2", { className: "panel-title", children: "Joburi recente" }), _jsx("p", { className: "panel-subtitle", children: "Datele vin din SQLite, deci raman dupa refresh." }), _jsx("div", { className: "jobs-list", children: jobs.map((job) => {
                    // We check if this row is currently selected.
                    const isActive = job.id === activeJobId;
                    // We create human-friendly timestamp string.
                    const createdLabel = new Date(job.createdAt).toLocaleString();
                    return (_jsxs("button", { type: "button", className: `job-item ${isActive ? "job-item-active" : ""}`, onClick: () => onSelectJob(job.id), children: [_jsx("span", { className: "job-item-id", children: job.id }), _jsx("span", { className: "job-item-status", children: job.status }), _jsx("span", { className: "job-item-date", children: createdLabel })] }, job.id));
                }) })] }));
}
