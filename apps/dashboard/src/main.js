import { jsx as _jsx } from "react/jsx-runtime";
// React entrypoint mounts the App component into #root.
// We import StrictMode for development checks.
import { StrictMode } from "react";
// We import createRoot for React 18 rendering.
import { createRoot } from "react-dom/client";
// We import global theme styles.
import "./styles/theme.css";
// We import main dashboard component.
import { App } from "./App";
// We find root DOM element and assert it exists.
const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Missing #root element in index.html");
}
// We create React root and render application tree.
createRoot(rootElement).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
