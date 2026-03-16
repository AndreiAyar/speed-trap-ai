// Standalone entrypoint renders only the presentation page for static export.

// We keep StrictMode for parity with the main app entry.
import { StrictMode } from "react";

// We use React 18 root API for mounting.
import { createRoot } from "react-dom/client";

// We reuse the same global theme so the exported presentation stays visually identical.
import "./styles/theme.css";

// We mount only the presentation page, independent of pathname or router logic.
import { PresentationPage } from "./PresentationPage";

// We require the static HTML shell to provide a root node.
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element in presentation.html");
}

// We render the isolated presentation so the build works from any folder or host.
createRoot(rootElement).render(
  <StrictMode>
    <PresentationPage />
  </StrictMode>
);