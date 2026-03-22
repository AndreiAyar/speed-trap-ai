// Standalone entrypoint renders only the radar upload page for static export.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import { RadarPage } from "./RadarPage";

// We require the static HTML shell root node.
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element in radar.html");
}

// We render only the radar page so this build can be deployed as a single page.
createRoot(rootElement).render(
  <StrictMode>
    <RadarPage />
  </StrictMode>
);
